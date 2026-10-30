/// <reference path="../pb_data/types.d.ts" />

// Правки 2.3: вкладка «Материалы».
// materials — полезные материалы, общие для всех пользователей: текст, аудио, видео, ссылка.
//   Читают все вошедшие, и только опубликованные (неопубликованные видит суперпользователь
//   и администратор приложения: иначе он не сможет открыть заготовку, чтобы загрузить к ней файл).
//   Создавать, менять и удалять через обычный API нельзя: материалы ведёт суперпользователь
//   в панели /_/, файлы аудио и видео загружает администратор маршрутом (см. pb_hooks).
//   Сами файлы аудио и видео лежат вне pb_data (папка /opt/molitva/media), в записи только их имя
//   и размер: так ежедневная копия pb_data не разрастается на гигабайты.
// material_marks — отметки каждого пользователя: закреплено, в архиве, когда открыл, где остановился.
//   Видит и меняет только он сам; при удалении материала или пользователя удаляются каскадом.
// Личные записи, нужды, группы и настройки почты миграция не трогает.

migrate((app) => {
  const MB = 1024 * 1024;
  const users = app.findCollectionByNameOrId("users");

  // опубликованные видят все вошедшие; неопубликованные — только администратор приложения
  const READ = '@request.auth.id != "" && (published = true || @request.auth.role = "admin")';

  const materials = new Collection({
    type: "base",
    name: "materials",
    listRule: READ,
    viewRule: READ,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "title", max: 200, required: true },
      { type: "select", name: "kind", maxSelect: 1, required: true, values: ["text", "audio", "video", "link"] },
      { type: "text", name: "summary", max: 300 },
      { type: "file", name: "cover", maxSelect: 1, maxSize: 5 * MB, protected: true,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"], thumbs: ["200x200", "800x0"] },
      { type: "editor", name: "body", maxSize: 300000 },
      // имя файла аудио или видео в папке материалов и его размер: ставит только сервер
      { type: "text", name: "media", max: 200 },
      { type: "number", name: "media_size" },
      { type: "text", name: "url", max: 500, pattern: "^https?://\\S+$" },
      { type: "number", name: "duration" }, // длительность в минутах
      { type: "number", name: "sort" },
      { type: "bool", name: "published" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_materials_order ON materials (published, sort)"],
  });
  app.save(materials);

  const ME = "user = @request.auth.id";
  app.save(new Collection({
    type: "base",
    name: "material_marks",
    listRule: ME,
    viewRule: ME,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: ME + ' && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: ME,
    fields: [
      { type: "relation", name: "user", collectionId: users.id, cascadeDelete: true, maxSelect: 1, required: true },
      { type: "relation", name: "material", collectionId: materials.id, cascadeDelete: true, maxSelect: 1, required: true },
      { type: "bool", name: "pinned" },
      { type: "bool", name: "archived" },
      { type: "text", name: "opened_at", max: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { type: "number", name: "position" }, // на какой секунде человек остановился
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_material_marks_pair ON material_marks (user, material)"],
  }));
}, (app) => {
  for (const name of ["material_marks", "materials"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
