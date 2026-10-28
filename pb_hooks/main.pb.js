/// <reference path="../pb_data/types.d.ts" />

// Регистрация: первый пользователь становится администратором,
// все следующие регистрируются только по коду приглашения.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const total = $app.countRecords("users");
  let invite = null;

  if (total > 0) {
    const body = e.requestInfo().body || {};
    const code = String(body["invite"] || "").trim().toUpperCase();
    if (!code) {
      throw new BadRequestError("Для регистрации нужен код приглашения.");
    }
    try {
      invite = $app.findFirstRecordByData("invites", "code", code);
    } catch (_) {
      invite = null;
    }
    if (!invite) {
      throw new BadRequestError("Такого кода приглашения нет. Проверьте, что он введён без ошибок.");
    }
    const max = invite.getInt("max_uses");
    if (max > 0 && invite.getInt("uses") >= max) {
      throw new BadRequestError("Это приглашение уже использовано.");
    }
    const expires = invite.getString("expires");
    if (expires && expires < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestError("Срок действия приглашения истёк.");
    }
    e.record.set("role", "user");
  } else {
    e.record.set("role", "admin");
  }
  if (!e.record.getString("verse_period")) e.record.set("verse_period", "daily");
  if (!e.record.getString("theme")) e.record.set("theme", "auto");

  e.next();

  if (invite) {
    invite.set("uses", invite.getInt("uses") + 1);
    invite.set("used_by", invite.getStringSlice("used_by").concat([e.record.id]));
    $app.save(invite);
  }
}, "users");

// Каждый новый пользователь сразу получает первый стих в «Моих стихах».
onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    require(`${__hooks}/lib.js`).addDefaultVerse(e.record.id);
  } catch (err) {
    $app.logger().error("Не удалось добавить стих по умолчанию", "user", e.record.id, "error", String(err));
  }
}, "users");

// Кто создал приглашение, записывает сервер.
onRecordCreateRequest((e) => {
  if (e.auth) e.record.set("created_by", e.auth.id);
  e.record.set("uses", 0);
  e.record.set("used_by", []);
  e.next();
}, "invites");

// Разделы: глубина не больше двух (раздел на главной и подраздел внутри него).
// Фото подраздела: размер считает сервер, он входит в лимит места.
onRecordCreateRequest((e) => { if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).checkSection(e); e.next(); }, "sections");
onRecordUpdateRequest((e) => { if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).checkSection(e); e.next(); }, "sections");

// Удалить можно только пустой раздел: без подразделов и нужд.
onRecordDeleteRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const subs = $app.countRecords("sections", $dbx.hashExp({ parent: e.record.id }));
    const needs = $app.countRecords("needs", $dbx.hashExp({ section: e.record.id }));
    if (subs || needs) {
      throw new BadRequestError("Удалить можно только пустой раздел. Сначала перенесите или удалите нужды и подразделы.");
    }
  }
  e.next();
}, "sections");

// Стихов не больше 7 у одного пользователя.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) {
    if ($app.countRecords("verses", $dbx.hashExp({ owner: e.auth.id })) >= 7) {
      throw new BadRequestError("Можно вписать не больше 7 стихов. Удалите или измените один из старых.");
    }
  }
  e.next();
}, "verses");

// Фото нужды (исходник и круглый вариант): размер считает сервер, общий объём фото и файлов на пользователя ограничен.
// «Поделиться ответом с группой» возможно только у отвеченной нужды: снятие «Отвечено» сбрасывает настройку.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).recordPhoto(e, "needs");
  if (!e.record.getString("answered_at")) e.record.set("answer_shared", false);
  e.next();
}, "needs");
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).recordPhoto(e, "needs");
  if (!e.record.getString("answered_at")) e.record.set("answer_shared", false);
  e.next();
}, "needs");

// Отметки дней: только за сегодня, вчера и позавчера.
onRecordCreateRequest((e) => { if (!e.hasSuperuserAuth()) require(`${__hooks}/lib.js`).checkDayDate(e.record.getString("date")); e.next(); }, "prayer_days");
onRecordDeleteRequest((e) => { if (!e.hasSuperuserAuth()) require(`${__hooks}/lib.js`).checkDayDate(e.record.getString("date")); e.next(); }, "prayer_days");

