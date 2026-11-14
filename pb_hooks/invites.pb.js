/// <reference path="../pb_data/types.d.ts" />

// Приглашения в группу по почте (правки 2.6). Логика в invites_lib.js.
// Таблица group_invites через обычный API закрыта всем: только эти маршруты.
// Пригласить и вступить без доступа нельзя (guard), посмотреть, отменить и отказаться можно.

const INV_AUTH = $apis.requireAuth("users");
routerAdd("POST", "/api/molitva/groups/{id}/invite", (e) => require(`${__hooks}/invites_lib.js`).invite(e), INV_AUTH);
routerAdd("GET", "/api/molitva/groups/{id}/invites", (e) => require(`${__hooks}/invites_lib.js`).pending(e), INV_AUTH);
routerAdd("DELETE", "/api/molitva/groups/{id}/invites/{inviteId}", (e) => require(`${__hooks}/invites_lib.js`).cancel(e), INV_AUTH);
routerAdd("GET", "/api/molitva/invites", (e) => require(`${__hooks}/invites_lib.js`).mine(e), INV_AUTH);
routerAdd("POST", "/api/molitva/invites/{id}/accept", (e) => require(`${__hooks}/invites_lib.js`).accept(e), INV_AUTH);
routerAdd("POST", "/api/molitva/invites/{id}/decline", (e) => require(`${__hooks}/invites_lib.js`).decline(e), INV_AUTH);

// Раз в сутки убираем приглашения старше 30 дней (при каждом обращении к приглашениям они убираются и так)
cronAdd("molitva_invites_cleanup", "17 4 * * *", () => {
  try { require(`${__hooks}/invites_lib.js`).cleanup(); }
  catch (err) { $app.logger().error("Не удалось убрать старые приглашения в группы", "error", String(err)); }
});
