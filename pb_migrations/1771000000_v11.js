/// <reference path="../pb_data/types.d.ts" />

// Правки 1.1: круглые фото (нужды, подразделы, профиль), общий стих дня,
// стих по умолчанию у тех, у кого ещё нет ни одного стиха.

migrate((app) => {
  const DAILY = [
    ["И все, чего ни попросите в молитве с верою, получите", "Матфея 21:22"],
    ["Должно всегда молиться и не унывать", "Луки 18:1"],
    ["С благодарением открывайте свои желания пред Богом", "Филиппийцам 4:6"],
    ["Непрестанно молитесь", "1 Фессалоникийцам 5:17"],
    ["Но да просит с верою, нимало не сомневаясь", "Иакова 1:6"],
    ["Верьте, что получите, — и будет вам", "Марка 11:24"],
    ["Много может усиленная молитва праведного", "Иакова 5:16"],
    ["Воззовет ко Мне, и услышу его; с ним Я в скорби", "Псалом 90:15"],
    ["Ты слышишь молитву; к Тебе прибегает всякая плоть", "Псалом 64:3"],
    ["Воззови ко Мне — и Я отвечу тебе, покажу тебе великое и недоступное, чего ты не знаешь", "Иеремия 33:3"],
    ["Близок Господь ко всем призывающим Его, ко всем призывающим Его в истине", "Псалом 144:18"],
  ];

  const MB = 1024 * 1024;
  const IMG = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  // --- фото профиля: только обрезанный квадрат 400×400, открывается по токену ---
  const users = app.findCollectionByNameOrId("users");
  const av = users.fields.getByName("avatar");
  if (av) {
    av.maxSelect = 1;
    av.maxSize = 2 * MB;
    av.mimeTypes = ["image/jpeg", "image/png", "image/webp"];
    av.thumbs = [];
    av.protected = true;
  } else {
    users.fields.add(new FileField({ name: "avatar", maxSelect: 1, maxSize: 2 * MB, mimeTypes: ["image/jpeg", "image/png", "image/webp"], protected: true }));
  }
  app.save(users);

  // круглый вариант (квадрат 400×400 JPEG) и параметры обрезки: центр и увеличение
  const round = () => new FileField({ name: "photo_round", maxSelect: 1, maxSize: 2 * MB, mimeTypes: ["image/jpeg"], protected: true });
  const crop = () => new JSONField({ name: "photo_crop", maxSize: 2000 });

  // --- нужды: к исходному фото добавляется круглое ---
  const needs = app.findCollectionByNameOrId("needs");
  if (!needs.fields.getByName("photo_round")) needs.fields.add(round());
  if (!needs.fields.getByName("photo_crop")) needs.fields.add(crop());
  app.save(needs);

  // --- подразделы: фото так же, как у нужды; размер (photo_size) считает сервер ---
  const sections = app.findCollectionByNameOrId("sections");
  if (!sections.fields.getByName("photo")) {
    sections.fields.add(new FileField({ name: "photo", maxSelect: 1, maxSize: 10 * MB, mimeTypes: IMG, thumbs: ["120x120", "800x0"], protected: true }));
  }
  if (!sections.fields.getByName("photo_round")) sections.fields.add(round());
  if (!sections.fields.getByName("photo_crop")) sections.fields.add(crop());
  if (!sections.fields.getByName("photo_size")) sections.fields.add(new NumberField({ name: "photo_size" }));
  app.save(sections);

  // --- стих дня, один для всех: читают все вошедшие, меняет только суперпользователь в /_/ ---
  const AUTH = '@request.auth.id != ""';
  const daily = new Collection({
    type: "base",
    name: "daily_verses",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "text", max: 2000, required: true },
      { type: "text", name: "ref", max: 200 },
      { type: "number", name: "sort" },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(daily);
  DAILY.forEach((v, i) => {
    const r = new Record(daily);
    r.set("text", v[0]);
    r.set("ref", v[1]);
    r.set("sort", i);
    app.save(r);
  });

  // --- стих по умолчанию тем, у кого ещё нет ни одного стиха ---
  const verses = app.findCollectionByNameOrId("verses");
  for (const u of app.findAllRecords("users")) {
    if (app.countRecords("verses", $dbx.hashExp({ owner: u.id })) > 0) continue;
    const r = new Record(verses);
    r.set("owner", u.id);
    r.set("text", "И не жаждут они в пустынях, через которые Он ведет их: Он источает им воду из камня; рассекает скалу, и льются воды.");
    r.set("ref", "Исаия 48:21");
    r.set("sort", 0);
    app.save(r);
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("daily_verses")); } catch (_) {}
  const drop = (name, fields) => {
    const c = app.findCollectionByNameOrId(name);
    for (const f of fields) c.fields.removeByName(f);
    app.save(c);
  };
  drop("needs", ["photo_round", "photo_crop"]);
  drop("sections", ["photo", "photo_round", "photo_crop", "photo_size"]);
});