// Файлы нужды: только pdf, doc, docx и картинки; размер считает сервер.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || !e.auth) {
    e.next();
    return;
  }
  const lib = require(`${__hooks}/lib.js`);
  const files = e.record.getUnsavedFiles("file");
  let add = 0;
  for (const f of files) {
    const ext = String(f.originalName || "").split(".").pop().toLowerCase();
    if (lib.FILE_EXT.indexOf(ext) < 0) throw new BadRequestError("Можно прикреплять только PDF, Word (doc, docx) и картинки.");
    add += f.size;
  }
  lib.checkQuota(e.auth.id, add, "", "");
  e.record.set("size", add);
  e.next();
}, "need_files");

// Размер файла после создания менять нельзя.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("size", e.record.original().getInt("size"));
  }
  e.next();
}, "need_files");

// Настройки из окружения:
// APP_URL — адрес приложения для писем (сброс пароля);
// BEHIND_PROXY=1 — приложение стоит за Caddy, настоящий IP посетителя берётся из X-Forwarded-For.
onBootstrap((e) => {
  e.next();
  const s = $app.settings();
  let changed = false;
  const url = $os.getenv("APP_URL");
  if (url && s.meta.appURL !== url) {
    s.meta.appURL = url;
    changed = true;
  }
  if ($os.getenv("BEHIND_PROXY") === "1") {
    const h = s.trustedProxy.headers || [];
    if (h.length !== 1 || h[0] !== "X-Forwarded-For") {
      s.trustedProxy.headers = ["X-Forwarded-For"];
      changed = true;
    }
  }
  if (changed) $app.save(s);
});

// Сведения для экрана входа и политики конфиденциальности.
routerAdd("GET", "/api/molitva/setup", (e) => {
  return e.json(200, {
    firstRun: $app.countRecords("users") === 0,
    owner: $os.getenv("OWNER_NAME") || "",
    contact: $os.getenv("CONTACT_EMAIL") || "",
  });
});

// Сколько места заняли фото и файлы пользователя.
routerAdd("GET", "/api/molitva/usage", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  return e.json(200, { used: lib.usedBytes(e.auth.id, "", ""), quota: lib.quotaBytes() });
}, $apis.requireAuth());


/* ---------- Группы (этап 2) ---------- */

// Что видят другие участники групп. Сервер убирает лишние поля из каждого ответа:
// списков, одиночных записей и живых обновлений (realtime).
// Чужая нужда: без раздела владельца, без даты его последней молитвы и параметров обрезки;
// заметка «как Бог ответил» только если владелец включил «Поделиться ответом с группой».
onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  const su = auth && auth.isSuperuser();
  if (!su && (!auth || auth.id !== e.record.getString("owner"))) {
    e.record.hide("section", "last_prayed_at", "photo_crop", "photo_size");
    if (!e.record.getBool("answer_shared") || !e.record.getString("answered_at")) e.record.hide("answer_note");
  }
  e.next();
}, "needs");

// Другой пользователь: только имя и фото профиля. Почту видит лишь сам человек и суперпользователь.
onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  if (!(auth && (auth.isSuperuser() || auth.id === e.record.id))) {
    e.record.hide("email", "emailVisibility", "verified", "role", "verse_period", "theme", "created", "updated");
  }
  e.next();
}, "users");

// Код ссылки-приглашения видит только создатель группы.
onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  if (!(auth && (auth.isSuperuser() || auth.id === e.record.getString("owner")))) e.record.hide("invite_code");
  e.next();
}, "groups");

// Фильтры и сортировка в общих коллекциях: только безопасные поля (см. checkQuery в lib.js).
onRecordsListRequest((e) => { require(`${__hooks}/lib.js`).checkQuery(e); e.next(); },
  "needs", "users", "groups", "group_members", "group_needs", "group_praying");

