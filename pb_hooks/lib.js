// Общие функции для хуков. В обработчиках PocketBase код верхнего уровня файла
// недоступен, поэтому каждый обработчик подключает этот файл через require.

const MB = 1024 * 1024;

function quotaBytes() {
  return (parseInt($os.getenv("USER_QUOTA_MB"), 10) || 250) * MB;
}

// Сколько места уже заняли файлы нужд и фото нужд и подразделов пользователя.
// Запись exceptId из коллекции exceptCol не считается: её размер сейчас пересчитывается.
function usedBytes(ownerId, exceptCol, exceptId) {
  const parts = [["need_files", "size"], ["needs", "photo_size"], ["sections", "photo_size"]];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const col = parts[i][0];
    const m = new DynamicModel({ total: 0 });
    let q = $app.db().select(`COALESCE(SUM(${parts[i][1]}), 0) as total`).from(col)
      .where($dbx.hashExp({ owner: ownerId }));
    if (exceptId && exceptCol === col) q = q.andWhere($dbx.not($dbx.hashExp({ id: exceptId })));
    q.one(m);
    total += m.total;
  }
  return total;
}

function checkQuota(ownerId, add, exceptCol, exceptId) {
  if (usedBytes(ownerId, exceptCol, exceptId) + add > quotaBytes()) {
    const mb = Math.round(quotaBytes() / MB);
    throw new BadRequestError(`Место для фото и файлов закончилось: на одного пользователя ${mb} МБ. Удалите ненужные файлы.`);
  }
}

// Раздел кладут только в раздел с главной, и только если у него самого нет подразделов.
function checkSectionDepth(e) {
  const parentId = e.record.getString("parent");
  if (!parentId) return;
  if (parentId === e.record.id) throw new BadRequestError("Раздел не может лежать внутри самого себя.");
  let parent;
  try { parent = $app.findRecordById("sections", parentId); } catch (_) { throw new BadRequestError("Раздел, внутрь которого вы кладёте этот, не найден."); }
  if (parent.getString("parent")) throw new BadRequestError("Подраздел можно создать только внутри раздела с главной: глубже двух уровней нельзя.");
  if (!e.record.isNew() && $app.countRecords("sections", $dbx.hashExp({ parent: e.record.id })) > 0) {
    throw new BadRequestError("У этого раздела есть подразделы, поэтому его нельзя положить внутрь другого раздела.");
  }
}

// Размер уже сохранённого файла записи.
function storedSize(record, name) {
  const fsys = $app.newFilesystem();
  try {
    return fsys.attributes(record.baseFilesPath() + "/" + name).size;
  } catch (_) {
    return 0;
  } finally {
    fsys.close();
  }
}

// Фото нужды или подраздела: исходник (photo) и круглый вариант (photo_round).
// Без исходника круглого варианта нет. Размер обоих считает сервер и проверяет лимит.
const PHOTO_FIELDS = ["photo", "photo_round"];
function recordPhoto(e, col) {
  const r = e.record;
  const orig = r.isNew() ? null : r.original();
  // у только что загруженного файла getString пока пустой, поэтому смотрим и getUnsavedFiles
  if (!r.getString("photo") && !r.getUnsavedFiles("photo").length) {
    r.set("photo_round", "");
    r.set("photo_crop", null);
  }
  let changed = !orig;
  for (const f of PHOTO_FIELDS) {
    if (r.getUnsavedFiles(f).length || (orig && r.getString(f) !== orig.getString(f))) changed = true;
  }
  if (!changed) {
    r.set("photo_size", orig.getInt("photo_size"));
    return;
  }
  let total = 0;
  for (const f of PHOTO_FIELDS) {
    const files = r.getUnsavedFiles(f);
    if (files.length) for (const file of files) total += file.size;
    else if (r.getString(f) && orig) total += storedSize(orig, r.getString(f));
  }
  // когда фото убирают или оно становится меньше, лимит не мешает
  if (total > (orig ? orig.getInt("photo_size") : 0)) checkQuota(e.auth.id, total, col, orig ? r.id : "");
  r.set("photo_size", total);
}

