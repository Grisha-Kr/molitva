// Приглашения в группу по почте (правки 2.6). Подключается через require() внутри обработчиков invites.pb.js.
// На iPhone ссылка из мессенджера или письма открывается в браузере, а не в приложении с экрана «Домой»,
// поэтому приглашение ждёт человека прямо в приложении, в разделе «Группы».
//
// Создатель группы вводит почту. Ответ всегда один, есть такой аккаунт или нет: так нельзя узнать, кто зарегистрирован.
// Если почта принадлежит участнику группы, приглашение не создаётся. Если аккаунта нет, приглашение ждёт регистрации.
// Письмо уходит, только если аккаунт с этой почтой есть (с ящика приложения письма незнакомым адресам не уходят),
// и только в пределах лимита писем (mail_log, 5 в сутки на одну почту).
// Приглашение живёт 30 дней от последней отправки (поле updated), потом удаляется.

const INVITE_DAYS = 30;
const MAX_PENDING = 20;   // приглашений без ответа у одной группы
const MAX_PER_DAY = 20;   // приглашений в сутки от одного человека
const SENT = "Приглашение отправлено. Если у человека есть аккаунт, он увидит его в разделе «Группы». Если аккаунта нет, приглашение будет ждать его после регистрации (30 дней).";

const lib = () => require(`${__hooks}/lib.js`);
const agoText = (days) => new Date(Date.now() - days * 864e5).toISOString().replace("T", " ");
const isEmail = (s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const myEmail = (e) => String(e.auth.getString("email") || "").trim().toLowerCase();

// Просроченные приглашения удаляются при каждом обращении к приглашениям и раз в сутки по расписанию
function cleanup() {
  $app.db().newQuery("DELETE FROM group_invites WHERE updated < {:t}").bind({ t: agoText(INVITE_DAYS) }).execute();
}
// Аккаунт с этой почтой (почту сравниваем без учёта регистра)
function userByEmail(email) {
  const list = $app.findAllRecords("users", $dbx.exp("LOWER(email) = {:e}", { e: email }));
  return list.length ? list[0] : null;
}
function ownerName(id) {
  try { return $app.findRecordById("users", id).getString("name"); } catch (_) { return ""; }
}

// POST /api/molitva/groups/{id}/invite {email}
function invite(e) {
  require(`${__hooks}/access_lib.js`).guard(e);
  const L = lib();
  const g = L.ownGroup($app, e.request.pathValue("id"), e.auth.id);
  const email = String((e.requestInfo().body || {}).email || "").trim().toLowerCase();
  if (!isEmail(email)) throw new BadRequestError("Проверьте адрес почты.");
  cleanup();
  const perDay = () => L.checkTries(e, "invite", MAX_PER_DAY, 86400, false, `За сутки можно отправить не больше ${MAX_PER_DAY} приглашений. Попробуйте завтра.`);

  const user = userByEmail(email);
  // почта участника группы: ответ тот же, приглашение не нужно
  if (user && L.isMember($app, g.id, user.id)) {
    perDay();
    L.addTry(e, "invite");
    return e.json(200, { ok: true, message: SENT });
  }
  let inv = null;
  try { inv = $app.findFirstRecordByFilter("group_invites", "group = {:g} && email = {:e}", { g: g.id, e: email }); } catch (_) {}
  if (!inv && $app.countRecords("group_invites", $dbx.hashExp({ group: g.id })) >= MAX_PENDING) {
    throw new BadRequestError(`У группы уже ${MAX_PENDING} приглашений без ответа. Отмените ненужные или дождитесь ответа.`);
  }
  perDay();
  if (!inv) {
    inv = new Record($app.findCollectionByNameOrId("group_invites"));
    inv.set("group", g.id);
    inv.set("email", email);
  }
  inv.set("by", e.auth.id);
  // повторное приглашение: та же запись, новая дата (updated ставится при каждом сохранении)
  inv.set("updated", new DateTime());
  $app.save(inv);
  L.addTry(e, "invite");
  if (user) sendMail(user, e.auth.getString("name"), g.getString("name"));
  return e.json(200, { ok: true, message: SENT });
}

// Письмо приглашённому, у которого уже есть аккаунт. Сверх лимита писем молча не уходит.
function sendMail(user, byName, groupName) {
  const L = lib();
  try {
    if (!L.mailAllowed(user, "invite")) return;
    const s = $app.settings();
    const url = String(s.meta.appURL || "").replace(/\/+$/, "");
    const who = byName.trim() || "Создатель группы";
    const name = user.getString("name").trim();
    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    const esc = L.escHtml;
    const p = (t) => `<p class="mol-ink" style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2B2A27;">${t}</p>`;
    const small = (t) => `<p class="mol-muted" style="margin:0 0 12px;font-size:13px;line-height:19px;color:#66625B;">${t}</p>`;
    const box = (t) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
<td class="mol-box" bgcolor="#E3E6D6" style="background:#E3E6D6;border-radius:12px;padding:14px 16px;font-family:${font};font-size:15px;line-height:22px;color:#2B2A27;">${t}</td></tr></table>`;
    const link = url ? `<a class="mol-muted" href="${esc(url)}" target="_blank" rel="noopener" style="color:#66625B;">${esc(url)}</a>` : "";
    const html = L.MAIL_HEAD + `<!--mol-->
<table class="mol-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2F0EB" style="width:100%;background:#F2F0EB;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
<tr><td class="mol-card" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:16px;padding:28px 22px 16px;font-family:${font};color:#2B2A27;text-align:left;">
<h1 class="mol-ink" style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;font-weight:bold;color:#2B2A27;">Приглашение в группу</h1>
${p(name ? `Здравствуйте, ${esc(name)}.` : "Здравствуйте.")}
${p(`${esc(who)} приглашает вас в группу «${esc(groupName)}».`)}
${box("Откройте Молитвенный дневник (если он у вас на экране «Домой», откройте его оттуда) и зайдите в «Группы»: приглашение ждёт там.")}
${small(`Приглашение действует ${INVITE_DAYS} дней. Если вы не хотите вступать, нажмите в приложении «Отказаться» или просто ничего не делайте.`)}
${link ? small(`Если приложения на экране «Домой» нет, откройте сайт: ${link}`) : ""}
</td></tr>
<tr><td class="mol-muted" align="center" style="padding:16px 8px 0;font-family:${font};font-size:12px;line-height:18px;color:#66625B;">Молитвенный дневник</td></tr>
</table>
</td></tr></table>
<!--/mol-->` + L.MAIL_FOOT;
    const text = `${name ? `Здравствуйте, ${name}.` : "Здравствуйте."}

${who} приглашает вас в группу «${groupName}».

Откройте Молитвенный дневник (если он у вас на экране «Домой», откройте его оттуда) и зайдите в «Группы»: приглашение ждёт там.

Приглашение действует ${INVITE_DAYS} дней.${url ? `\n\nЕсли приложения на экране «Домой» нет, откройте сайт: ${url}` : ""}`;
    const msg = new MailerMessage({
      from: { address: s.meta.senderAddress, name: s.meta.senderName },
      to: [{ address: user.getString("email") }],
      subject: `${who} приглашает вас в группу «${groupName}»`,
      html, text,
    });
    $app.newMailClient().send(msg);
  } catch (err) {
    $app.logger().error("Не удалось отправить письмо о приглашении в группу", "user", user.id, "error", String(err));
  }
}

// GET /api/molitva/groups/{id}/invites: «Ждут ответа», только создателю и только почта, которую он сам ввёл
function pending(e) {
  const g = lib().ownGroup($app, e.request.pathValue("id"), e.auth.id);
  cleanup();
  const list = $app.findRecordsByFilter("group_invites", "group = {:g} && by = {:u}", "-updated", 100, 0, { g: g.id, u: e.auth.id });
  return e.json(200, { invites: list.map((r) => ({ id: r.id, email: r.getString("email"), date: r.getString("updated") })) });
}

// DELETE /api/molitva/groups/{id}/invites/{inviteId}: отменить своё приглашение
function cancel(e) {
  const g = lib().ownGroup($app, e.request.pathValue("id"), e.auth.id);
  let r = null;
  try { r = $app.findRecordById("group_invites", e.request.pathValue("inviteId")); } catch (_) {}
  if (r && r.getString("group") === g.id && r.getString("by") === e.auth.id) $app.delete(r);
  return e.json(200, { ok: true });
}

// GET /api/molitva/invites: мои приглашения по почте вошедшего человека.
// Почту пригласившего не отдаём: только его имя, название группы и число участников.
function mine(e) {
  cleanup();
  const out = [];
  for (const r of $app.findRecordsByFilter("group_invites", "email = {:e}", "-updated", 50, 0, { e: myEmail(e) })) {
    let g = null;
    try { g = $app.findRecordById("groups", r.getString("group")); } catch (_) {}
    if (!g) continue;
    if (lib().isMember($app, g.id, e.auth.id)) { $app.delete(r); continue; } // уже участник
    out.push({
      id: r.id, group: g.id, name: g.getString("name"), by: ownerName(r.getString("by")),
      members: $app.countRecords("group_members", $dbx.hashExp({ group: g.id })), date: r.getString("updated"),
    });
  }
  return e.json(200, { invites: out });
}

// Своё приглашение: найдено по id и выписано на почту вошедшего человека
function myInvite(e) {
  cleanup();
  let r = null;
  try { r = $app.findRecordById("group_invites", e.request.pathValue("id")); } catch (_) {}
  if (!r || r.getString("email") !== myEmail(e)) throw new NotFoundError("Приглашение не найдено: возможно, его отменили или срок истёк.");
  return r;
}

// POST /api/molitva/invites/{id}/accept: те же проверки, что при вступлении по коду (20 участников, 10 групп, доступ)
function accept(e) {
  require(`${__hooks}/access_lib.js`).guard(e);
  const r = myInvite(e);
  let g = null;
  try { g = $app.findRecordById("groups", r.getString("group")); } catch (_) {}
  if (!g) throw new NotFoundError("Группа не найдена: возможно, её удалили.");
  $app.runInTransaction((tx) => lib().joinGroup(tx, g, e.auth));
  return e.json(200, { id: g.id });
}

// POST /api/molitva/invites/{id}/decline: отказаться можно и без доступа
function decline(e) {
  $app.delete(myInvite(e));
  return e.json(200, { ok: true });
}

module.exports = { INVITE_DAYS, cleanup, invite, pending, cancel, mine, accept, decline };
