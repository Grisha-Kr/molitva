/// <reference path="../pb_data/types.d.ts" />

// Этап 2: группы. Нуждой можно поделиться только через группу.
// Группу, её участников, общие нужды и «Молюсь» видят только участники группы.
// Чужую нужду участник только читает; лишние поля (раздел, заметку об ответе без
// разрешения владельца) сервер убирает из ответа (onRecordEnrich в pb_hooks).
// Записи молитв и файлы нужд остаются только у владельца, их правила не меняются.
// Отметки дней (prayer_days) напрямую читает только владелец; неделю группы
// отдаёт маршрут /api/molitva/group-days, только за текущую неделю.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const needs = app.findCollectionByNameOrId("needs");

  const stamps = () => [
    { type: "autodate", name: "created", onCreate: true },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];
  const rel = (name, collectionId, cascade) => ({ type: "relation", name, collectionId, cascadeDelete: cascade, maxSelect: 1, required: true });

  // запись видна, если вы участник её группы
  const MEMBER = "group.group_members_via_group.user ?= @request.auth.id";

  // --- группы: создают, вступают, меняют ссылку и создателя через маршруты /api/molitva/... ---
  // создатель может переименовать (хук разрешает менять только название) и удалить группу
  const groups = new Collection({
    type: "base",
    name: "groups",
    // правила ставятся ниже, когда появится коллекция участников
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "name", max: 100, required: true },
      // при удалении аккаунта создателя хук передаёт группу другому участнику или удаляет её
      rel("owner", users.id, false),
      { type: "text", name: "invite_code", min: 16, max: 64, required: true },
      ...stamps(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_groups_invite ON groups (invite_code)"],
  });
  app.save(groups);

  // --- участники: добавляет и убирает только сервер (вступление, выход, исключение) ---
  const members = new Collection({
    type: "base",
    name: "group_members",
    listRule: MEMBER,
    viewRule: MEMBER,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [rel("group", groups.id, true), rel("user", users.id, true), ...stamps()],
    indexes: [
      "CREATE UNIQUE INDEX idx_group_members_pair ON group_members (`group`, user)",
      "CREATE INDEX idx_group_members_user ON group_members (user)",
    ],
  });
  app.save(members);

  groups.listRule = "group_members_via_group.user ?= @request.auth.id";
  groups.viewRule = "group_members_via_group.user ?= @request.auth.id";
  groups.updateRule = "owner = @request.auth.id";
  groups.deleteRule = "owner = @request.auth.id";
  app.save(groups);

  // --- общие нужды: ссылка на нужду владельца, копия не создаётся ---
  // отдать можно только свою нужду и только в свою группу (проверяет хук), убрать может только владелец нужды
  const gneeds = new Collection({
    type: "base",
    name: "group_needs",
    listRule: MEMBER,
    viewRule: MEMBER,
    createRule: '@request.auth.id != "" && @request.body.need.owner = @request.auth.id',
    updateRule: null,
    deleteRule: "need.owner = @request.auth.id",
    fields: [rel("group", groups.id, true), rel("need", needs.id, true), rel("added_by", users.id, true), ...stamps()],
    indexes: [
      "CREATE UNIQUE INDEX idx_group_needs_pair ON group_needs (`group`, need)",
      "CREATE INDEX idx_group_needs_need ON group_needs (need)",
    ],
  });
  app.save(gneeds);

  // --- «Молюсь»: у каждой общей нужды в каждой группе свой список ---
  app.save(new Collection({
    type: "base",
    name: "group_praying",
    listRule: MEMBER,
    viewRule: MEMBER,
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: null,
    deleteRule: "user = @request.auth.id",
    fields: [rel("group_need", gneeds.id, true), rel("user", users.id, true), rel("group", groups.id, true), ...stamps()],
    indexes: [
      "CREATE UNIQUE INDEX idx_group_praying_pair ON group_praying (group_need, user)",
      "CREATE INDEX idx_group_praying_group ON group_praying (`group`)",
    ],
  }));

  // --- нужды: участник группы читает нужды, отданные в его группу ---
  if (!needs.fields.getByName("answer_shared")) needs.fields.add(new BoolField({ name: "answer_shared" }));
  const NEED_READ = "owner = @request.auth.id || group_needs_via_need.group.group_members_via_group.user ?= @request.auth.id";
  needs.listRule = NEED_READ;
  needs.viewRule = NEED_READ;
  app.save(needs);

  // --- пользователи: участники общих групп видят друг у друга имя и фото (остальное скрывает хук) ---
  const USER_READ = "id = @request.auth.id || group_members_via_user.group.group_members_via_group.user ?= @request.auth.id";
  users.listRule = USER_READ;
  users.viewRule = USER_READ;
  app.save(users);
}, (app) => {
  for (const name of ["group_praying", "group_needs", "group_members", "groups"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  const needs = app.findCollectionByNameOrId("needs");
  needs.fields.removeByName("answer_shared");
  needs.listRule = "owner = @request.auth.id";
  needs.viewRule = "owner = @request.auth.id";
  app.save(needs);
  const users = app.findCollectionByNameOrId("users");
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  app.save(users);
});
