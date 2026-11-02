/// <reference path="../pb_data/types.d.ts" />

// Доступ на срок (правки 2.5): когда срок прошёл или стоит пауза, записи можно только смотреть.
// Логика в access_lib.js. Запреты здесь срабатывают раньше хуков main.pb.js (файлы подключаются по алфавиту).
// Без доступа открыты: вход, просмотр, смена пароля и темы, выход из группы, удаление аккаунта.
// Каскадные удаления (удаление аккаунта, выход из группы) идут мимо этих хуков: они не запросы API.

// Коллекции с данными пользователя и групп. group_members и group_days через API и так закрыты (их ведёт сервер),
// здесь они на случай, если правила когда-нибудь откроют.
const DATA = ["sections", "needs", "prayers", "verses", "prayer_days",
  "groups", "group_members", "group_needs", "group_praying", "group_days", "material_marks"];

onRecordCreateRequest((e) => { require(`${__hooks}/access_lib.js`).guard(e); e.next(); }, ...DATA);
onRecordUpdateRequest((e) => { require(`${__hooks}/access_lib.js`).guard(e); e.next(); }, ...DATA);
onRecordDeleteRequest((e) => { require(`${__hooks}/access_lib.js`).guard(e); e.next(); }, ...DATA);

// Свой профиль: без доступа нельзя менять имя, фото и период стиха; пароль и тему можно.
onRecordUpdateRequest((e) => { require(`${__hooks}/access_lib.js`).guardProfile(e); e.next(); }, "users");

// Срок доступа в приглашении: только из списка
onRecordCreateRequest((e) => { require(`${__hooks}/access_lib.js`).checkInvite(e); e.next(); }, "invites");
onRecordUpdateRequest((e) => { require(`${__hooks}/access_lib.js`).checkInvite(e); e.next(); }, "invites");

routerAdd("GET", "/api/molitva/access", (e) => require(`${__hooks}/access_lib.js`).myAccess(e), $apis.requireAuth("users"));
routerAdd("GET", "/api/molitva/admin/users", (e) => require(`${__hooks}/access_lib.js`).adminUsers(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/molitva/admin/access", (e) => require(`${__hooks}/access_lib.js`).adminAccess(e), $apis.requireAuth("users"));
routerAdd("GET", "/api/molitva/admin/users/{id}/avatar", (e) => require(`${__hooks}/access_lib.js`).adminAvatar(e), $apis.requireAuth("users"));
