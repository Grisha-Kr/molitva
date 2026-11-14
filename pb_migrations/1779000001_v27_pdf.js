/// <reference path="../pb_data/types.d.ts" />

// Правки 2.7, часть Б: PDF в «Материалах».
// У materials.kind новый вид pdf. Файл PDF лежит там же, где аудио и видео (папка материалов вне pb_data),
// в записи его имя (media) и размер (media_size). Новые поля:
//   pages: число страниц, его после загрузки считает приложение администратора и сохраняет маршрутом;
//   cover_auto: обложка сделана приложением из первой страницы PDF (тогда «Заменить файл» её обновляет;
//   обложку, загруженную вручную, сервер не трогает).
// У обложки новая миниатюра 200x200t (квадрат, обрезанный сверху): у PDF в карточке виден верх первой страницы.
// Существующие материалы (текст, ссылка, аудио, видео), отметки людей и файлы миграция не меняет.

migrate((app) => {
  const c = app.findCollectionByNameOrId("materials");
  const kind = c.fields.getByName("kind");
  if (kind.values.indexOf("pdf") < 0) kind.values = kind.values.concat(["pdf"]);
  if (!c.fields.getByName("pages")) c.fields.add(new NumberField({ name: "pages", min: 0, onlyInt: true }));
  if (!c.fields.getByName("cover_auto")) c.fields.add(new BoolField({ name: "cover_auto" }));
  const cover = c.fields.getByName("cover");
  if (cover.thumbs.indexOf("200x200t") < 0) cover.thumbs = cover.thumbs.concat(["200x200t"]);
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("materials");
  // материалы вида pdf при откате остаются в базе, но без своего вида их не показать: откат их не удаляет
  const kind = c.fields.getByName("kind");
  kind.values = kind.values.filter((v) => v !== "pdf");
  c.fields.removeByName("pages");
  c.fields.removeByName("cover_auto");
  const cover = c.fields.getByName("cover");
  cover.thumbs = cover.thumbs.filter((t) => t !== "200x200t");
  app.save(c);
});