// Подписки на живые обновления без фильтров: приложению они не нужны, а через них можно подбирать скрытые поля.
onRealtimeSubscribeRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    for (const sub of e.subscriptions) {
      let t = String(sub);
      try { t = decodeURIComponent(t); } catch (_) {}
      if (t.indexOf("filter") >= 0) throw new BadRequestError("Такая подписка не поддерживается.");
    }
  }
  e.next();
});

// Переименовать группу: создатель меняет через обычный API только название.
// Создатель, код ссылки и участники меняются только маршрутами ниже.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const o = e.record.original();
    e.record.set("owner", o.getString("owner"));
    e.record.set("invite_code", o.getString("invite_code"));
    const name = e.record.getString("name").trim();
    if (!name) throw new BadRequestError("Введите название группы.");
    e.record.set("name", name);
  }
  e.next();
}, "groups");

// Поделиться нуждой: только своей (проверяет правило) и только в группу, где вы участник.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const lib = require(`${__hooks}/lib.js`);
    const groupId = e.record.getString("group");
    lib.memberGroup($app, groupId, e.auth.id);
    if ($app.countRecords("group_needs", $dbx.hashExp({ group: groupId, need: e.record.getString("need") })) > 0) {
      throw new BadRequestError("Эта нужда уже есть в группе.");
    }
    e.record.set("added_by", e.auth.id);
  }
  e.next();
}, "group_needs");

// «Молюсь»: только участник группы, где лежит общая нужда; группу записывает сервер.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const lib = require(`${__hooks}/lib.js`);
    let gn = null;
    try { gn = $app.findRecordById("group_needs", e.record.getString("group_need")); } catch (_) {}
    if (!gn) throw new NotFoundError("Нужда уже убрана из группы.");
    lib.memberGroup($app, gn.getString("group"), e.auth.id);
    if ($app.countRecords("group_praying", $dbx.hashExp({ group_need: gn.id, user: e.auth.id })) > 0) {
      throw new BadRequestError("Вы уже отметили «Молюсь».");
    }
    e.record.set("group", gn.getString("group"));
    e.record.set("user", e.auth.id);
  }
  e.next();
}, "group_praying");

// Удаление аккаунта: группы, где человек создатель, переходят к другому участнику или удаляются.
onRecordDelete((e) => {
  require(`${__hooks}/lib.js`).handOverGroups(e.app, e.record.id);
  e.next();
}, "users");

const GROUP_AUTH = $apis.requireAuth("users");

// Создать группу: создатель сразу становится участником.
routerAdd("POST", "/api/molitva/groups", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const name = String((e.requestInfo().body || {}).name || "").trim();
  if (!name) throw new BadRequestError("Введите название группы.");
  if (name.length > 100) throw new BadRequestError("Название группы слишком длинное: не больше 100 символов.");
  lib.checkGroupLimit($app, e.auth.id);
  let id = "";
  $app.runInTransaction((tx) => {
    const g = new Record(tx.findCollectionByNameOrId("groups"));
    g.set("name", name);
    g.set("owner", e.auth.id);
    g.set("invite_code", lib.newGroupCode());
    tx.save(g);
    lib.addMember(tx, g.id, e.auth.id);
    id = g.id;
  });
  return e.json(200, { id });
}, GROUP_AUTH);

// Группа по коду из ссылки: название, создатель, сколько участников. Код проверяет только сервер.
routerAdd("GET", "/api/molitva/join/{code}", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.groupByCode($app, e.request.pathValue("code"));
  let owner = "";
  try { owner = $app.findRecordById("users", g.getString("owner")).getString("name"); } catch (_) {}
  const members = $app.countRecords("group_members", $dbx.hashExp({ group: g.id }));
  return e.json(200, {
    id: g.id, name: g.getString("name"), owner, members,
    member: lib.isMember($app, g.id, e.auth.id),
    full: members >= lib.MAX_MEMBERS,
  });
}, GROUP_AUTH);
routerAdd("POST", "/api/molitva/join/{code}", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.groupByCode($app, e.request.pathValue("code"));
  if (!lib.isMember($app, g.id, e.auth.id)) {
    if ($app.countRecords("group_members", $dbx.hashExp({ group: g.id })) >= lib.MAX_MEMBERS) {
      throw new BadRequestError(`В группе уже ${lib.MAX_MEMBERS} участников: это наибольшее число.`);
    }
    lib.checkGroupLimit($app, e.auth.id);
    lib.addMember($app, g.id, e.auth.id);
  }
  return e.json(200, { id: g.id });
}, GROUP_AUTH);

