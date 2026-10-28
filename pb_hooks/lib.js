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

module.exports = { MB, quotaBytes, usedBytes, checkQuota, checkSectionDepth, checkSection, recordPhoto, checkDayDate, addDefaultVerse, FILE_EXT };
