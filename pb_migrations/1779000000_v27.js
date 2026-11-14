/// <reference path="../pb_data/types.d.ts" />

// Правки 2.7, часть А: сообщения администратору (по образцу «Библиотеки», правки 4.5).
//
// messages: сообщение пользователя (автор, тема, текст до 1000 знаков, снимок экрана по желанию).
//   Снимок хранится в pb_data, как фото профиля: защищённое поле, только JPEG, PNG, WEBP до 2 МБ.
//   Отдаёт его маршрут /api/molitva/media/shot/{id} по ссылке с кукой (автору и администратору).
//   В лимит места на фото (250 МБ) снимки не входят.
//   status: new (новое или новый ответ пользователя), read («Прочитано»), answered (администратор ответил).
//   archived: в архиве у администратора. user_unread: есть ответ администратора, который пользователь ещё не открыл.
//   answers: сколько ответов администратора. last_at: последняя запись в переписке (для порядка в списке).
//   author_name, author_email: имя и почта на момент отправки.
// message_replies: ответы в переписке (сообщение, кто написал, текст до 1000 знаков, от администратора ли).
//
// Пользователь видит только свои сообщения и ответы на них, администратор все. Через обычный API никто не пишет:
// создают и меняют только маршруты сервера (messages.pb.js). Удаление пользователя удаляет его сообщения
// (а с ними ответы и снимки), удаление сообщения удаляет ответы и снимок.
// Остальные коллекции и настройки почты миграция не трогает.

const AUTH = '@request.auth.id != ""';
const ADMIN = '@request.auth.role = "admin"';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const messages = new Collection({
    type: "base",
    name: "messages",
    listRule: `${AUTH} && (author = @request.auth.id || ${ADMIN})`,
    viewRule: `${AUTH} && (author = @request.auth.id || ${ADMIN})`,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "author", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "author_name", max: 300 },
      { type: "text", name: "author_email", max: 300 },
      { type: "select", name: "topic", required: true, maxSelect: 1, values: ["offer", "problem", "review", "renew", "other"] },
      { type: "text", name: "text", required: true, max: 1000 },
      { type: "file", name: "shot", maxSelect: 1, maxSize: 2 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp"], protected: true, thumbs: [] },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["new", "read", "answered"] },
      { type: "bool", name: "archived" },
      { type: "bool", name: "user_unread" },
      { type: "number", name: "answers", min: 0, onlyInt: true },
      { type: "date", name: "last_at" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_messages_author ON messages (author, created)",
      "CREATE INDEX idx_messages_last ON messages (last_at)",
    ],
  });
  app.save(messages);

  app.save(new Collection({
    type: "base",
    name: "message_replies",
    listRule: `${AUTH} && (message.author = @request.auth.id || ${ADMIN})`,
    viewRule: `${AUTH} && (message.author = @request.auth.id || ${ADMIN})`,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "message", required: true, collectionId: messages.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "bool", name: "admin" },
      { type: "text", name: "text", required: true, max: 1000 },
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: [
      "CREATE INDEX idx_message_replies_msg ON message_replies (message, created)",
      "CREATE INDEX idx_message_replies_user ON message_replies (user, created)",
    ],
  }));
}, (app) => {
  for (const name of ["message_replies", "messages"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