// Отметку дня ставят и снимают только за сегодня, вчера и позавчера (по часам телефона).
// Сервер разрешает от 3 дней назад до 1 дня вперёд: запас на разницу часовых поясов.
function checkDayDate(date) {
  const day = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
  if (!date || date < day(-3) || date > day(1)) {
    throw new BadRequestError("Отмечать дни молитвы можно только за сегодня, вчера и позавчера.");
  }
}

// Стих, который каждый новый пользователь сразу видит в «Моих стихах».
const DEFAULT_VERSE = {
  text: "И не жаждут они в пустынях, через которые Он ведет их: Он источает им воду из камня; рассекает скалу, и льются воды.",
  ref: "Исаия 48:21",
};
function addDefaultVerse(userId) {
  const r = new Record($app.findCollectionByNameOrId("verses"));
  r.set("owner", userId);
  r.set("text", DEFAULT_VERSE.text);
  r.set("ref", DEFAULT_VERSE.ref);
  r.set("sort", 0);
  $app.save(r);
}

function checkSection(e) {
  checkSectionDepth(e);
  recordPhoto(e, "sections");
}

const FILE_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

/* ---------- Группы ---------- */
const MAX_MEMBERS = 20; // участников в группе
const MAX_GROUPS = 10;  // групп у одного человека

// Код ссылки-приглашения в группу: 24 случайных символа без похожих (0/o, 1/l)
function newGroupCode() {
  return $security.randomStringWithAlphabet(24, "abcdefghijkmnpqrstuvwxyz23456789");
}

function isMember(app, groupId, userId) {
  return app.countRecords("group_members", $dbx.hashExp({ group: groupId, user: userId })) > 0;
}

// Группа, в которой пользователь участник; иначе ошибка «не найдена» (чужие группы не выдаём)
function memberGroup(app, groupId, userId) {
  let g = null;
  try { g = app.findRecordById("groups", groupId); } catch (_) {}
  if (!g || !isMember(app, g.id, userId)) throw new NotFoundError("Группа не найдена: возможно, её удалили или вас из неё исключили.");
  return g;
}

function ownGroup(app, groupId, userId) {
  const g = memberGroup(app, groupId, userId);
  if (g.getString("owner") !== userId) throw new ForbiddenError("Это может сделать только создатель группы.");
  return g;
}

// Группа по коду из ссылки-приглашения
function groupByCode(app, code) {
  code = String(code || "").trim().toLowerCase();
  let g = null;
  if (code.length >= 16) {
    try { g = app.findFirstRecordByData("groups", "invite_code", code); } catch (_) {}
  }
  if (!g) throw new NotFoundError("Ссылка не работает: возможно, создатель группы сделал новую. Попросите прислать свежую ссылку.");
  return g;
}

function checkGroupLimit(app, userId) {
  if (app.countRecords("group_members", $dbx.hashExp({ user: userId })) >= MAX_GROUPS) {
    throw new BadRequestError(`Можно состоять не больше чем в ${MAX_GROUPS} группах. Чтобы вступить в новую, выйдите из одной из старых.`);
  }
}

function addMember(app, groupId, userId) {
  const m = new Record(app.findCollectionByNameOrId("group_members"));
  m.set("group", groupId);
  m.set("user", userId);
  app.save(m);
}

// Человек выходит или его исключают: его нужды пропадают из группы, его отметки молитвы в группе удаляются.
// В его личном дневнике всё остаётся.
function removeMember(app, groupId, userId) {
  for (const r of app.findAllRecords("group_needs", $dbx.hashExp({ group: groupId, added_by: userId }))) app.delete(r);
  for (const r of app.findAllRecords("group_praying", $dbx.hashExp({ group: groupId, user: userId }))) app.delete(r);
  for (const r of app.findAllRecords("group_days", $dbx.hashExp({ group: groupId, user: userId }))) app.delete(r);
  for (const r of app.findAllRecords("group_members", $dbx.hashExp({ group: groupId, user: userId }))) app.delete(r);
}

