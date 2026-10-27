// Общие функции для хуков. В обработчиках PocketBase код верхнего уровня файла
// недоступен, поэтому каждый обработчик подключает этот файл через require.

const MB = 1024 * 1024;

function quotaBytes() {
  return (parseInt($os.getenv("USER_QUOTA_MB"), 10) || 500) * MB;
}

// Сколько места уже заняли фото нужд и файлы пользователя (без фото нужды exceptNeedId).
function usedBytes(ownerId, exceptNeedId) {
  const a = new DynamicModel({ total: 0 });
  $app.db().select("COALESCE(SUM(size), 0) as total").from("need_files")
    .where($dbx.hashExp({ owner: ownerId })).one(a);
  const b = new DynamicModel({ total: 0 });
  let q = $app.db().select("COALESCE(SUM(photo_size), 0) as total").from("needs")
    .where($dbx.hashExp({ owner: ownerId }));
  if (exceptNeedId) q = q.andWhere($dbx.not($dbx.hashExp({ id: exceptNeedId })));
  q.one(b);
  return a.total + b.total;
}

function checkQuota(ownerId, add, exceptNeedId) {
  if (usedBytes(ownerId, exceptNeedId) + add > quotaBytes()) {
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

// Фото нужды: размер считает сервер.
function needPhoto(e) {
  const files = e.record.getUnsavedFiles("photo");
  if (files.length) {
    let add = 0;
    for (const f of files) add += f.size;
    checkQuota(e.auth.id, add, e.record.isNew() ? "" : e.record.id);
    e.record.set("photo_size", add);
  } else if (!e.record.getString("photo")) {
    e.record.set("photo_size", 0);
  } else if (!e.record.isNew()) {
    e.record.set("photo_size", e.record.original().getInt("photo_size"));
  }
}

const FILE_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

module.exports = { MB, quotaBytes, usedBytes, checkQuota, checkSectionDepth, needPhoto, FILE_EXT };
