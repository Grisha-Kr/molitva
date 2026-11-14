/// <reference path="../pb_data/types.d.ts" />

// Правки 2.6: вступление в группу без открытия ссылки в приложении.
// 1. group_invites: приглашение в группу по почте. Создаёт, показывает, отменяет и принимает только сервер
//    (маршруты в pb_hooks/invites.pb.js), через обычный API таблица закрыта всем. Дата приглашения = updated:
//    повторное приглашение той же почты в ту же группу обновляет её. Через 30 дней приглашение удаляется.
// 2. rate_log: учёт для ограничений частоты, которые считает сервер: неудачные попытки ввести код группы
//    (по пользователю и по адресу в интернете) и отправленные приглашения (по пользователю). Тоже закрыта.
// 3. groups.invite_code: короткий код из 8 символов. Старые коды из 24 символов остаются и работают.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");

  app.save(new Collection({
    type: "base",
    name: "group_invites",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "group", required: true, collectionId: groups.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "email", required: true, max: 254 },
      { type: "relation", name: "by", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_group_invites_pair ON group_invites (`group`, email)",
      "CREATE INDEX idx_group_invites_email ON group_invites (email)",
      "CREATE INDEX idx_group_invites_by ON group_invites (`by`, updated)",
    ],
  }));

  app.save(new Collection({
    type: "base",
    name: "rate_log",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "kind", required: true, max: 20 },
      { type: "relation", name: "user", collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "ip", max: 64 },
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: [
      "CREATE INDEX idx_rate_log_user ON rate_log (kind, user, created)",
      "CREATE INDEX idx_rate_log_ip ON rate_log (kind, ip, created)",
    ],
  }));

  // короткий код группы: 8 символов (старые коды из 24 символов остаются)
  const code = groups.fields.getByName("invite_code");
  code.min = 8;
  app.save(groups);
}, (app) => {
  for (const name of ["group_invites", "rate_log"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  // коротким кодам выдаём длинные: прежняя проверка требует не меньше 16 символов
  const groups = app.findCollectionByNameOrId("groups");
  for (const g of app.findAllRecords("groups", $dbx.exp("LENGTH(invite_code) < 16"))) {
    g.set("invite_code", $security.randomStringWithAlphabet(24, "abcdefghijkmnpqrstuvwxyz23456789"));
    app.save(g);
  }
  groups.fields.getByName("invite_code").min = 16;
  app.save(groups);
});