// Молитва в группе только за сегодня (по часам телефона).
// Сервер разрешает от 1 дня назад до 1 дня вперёд: запас на разницу часовых поясов.
function checkGroupDate(date) {
  const day = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date < day(-1) || date > day(1)) {
    throw new BadRequestError("Отметить молитву в группе можно только за сегодня. Проверьте дату на телефоне.");
  }
}

// День молитвы участника в группе (group_days): есть, пока у него за этот день есть хотя бы одна отметка нужды.
// Нужду потом убрали из группы или удалили: отметки нужды пропадают каскадом, а день остаётся.
function markGroupDay(app, groupId, userId, date) {
  if (app.countRecords("group_days", $dbx.hashExp({ group: groupId, user: userId, date })) > 0) return;
  const d = new Record(app.findCollectionByNameOrId("group_days"));
  d.set("group", groupId);
  d.set("user", userId);
  d.set("date", date);
  try { app.save(d); } catch (err) {
    // одновременно отметили две нужды: день уже записан вторым запросом
    if (app.countRecords("group_days", $dbx.hashExp({ group: groupId, user: userId, date })) === 0) throw err;
  }
}
function unmarkGroupDay(app, groupId, userId, date) {
  if (app.countRecords("group_praying", $dbx.hashExp({ group: groupId, user: userId, date })) > 0) return;
  for (const r of app.findAllRecords("group_days", $dbx.hashExp({ group: groupId, user: userId, date }))) app.delete(r);
}

// Аккаунт создателя удаляется: группа переходит к участнику, который вступил раньше всех, а если никого нет, удаляется
function handOverGroups(app, userId) {
  for (const g of app.findAllRecords("groups", $dbx.hashExp({ owner: userId }))) {
    const rest = app.findRecordsByFilter("group_members", "group = {:g} && user != {:u}", "created", 1, 0, { g: g.id, u: userId });
    if (rest.length) {
      g.set("owner", rest[0].getString("user"));
      app.save(g);
    } else {
      app.delete(g);
    }
  }
}

// Фильтры и сортировка в запросах к общим коллекциям: только безопасные поля.
// Так через фильтр нельзя подобрать скрытое содержимое (заметку об ответе, почту, раздел, код ссылки).
const QUERY_FIELDS = ["id", "owner", "user", "group", "need", "group_need", "added_by", "date", "created", "updated", "name", "title", "true", "false", "null", "@request.auth.id", "@random"];
function checkQuery(e) {
  if (e.hasSuperuserAuth()) return;
  const q = e.requestInfo().query || {};
  for (const p of ["filter", "sort"]) {
    const s = String(q[p] || "").replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "");
    const words = s.match(/[@A-Za-z_][\w.:@]*/g) || [];
    for (const w of words) {
      if (QUERY_FIELDS.indexOf(w) < 0) throw new BadRequestError("Такой запрос не поддерживается.");
    }
  }
}

/* ---------- Письма (правки 2.2) ---------- */
const MAIL_PER_DAY = 5; // писем в сутки на одну почту: сброс пароля, подтверждение и смена почты вместе

