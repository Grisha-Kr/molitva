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

// Человек выходит или его исключают: его нужды пропадают из группы, его «Молюсь» в группе удаляются.
// В его личном дневнике всё остаётся.
function removeMember(app, groupId, userId) {
  for (const r of app.findAllRecords("group_needs", $dbx.hashExp({ group: groupId, added_by: userId }))) app.delete(r);
  for (const r of app.findAllRecords("group_praying", $dbx.hashExp({ group: groupId, user: userId }))) app.delete(r);
  for (const r of app.findAllRecords("group_members", $dbx.hashExp({ group: groupId, user: userId }))) app.delete(r);
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
const QUERY_FIELDS = ["id", "owner", "user", "group", "need", "group_need", "added_by", "created", "updated", "name", "title", "true", "false", "null", "@request.auth.id", "@random"];
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

module.exports = {
  MB, quotaBytes, usedBytes, checkQuota, checkSectionDepth, checkSection, recordPhoto, checkDayDate, addDefaultVerse, FILE_EXT,
  MAX_MEMBERS, MAX_GROUPS, newGroupCode, groupByCode, isMember, memberGroup, ownGroup, checkGroupLimit, addMember, removeMember, handOverGroups, checkQuery,
};
