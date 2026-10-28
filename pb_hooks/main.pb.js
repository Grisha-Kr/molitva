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
onRecordCreateRequest((e) => { if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).recordPhoto(e, "needs"); e.next(); }, "needs");
onRecordUpdateRequest((e) => { if (!e.hasSuperuserAuth() && e.auth) require(`${__hooks}/lib.js`).recordPhoto(e, "needs"); e.next(); }, "needs");

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