// Можно ли отправить ещё одно письмо этому человеку. Если можно, письмо записывается в mail_log.
// Если нельзя, хук отвечает как обычно (204), но письмо не уходит: по ответу не узнать, есть ли такая почта.
function mailAllowed(user, kind) {
  const ago = (days) => new Date(Date.now() - days * 864e5).toISOString().replace("T", " ");
  $app.db().newQuery("DELETE FROM mail_log WHERE created < {:t}").bind({ t: ago(7) }).execute();
  const sent = $app.countRecords("mail_log", $dbx.exp("user = {:u} AND created > {:t}", { u: user.id, t: ago(1) }));
  if (sent >= MAIL_PER_DAY) {
    $app.logger().warn("Письмо не отправлено: на эту почту за сутки уже ушло " + MAIL_PER_DAY + " писем", "user", user.id, "kind", kind);
    return false;
  }
  const r = new Record($app.findCollectionByNameOrId("mail_log"));
  r.set("user", user.id);
  r.set("kind", kind);
  $app.save(r);
  return true;
}

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  return n + " " + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many);
}
function durationText(sec) {
  if (sec >= 86400 && sec % 86400 === 0) return plural(sec / 86400, "день", "дня", "дней");
  if (sec >= 3600 && sec % 3600 === 0) return plural(sec / 3600, "час", "часа", "часов");
  return plural(Math.max(1, Math.round(sec / 60)), "минуту", "минуты", "минут");
}
const TTL_OPTION = { reset: "passwordResetToken", verify: "verificationToken", change: "emailChangeToken", otp: "otp" };

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Устройство из строки браузера (User-Agent) коротко и по-русски
function deviceName(ua) {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return [br, os].filter(Boolean).join(", ") || "неизвестное устройство";
}
// Сведения о входе от PocketBase («2026-10-30 12:00:00.000Z - IP браузер») в три строки по-русски
function alertInfo(info) {
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)\S* - (\S+) ?(.*)$/.exec(info || "");
  if (!m) return info;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + 3 * 3600e3); // по Москве
  const two = (x) => String(x).padStart(2, "0");
  const when = `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} по Москве`;
  const ua = m[7].replace(/&#34;|&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return `Когда: ${when}<br>Адрес в интернете: ${escHtml(m[6])}<br>Устройство: ${escHtml(deviceName(ua))}`;
}

const MAIL_HEAD = `<!DOCTYPE html>
<html lang="ru"><head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
@media (prefers-color-scheme: dark){
  body,.mol-bg{background:#171815!important}
  .mol-card{background:#23241F!important;color:#ECEAE3!important}
  .mol-ink{color:#ECEAE3!important}
  .mol-muted{color:#A39F95!important}
  .mol-link{color:#B9C77F!important}
  .mol-btn{background:#A9B972!important}
  .mol-btn-a{color:#1B1F0E!important}
  .mol-box{background:#30361F!important;color:#E4EACB!important}
}
</style>
</head>
<body style="margin:0;padding:0;background:#F2F0EB;">`;
const MAIL_FOOT = "</body></html>";

// Письмо перед отправкой: обращение по имени, срок ссылки из настроек коллекции и своя обёртка вместо стандартной PocketBase.
// Если в шаблоне нет меток <!--mol--> (шаблон переписали в панели), письмо уходит как есть.
function mailPolish(e, kind) {
  try {
    const html = e.message.html;
    const a = html.indexOf("<!--mol-->"), b = html.indexOf("<!--/mol-->");
    if (a < 0 || b < a) return;
    let body = html.slice(a, b + "<!--/mol-->".length);
    const name = e.record ? e.record.getString("name").trim() : "";
    body = body.split("{MOL_HELLO}").join(name ? `Здравствуйте, ${escHtml(name)}.` : "Здравствуйте.");
    if (TTL_OPTION[kind]) {
      const opt = e.record.collection()[TTL_OPTION[kind]];
      body = body.split("{MOL_TTL}").join(durationText(opt.duration));
    }
    if (kind === "alert" && e.meta && e.meta.info) body = body.split(e.meta.info).join(alertInfo(e.meta.info));
    e.message.html = MAIL_HEAD + body + MAIL_FOOT;
  } catch (err) {
    $app.logger().warn("Не удалось оформить письмо, ушло стандартное", "kind", kind, "error", String(err));
  }
}

