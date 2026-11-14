// Общие функции для хуков. В обработчиках PocketBase код верхнего уровня файла
// недоступен, поэтому каждый обработчик подключает этот файл через require.

const MB = 1024 * 1024;

function quotaBytes() {
  return (parseInt($os.getenv("USER_QUOTA_MB"), 10) || 250) * MB;
}

// Сколько места уже заняли фото нужд и подразделов пользователя (файлов у нужд с правок 2.4 нет).
// Запись exceptId из коллекции exceptCol не считается: её размер сейчас пересчитывается.
function usedBytes(ownerId, exceptCol, exceptId) {
  const parts = [["needs", "photo_size"], ["sections", "photo_size"]];
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
    throw new BadRequestError(`Место для фото закончилось: на одного пользователя ${mb} МБ. Удалите ненужные фото.`);
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

/* ---------- Группы ---------- */
const MAX_MEMBERS = 20; // участников в группе
const MAX_GROUPS = 10;  // групп у одного человека

// Код группы для ссылки и для ввода в приложении (правки 2.6): 8 случайных символов без похожих (0/o, 1/l).
// В приложении показывается заглавными с дефисом: K7MP-4QDX. Старые коды из 24 символов продолжают работать.
const CODE_ABC = "abcdefghijkmnpqrstuvwxyz23456789";
function newGroupCode(app) {
  for (let i = 0; i < 10; i++) {
    const code = $security.randomStringWithAlphabet(8, CODE_ABC);
    if (!app || app.countRecords("groups", $dbx.hashExp({ invite_code: code })) === 0) return code;
  }
  throw new BadRequestError("Не удалось сделать новый код. Попробуйте ещё раз.");
}
// Код в любом виде: «K7MP-4QDX», «k7mp4qdx», с пробелами. Принимаем 8 и 24 символа.
// Заглавная I похожа на 1 и l, а этих знаков в коде не бывает, поэтому читаем их как i.
function normCode(code) {
  const c = String(code || "").replace(/[\s-]+/g, "").toLowerCase().replace(/[1l]/g, "i");
  return (c.length === 8 || c.length === 24) && /^[a-z0-9]+$/.test(c) ? c : "";
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

// Группа по коду из ссылки или из окна «Вступить по коду».
// Защита от подбора: после 20 неудачных попыток за час (с одного пользователя или с одного адреса в интернете)
// сервер отвечает «Слишком много попыток», даже если код верный. Удачные попытки не считаются.
const CODE_TRIES = 20;
function groupByCode(app, code, e) {
  if (e) checkTries(e, "code", CODE_TRIES, 3600, true, "Слишком много попыток. Попробуйте через час.");
  const c = normCode(code);
  let g = null;
  if (c) {
    try { g = app.findFirstRecordByData("groups", "invite_code", c); } catch (_) {}
  }
  if (!g) {
    if (e) addTry(e, "code");
    throw new NotFoundError("Код или ссылка не подходят. Проверьте код или попросите у создателя группы новый: возможно, он сделал новую ссылку.");
  }
  return g;
}

/* ---------- Ограничения частоты, которые считает сервер (rate_log) ---------- */
const realIP = (e) => { try { return String(e.realIP() || ""); } catch (_) { return ""; } };
const agoText = (sec) => new Date(Date.now() - sec * 1000).toISOString().replace("T", " ");
// Сколько раз за последние sec секунд было событие kind у этого пользователя (и с этого адреса, если byIP)
function checkTries(e, kind, max, sec, byIP, message) {
  $app.db().newQuery("DELETE FROM rate_log WHERE created < {:t}").bind({ t: agoText(2 * 86400) }).execute();
  const since = agoText(sec);
  const byUser = $app.countRecords("rate_log", $dbx.exp("kind = {:k} AND user = {:u} AND created > {:t}", { k: kind, u: e.auth.id, t: since }));
  const ip = realIP(e);
  const byAddr = byIP && ip ? $app.countRecords("rate_log", $dbx.exp("kind = {:k} AND ip = {:ip} AND created > {:t}", { k: kind, ip, t: since })) : 0;
  if (byUser >= max || byAddr >= max) throw new TooManyRequestsError(message);
}
function addTry(e, kind) {
  const r = new Record($app.findCollectionByNameOrId("rate_log"));
  r.set("kind", kind);
  r.set("user", e.auth.id);
  r.set("ip", realIP(e).slice(0, 64));
  $app.save(r);
}

// Вступить в группу любым способом (код, ссылка, приглашение по почте): те же проверки,
// после вступления приглашения этого человека в эту группу больше не нужны.
function joinGroup(app, g, user) {
  if (!isMember(app, g.id, user.id)) {
    if (app.countRecords("group_members", $dbx.hashExp({ group: g.id })) >= MAX_MEMBERS) {
      throw new BadRequestError(`В группе уже ${MAX_MEMBERS} участников: это наибольшее число.`);
    }
    checkGroupLimit(app, user.id);
    addMember(app, g.id, user.id);
  }
  const email = String(user.getString("email") || "").toLowerCase();
  for (const r of app.findAllRecords("group_invites", $dbx.hashExp({ group: g.id, email }))) app.delete(r);
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
const MAT_KIND_RU = { text: "Текст", audio: "Аудио", video: "Видео", link: "Ссылка", pdf: "PDF" };
function checkMaterial(e) {
  const r = e.record;
  const title = r.getString("title").trim();
  if (!title) throw new BadRequestError("Введите название материала.");
  r.set("title", title);
  r.set("summary", r.getString("summary").trim());
  const kind = r.getString("kind");
  if (!MAT_KIND_RU[kind]) throw new BadRequestError("Выберите вид материала: text, audio, video, pdf или link.");
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
  if (MEDIA[kind] && !r.getString("media")) {
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
  pdf: { ru: "PDF", ext: ["pdf"], max: 100 * MB, about: "PDF до 100 МБ" },
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
/* ---------- PDF в материалах (правки 2.7, часть Б) ---------- */
const mediaPath = (name) => $filepath.join(mediaDir(), name);
function fileSize(path) { try { return $os.stat(path).size(); } catch (_) { return 0; } }
function hasCmd(name) {
  try { $os.cmd("sh", "-c", 'command -v "$1" >/dev/null', "sh", name).run(); return true; } catch (_) { return false; }
}
// Действительно ли файл PDF: смотрим на содержимое, а не на имя. У PDF в первых 1024 байтах стоит «%PDF-».
function looksLikePdf(path) {
  try { return toString($os.cmd("head", "-c", "1024", path).output()).indexOf("%PDF-") >= 0; } catch (_) { return false; }
}
// Пересобрать PDF так, чтобы описания страниц лежали вместе (qpdf, «потоки объектов»), как в «Библиотеке».
// Без этого в части файлов (сканы, PDF из простых программ) описание каждой страницы лежит рядом с её картинкой,
// и читалка, чтобы найти страницу 150, скачивает почти весь файл. Содержимое страниц не меняется.
// Если qpdf на сервере нет или он не справился (повреждённый или защищённый паролем файл), остаётся исходный файл.
function optimizePdf(path) {
  if (!hasCmd("qpdf")) return false;
  const tmp = path + ".qpdf";
  try {
    try { $os.cmd("timeout", "600", "qpdf", "--object-streams=generate", "--stream-data=preserve", "--deterministic-id", path, tmp).run(); }
    catch (err) { if (!/exit status 3/.test(String(err))) throw err; } // 3 = предупреждения, файл готов
    if (fileSize(tmp) <= 0 || !looksLikePdf(tmp)) throw new Error("пустой файл");
    $os.rename(tmp, path);
    return true;
  } catch (err) {
    try { $os.remove(tmp); } catch (_) {}
    $app.logger().warn("qpdf не пересобрал PDF, оставлен исходный файл", "file", path, "error", String(err));
    return false;
  }
}

/* ---------- Отдача PDF частями ---------- */
const MAX_SPAN = 4 * MB; // больше за один запрос не отдаём: читалка просит куски по 512 КБ
function parseRange(h, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(h || "").trim());
  if (!m || size <= 0) return null;
  let start, end;
  if (m[1] === "") {
    const n = parseInt(m[2], 10);
    if (!n) return null;
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (!(start >= 0) || start > end || start >= size) return null;
  return { start, end, len: end - start + 1 };
}
// Отдать ровно этот кусок файла. e.fileFS отдаёт файл стандартной функцией Go (http.ServeContent), а она смотрит
// на заголовки запроса: при If-Range, который не совпал, отдаёт файл целиком вместо куска. Поэтому сервер сам ставит
// Range «от и до» и убирает условные заголовки (как в «Библиотеке», правки 4.8).
const COND_HEADERS = ["If-Range", "If-Match", "If-None-Match", "If-Modified-Since", "If-Unmodified-Since"];
function serveRange(e, dir, name, range) {
  const h = e.request.header;
  for (const k of COND_HEADERS) h.del(k);
  h.set("Range", `bytes=${range.start}-${range.end}`);
  return e.fileFS($os.dirFS(dir), name);
}
// Файл открывают как страницу: адрес вставили в новую вкладку, «Сохранить ссылку как», рамка на странице.
// Браузеры сообщают это заголовками Sec-Fetch-Dest и Sec-Fetch-Mode. Читалка просит файл из кода страницы
// (Sec-Fetch-Dest: empty), её это не касается. Запросы без этих заголовков проходят: их проверяют ключ и кука.
const PAGE_DEST = { document: 1, iframe: 1, frame: 1, embed: 1, object: 1 };
function refuseAsPage(e, text) {
  const h = e.request.header;
  const words = (name) => (h.values(name) || []).join(",").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  if (words("Sec-Fetch-Dest").some((d) => PAGE_DEST[d]) || words("Sec-Fetch-Mode").indexOf("navigate") >= 0) {
    throw new ForbiddenError(text || "PDF открывается только в приложении, на вкладке «Материалы».");
  }
}

// Файл материала удаляется вместе с материалом и при замене на новый
function deleteMedia(name) {
  if (!name) return;
  const fs = mediaFs();
  try { fs.delete(name); } catch (_) {} finally { fs.close(); }
}

module.exports = {
  MB, quotaBytes, usedBytes, checkQuota, checkSectionDepth, checkSection, recordPhoto, checkDayDate, addDefaultVerse,
  MAX_MEMBERS, MAX_GROUPS, newGroupCode, normCode, groupByCode, checkTries, addTry, joinGroup, realIP, isMember, memberGroup, ownGroup, checkGroupLimit, addMember, removeMember, handOverGroups, checkQuery,
  checkGroupDate, markGroupDay, unmarkGroupDay,
  MAIL_PER_DAY, mailAllowed, mailPolish, durationText, alertInfo, MAIL_HEAD, MAIL_FOOT, escHtml,
  MAT_KIND_RU, checkMaterial, checkMaterialMark,
  MEDIA, MEDIA_TTL, MEDIA_COOKIE, mediaDir, mediaFs, mediaKey, freeBytes, minFreeBytes, mediaName,
  requireAdmin, cookieValue, setMediaCookie, mediaLink, mediaUser, visibleMaterial, deleteMedia,
  mediaPath, fileSize, looksLikePdf, optimizePdf, MAX_SPAN, parseRange, serveRange, refuseAsPage,
};