// Новая ссылка: старая сразу перестаёт работать.
routerAdd("POST", "/api/molitva/groups/{id}/link", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.ownGroup($app, e.request.pathValue("id"), e.auth.id);
  g.set("invite_code", lib.newGroupCode());
  $app.save(g);
  return e.json(200, { invite_code: g.getString("invite_code") });
}, GROUP_AUTH);

// Передать роль создателя другому участнику.
routerAdd("POST", "/api/molitva/groups/{id}/owner", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.ownGroup($app, e.request.pathValue("id"), e.auth.id);
  const user = String((e.requestInfo().body || {}).user || "");
  if (!user || user === e.auth.id || !lib.isMember($app, g.id, user)) throw new BadRequestError("Выберите другого участника группы.");
  g.set("owner", user);
  $app.save(g);
  return e.json(200, { ok: true });
}, GROUP_AUTH);

// Исключить участника (только создатель).
routerAdd("POST", "/api/molitva/groups/{id}/remove", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.ownGroup($app, e.request.pathValue("id"), e.auth.id);
  const user = String((e.requestInfo().body || {}).user || "");
  if (!user || user === e.auth.id) throw new BadRequestError("Себя исключить нельзя: чтобы уйти, выберите «Выйти из группы».");
  if (!lib.isMember($app, g.id, user)) throw new BadRequestError("Этого человека уже нет в группе.");
  $app.runInTransaction((tx) => lib.removeMember(tx, g.id, user));
  return e.json(200, { ok: true });
}, GROUP_AUTH);

// Выйти из группы. Создатель сначала передаёт роль другому участнику; если участников больше нет, группа удаляется.
routerAdd("POST", "/api/molitva/groups/{id}/leave", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  const g = lib.memberGroup($app, e.request.pathValue("id"), e.auth.id);
  if (g.getString("owner") === e.auth.id) {
    if ($app.countRecords("group_members", $dbx.hashExp({ group: g.id })) > 1) {
      throw new BadRequestError("Вы создатель группы. Сначала передайте эту роль другому участнику: «Участники» → «Сделать создателем».");
    }
    $app.delete(g);
    return e.json(200, { deleted: true });
  }
  $app.runInTransaction((tx) => lib.removeMember(tx, g.id, e.auth.id));
  return e.json(200, { deleted: false });
}, GROUP_AUTH);

// Неделя групп: отметки дня всех, с кем вы в общей группе, только за 7 дней с from.
// from (понедельник по часам телефона) должен быть не раньше чем 7 дней назад по UTC сервера,
// поэтому старые отметки другим участникам не видны никогда.
routerAdd("GET", "/api/molitva/group-days", (e) => {
  const from = String((e.requestInfo().query || {})["from"] || "");
  const day = (k) => new Date(Date.now() + k * 864e5).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < day(-7) || from > day(1)) {
    throw new BadRequestError("Неделю группы можно посмотреть только за текущую неделю.");
  }
  const to = new Date(Date.parse(from + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10);
  const rows = arrayOf(new DynamicModel({ user: "", date: "" }));
  $app.db().newQuery(
    "SELECT DISTINCT pd.user AS user, pd.date AS date FROM prayer_days pd " +
    "JOIN group_members a ON a.user = pd.user " +
    "JOIN group_members b ON b.[[group]] = a.[[group]] " +
    "WHERE b.user = {:me} AND pd.date >= {:from} AND pd.date <= {:to}"
  ).bind({ me: e.auth.id, from, to }).all(rows);
  const days = {};
  for (const r of rows) (days[r.user] = days[r.user] || []).push(r.date);
  return e.json(200, { from, to, days });
}, GROUP_AUTH);
