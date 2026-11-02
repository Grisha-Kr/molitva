/// <reference path="../pb_data/types.d.ts" />

// Правки 2.4: у нужд больше нет файлов. Коллекция need_files удаляется.
// Фото (профиль, подразделы, нужды) остаются как были.
// Страховка: если в need_files есть хотя бы одна запись, миграция останавливается и ничего не удаляет.
// Обратная миграция создаёт коллекцию заново с прежними полями и правилами (как в 1770000000_init.js).

migrate((app) => {
  let files = null;
  try { files = app.findCollectionByNameOrId("need_files"); } catch (_) {}
  if (!files) return;
  const n = app.countRecords("need_files");
  if (n > 0) {
    throw new Error(`Правки 2.4 остановлены: в коллекции need_files есть записи (${n}). Это файлы, прикреплённые к нуждам. Сначала скачайте их в панели /_/ и удалите записи, потом запустите обновление снова. Ничего не удалено.`);
  }
  app.delete(files);
}, (app) => {
  try { app.findCollectionByNameOrId("need_files"); return; } catch (_) {}
  const users = app.findCollectionByNameOrId("users");
  const needs = app.findCollectionByNameOrId("needs");
  const OWN = "owner = @request.auth.id";
  const OWN_CREATE = '@request.auth.id != "" && @request.body.owner = @request.auth.id';
  const OWN_UPDATE = "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)";
  app.save(new Collection({
    type: "base",
    name: "need_files",
    listRule: OWN,
    viewRule: OWN,
    createRule: OWN_CREATE + ' && (@request.body.need = "" || @request.body.need.owner = @request.auth.id)',
    updateRule: OWN_UPDATE + ' && (@request.body.need:isset = false || @request.body.need = "" || @request.body.need.owner = @request.auth.id)',
    deleteRule: OWN,
    fields: [
      { type: "relation", name: "owner", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "need", required: true, collectionId: needs.id, cascadeDelete: true, maxSelect: 1 },
      { type: "file", name: "file", required: true, maxSelect: 1, maxSize: 20 * 1024 * 1024, protected: true },
      { type: "text", name: "name", max: 300 },
      { type: "text", name: "ext", max: 10 },
      { type: "number", name: "size" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_need_files_owner ON need_files (owner)"],
  }));
});
