/// <reference path="../pb_data/types.d.ts" />

// Начальная схема «Молитвенного дневника», этап 1 (личный дневник).
// Каждый пользователь видит и меняет только свои записи (поле owner, у отметок дня user).
// На этапе 2 появятся группы: тогда правила needs и prayer_days расширятся на чтение
// участниками общих групп, а prayers и need_files останутся только у владельца.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // --- пользователи: роль, период смены стиха, тема ---
  if (!users.fields.getByName("role")) {
    users.fields.add(new SelectField({ name: "role", values: ["user", "admin"], maxSelect: 1 }));
  }
  if (!users.fields.getByName("verse_period")) {
    users.fields.add(new SelectField({ name: "verse_period", values: ["daily", "every3", "weekly", "never"], maxSelect: 1 }));
  }
  if (!users.fields.getByName("theme")) {
    users.fields.add(new SelectField({ name: "theme", values: ["auto", "light", "dark"], maxSelect: 1 }));
  }
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "";
  // роль менять через API нельзя, только из панели администратора
  users.updateRule = "id = @request.auth.id && @request.body.role:isset = false";
  users.deleteRule = "id = @request.auth.id";
  app.save(users);

  const OWN = "owner = @request.auth.id";
  const OWN_CREATE = '@request.auth.id != "" && @request.body.owner = @request.auth.id';
  const OWN_UPDATE = "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)";

  // связь с записью другой коллекции разрешена, только если та запись тоже ваша
  const relCreate = (field) => ` && (@request.body.${field} = "" || @request.body.${field}.owner = @request.auth.id)`;
  const relUpdate = (field) => ` && (@request.body.${field}:isset = false || @request.body.${field} = "" || @request.body.${field}.owner = @request.auth.id)`;

  const ownerField = () => ({ type: "relation", name: "owner", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 });
  const txt = (name, max, required) => ({ type: "text", name, max: max || 500, required: !!required });
  const date = (name, required) => ({ type: "text", name, max: 10, required: !!required, pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
  const num = (name) => ({ type: "number", name });
  const rel = (name, collection, required) => ({ type: "relation", name, collectionId: collection.id, cascadeDelete: true, maxSelect: 1, required: !!required });
  const stamps = () => [
    { type: "autodate", name: "created", onCreate: true },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];

  function owned(name, fields, rels) {
    rels = rels || [];
    const c = new Collection({
      type: "base",
      name,
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN_CREATE + rels.map(relCreate).join(""),
      updateRule: OWN_UPDATE + rels.map(relUpdate).join(""),
      deleteRule: OWN,
      fields: [ownerField(), ...fields, ...stamps()],
      indexes: [`CREATE INDEX idx_${name}_owner ON ${name} (owner)`],
    });
    app.save(c);
    return c;
  }

  // --- разделы-камни: на главной (parent пуст) или внутри раздела первого уровня ---
  const sections = owned("sections", [txt("name", 100, true), txt("color", 20), num("sort")]);
  sections.fields.add(new RelationField({ name: "parent", collectionId: sections.id, cascadeDelete: true, maxSelect: 1 }));
  sections.createRule += relCreate("parent");
  sections.updateRule += relUpdate("parent");
  app.save(sections);

  // --- нужды ---
  const needs = owned("needs", [
    rel("section", sections, true),
    txt("title", 300, true), txt("description", 5000),
    { type: "file", name: "photo", maxSelect: 1, maxSize: 10 * 1024 * 1024, protected: true,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"], thumbs: ["120x120", "800x0"] },
    num("photo_size"),
    date("answered_at"), txt("answer_note", 2000), date("last_prayed_at"),
  ], ["section"]);

  // --- файлы нужды: видит только владелец, всегда ---
  owned("need_files", [
    rel("need", needs, true),
    { type: "file", name: "file", required: true, maxSelect: 1, maxSize: 20 * 1024 * 1024, protected: true },
    txt("name", 300), txt("ext", 10), num("size"),
  ], ["need"]);

  // --- записи молитв: видит только владелец, всегда ---
  owned("prayers", [rel("need", needs, true), date("date", true), txt("text", 10000, true)], ["need"]);

  // --- мои стихи: не больше 7 (проверяет хук) ---
  owned("verses", [txt("text", 2000, true), txt("ref", 200), num("sort")]);

  // --- отметки дня: одна на пользователя и дату ---
  const ME = "user = @request.auth.id";
  app.save(new Collection({
    type: "base",
    name: "prayer_days",
    listRule: ME, viewRule: ME,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: null, // отметку только ставят и снимают
    deleteRule: ME,
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      date("date", true),
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_prayer_days_user_date ON prayer_days (user, date)"],
  }));

  // --- приглашения: видит и создаёт только администратор приложения ---
  const ADMIN = '@request.auth.role = "admin"';
  app.save(new Collection({
    type: "base",
    name: "invites",
    listRule: ADMIN, viewRule: ADMIN, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    fields: [
      txt("code", 40, true), txt("note", 300), num("max_uses"), num("uses"), txt("expires", 10),
      { type: "relation", name: "created_by", collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
      { type: "relation", name: "used_by", collectionId: users.id, cascadeDelete: false, maxSelect: 999 },
      { type: "autodate", name: "created", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_invites_code ON invites (code)"],
  }));

  // --- настройки: имя приложения и ежедневные резервные копии в 3:00, храним 14 ---
  const s = app.settings();
  s.meta.appName = "Молитвенный дневник";
  s.backups.cron = "0 3 * * *";
  s.backups.cronMaxKeep = 14;
  app.save(s);
}, (app) => {
  for (const name of ["invites", "prayer_days", "verses", "prayers", "need_files", "needs", "sections"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
