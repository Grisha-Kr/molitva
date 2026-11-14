/// <reference path="../pb_data/types.d.ts" />

// Сообщения администратору (правки 2.7, часть А, по образцу «Библиотеки»): маршруты. Логика в messages_lib.js.
// Через обычный API сообщения и ответы только читаются (своё пользователю, всё администратору), правила записи
// закрыты: всё пишут эти маршруты. Проверки срока доступа (guard) здесь нет намеренно: написать администратору
// может и человек с закончившимся сроком или на паузе.

// Состояние «Новое / Прочитано / Отвечено» и архив нужны только администратору
onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  if (!(auth && (auth.isSuperuser() || auth.getString("role") === "admin"))) e.record.hide("status", "archived");
  e.next();
}, "messages");

// Фильтры и сортировка только по безопасным полям (как в группах): так по скрытому состоянию ничего не подобрать
onRecordsListRequest((e) => { require(`${__hooks}/lib.js`).checkQuery(e); e.next(); }, "messages", "message_replies");

routerAdd("POST", "/api/molitva/messages", (e) => require(`${__hooks}/messages_lib.js`).create(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/molitva/messages/{id}/reply", (e) => require(`${__hooks}/messages_lib.js`).reply(e, e.request.pathValue("id")), $apis.requireAuth("users"));
routerAdd("POST", "/api/molitva/messages/{id}/seen", (e) => require(`${__hooks}/messages_lib.js`).seen(e, e.request.pathValue("id")), $apis.requireAuth("users"));
routerAdd("POST", "/api/molitva/messages/{id}/state", (e) => require(`${__hooks}/messages_lib.js`).setState(e, e.request.pathValue("id")), $apis.requireAuth("users"));
routerAdd("DELETE", "/api/molitva/messages/{id}", (e) => require(`${__hooks}/messages_lib.js`).remove(e, e.request.pathValue("id")), $apis.requireAuth("users"));
// Снимок экрана: ссылка на 2 часа и кука (как файлы материалов), сам файл по адресу под /api/molitva/media/
routerAdd("GET", "/api/molitva/messages/{id}/shot", (e) => require(`${__hooks}/messages_lib.js`).shotLink(e, e.request.pathValue("id")), $apis.requireAuth("users"));
routerAdd("GET", "/api/molitva/media/shot/{id}", (e) => require(`${__hooks}/messages_lib.js`).shotServe(e, e.request.pathValue("id")));
