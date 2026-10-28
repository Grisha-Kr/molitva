/// <reference path="../pb_data/types.d.ts" />

// Правки 2.1: молитва в группе привязана к дате и не связана с личным дневником.
// group_praying: «помолился за эту общую нужду в этот день», одна отметка на (нужда, участник, дата).
// group_days: день молитвы участника в группе, его ставит и снимает только сервер
// (первая отметка нужды за день ставит, снятие последней снимает). По нему строится неделя группы,
// поэтому прошедшие дни не пропадают, если нужду потом убрали из группы, удалили или отметили отвеченной.
// Старые отметки «Молюсь» (без даты) удаляются. Группы, участники и общие нужды остаются.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  const MEMBER = "group.group_members_via_group.user ?= @request.auth.id";
  const date = { type: "text", name: "date", max: 10, required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" };

  app.db().newQuery("DELETE FROM group_praying").execute();
  const praying = app.findCollectionByNameOrId("group_praying");
  praying.fields.add(new TextField(date));
  praying.indexes = [
    "CREATE UNIQUE INDEX idx_group_praying_day ON group_praying (group_need, user, date)",
    "CREATE INDEX idx_group_praying_group ON group_praying (`group`, date)",
  ];
  app.save(praying);

  app.save(new Collection({
    type: "base",
    name: "group_days",
    listRule: MEMBER,
    viewRule: MEMBER,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "group", collectionId: groups.id, cascadeDelete: true, maxSelect: 1, required: true },
      { type: "relation", name: "user", collectionId: users.id, cascadeDelete: true, maxSelect: 1, required: true },
      date,
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_group_days_day ON group_days (`group`, user, date)"],
  }));
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("group_days")); } catch (_) {}
  app.db().newQuery("DELETE FROM group_praying").execute();
  const praying = app.findCollectionByNameOrId("group_praying");
  praying.indexes = [
    "CREATE UNIQUE INDEX idx_group_praying_pair ON group_praying (group_need, user)",
    "CREATE INDEX idx_group_praying_group ON group_praying (`group`)",
  ];
  praying.fields.removeByName("date");
  app.save(praying);
});