/* ---------- Материалы (правки 2.3) ---------- */
// Опубликованный материал должен быть готов к показу: у текста есть текст, у ссылки адрес,
// у аудио и видео загружен файл. Пока материал не опубликован, достаточно названия и вида:
// так можно создать запись в панели, потом загрузить к ней файл в приложении и только затем опубликовать.
const MAT_KIND_RU = { text: "Текст", audio: "Аудио", video: "Видео", link: "Ссылка" };
function checkMaterial(e) {
  const r = e.record;
  const title = r.getString("title").trim();
  if (!title) throw new BadRequestError("Введите название материала.");
  r.set("title", title);
  r.set("summary", r.getString("summary").trim());
  const kind = r.getString("kind");
  if (!MAT_KIND_RU[kind]) throw new BadRequestError("Выберите вид материала: text, audio, video или link.");
  const url = r.getString("url").trim();
  if (url && !/^https?:\/\/\S+$/.test(url)) throw new BadRequestError("Адрес ссылки должен начинаться с http:// или https://");
  r.set("url", url);
  if (!r.getBool("published")) return;
  if (kind === "text" && !r.getString("body").trim()) {
    throw new BadRequestError("У текстового материала пустое поле body: впишите текст или снимите публикацию.");
  }
  if (kind === "link" && !url) {
    throw new BadRequestError("У материала-ссылки пустое поле url: впишите адрес или снимите публикацию.");
  }
  if ((kind === "audio" || kind === "video") && !r.getString("media")) {
    throw new BadRequestError(`${MAT_KIND_RU[kind]}: файл ещё не загружен. Сохраните материал без публикации, загрузите файл в приложении на вкладке «Материалы», потом поставьте «published».`);
  }
}

// Отметку можно поставить только себе и только на один материал: при изменении эти поля остаются прежними.
function checkMaterialMark(e) {
  const o = e.record.original();
  e.record.set("user", o.getString("user"));
  e.record.set("material", o.getString("material"));
}

/* ---------- Файлы аудио и видео ---------- */
// Лежат не в pb_data, а в отдельной папке рядом с ней (по умолчанию /opt/molitva/media).
// Поэтому ежедневная копия pb_data (база и файлы пользователей) не разрастается на гигабайты:
// видео в неё не попадает и не дублируется. Оригиналы хранит владелец, плюс недельная копия всего сервера.
const MEDIA = {
  audio: { ru: "Аудио", ext: ["mp3", "m4a"], max: 100 * MB, about: "MP3 или M4A до 100 МБ" },
  video: { ru: "Видео", ext: ["mp4"], max: 1024 * MB, about: "MP4 (H.264 и AAC) до 1 ГБ" },
};
const MEDIA_TTL = 2 * 3600;        // сколько живёт ссылка на файл
const MEDIA_COOKIE = "mol_media";  // кука, привязанная к вошедшему человеку

function mediaDir() {
  return $os.getenv("MEDIA_DIR") || $filepath.join($app.dataDir(), "..", "media");
}
// Папка материалов и файловая система для неё (не забывать close())
function mediaFs() {
  const dir = mediaDir();
  $os.mkdirAll(dir, 0o750);
  return $filesystem.local(dir);
}
// Ключ для подписи ссылок и кук. Лежит рядом с базой, создаётся сам при первом запуске.
// Если его потерять, перестанут работать только уже выданные ссылки: приложение попросит новую.
function mediaKey() {
  const path = $filepath.join($app.dataDir(), "media.key");
  try {
    const key = toString($os.readFile(path));
    if (key.length >= 32) return key;
  } catch (_) {}
  const key = $security.randomString(50);
  $os.writeFile(path, key, 0o600);
  return key;
}
// Сколько байт свободно на диске и сколько нужно оставить свободными
function freeBytes() {
  const out = toString($os.cmd("df", "-Pk", mediaDir()).output());
  const lines = out.trim().split("\n");
  const cols = lines[lines.length - 1].trim().split(/\s+/);
  return (parseInt(cols[3], 10) || 0) * 1024;
}
function minFreeBytes() {
  const gb = parseFloat($os.getenv("MEDIA_MIN_FREE_GB"));
  return (gb > 0 ? gb : 5) * 1024 * MB;
}
// Имя файла в папке: id материала и случайный хвост, чтобы старые ссылки не попадали на новый файл
function mediaName(id, ext) {
  return id + "-" + $security.randomStringWithAlphabet(8, "abcdefghijkmnpqrstuvwxyz23456789") + "." + ext;
}

// Материалы ведёт администратор приложения (role = admin), он же загружает файлы
function requireAdmin(e) {
  if (!e.auth || e.auth.getString("role") !== "admin") {
    throw new ForbiddenError("Это может сделать только администратор приложения.");
  }
}

function cookieValue(e, name) {
  const raw = String(e.request.header.get("Cookie") || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

// Ссылка на файл выдаётся вместе с короткоживущей кукой, привязанной к вошедшему человеку.
// Кука только для пути отдачи файлов, недоступна странице (HttpOnly) и не уходит на другие сайты (SameSite=Strict),
// поэтому в чужом браузере пересланная ссылка не открывается даже пока она не устарела.
function setMediaCookie(e, userId) {
  const token = $security.createJWT({ u: userId, c: 1 }, mediaKey(), MEDIA_TTL + 3600);
  const proto = String(e.request.header.get("X-Forwarded-Proto") || "").toLowerCase();
  const secure = e.isTLS() || proto === "https"; // на сервере https завершает Caddy, он же ставит заголовок
  e.response.header().set("Set-Cookie",
    `${MEDIA_COOKIE}=${token}; Path=/api/molitva/media; Max-Age=${MEDIA_TTL + 3600}; HttpOnly; SameSite=Strict` + (secure ? "; Secure" : ""));
}
function mediaLink(e, materialId, userId) {
  setMediaCookie(e, userId);
  const token = $security.createJWT({ m: materialId, u: userId }, mediaKey(), MEDIA_TTL);
  return `/api/molitva/media/${materialId}?t=${token}`;
}
// Кто просит файл: проверяем и подписанный ключ из адреса, и куку, и что человек в них один и тот же
function mediaUser(e, materialId) {
  const key = mediaKey();
  let link = null, cookie = null;
  try { link = $security.parseJWT(String((e.requestInfo().query || {}).t || ""), key); } catch (_) {}
  if (!link || link.m !== materialId || !link.u) throw new UnauthorizedError("Ссылка устарела. Откройте материал в приложении заново.");
  try { cookie = $security.parseJWT(cookieValue(e, MEDIA_COOKIE), key); } catch (_) {}
  if (!cookie || cookie.u !== link.u) {
    throw new UnauthorizedError("Этот файл открывается только в том браузере, где выполнен вход в приложение.");
  }
  return String(link.u);
}
// Материал, который можно показать этому человеку: опубликованный или свой для администратора
function visibleMaterial(userId, materialId) {
  let m = null;
  try { m = $app.findRecordById("materials", materialId); } catch (_) {}
  if (!m) throw new NotFoundError("Материал не найден: возможно, его убрали.");
  if (!m.getBool("published")) {
    let u = null;
    try { u = $app.findRecordById("users", userId); } catch (_) {}
    if (!u || u.getString("role") !== "admin") throw new NotFoundError("Материал не найден: возможно, его убрали.");
  }
  return m;
}
// Файл материала удаляется вместе с материалом и при замене на новый
function deleteMedia(name) {
  if (!name) return;
  const fs = mediaFs();
  try { fs.delete(name); } catch (_) {} finally { fs.close(); }
}

module.exports = {
  MB, quotaBytes, usedBytes, checkQuota, checkSectionDepth, checkSection, recordPhoto, checkDayDate, addDefaultVerse, FILE_EXT,
  MAX_MEMBERS, MAX_GROUPS, newGroupCode, groupByCode, isMember, memberGroup, ownGroup, checkGroupLimit, addMember, removeMember, handOverGroups, checkQuery,
  checkGroupDate, markGroupDay, unmarkGroupDay,
  MAIL_PER_DAY, mailAllowed, mailPolish, durationText, alertInfo,
  MAT_KIND_RU, checkMaterial, checkMaterialMark,
  MEDIA, MEDIA_TTL, MEDIA_COOKIE, mediaDir, mediaFs, mediaKey, freeBytes, minFreeBytes, mediaName,
  requireAdmin, cookieValue, setMediaCookie, mediaLink, mediaUser, visibleMaterial, deleteMedia,
};
