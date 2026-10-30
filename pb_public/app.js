(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Справочники ---------- */
// Цвета камней: ключ хранится в базе (sections.color), ink = цвет подписи
const COLORS = {
  granite:{n:'Гранит', c:'#B3AB9F', ink:'light'}, moss:{n:'Мох', c:'#5F6E4A', ink:'light'},
  clay:{n:'Глина', c:'#9A553F', ink:'light'}, slate:{n:'Сланец', c:'#5A7389', ink:'light'},
  sand:{n:'Песчаник', c:'#D9C29A', ink:'dark'}, basalt:{n:'Базальт', c:'#4A4D52', ink:'light'},
  marble:{n:'Мрамор', c:'#F2EEE6', ink:'dark'}, night:{n:'Ночь', c:'#3A3650', ink:'light'}
};
const PERIODS = {daily:['Каждый день', 1], every3:['Раз в 3 дня', 3], weekly:['Раз в неделю', 7], never:['Не менять', 0]};
const VERSE_EPOCH = '2026-01-01'; // от этой даты считается смена стиха
const MAX_VERSES = 7;
const MB = 1024*1024;
const MAX_PHOTO = 10*MB, MAX_FILE = 20*MB;
const FILE_EXT = ['pdf','doc','docx','jpg','jpeg','png','gif','webp','heic','heif'];
const PBN = {sections:'sections', needs:'needs', files:'need_files', prayers:'prayers', verses:'verses', days:'prayer_days', daily:'daily_verses',
  groups:'groups', gmembers:'group_members', glinks:'group_needs', gpray:'group_praying', gdays:'group_days', people:'users', shared:'needs',
  materials:'materials', marks:'material_marks'};
const KEYS = Object.keys(PBN);
// Группы: needs = свои нужды, shared = чужие нужды из общих групп (только чтение), people = участники общих групп,
// gpray = отметки «Помолился» у общих нужд (с датой), gdays = дни молитвы участников в группах (ставит сервер)
const GKEYS = ['groups','gmembers','glinks','gpray','gdays','people','shared'];
const MAX_MEMBERS = 20, MAX_GROUPS = 10;
// Материалы (правки 2.3): общий для всех список, ведёт его администратор. marks = свои отметки
const KINDS = {text:{n:'Текст', ic:'doc'}, audio:{n:'Аудио', ic:'head'}, video:{n:'Видео', ic:'film'}, link:{n:'Ссылка', ic:'link'}};

/* ---------- Значки ---------- */
const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="fill" cx="5" cy="12" r="1.8"/><circle class="fill" cx="12" cy="12" r="1.8"/><circle class="fill" cx="19" cy="12" r="1.8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  clip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17a1.7 1.7 0 0 1-2.4-2.4L15 7"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  // сложенные руки: Phosphor Icons, лицензия MIT (icons/LICENSE-phosphor-icons.txt)
  hands: '<svg class="hands" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M233.9,181.42l-36.59-36.6L160.71,24A19.75,19.75,0,0,0,128,15.62,19.75,19.75,0,0,0,95.29,24L58.69,144.82,22.1,181.42a14,14,0,0,0,0,19.79L54.79,233.9a14,14,0,0,0,19.79,0l48.29-48.28a38,38,0,0,0,5.13-6.38,38,38,0,0,0,5.13,6.38l48.29,48.28a14,14,0,0,0,19.79,0l32.69-32.69a14,14,0,0,0,0-19.79Zm-167.8,44a2,2,0,0,1-2.83,0L30.58,192.73a2,2,0,0,1,0-2.83l14.11-14.1L80.2,211.31Zm48.28-48.29-25.69,25.7L53.17,167.31l15.07-15.07a6,6,0,0,0,1.5-2.5l37-122.22A7.78,7.78,0,0,1,122,29.78v129A25.83,25.83,0,0,1,114.38,177.13ZM134,158.75v-129a7.78,7.78,0,0,1,15.22-2.26l37,122.22a6,6,0,0,0,1.5,2.5l15.93,15.94-36.28,34.74-25.79-25.79A25.83,25.83,0,0,1,134,158.75Zm91.42,34-32.69,32.69a2,2,0,0,1-2.83,0l-14-14,36.29-34.74,13.24,13.23A2,2,0,0,1,225.42,192.73Z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z M20 5.5C20 4.7 19.3 4 18.5 4H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  group: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 1.7 5 4.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  // материалы: раскрытая книга, наушники, плёнка, звено цепи, булавка
  mats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10.5 5.2 8.4 4.5 5 4.5V18c3.4 0 5.5.7 7 2 1.5-1.3 3.6-2 7-2V4.5c-3.4 0-5.5.7-7 2z"/><path d="M12 6.5V20"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h7l5 5v13H6z"/><path d="M13 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
  head: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13" width="4.5" height="7" rx="2"/><rect x="17" y="13" width="4.5" height="7" rx="2"/></svg>',
  film: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.3l4.5 2.7-4.5 2.7z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M8 5.5l11 6.5-11 6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>'
};

/* ---------- Состояние ---------- */
const S = {sections:[], needs:[], files:[], prayers:[], verses:[], days:[], daily:[], invites:[], usage:null, loaded:false,
  groups:[], gmembers:[], glinks:[], gpray:[], gdays:[], people:[], shared:[], materials:[], marks:[], mediaUsage:null};
const loadLS = (k, d) => { try { const v = localStorage.getItem('mol_'+k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const saveLS = (k, v) => { try { localStorage.setItem('mol_'+k, JSON.stringify(v)); } catch(e){} };
const UI = {reorder:'', filesOpen:false, form:null, hops:0, verseDay:undefined, verseAt:0, join:null, archOpen:false, up:0};
const pb = new PocketBase(location.origin);
pb.autoCancellation(false);
const me = () => pb.authStore.record || {};
const isAdmin = () => me().role === 'admin';

/* ---------- Тема оформления: auto (как в системе), light, dark ---------- */
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
function themePref(){ const t = loadLS('theme', 'auto'); return t === 'light' || t === 'dark' ? t : 'auto'; }
function isDark(){ const t = themePref(); return t === 'dark' || (t === 'auto' && darkMQ.matches); }
function applyTheme(){
  const t = themePref(), root = document.documentElement;
  if(t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', isDark() ? '#171815' : '#F2F0EB'));
}
// Тема запоминается на устройстве и в профиле, чтобы совпадала на телефоне и ноутбуке
function setTheme(t){
  saveLS('theme', t); applyTheme();
  if(pb.authStore.isValid && me().theme !== t) pb.collection('users').update(me().id, {theme: t}).then(r => pb.authStore.save(pb.authStore.token, r)).catch(() => {});
}
function themeFromUser(){ const t = me().theme; if((t === 'auto' || t === 'light' || t === 'dark') && t !== themePref()){ saveLS('theme', t); applyTheme(); } }
darkMQ.addEventListener && darkMQ.addEventListener('change', () => { if(themePref() === 'auto') applyTheme(); });
applyTheme();

/* ---------- Даты (день считается по часам устройства) ---------- */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const dnum = iso => { const [y,m,d] = iso.split('-').map(Number); return Date.UTC(y, m-1, d) / 864e5; };
const diff = iso => Math.round(dnum(todayISO()) - dnum(iso)); // сколько дней прошло
const addDays = (iso, k) => { const [y,m,d] = iso.split('-').map(Number); return isoOf(new Date(y, m-1, d + k)); };
const MONF = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONP = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
const WDM = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']; // неделя с понедельника
const WDF = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const monIndex = d => (d.getDay() + 6) % 7; // 0 = понедельник
const canMark = iso => { const k = diff(iso); return k >= 0 && k <= 2; }; // сегодня, вчера, позавчера
const weekStart = () => addDays(todayISO(), -monIndex(new Date())); // понедельник текущей недели
function fmtDay(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-').map(Number);
  return d + ' ' + MONF[m-1] + (y !== new Date().getFullYear() ? ' ' + y : '');
}
const createdISO = r => r.created ? isoOf(new Date(String(r.created).replace(' ', 'T'))) : '';
const plural = (n, f) => { n = Math.abs(n) % 100; const n1 = n % 10; if(n > 10 && n < 20) return f[2]; if(n1 > 1 && n1 < 5) return f[1]; if(n1 === 1) return f[0]; return f[2]; };
const NEEDS = ['нужда','нужды','нужд'], SUBS = ['подраздел','подраздела','подразделов'], DAYS = ['день','дня','дней'];
function prayedText(iso){
  if(!iso) return 'Ещё не молился';
  const k = diff(iso);
  if(k <= 0) return 'Молился сегодня';
  if(k === 1) return 'Молился вчера';
  return `Молился ${k} ${plural(k, DAYS)} назад`;
}
const fsize = b => b < MB ? Math.max(1, Math.round(b/1024)) + ' КБ'
  : b < 1024*MB ? (b/MB).toFixed(1).replace('.', ',') + ' МБ'
  : (b/1024/MB).toFixed(1).replace('.', ',') + ' ГБ';

/* ---------- Доступ к данным ---------- */
const byId = (key, id) => S[key].find(x => x.id === id);
const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.created).localeCompare(String(b.created));
const topSections = () => S.sections.filter(s => !s.parent).sort(bySort);
const childrenOf = id => S.sections.filter(s => s.parent === id).sort(bySort);
const needsIn = id => S.needs.filter(n => n.section === id);
const needsTotal = s => needsIn(s.id).length + childrenOf(s.id).reduce((a, c) => a + needsIn(c.id).length, 0);
const colorOf = s => COLORS[s && s.color] || COLORS.granite;
function pathOf(sec){ const p = sec && sec.parent ? byId('sections', sec.parent) : null; return (p ? [p.name] : []).concat(sec ? [sec.name] : []); }
const sortedVerses = () => [...S.verses].sort(bySort);
const dayRec = iso => S.days.find(d => d.date === iso);
// Нужды: сначала по дате последней молитвы (новые без молитв по дате добавления), отвеченные внизу
function needSort(a, b){
  const aa = !!a.answered_at, ba = !!b.answered_at;
  if(aa !== ba) return aa ? 1 : -1;
  if(aa) return String(b.answered_at).localeCompare(String(a.answered_at));
  const ka = a.last_prayed_at || createdISO(a), kb = b.last_prayed_at || createdISO(b);
  return kb.localeCompare(ka) || String(b.created).localeCompare(String(a.created));
}

const ID_ABC = 'abcdefghijklmnopqrstuvwxyz0123456789';
function newId(){ const a = new Uint8Array(15); crypto.getRandomValues(a); return Array.from(a, x => ID_ABC[x % 36]).join(''); }
const SKIP = new Set(['id','owner','user','collectionId','collectionName','created','updated','expand']);
function clean(d){ const o = {}; for(const [k, v] of Object.entries(d || {})) if(!SKIP.has(k) && v !== undefined) o[k] = v; return o; }
function upsert(key, rec){ const arr = S[key]; const i = arr.findIndex(x => x.id === rec.id); if(i >= 0) arr[i] = {...rec}; else arr.push({...rec}); schedule(); }
function removeLocal(key, id){ S[key] = S[key].filter(x => x.id !== id); schedule(); }
function col(key){
  const c = pb.collection(PBN[key]);
  return { doc(id){
    const rid = id || newId();
    return {
      id: rid,
      async create(data){ const rec = await c.create({...clean(data), id: rid, owner: me().id}); upsert(key, rec); return rec; },
      async update(data){ const rec = await c.update(rid, clean(data)); upsert(key, rec); return rec; },
      async delete(){ await c.delete(rid); removeLocal(key, rid); }
    };
  } };
}
// Свои нужды и чужие (из общих групп) лежат в одной коллекции: разделяем по владельцу.
// Молитва в группах: отметки нужд со вчерашнего дня (на случай смены даты), дни группы с понедельника.
const LIST_FILTER = {needs: () => pb.filter('owner = {:me}', {me: me().id}), shared: () => pb.filter('owner != {:me}', {me: me().id}),
  gpray: () => pb.filter('date >= {:d}', {d: addDays(todayISO(), -1)}), gdays: () => pb.filter('date >= {:d}', {d: weekStart()})};
async function loadAll(keys = KEYS){
  const res = await Promise.all(keys.map(k => pb.collection(PBN[k]).getFullList({batch: 500, ...(LIST_FILTER[k] ? {filter: LIST_FILTER[k]()} : {})})));
  keys.forEach((k, n) => { S[k] = res[n]; });
  schedule();
}
// Изменилось что-то в группах: доступ к чужим нуждам и участникам мог появиться или пропасть, перечитываем всё групповое
let gTimer = 0;
function refreshGroups(){ clearTimeout(gTimer); gTimer = setTimeout(() => loadAll(GKEYS).catch(() => {}), 300); }
let subscribed = false;
async function subscribeAll(){
  if(subscribed) return; subscribed = true;
  await pb.collection('users').subscribe(me().id, e => { if(e.action === 'update'){ pb.authStore.save(pb.authStore.token, e.record); themeFromUser(); schedule(); } });
  for(const k of KEYS){
    if(k === 'people' || k === 'shared') continue;
    await pb.collection(PBN[k]).subscribe('*', e => {
      // нужды: свои в needs, чужие из общих групп в shared
      const key = k === 'needs' && e.record.owner !== me().id ? 'shared' : k;
      if(e.action === 'delete') removeLocal(key, e.record.id); else upsert(key, e.record);
      if(k === 'groups' || k === 'gmembers' || k === 'glinks') refreshGroups();
    });
  }
}

/* ---------- Запуск ---------- */
async function boot(){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const qs = new URLSearchParams(location.search);
  const invite = qs.get('invite'), join = qs.get('group');
  // ссылка из письма: /?reset=КЛЮЧ, /?verify=КЛЮЧ, /?email-change=КЛЮЧ
  const mail = MAIL_LINKS.find(k => qs.get(k));
  // ссылка в группу: код запоминаем, после входа приложение предложит вступить
  if(join) saveLS('join', join.trim());
  // ключ из письма сразу убираем из адресной строки и истории
  if(invite || join || mail) history.replaceState(null, '', location.pathname + location.hash);
  if(mail){ showMailLink(mail, qs.get(mail).trim()); return; }
  if(!pb.authStore.isValid){ showAuth(invite ? 'register' : 'login', invite); return; }
  try { await pb.collection('users').authRefresh(); }
  catch(e){ if(e && e.status && e.status !== 0){ pb.authStore.clear(); showAuth('login'); return; } }
  startApp();
}
async function startApp(){
  $('#auth').hidden = true; $('#app').hidden = false;
  themeFromUser();
  render(true);
  try {
    await loadAll();
    S.loaded = true; $('#notice').hidden = true; render(true);
    if(route().name === 'profile') loadProfileExtras();
    touchMaterial();
    const join = loadLS('join', '');
    if(join){ saveLS('join', ''); go('#/join/' + encodeURIComponent(join)); }
    subscribeAll().catch(() => {});
  } catch(e){
    showNotice('Не удалось загрузить данные. ' + errText(e));
  }
}
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible'){ savePos(true); return; } // ушли с экрана: запоминаем место в плеере
  checkUpdate();
  if(S.loaded && pb.authStore.isValid) loadAll().catch(() => {});
});
window.addEventListener('pagehide', () => savePos(true));

/* ---------- Проверка новой версии ---------- */
// Сравниваем ?v= у app.js и app.css в открытой странице и в свежем index.html с сервера
const verOf = html => (html.match(/\/app\.(?:js|css)\?v=\d+/g) || []).sort().join(' ');
const MY_VER = verOf(document.documentElement.innerHTML);
let lastCheck = 0;
async function checkUpdate(){
  if(!navigator.onLine || Date.now() - lastCheck < 60e3) return;
  lastCheck = Date.now();
  try {
    const res = await fetch('/index.html', {cache: 'no-store'});
    if(!res.ok) return;
    const v = verOf(await res.text());
    if(v && MY_VER && v !== MY_VER) $('#update-bar').hidden = false;
  } catch(e){}
}
setInterval(checkUpdate, 30*60e3);
$('#update-btn').addEventListener('click', () => location.reload());
$('#update-close').addEventListener('click', () => { $('#update-bar').hidden = true; });
window.addEventListener('online', () => { $('#notice').hidden = true; schedule(); if(S.loaded) loadAll().catch(() => {}); });
window.addEventListener('offline', () => { showNotice('Нет подключения к интернету. Записи сохранятся, когда связь вернётся.'); schedule(); });
let raf = 0;
function schedule(){ if(raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); }
function showNotice(text){ $('#notice-text').textContent = text; $('#notice').hidden = false; }

/* ---------- Адреса экранов: #/, #/s/ID, #/n/ID, #/new, #/edit/ID, #/verses, #/answers, #/profile,
   группы: #/groups, #/g/ID, #/gn/ID (общая нужда, ID записи group_needs), #/join/КОД,
   материалы: #/materials, #/m/ID ---------- */
function route(){
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return {name: parts[0] || 'home', id: parts[1] || '', q: new URLSearchParams(q || '')};
}
const go = (hash, replace) => { if(replace) location.replace(hash); else location.hash = hash; };
// Назад внутри приложения; если пришли по прямой ссылке, переходим на запасной адрес
function goBack(fallback){ if(UI.hops > 0) history.back(); else go(fallback, true); }
window.addEventListener('hashchange', () => { UI.hops++; UI.reorder = ''; UI.filesOpen = false; closeMenu(); render(true); window.scrollTo(0, 0); });

/* ---------- Отрисовка ---------- */
function render(force){
  const r = route();
  const tab = ['profile','verses','answers'].includes(r.name) ? 'profile'
    : ['materials','m'].includes(r.name) ? 'materials'
    : ['groups','g','gn','join'].includes(r.name) || (r.name === 'n' && r.q.get('g')) ? 'groups' : 'diary';
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.tab === tab ? 'page' : 'false'));
  const m = $('#main');
  if(calDlg.open) renderCal();
  if(!S.loaded){ m.innerHTML = '<div class="loading">Загружаю…</div>'; return; }
  const isForm = r.name === 'new' || r.name === 'edit';
  // форма раздела не перерисовывается от живых обновлений, чтобы не сбить ввод
  if(isForm && !force && $('#f-name')) return;
  // экран материала тоже: иначе остановится плеер или прервётся загрузка файла
  if(r.name === 'm' && !force && (UI.up || $('#main [data-player]'))) return;
  if(!isForm) UI.form = null;
  const views = {home:vHome, s:vSection, n:vNeed, new:vSectionForm, edit:vSectionForm, verses:vVerses, answers:vAnswers, profile:vProfile,
    groups:vGroups, g:vGroup, gn:vGroupNeed, join:vJoin, materials:vMaterials, m:vMaterial};
  m.innerHTML = (views[r.name] || vHome)(r);
  if(r.name === 'm'){ setupPlayer(); if(isAdmin() && !S.mediaUsage) loadMediaUsage(); } else if(PL.id) stopPlayer();
}
const notFound = () => `<div class="card"><p>Запись не найдена: возможно, её уже удалили.</p><a class="btn" href="#/">На главную</a></div>`;
const backLink = (href, text) => `<a class="back" href="${href}">${ICON.back}<span>${esc(text)}</span></a>`;
const initial = u => (String(u.name || u.email || '?').trim()[0] || '?').toUpperCase();
const imgTag = src => src ? `<img src="${esc(src)}" alt="">` : '';
// Кружок профиля: фото или первая буква имени
const avatarInner = u => (u.avatar && imgTag(photoSrc(u, 'avatar'))) || esc(initial(u));

/* ---------- Камни ---------- */
const stoneBg = s => `background-color:${colorOf(s).c}`;
function stoneHTML(s){
  const c = colorOf(s), n = needsTotal(s);
  const count = `${n} ${plural(n, NEEDS)}`;
  return `<a class="stone-btn ink-${c.ink}" href="#/s/${esc(s.id)}" aria-label="${esc(s.name)}, ${count}">
    <span class="stone-shadow" aria-hidden="true"></span><span class="stone" style="${stoneBg(s)}" aria-hidden="true"></span>
    <span class="stone-name${String(s.name).length > 10 ? ' long' : ''}">${esc(s.name)}</span><span class="stone-count">${count}</span></a>`;
}
const addStone = (href, label) => `<a class="stone-btn add" href="${href}" aria-label="${label}"><span class="stone-shadow" aria-hidden="true"></span><span class="stone empty" aria-hidden="true"></span>${ICON.plus}</a>`;
/* ---------- Подразделы: вода ---------- */
const WATER = '<span class="water" aria-hidden="true"></span><span class="water-shade" aria-hidden="true"></span>';
// Круглое фото нужды или подраздела; у старых фото без круга берётся середина миниатюры
const roundSrc = r => r.photo_round ? photoSrc(r, 'photo_round') : photoSrc(r, 'photo', '120x120');
function subHTML(s){
  const n = needsIn(s.id).length, label = `${esc(s.name)}, ${n} ${plural(n, NEEDS)}`;
  if(s.photo) return `<div class="sub-cell"><a class="sub-tile has-photo" href="#/s/${esc(s.id)}" aria-label="${label}">${WATER}<span class="sub-ph" aria-hidden="true">${imgTag(roundSrc(s))}</span><span class="sub-name">${esc(s.name)}</span></a></div>`;
  return `<div class="sub-cell"><a class="sub-tile" href="#/s/${esc(s.id)}" aria-label="${label}">${WATER}<span class="sub-name">${esc(s.name)}</span></a>
    <button type="button" class="sub-add" data-act="sub-photo" data-id="${esc(s.id)}" aria-label="Добавить фото для подраздела ${esc(s.name)}"><span>${ICON.plus}</span></button></div>`;
}
const addSub = (href, label) => `<div class="sub-cell"><a class="sub-tile add" href="${href}" aria-label="${label}"><span class="water" aria-hidden="true"></span>${ICON.plus}</a></div>`;
// Сетка камней или воды; в режиме «Переставить» под каждым стрелки влево и вправо
function stonesGrid(list, scope, addHref, addLabel, water){
  const mode = UI.reorder === scope;
  const cell = water ? subHTML : stoneHTML;
  const cells = list.map((s, i) => mode
    ? `<div class="stone-cell">${cell(s)}<div class="move"><button class="icon-btn" data-act="move" data-key="sections" data-scope="${scope}" data-id="${esc(s.id)}" data-dir="-1" aria-label="Переставить левее"${i ? '' : ' disabled'}>${ICON.left}</button><button class="icon-btn" data-act="move" data-key="sections" data-scope="${scope}" data-id="${esc(s.id)}" data-dir="1" aria-label="Переставить правее"${i < list.length - 1 ? '' : ' disabled'}>${ICON.right}</button></div></div>`
    : cell(s)).join('');
  const add = addHref && !mode ? (water ? addSub : addStone)(addHref, addLabel) : '';
  const toggle = list.length > 1 ? `<div class="row-actions"><button class="btn ghost sm" data-act="reorder" data-scope="${scope}">${mode ? 'Готово' : water ? 'Переставить' : 'Переставить камни'}</button></div>` : '';
  return `<div class="${water ? 'subs' : 'stones'}">${cells}${add}</div>${toggle}`;
}

/* ---------- Главная ---------- */
function currentVerse(){
  const list = sortedVerses();
  if(!list.length) return null;
  const p = PERIODS[me().verse_period] || PERIODS.daily;
  let i = 0;
  if(p[1] > 0 && list.length > 1){ const days = Math.round(dnum(todayISO()) - dnum(VERSE_EPOCH)); i = ((Math.floor(days / p[1]) % list.length) + list.length) % list.length; }
  return {v: list[i], i, n: list.length};
}
// Стих дня один для всех: по кругу через список daily_verses в порядке sort
function dailyVerse(){
  const list = [...S.daily].sort(bySort);
  if(!list.length) return null;
  const days = Math.round(dnum(todayISO()) - dnum(VERSE_EPOCH));
  return list[((days % list.length) + list.length) % list.length];
}
// Стих после молитвы: виден, пока сегодня отмечено. Мягко появляется, когда отметку только что поставили;
// при перерисовке анимация продолжается с того же места (отрицательная задержка)
function dayVerseHTML(marked, t){
  if(!marked){ UI.verseDay = ''; return ''; }
  if(UI.verseDay !== t){ UI.verseAt = UI.verseDay === undefined ? 0 : Date.now(); UI.verseDay = t; }
  const v = dailyVerse();
  if(!v) return '';
  const el = Date.now() - UI.verseAt, anim = el < 900 ? ` anim" style="animation-delay:-${el}ms` : '';
  return `<div class="day-verse${anim}"><span class="text">${esc(v.text)}</span>${v.ref ? `<span class="ref">${esc(v.ref)}</span>` : ''}</div>`;
}
function vHome(){
  const cv = currentVerse();
  const verse = cv
    ? `<a class="verse" href="#/verses"><span class="top"><span>Мой стих</span>${cv.n > 1 ? `<span>${cv.i + 1} из ${cv.n}</span>` : ''}</span><span class="text">${esc(cv.v.text)}</span>${cv.v.ref ? `<span class="ref">${esc(cv.v.ref)}</span>` : ''}</a>`
    : `<button type="button" class="verse empty-verse" data-act="new-verse"><span class="top"><span>Мой стих</span></span><span class="text">Нажмите, чтобы вписать стих, который хотите держать перед глазами</span></button>`;
  // неделя с понедельника по воскресенье; будущие дни бледные
  const t = todayISO(), now = new Date(), wi = monIndex(now), mon = addDays(t, -wi);
  let done = 0;
  const days = WDM.map((l, k) => {
    const iso = addDays(mon, k), on = !!dayRec(iso);
    if(on) done++;
    return `<span class="day${on ? ' on' : ''}${k === wi ? ' today' : ''}${k > wi ? ' future' : ''}"><span>${l}</span><i></i></span>`;
  }).join('');
  const marked = !!dayRec(t);
  const week = `<section class="card week-card"><div class="week-top"><div class="wt"><b>${WDF[now.getDay()]}, ${now.getDate()} ${MONF[now.getMonth()]}</b><span>на этой неделе ${done} из 7 дней</span></div>
      <button type="button" class="pray-btn${marked ? ' on' : ''}" data-act="today" aria-pressed="${marked}">${marked ? ICON.check : ''}<span>Помолился</span></button></div>
    <button type="button" class="week" data-act="calendar" aria-label="На этой неделе молился ${done} из 7 дней. Открыть календарь молитв">${days}</button>
    ${dayVerseHTML(marked, t)}</section>`;
  const tops = topSections();
  return `<header class="head"><h1>Молитвенный дневник</h1><a class="me" href="#/profile" aria-label="Профиль">${avatarInner(me())}</a></header>
    ${verse}${week}
    <h2 class="label">Мои разделы</h2>
    ${stonesGrid(tops, 'home', '#/new', 'Создать раздел')}
    ${tops.length ? '' : '<p class="hint">Нажмите на камень, чтобы создать первый раздел: назовите его и выберите цвет.</p>'}`;
}

/* ---------- Раздел ---------- */
function needRow(n){
  const src = n.photo ? roundSrc(n) : '';
  const pic = src ? imgTag(src) : n.photo ? '' : n.answered_at ? ICON.check : ICON.hands;
  const first = String(n.description || '').split('\n').find(x => x.trim()) || '';
  const when = n.answered_at ? `<span class="pill">Отвечено ${fmtDay(n.answered_at)}</span>` : `<span class="when">${prayedText(n.last_prayed_at)}</span>`;
  return `<a class="need-row${n.answered_at ? ' answered' : ''}" href="#/n/${esc(n.id)}"><span class="pic${n.answered_at && !n.photo ? ' ok' : ''}" aria-hidden="true">${pic}</span>
    <span class="txt"><b>${esc(n.title)}</b>${first ? `<span class="desc">${esc(first)}</span>` : ''}${when}</span></a>`;
}
// Значок в шапке раздела: камень, у подраздела круглое фото или маленькая вода
function secMini(s){
  if(!s.parent) return `<span class="mini" aria-hidden="true"><span class="stone" style="${stoneBg(s)}"></span></span>`;
  if(s.photo) return `<span class="mini-round" aria-hidden="true">${imgTag(roundSrc(s))}</span>`;
  return `<span class="mini-water" aria-hidden="true"><span class="water"></span></span>`;
}
function vSection(r){
  const s = byId('sections', r.id);
  if(!s) return notFound();
  const parent = s.parent ? byId('sections', s.parent) : null;
  const subs = parent ? [] : childrenOf(s.id);
  const needs = needsIn(s.id).sort(needSort);
  const counter = [subs.length ? `${subs.length} ${plural(subs.length, SUBS)}` : '', `${needs.length} ${plural(needs.length, NEEDS)}`].filter(Boolean).join(' · ');
  return `<div class="nav-head">${parent ? backLink('#/s/' + esc(parent.id), parent.name) : backLink('#/', 'Главная')}
      <button type="button" class="icon-btn" data-act="sec-menu" data-id="${esc(s.id)}" aria-label="Действия с разделом: изменить, удалить" aria-haspopup="menu">${ICON.more}</button></div>
    <div class="sec-title">${secMini(s)}<div><h1>${esc(s.name)}</h1><span>${counter}</span></div></div>
    ${parent ? '' : `<h2 class="label">Подразделы</h2>${stonesGrid(subs, 's:' + s.id, '#/new?in=' + esc(s.id), 'Создать подраздел', true)}`}
    <h2 class="label">Нужды</h2>
    ${needs.length ? `<div class="needs">${needs.map(needRow).join('')}</div>` : '<p class="hint">Здесь будут нужды этого раздела: люди, просьбы, события.</p>'}
    <button type="button" class="dashed" data-act="new-need" data-id="${esc(s.id)}">+ Добавить нужду</button>`;
}

/* ---------- Нужда ---------- */
function vNeed(r){
  const n = byId('needs', r.id);
  if(!n) return notFound();
  const sec = byId('sections', n.section);
  const t = todayISO();
  // круглое фото посередине; без фото на его месте ничего нет
  const photo = n.photo
    ? `<button type="button" class="need-photo" data-act="view-photo" data-id="${esc(n.id)}" aria-label="Открыть фото целиком">${imgTag(n.photo_round ? photoSrc(n, 'photo_round') : photoSrc(n, 'photo', '800x0'))}</button>`
    : '';
  const prayedToday = n.last_prayed_at === t;
  const prayers = S.prayers.filter(p => p.need === n.id).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created).localeCompare(String(a.created)));
  const files = S.files.filter(f => f.need === n.id).sort((a, b) => String(b.created).localeCompare(String(a.created)));
  const meta = ['С ' + fmtDay(createdISO(n)), n.answered_at ? '' : prayedText(n.last_prayed_at).toLowerCase()].filter(Boolean).join(' · ');
  // открыли из группы: «Назад» ведёт в группу
  const fromG = r.q.get('g') ? byId('groups', r.q.get('g')) : null;
  return `<div class="nav-head">${fromG ? backLink('#/g/' + esc(fromG.id), fromG.name) : backLink('#/s/' + esc(n.section), pathOf(sec).join(' › ') || 'Раздел')}
      <button type="button" class="icon-btn" data-act="need-menu" data-id="${esc(n.id)}" aria-label="Действия с нуждой: изменить, перенести, удалить" aria-haspopup="menu">${ICON.more}</button></div>
    ${photo}
    <div class="need-head${n.photo ? ' center' : ''}"><h1>${esc(n.title)}</h1><span>${esc(meta)}</span></div>
    ${n.description ? `<p class="prose">${esc(n.description)}</p>` : ''}
    <div class="btn-row">
      <button type="button" class="btn ${prayedToday ? 'soft' : 'primary'}" data-act="prayed" data-id="${esc(n.id)}">${prayedToday ? 'Молился сегодня' : 'Помолился'}</button>
      <button type="button" class="btn ${n.answered_at ? 'soft' : 'outline'}" data-act="answered" data-id="${esc(n.id)}">${n.answered_at ? ICON.check : ''}Отвечено</button>
    </div>
    ${n.answered_at ? `<div class="answer"><b>Отвечено ${fmtDay(n.answered_at)}</b>${n.answer_note ? `<p>${esc(n.answer_note)}</p>` : ''}</div>` : ''}
    ${needShareHTML(n)}
    <h2 class="label">Мои молитвы <span class="side">${ICON.lock}видно только вам</span></h2>
    ${prayers.length ? `<div class="entries">${prayers.map(p => `<button type="button" class="entry" data-act="edit-prayer" data-id="${esc(p.id)}"><small>${fmtDay(p.date)}</small><span>${esc(p.text)}</span></button>`).join('')}</div>` : ''}
    <button type="button" class="dashed" data-act="new-prayer" data-id="${esc(n.id)}">+ Записать молитву</button>
    <details class="fold" id="files-fold"${UI.filesOpen ? ' open' : ''}><summary><span>${ICON.clip}Файлы · ${files.length}</span>${ICON.chev}</summary>
      <div class="fold-body">
        ${files.length ? `<div>${files.map(fileRow).join('')}</div>` : '<p class="hint">Документы и картинки к этой нужде. Их видите только вы.</p>'}
        <label class="btn sm upload" for="nf-input" style="align-self:flex-start">${ICON.clip}Прикрепить файл<input type="file" id="nf-input" multiple accept="${FILE_EXT.map(x => '.' + x).join(',')},image/*"></label>
        <p class="hint" style="font-size:12.5px">PDF, Word (doc, docx) и картинки, до 20 МБ каждый.</p>
      </div></details>`;
}

/* ---------- Новый раздел и изменение раздела ---------- */
function formInit(r){
  if(UI.form && UI.form.key === location.hash) return UI.form;
  const s = r.name === 'edit' ? byId('sections', r.id) : null;
  const inId = r.q.get('in');
  const inSec = inId ? byId('sections', inId) : null;
  // ph: фото подраздела после окна обрезки ({file, round, crop, preview} или {remove: true})
  UI.form = s
    ? {key: location.hash, id: s.id, name: s.name, color: s.color || 'granite', place: s.parent ? 'inside' : 'home', parent: s.parent || '', ph: null}
    : {key: location.hash, id: '', name: '', color: 'granite', place: inSec && !inSec.parent ? 'inside' : 'home', parent: inSec && !inSec.parent ? inSec.id : '', ph: null};
  return UI.form;
}
function vSectionForm(r){
  if(r.name === 'edit' && !byId('sections', r.id)) return notFound();
  const f = formInit(r);
  const c = COLORS[f.color] || COLORS.granite;
  const hasSubs = f.id && childrenOf(f.id).length > 0;
  const cands = topSections().filter(s => s.id !== f.id);
  const canInside = !hasSubs && cands.length > 0;
  if(f.place === 'inside' && !canInside) f.place = 'home';
  if(f.place === 'inside' && !cands.some(s => s.id === f.parent)) f.parent = cands[0].id;
  const sw = Object.entries(COLORS).map(([k, v]) => `<button type="button" class="swatch" data-act="pick-color" data-color="${k}" aria-label="${v.n}" aria-pressed="${k === f.color}"><span><span class="stone" style="background-color:${v.c}" aria-hidden="true"></span></span></button>`).join('');
  const why = hasSubs ? 'У раздела есть подразделы, поэтому он остаётся на главной.' : !cands.length ? 'Внутрь можно положить, когда на главной появится другой раздел.' : '';
  const inside = f.place === 'inside';
  const parents = inside ? `<div class="parents" role="radiogroup" aria-label="Внутри какого раздела">${cands.map(s => `<label><input type="radio" name="f-parent" value="${esc(s.id)}"${s.id === f.parent ? ' checked' : ''}><span class="dot" aria-hidden="true"><span class="stone" style="${stoneBg(s)}"></span></span><span>${esc(s.name)}</span></label>`).join('')}</div>` : '';
  // у подраздела вместо цвета камня фото по желанию
  const src = formPhotoSrc(f), hasPh = !!(src || (f.ph && !f.ph.remove) || (!f.ph && f.id && byId('sections', f.id).photo));
  const preview = inside
    ? `<div class="sub-tile pv-sub${hasPh ? ' has-photo' : ''}" id="pv">${WATER}${hasPh ? `<span class="sub-ph" aria-hidden="true">${imgTag(src)}</span>` : ''}<span class="sub-name" id="pv-name">${esc(f.name || 'Название')}</span></div>`
    : `<div class="preview ink-${c.ink}" id="pv"><span class="stone-shadow" aria-hidden="true"></span><span class="stone" id="pv-stone" style="background-color:${c.c}" aria-hidden="true"></span><span class="pv-name" id="pv-name">${esc(f.name || 'Название')}</span></div>`;
  const look = inside
    ? `<div class="field"><span class="flabel">Фото (по желанию)</span><div class="ph-pick"><span class="thumb round">${imgTag(src) || ICON.photo}</span>
        <div class="acts"><button type="button" class="btn sm" data-act="form-photo">${hasPh ? 'Изменить фото' : 'Поставить фото'}</button>${hasPh ? '<button type="button" class="btn sm ghost danger" data-act="form-photo-remove">Убрать</button>' : ''}</div></div></div>`
    : `<div class="field"><span class="flabel" id="f-color-l">Цвет камня: ${c.n}</span><div class="swatches">${sw}</div></div>`;
  return `<div class="form-head"><button type="button" class="back" data-act="cancel-form">Отмена</button><h1>${f.id ? 'Изменить раздел' : 'Новый раздел'}</h1><span></span></div>
    ${preview}
    <div class="field"><label for="f-name">Название</label><input id="f-name" type="text" maxlength="100" autocomplete="off" placeholder="Например, Семья" value="${esc(f.name)}"></div>
    ${look}
    <div class="field"><span class="flabel">Где будет раздел</span>
      <div class="choice"><button type="button" data-act="place" data-place="home" aria-pressed="${f.place === 'home'}">На главной</button><button type="button" data-act="place" data-place="inside" aria-pressed="${f.place === 'inside'}"${canInside ? '' : ' disabled'}>Внутри раздела</button></div>
      ${parents}${why ? `<p class="hint">${why}</p>` : ''}</div>
    <p class="form-err" id="f-err" hidden></p>
    <button type="button" class="btn primary big wide" data-act="save-section">${f.id ? 'Сохранить' : 'Создать раздел'}</button>`;
}
// Картинка фото в форме раздела: только что обрезанное или уже сохранённое
function formPhotoSrc(f){
  if(f.ph) return f.ph.remove ? '' : f.ph.preview || '';
  const s = f.id ? byId('sections', f.id) : null;
  return s && s.photo ? roundSrc(s) : '';
}
async function saveSection(btn){
  const f = UI.form; if(!f) return;
  const err = $('#f-err');
  f.name = ($('#f-name')?.value || '').trim();
  if(!f.name){ err.textContent = 'Введите название раздела.'; err.hidden = false; $('#f-name').focus(); return; }
  const parent = f.place === 'inside' ? f.parent : '';
  btn.disabled = true;
  try {
    if(f.id){
      const old = byId('sections', f.id);
      const data = {name: f.name, color: f.color, parent};
      if((old.parent || '') !== parent) data.sort = nextSort(S.sections.filter(s => (s.parent || '') === parent));
      if(parent && f.ph) Object.assign(data, photoData(f.ph));
      await col('sections').doc(f.id).update(data);
      toast('Раздел сохранён');
    } else {
      const data = {name: f.name, color: f.color, parent, sort: nextSort(S.sections.filter(s => (s.parent || '') === parent))};
      if(parent && f.ph && !f.ph.remove) Object.assign(data, photoData(f.ph));
      await col('sections').doc().create(data);
      toast('Раздел создан');
    }
    UI.form = null;
    goBack(parent ? '#/s/' + parent : '#/');
  } catch(e){ err.textContent = errText(e); err.hidden = false; btn.disabled = false; }
}
const nextSort = list => list.reduce((m, x) => Math.max(m, x.sort ?? 0), -1) + 1;

/* ---------- Мои стихи ---------- */
function vVerses(){
  const list = sortedVerses(), cv = currentVerse(), per = me().verse_period || 'daily';
  const mode = UI.reorder === 'verses';
  const items = list.map((v, i) => `<div class="verse-item${cv && cv.v.id === v.id ? ' current' : ''}"><div class="vi">
      ${cv && cv.v.id === v.id ? '<span class="pill">Сейчас на главной</span>' : ''}<span class="vt">${esc(v.text)}</span>${v.ref ? `<span class="vr">${esc(v.ref)}</span>` : ''}</div>
      ${mode ? `<div class="vbtns"><button class="icon-btn" data-act="move" data-key="verses" data-scope="verses" data-id="${esc(v.id)}" data-dir="-1" aria-label="Выше"${i ? '' : ' disabled'}>${ICON.up}</button><button class="icon-btn" data-act="move" data-key="verses" data-scope="verses" data-id="${esc(v.id)}" data-dir="1" aria-label="Ниже"${i < list.length - 1 ? '' : ' disabled'}>${ICON.down}</button></div>`
        : `<button type="button" class="icon-btn" data-act="edit-verse" data-id="${esc(v.id)}" aria-label="Изменить стих${v.ref ? ': ' + esc(v.ref) : ''}">${ICON.pen}</button>`}</div>`).join('');
  return `<div class="nav-head">${backLink('#/profile', 'Профиль')}</div>
    <div><h1 class="title">Мои стихи</h1><p class="lead">Стих на главной меняется по кругу. Можно вписать до ${MAX_VERSES} стихов.</p></div>
    <section class="card"><h2>Менять стих</h2><div class="choice four">${Object.entries(PERIODS).map(([k, p]) => `<button type="button" data-act="period" data-period="${k}" aria-pressed="${k === per}">${p[0]}</button>`).join('')}</div></section>
    <h2 class="label">Стихи <span class="side">${list.length} из ${MAX_VERSES}</span></h2>
    ${list.length ? `<div class="entries">${items}</div>` : '<p class="hint">Стихов пока нет. Впишите стих, который хотите держать перед глазами.</p>'}
    ${list.length > 1 ? `<div class="row-actions"><button class="btn ghost sm" data-act="reorder" data-scope="verses">${mode ? 'Готово' : 'Переставить'}</button></div>` : ''}
    <button type="button" class="dashed" data-act="new-verse"${list.length >= MAX_VERSES ? ' disabled' : ''}>${list.length >= MAX_VERSES ? `Вписано ${MAX_VERSES} из ${MAX_VERSES} стихов` : `+ Добавить стих (${list.length} из ${MAX_VERSES})`}</button>`;
}

/* ---------- Ответы на молитвы ---------- */
function vAnswers(){
  const list = S.needs.filter(n => n.answered_at).sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at)));
  return `<div class="nav-head">${backLink('#/profile', 'Профиль')}</div>
    <div><h1 class="title">Ответы на молитвы</h1><p class="lead">Нужды, которые вы отметили как отвеченные, по дате ответа.</p></div>
    ${list.length ? `<div class="answers">${list.map(n => `<a class="ans" href="#/n/${esc(n.id)}"><small>${fmtDay(n.answered_at)} · ${esc(pathOf(byId('sections', n.section)).join(' › '))}</small><b>${esc(n.title)}</b>${n.answer_note ? `<p>${esc(n.answer_note)}</p>` : ''}</a>`).join('')}</div>`
      : '<p class="hint">Когда вы отметите нужду кнопкой «Отвечено», она появится здесь.</p>'}`;
}

/* ---------- Группы ---------- */
const byCreated = (a, b) => String(a.created).localeCompare(String(b.created));
const sortedGroups = () => [...S.groups].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru') || byCreated(a, b));
const membersOf = gid => S.gmembers.filter(m => m.group === gid).sort(byCreated);
const person = uid => uid === me().id ? me() : byId('people', uid) || {id: uid, name: ''};
const nameOf = u => (u && u.name) || 'Без имени';
const linksOf = gid => S.glinks.filter(l => l.group === gid);
const linksOfNeed = nid => S.glinks.filter(l => l.need === nid);
const linkNeed = l => l ? byId('needs', l.need) || byId('shared', l.need) : null;
// Кто сегодня отметил «Помолился» у общей нужды
const prayingOf = lid => { const t = todayISO(); return S.gpray.filter(p => p.group_need === lid && p.date === t).sort(byCreated); };
const isOwner = g => !!g && g.owner === me().id;
const MEMBERS = ['участник','участника','участников'];
const prayCount = n => n ? `Сегодня молились: ${n}` : 'Сегодня ещё никто не молился';
const groupLink = g => `${location.origin}/?group=${g.invite_code || ''}`;
// Дни молитвы участника в группе: день есть, если он отметил хотя бы одну нужду этой группы. Личный дневник не учитывается.
const marksOf = (gid, uid) => S.gdays.filter(d => d.group === gid && d.user === uid).map(d => d.date);
const prayedToday = gid => { const t = todayISO(); return membersOf(gid).filter(m => marksOf(gid, m.user).includes(t)).length; };
const faceHTML = (u, cls) => `<span class="face${cls ? ' ' + cls : ''}" aria-hidden="true">${avatarInner(u)}</span>`;
const groupGone = () => `<div class="nav-head">${backLink('#/groups', 'Группы')}</div>
  <div class="card"><p>Группа не найдена: возможно, её удалили или вас из неё исключили.</p><a class="btn" href="#/groups">К группам</a></div>`;

function vGroups(){
  const list = sortedGroups();
  const cards = list.map(g => {
    const ms = membersOf(g.id), k = linksOf(g.id).length;
    const faces = ms.slice(0, 7).map(m => faceHTML(person(m.user))).join('') + (ms.length > 7 ? `<span class="face more" aria-hidden="true">+${ms.length - 7}</span>` : '');
    return `<a class="group-card" href="#/g/${esc(g.id)}"><span class="gc-top"><b>${esc(g.name)}</b>${ICON.chev}</span>
      <span class="faces">${faces}</span>
      <span class="gc-meta">Сегодня молились ${prayedToday(g.id)} из ${ms.length} · ${k} ${plural(k, NEEDS)}</span></a>`;
  }).join('');
  const full = list.length >= MAX_GROUPS;
  return `<header class="head"><h1>Группы</h1></header>
    ${list.length ? `<div class="groups">${cards}</div>`
      : '<section class="card"><p class="empty">Группа нужна, чтобы молиться вместе: делиться нуждами и видеть, кто сегодня молился. Чтобы молиться вдвоём, создайте группу и отправьте ссылку близкому человеку.</p></section>'}
    <button type="button" class="${list.length ? 'dashed' : 'btn primary big wide'}" data-act="new-group"${full ? ' disabled' : ''}>${full ? `Вы уже в ${MAX_GROUPS} группах` : list.length ? '+ Создать группу' : 'Создать группу'}</button>`;
}

// Кнопка «Помолился» у общей нужды (как на главной) и счётчик «Сегодня молились»
function gPrayBtn(l){ const on = prayingOf(l.id).some(p => p.user === me().id);
  return `<button type="button" class="pray-btn${on ? ' on' : ''}" data-act="g-pray" data-id="${esc(l.id)}" aria-pressed="${on}">${on ? ICON.check : ''}<span>Помолился</span></button>`; }
function gCount(l){ const k = prayingOf(l.id).length;
  return k ? `<button type="button" class="gn-count" data-act="g-who" data-id="${esc(l.id)}">${prayCount(k)}</button>` : `<span class="gn-count none">${prayCount(0)}</span>`; }
// заметку об ответе сервер присылает участникам, только если владелец ею поделился
const sharedNote = n => n.answered_at && n.answer_shared && n.answer_note ? n.answer_note : '';

// Общая нужда в списке группы: фото, название, кто добавил и когда, «Помолился» и счётчик.
// У отвеченной нужды вместо кнопки пометка «Отвечено» и заметка, если владелец ею поделился.
function gneedRow(l, n){
  const src = n.photo ? roundSrc(n) : '';
  const pic = src ? imgTag(src) : n.photo ? '' : n.answered_at ? ICON.check : ICON.hands;
  const who = l.added_by === me().id ? 'Вы' : nameOf(person(l.added_by));
  const href = n.owner === me().id ? `#/n/${esc(n.id)}?g=${esc(l.group)}` : `#/gn/${esc(l.id)}`;
  const note = sharedNote(n);
  return `<div class="gneed${n.answered_at ? ' answered' : ''}">
    <a class="gn-main" href="${href}"><span class="pic${n.answered_at && !n.photo ? ' ok' : ''}" aria-hidden="true">${pic}</span>
      <span class="txt"><b>${esc(n.title)}</b><span class="when">${esc(who)} · ${fmtDay(createdISO(l))}</span></span></a>
    ${n.answered_at ? `<span class="pill gn-ans">Отвечено ${fmtDay(n.answered_at)}</span>${note ? `<p class="gn-note">${esc(note)}</p>` : ''}` : gPrayBtn(l) + gCount(l)}</div>`;
}

function vGroup(r){
  const g = byId('groups', r.id);
  if(!g) return groupGone();
  const ms = membersOf(g.id), own = isOwner(g);
  // неделя группы: строка на участника, семь кружков с понедельника, сегодняшний столбец выделен
  const wi = monIndex(new Date()), dates = WDM.map((_, k) => addDays(weekStart(), k));
  const head = `<span></span>${WDM.map((l, k) => `<span class="gw-l${k === wi ? ' today' : ''}" aria-hidden="true">${l}</span>`).join('')}`;
  const rows = ms.map(m => {
    const u = person(m.user), marks = marksOf(g.id, m.user), mine = m.user === me().id;
    const cnt = dates.filter(d => marks.includes(d)).length;
    return `<span class="gw-who">${faceHTML(u, 'sm')}<span class="nm${mine ? ' self' : ''}">${esc(nameOf(u))}${mine ? ' (вы)' : ''}</span>
        <span class="sr">: на этой неделе ${cnt} из 7 дней, сегодня ${marks.includes(dates[wi]) ? 'отмечено' : 'не отмечено'}</span></span>` +
      dates.map((iso, k) => `<i class="gw-d${marks.includes(iso) ? ' on' : ''}${k === wi ? ' today' : ''}${k > wi ? ' future' : ''}" aria-hidden="true"></i>`).join('');
  }).join('');
  // общие нужды: новые сверху, отвеченные внизу
  const links = linksOf(g.id).map(l => ({l, n: linkNeed(l)})).filter(x => x.n)
    .sort((a, b) => (!!a.n.answered_at - !!b.n.answered_at) || String(b.l.created).localeCompare(String(a.l.created)));
  const alone = own && ms.length < 2
    ? `<section class="card invite-card"><h2>Пригласите участников</h2><p class="hint">Отправьте ссылку тем, с кем хотите молиться вместе. Вступить смогут те, у кого уже есть аккаунт в приложении.</p>
        <button type="button" class="btn primary" data-act="g-invite" data-id="${esc(g.id)}">Пригласить</button></section>` : '';
  return `<div class="nav-head">${backLink('#/groups', 'Группы')}<div class="nav-acts">
      ${own ? `<button type="button" class="pill-btn" data-act="g-invite" data-id="${esc(g.id)}">Пригласить</button>` : ''}
      <button type="button" class="icon-btn" data-act="g-menu" data-id="${esc(g.id)}" aria-label="Действия с группой" aria-haspopup="menu">${ICON.more}</button></div></div>
    <div class="g-title"><h1 class="title">${esc(g.name)}</h1><span>${ms.length} ${plural(ms.length, MEMBERS)} · ${own ? 'вы создатель' : 'создатель ' + esc(nameOf(person(g.owner)))}</span></div>
    ${alone}
    <section class="card gweek"><div class="gw-top"><b>Неделя группы</b><span>Сегодня молились ${prayedToday(g.id)} из ${ms.length}</span></div>
      <div class="gw-grid">${head}${rows}</div></section>
    <h2 class="label">Общие нужды${links.length ? `<span class="side">${links.length}</span>` : ''}</h2>
    ${links.length ? `<div class="needs">${links.map(x => gneedRow(x.l, x.n)).join('')}</div>`
      : '<p class="hint">Здесь будут нужды, которыми участники поделились с группой. Записи молитв и файлы при этом видит только владелец нужды.</p>'}
    <button type="button" class="dashed" data-act="g-add-need" data-id="${esc(g.id)}">+ Нужда в группу</button>`;
}

// Чужая общая нужда: только чтение. Свою нужду владелец видит как обычно, со всеми кнопками.
function vGroupNeed(r){
  const l = byId('glinks', r.id), g = l && byId('groups', l.group), n = linkNeed(l);
  if(!g) return groupGone();
  if(!n) return notFound();
  if(n.owner === me().id) return vNeed({id: n.id, q: new URLSearchParams('g=' + g.id)});
  const owner = nameOf(person(n.owner));
  const photo = n.photo
    ? `<button type="button" class="need-photo" data-act="view-photo" data-id="${esc(n.id)}" aria-label="Открыть фото целиком">${imgTag(n.photo_round ? photoSrc(n, 'photo_round') : photoSrc(n, 'photo', '800x0'))}</button>` : '';
  const note = sharedNote(n);
  const answer = !n.answered_at ? ''
    : note ? `<div class="answer"><b>Как Бог ответил · ${fmtDay(n.answered_at)}</b><p>${esc(note)}</p></div>`
    : `<div class="answer"><b>Отвечено ${fmtDay(n.answered_at)}</b></div>`;
  return `<div class="nav-head">${backLink('#/g/' + esc(g.id), g.name)}</div>
    ${photo}
    <div class="need-head${n.photo ? ' center' : ''}"><h1>${esc(n.title)}</h1><span>${esc(owner)} · ${fmtDay(createdISO(l))}</span></div>
    ${n.description ? `<p class="prose">${esc(n.description)}</p>` : ''}
    ${n.answered_at ? answer : `<div class="gn-pray">${gPrayBtn(l)}${gCount(l)}</div>`}
    <p class="hint">Записи молитв и файлы этой нужды видит только ${esc(owner)}.</p>`;
}

// Приглашение по ссылке ?group=КОД: название группы и создатель, кнопка «Вступить»
function vJoin(r){
  const code = r.id;
  if(!UI.join || UI.join.code !== code){ UI.join = {code, data: null, err: ''}; loadJoin(code); }
  const j = UI.join, head = '<header class="head"><h1>Приглашение в группу</h1></header>';
  if(j.err) return head + `<section class="card"><p>${esc(j.err)}</p><a class="btn" href="#/groups">К группам</a></section>`;
  if(!j.data) return head + '<div class="loading">Проверяю ссылку…</div>';
  const d = j.data;
  const top = `<span class="join-ic" aria-hidden="true">${ICON.group}</span><h2>${esc(d.name)}</h2>
    <p class="muted">Создатель: ${esc(d.owner || 'без имени')} · ${d.members} ${plural(d.members, MEMBERS)}</p>`;
  if(d.member) return head + `<section class="card join-card">${top}<p>Вы уже участник этой группы.</p><a class="btn primary big wide" href="#/g/${esc(d.id)}">Открыть группу</a></section>`;
  if(d.full) return head + `<section class="card join-card">${top}<p>В группе уже ${MAX_MEMBERS} участников, больше вступить нельзя.</p><a class="btn wide" href="#/groups">К группам</a></section>`;
  return head + `<section class="card join-card">${top}
    <p class="hint">Участники увидят ваше имя, фото профиля, в какие дни вы молились в группе, за какие общие нужды молились сегодня, и нужды, которыми вы сами поделитесь. Записи молитв и файлы останутся видны только вам.</p>
    <button type="button" class="btn primary big wide" data-act="join" data-code="${esc(code)}">Вступить</button>
    <a class="btn ghost wide" href="#/groups">Не сейчас</a></section>`;
}
async function loadJoin(code){
  try { const d = await pb.send('/api/molitva/join/' + encodeURIComponent(code), {}); if(UI.join && UI.join.code === code) UI.join.data = d; }
  catch(e){ if(UI.join && UI.join.code === code) UI.join.err = errText(e); }
  schedule();
}

// Блок в своей нужде: в каких группах, кто молится, виден ли ответ группе
function needShareHTML(n){
  const ls = linksOfNeed(n.id).map(l => ({l, g: byId('groups', l.group)})).filter(x => x.g);
  if(!ls.length) return `<button type="button" class="btn outline share-btn" data-act="share-need" data-id="${esc(n.id)}">${ICON.group}Поделиться с группой</button>`;
  const names = ls.map(x => `<a href="#/g/${esc(x.g.id)}">${esc(x.g.name)}</a>`).join(', ');
  const counts = n.answered_at ? '' : ls.map(x => { const k = prayingOf(x.l.id).length; return k ? `<button type="button" class="gn-count" data-act="g-who" data-id="${esc(x.l.id)}">${ls.length > 1 ? esc(x.g.name) + ': ' : ''}${prayCount(k)}</button>` : ''; }).join('');
  const ans = n.answered_at
    ? `<div class="share-ans"><span>${n.answer_shared ? 'Ответ виден группе' : 'Ответ видите только вы'}</span><button type="button" class="btn sm" data-act="answer-share" data-id="${esc(n.id)}">${n.answer_shared ? 'Скрыть от группы' : 'Показать группе'}</button></div>` : '';
  return `<section class="share"><div class="share-top">${ICON.group}<p>В группах: ${names}</p><button type="button" class="btn sm ghost" data-act="share-need" data-id="${esc(n.id)}">Изменить</button></div>
    ${counts ? `<div class="share-counts">${counts}</div>` : ''}${ans}</section>`;
}

async function shareNeed(needId, groupId){
  upsert('glinks', await pb.collection('group_needs').create({id: newId(), group: groupId, need: needId}));
}
// «Поделиться с группой»: галочки своих групп; снятая галочка убирает нужду из группы
function openShare(n){
  const gs = sortedGroups();
  if(!gs.length){
    openForm({title: 'Поделиться с группой', text: 'Поделиться нуждой можно только через группу. Создайте группу, даже из двух человек, и пригласите туда близких.', submit: 'Создать группу',
      async onSave(){ thenOpen(openNewGroup); }});
    return;
  }
  const now = linksOfNeed(n.id);
  openForm({title: 'Поделиться с группой',
    text: 'Нужда останется в вашем разделе, в группе появится ссылка на неё. Участники увидят название, описание и фото. Записи молитв и файлы видны только вам.' + (now.length ? ' Если снять галочку, нужда пропадёт из группы. Дни, когда участники за неё молились, в неделе группы останутся.' : ''),
    fields: [{key:'groups', label:'Мои группы', type:'checks', options: gs.map(g => { const k = membersOf(g.id).length; return [g.id, g.name, `${k} ${plural(k, MEMBERS)}`]; })}],
    values: {groups: now.map(l => l.group)}, submit: 'Сохранить',
    async onSave(v){
      const add = v.groups.filter(id => !now.some(l => l.group === id));
      const del = now.filter(l => !v.groups.includes(l.group));
      for(const id of add) await shareNeed(n.id, id);
      for(const l of del){ await pb.collection('group_needs').delete(l.id); removeLocal('glinks', l.id); }
      toast(add.length || del.length ? 'Сохранено' : 'Без изменений');
    }});
}
// «+ Нужда в группу»: выбрать из своих нужд или создать новую
function openAddToGroup(g){
  const inG = new Set(linksOf(g.id).map(l => l.need));
  const avail = S.needs.filter(n => !inG.has(n.id)).sort(needSort);
  if(!avail.length){ openNeed(null, null, g.id); return; }
  openForm({title: 'Нужда в группу', text: `Отметьте свои нужды для группы «${g.name}» или создайте новую.`,
    fields: [{key:'needs', label:'Мои нужды', type:'checks', options: avail.map(n => [n.id, n.title, pathOf(byId('sections', n.section)).join(' › ')])}],
    html: '<button type="button" class="dashed" data-dlg="new">+ Создать новую нужду</button>',
    submit: 'Добавить',
    onClick(b){ if(b.dataset.dlg === 'new') openNeed(null, null, g.id); },
    async onSave(v){
      if(!v.needs.length) throw new Error('Отметьте хотя бы одну нужду или создайте новую.');
      for(const id of v.needs) await shareNeed(id, g.id);
      toast(v.needs.length > 1 ? 'Нужды добавлены в группу' : 'Нужда добавлена в группу');
    }});
}

// «Помолился» у общей нужды: отметка только за сегодня, повторное нажатие снимает её.
// День молитвы в группе ставит и снимает сервер, поэтому после нажатия перечитываем дни групп.
// Личную отметку дня и «последнюю молитву» у нужды это нажатие не трогает.
async function togglePraying(lid, btn){
  const mine = prayingOf(lid).find(p => p.user === me().id);
  btn.disabled = true;
  try {
    if(mine){ await pb.collection('group_praying').delete(mine.id); removeLocal('gpray', mine.id); }
    else upsert('gpray', await pb.collection('group_praying').create({id: newId(), group_need: lid, user: me().id, date: todayISO()}));
    loadAll(['gdays']).catch(() => {});
  } catch(e){ toast(errText(e)); refreshGroups(); }
  finally { btn.disabled = false; }
}
// Список людей с кружками: участники группы или те, кто молится
const personRow = (uid, extra) => { const u = person(uid); return `<div class="member">${faceHTML(u)}<div class="mb-main"><b>${esc(nameOf(u))}${uid === me().id ? ' (вы)' : ''}</b>${extra || ''}</div></div>`; };
function openPraying(lid){
  const pr = prayingOf(lid);
  openForm({title: 'Сегодня молились', html: pr.length ? `<div class="members">${pr.map(p => personRow(p.user)).join('')}</div>` : '<p class="hint">Сегодня за эту нужду ещё никто не отметил «Помолился».</p>',
    submit: 'Готово', noCancel: true, async onSave(){}});
}

function openNewGroup(){
  if(S.groups.length >= MAX_GROUPS){ info('Групп уже много', `Можно состоять не больше чем в ${MAX_GROUPS} группах. Чтобы создать новую, выйдите из одной из старых.`); return; }
  openForm({title: 'Новая группа', fields: [{key:'name', label:'Название', required:true, max:100, placeholder:'Например, Семья'}], submit: 'Создать',
    async onSave(v){
      const res = await pb.send('/api/molitva/groups', {method: 'POST', body: {name: v.name}});
      await loadAll(GKEYS);
      go('#/g/' + res.id); toast('Группа создана');
    }});
}
function openInvite(g){
  const link = groupLink(g);
  openForm({title: 'Пригласить в группу',
    text: 'Отправьте ссылку тем, с кем хотите молиться вместе. Вступить смогут те, у кого уже есть аккаунт в приложении: регистрация по-прежнему только по приглашению администратора.',
    html: `<div class="field"><label for="g-link">Ссылка на группу «${esc(g.name)}»</label><input type="text" id="g-link" readonly value="${esc(link)}"></div>
      <div class="share-btns"><button type="button" class="btn primary" data-dlg="copy">Скопировать</button>${navigator.share ? '<button type="button" class="btn" data-dlg="share">Поделиться</button>' : ''}</div>`,
    submit: 'Готово', noCancel: true, async onSave(){},
    onClick(b){
      if(b.dataset.dlg === 'copy') copyText(link);
      if(b.dataset.dlg === 'share') navigator.share({title: 'Молитвенный дневник', text: `Приглашаю в группу «${g.name}» в Молитвенном дневнике`, url: link}).catch(() => {});
    }});
}
function openMembers(g){
  const own = isOwner(g);
  const rows = membersOf(g.id).map(m => {
    const acts = own && m.user !== me().id ? `<div class="mb-acts"><button type="button" class="btn sm" data-dlg="owner" data-id="${esc(m.user)}">Сделать создателем</button><button type="button" class="btn sm ghost danger" data-dlg="kick" data-id="${esc(m.user)}">Исключить</button></div>` : '';
    return personRow(m.user, (m.user === g.owner ? '<span class="pill">создатель</span>' : '') + acts);
  }).join('');
  openForm({title: 'Участники', text: own ? 'Если исключить участника, его нужды пропадут из группы, а его отметки молитвы в ней удалятся.' : '',
    html: `<div class="members">${rows}</div>`, submit: 'Готово', noCancel: true, async onSave(){},
    async onClick(b){
      const kick = b.dataset.dlg === 'kick';
      if(!arm(b, kick ? 'Точно исключить?' : 'Точно передать?')) return;
      b.disabled = true;
      try {
        await pb.send(`/api/molitva/groups/${g.id}/${kick ? 'remove' : 'owner'}`, {method: 'POST', body: {user: b.dataset.id}});
        await loadAll(GKEYS);
        toast(kick ? 'Участник исключён' : 'Роль создателя передана');
        const g2 = byId('groups', g.id);
        if(g2 && dlg.open && cur && cur.title === 'Участники') openMembers(g2);
      } catch(e){ toast(errText(e)); b.disabled = false; }
    }});
}
function openRenameGroup(g){
  openForm({title: 'Название группы', fields: [{key:'name', label:'Название', required:true, max:100}], values: g,
    async onSave(v){ upsert('groups', await pb.collection('groups').update(g.id, {name: v.name})); toast('Сохранено'); }});
}
function openNewLink(g){
  openForm({title: 'Сделать новую ссылку?', text: 'Старая ссылка сразу перестанет работать. Те, кто уже вступил, останутся в группе.', submit: 'Сделать новую',
    async onSave(){
      const res = await pb.send(`/api/molitva/groups/${g.id}/link`, {method: 'POST'});
      const g2 = {...g, invite_code: res.invite_code};
      upsert('groups', g2); thenOpen(() => openInvite(g2));
    }});
}
function leaveGroup(g){
  const own = isOwner(g);
  if(own && membersOf(g.id).length > 1){
    info('Сначала передайте роль создателя', 'Создатель не может просто выйти из группы. Откройте «Участники» и нажмите «Сделать создателем» рядом с тем, кто будет вести группу. После этого можно выйти.');
    return;
  }
  openForm({title: 'Выйти из группы?', submit: 'Выйти', danger: true,
    text: own ? `Вы единственный участник, поэтому группа «${g.name}» удалится.` : `Ваши нужды пропадут из группы «${g.name}», ваши отметки молитвы в ней удалятся. В вашем дневнике всё останется.`,
    async onSave(){
      await pb.send(`/api/molitva/groups/${g.id}/leave`, {method: 'POST'});
      await loadAll(GKEYS);
      toast(own ? 'Группа удалена' : 'Вы вышли из группы'); go('#/groups', true);
    }});
}
function deleteGroup(g){
  openForm({title: 'Удалить группу?', submit: 'Удалить', danger: true,
    text: `Группа «${g.name}» удалится у всех участников вместе со списком общих нужд и отметками молитвы. Сами нужды останутся в дневниках их владельцев.`,
    async onSave(){ await pb.collection('groups').delete(g.id); await loadAll(GKEYS); toast('Группа удалена'); go('#/groups', true); }});
}
function groupMenu(btn, g){
  const own = isOwner(g);
  openMenu(btn, [
    ...(own ? [{label: 'Пригласить', run: () => openInvite(g)}] : []),
    {label: 'Участники', run: () => openMembers(g)},
    ...(own ? [{label: 'Переименовать', run: () => openRenameGroup(g)}, {label: 'Новая ссылка', run: () => openNewLink(g)}] : []),
    {label: 'Выйти из группы', danger: !own, run: () => leaveGroup(g)},
    ...(own ? [{label: 'Удалить группу', danger: true, run: () => deleteGroup(g)}] : [])
  ]);
}
// Открыли группы: освежаем отметки молитвы не чаще раза в минуту (живые обновления могли прерваться, мог смениться день)
let gprayAt = 0;
window.addEventListener('hashchange', () => {
  if(!['groups','g','gn'].includes(route().name) || !S.loaded || Date.now() - gprayAt < 60e3) return;
  gprayAt = Date.now(); loadAll(['gpray','gdays']).catch(() => {});
});

/* ---------- Материалы ---------- */
// Список общий для всех, ведёт его администратор. У каждого человека свои отметки (marks):
// закреплено, в архиве, когда открыл, где остановился в аудио или видео.
const markOf = id => S.marks.find(m => m.material === id);
// Свежие сверху; поле sort поднимает материал выше (больше число — выше)
const matSort = (a, b) => (b.sort ?? 0) - (a.sort ?? 0) || String(b.created).localeCompare(String(a.created));
const kindOf = m => KINDS[m && m.kind] || KINDS.text;
const matIcon = m => ICON[kindOf(m).ic];
const MINS = ['мин','мин','мин'];
const matMeta = m => [kindOf(m).n, m.duration ? `${m.duration} ${plural(m.duration, MINS)}` : ''].filter(Boolean).join(' · ');
const isNewMat = m => { const k = markOf(m.id); return !(k && k.opened_at); };
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';
// Докуда человек дослушал: доля от длительности (только для аудио и видео)
function matProgress(m){
  const k = markOf(m.id);
  if(!k || !k.position || !m.duration || (m.kind !== 'audio' && m.kind !== 'video')) return 0;
  return Math.max(0, Math.min(1, k.position / (m.duration * 60)));
}
// Отметка создаётся при первом действии с материалом, потом только обновляется
async function setMark(id, patch){
  const k = markOf(id);
  if(k){ upsert('marks', await pb.collection('material_marks').update(k.id, patch)); return; }
  try { upsert('marks', await pb.collection('material_marks').create({id: newId(), user: me().id, material: id, ...patch})); }
  catch(e){
    // отметку уже создали с другого устройства: перечитываем и дописываем
    await loadAll(['marks']);
    const k2 = markOf(id);
    if(!k2) throw e;
    upsert('marks', await pb.collection('material_marks').update(k2.id, patch));
  }
}
// Текст материала приходит из поля-редактора: оставляем только безопасные теги и адреса
const MAT_TAGS = {P:1,BR:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,STRONG:1,B:1,EM:1,I:1,U:1,S:1,STRIKE:1,DEL:1,
  UL:1,OL:1,LI:1,BLOCKQUOTE:1,HR:1,A:1,CODE:1,PRE:1,SPAN:1,DIV:1,FIGURE:1,FIGCAPTION:1,IMG:1,
  TABLE:1,THEAD:1,TBODY:1,TR:1,TD:1,TH:1};
function cleanHtml(html){
  const doc = new DOMParser().parseFromString('<div id="mat-root"></div>', 'text/html');
  const root = doc.getElementById('mat-root');
  root.innerHTML = String(html || ''); // DOMParser не выполняет скрипты, ниже они удаляются
  const walk = el => {
    for(const ch of [...el.children]){
      if(!MAT_TAGS[ch.tagName]){ ch.remove(); continue; } // script, iframe, style, object, form и прочее
      for(const at of [...ch.attributes]){
        const n = at.name.toLowerCase(), v = String(at.value || '').trim();
        if(n === 'alt' || n === 'title') continue;
        if(n === 'href' && ch.tagName === 'A' && /^(https?:|mailto:)/i.test(v)) continue;
        if(n === 'src' && ch.tagName === 'IMG' && /^data:image\//i.test(v)) continue;
        ch.removeAttribute(at.name); // in-line стили, onclick, srcset, внешние картинки
      }
      if(ch.tagName === 'IMG' && !ch.getAttribute('src')){ ch.remove(); continue; }
      if(ch.tagName === 'A'){ ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
      walk(ch);
      // ссылка без разрешённого адреса (javascript: и прочее) остаётся обычным текстом
      if(ch.tagName === 'A' && !ch.getAttribute('href')) ch.replaceWith(...ch.childNodes);
    }
  };
  walk(root);
  return root.innerHTML;
}

function matCard(m){
  const src = m.cover ? photoSrc(m, 'cover', '200x200') : '';
  const pr = matProgress(m);
  const pills = [isNewMat(m) ? '<span class="pill new">Новое</span>' : '', !m.published ? '<span class="pill draft">Черновик</span>' : ''].join('');
  return `<div class="mat-card">
    <a class="mat-main" href="#/m/${esc(m.id)}">
      <span class="mat-pic${src ? ' has' : ''}" aria-hidden="true">${src ? imgTag(src) : matIcon(m)}</span>
      <span class="txt"><b>${esc(m.title)}</b>
        ${m.summary ? `<span class="desc">${esc(m.summary)}</span>` : ''}
        <span class="when"><span>${esc(matMeta(m))}</span>${pills}</span></span>
    </a>
    <button type="button" class="icon-btn" data-act="mat-menu" data-id="${esc(m.id)}" aria-label="Действия с материалом «${esc(m.title)}»" aria-haspopup="menu">${ICON.more}</button>
    ${pr ? `<span class="mat-bar" aria-hidden="true"><i style="width:${Math.round(pr * 100)}%"></i></span>` : ''}</div>`;
}

function vMaterials(){
  const head = '<header class="head"><h1>Материалы</h1></header>';
  // ничего из материалов не хранится на устройстве, поэтому без интернета вкладка пустая
  if(!navigator.onLine) return head + '<section class="card"><p class="empty">Материалы открываются только при подключении к интернету.</p></section>';
  const all = [...S.materials].sort(matSort);
  const state = m => { const k = markOf(m.id); return k && k.archived ? 'arch' : k && k.pinned ? 'pin' : 'rest'; };
  const pin = all.filter(m => state(m) === 'pin'), rest = all.filter(m => state(m) === 'rest'), arch = all.filter(m => state(m) === 'arch');
  const admin = isAdmin() ? `<section class="card"><h2>Материалы ведёте вы</h2>
    <p class="hint">Создать или изменить материал: панель администратора, «Collections» (коллекции) → <code>materials</code>. Файл аудио или видео загружается в приложении, на экране материала. Неопубликованные материалы видите только вы.</p>
    <a class="btn sm" href="/_/#/collections" target="_blank" rel="noopener">Открыть панель</a></section>` : '';
  if(!all.length) return head + '<section class="card"><p class="empty">Материалов пока нет.</p></section>' + admin;
  return head +
    (pin.length ? `<h2 class="label">Закреплённые</h2><div class="mats">${pin.map(matCard).join('')}</div>` : '') +
    (rest.length ? `${pin.length ? '<h2 class="label">Остальные</h2>' : ''}<div class="mats">${rest.map(matCard).join('')}</div>` : '') +
    (!pin.length && !rest.length ? '<p class="hint">Все материалы убраны в архив.</p>' : '') +
    (arch.length ? `<details class="fold" id="arch-fold"${UI.archOpen ? ' open' : ''}><summary><span>Архив · ${arch.length}</span>${ICON.chev}</summary>
      <div class="fold-body"><div class="mats">${arch.map(matCard).join('')}</div></div></details>` : '') +
    admin;
}

function vMaterial(r){
  const m = byId('materials', r.id);
  if(!m) return `<div class="nav-head">${backLink('#/materials', 'Материалы')}</div>
    <div class="card"><p>Материал не найден: возможно, его убрали.</p><a class="btn" href="#/materials">К материалам</a></div>`;
  const cover = m.cover ? `<div class="mat-cover">${imgTag(photoSrc(m, 'cover', '800x0'))}</div>` : '';
  const url = safeUrl(m.url);
  let body = '';
  if(m.kind === 'text') body = m.body ? `<article class="mat-text">${cleanHtml(m.body)}</article>` : '<p class="hint">Текст ещё не вписан.</p>';
  else if(m.kind === 'link') body = url
    ? `<p class="mat-ext">${ICON.link}Внешний сайт</p><a class="btn primary big wide" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Открыть</a>`
    : '<p class="hint">Адрес ещё не вписан.</p>';
  else body = matMediaHTML(m);
  return `<div class="nav-head">${backLink('#/materials', 'Материалы')}
      <button type="button" class="icon-btn" data-act="mat-menu" data-id="${esc(m.id)}" aria-label="Действия с материалом" aria-haspopup="menu">${ICON.more}</button></div>
    ${cover}
    <div class="mat-head"><h1 class="title">${esc(m.title)}</h1><span>${esc(matMeta(m))}${m.published ? '' : ' · черновик'}</span></div>
    ${m.summary ? `<p class="lead">${esc(m.summary)}</p>` : ''}
    ${body}`;
}
/* ---------- Аудио и видео ---------- */
// Файл лежит на сервере отдельно от базы и отдаётся по ссылке, которая живёт 2 часа
// и работает только в том браузере, где выполнен вход (сервер ставит к ней куку).
const RATES = [1, 1.25, 1.5, 2];
const PL = {id:'', el:null, box:null, at:0, last:-999, tries:0, want:null, resume:false, seeking:false};
const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function matMediaHTML(m){
  const admin = isAdmin() ? matAdminHTML(m) : '';
  if(!m.media) return '<p class="hint">Файл ещё не загружен.</p>' + admin;
  const restart = '<button type="button" class="btn sm" data-act="pl-restart">Сначала</button>';
  if(m.kind === 'video') return `<div class="mat-media" data-player="${esc(m.id)}">
      <video class="mat-video" playsinline controls preload="metadata" controlslist="nodownload noremoteplayback" disablepictureinpicture></video>
      <p class="pl-msg" hidden></p><div class="pl-foot">${restart}</div></div>` + admin;
  return `<section class="card mat-media mat-player" data-player="${esc(m.id)}">
      <audio preload="metadata"></audio>
      <div class="pl-main">
        <button type="button" class="btn sm pl-skip" data-act="pl-skip" data-k="-15" aria-label="Назад на 15 секунд">−15 с</button>
        <button type="button" class="pl-play" data-act="pl-play" aria-label="Играть">${ICON.play}</button>
        <button type="button" class="btn sm pl-skip" data-act="pl-skip" data-k="15" aria-label="Вперёд на 15 секунд">+15 с</button>
      </div>
      <input type="range" class="pl-seek" min="0" max="1" value="0" step="1" aria-label="Перемотка">
      <div class="pl-time"><span class="now">0:00</span><span class="dur">—</span></div>
      <div class="pl-rates" role="group" aria-label="Скорость">${RATES.map(r => `<button type="button" data-act="pl-rate" data-r="${r}" aria-pressed="${r === 1}">${String(r).replace('.', ',')}×</button>`).join('')}</div>
      <p class="pl-msg" hidden></p><div class="pl-foot">${restart}</div>
    </section>` + admin;
}
function plMsg(text){
  const p = PL.box && PL.box.querySelector('.pl-msg');
  if(p){ p.textContent = text; p.hidden = !text; }
}
// Экран материала открыт: включаем плеер. Другой экран: выключаем и запоминаем место.
function setupPlayer(){
  const box = $('#main [data-player]');
  if(!box){ if(PL.id) stopPlayer(); return; }
  if(PL.id === box.dataset.player && PL.el && PL.el.isConnected) return;
  stopPlayer();
  PL.id = box.dataset.player; PL.box = box; PL.el = box.querySelector('audio, video');
  const el = PL.el, m = byId('materials', PL.id);
  el.addEventListener('loadedmetadata', () => { plStart(); plTick(); });
  el.addEventListener('timeupdate', () => { plTick(); savePos(false); });
  el.addEventListener('play', plBtn);
  el.addEventListener('pause', () => { plBtn(); savePos(true); });
  el.addEventListener('ended', () => { plBtn(); savePos(true); });
  el.addEventListener('error', plError);
  plBtn();
  plLink();
  if(m) plSession(m, el);
}
function stopPlayer(){
  if(PL.el){
    savePos(true);
    try { PL.el.pause(); PL.el.removeAttribute('src'); PL.el.load(); } catch(e){}
  }
  if('mediaSession' in navigator){ try { navigator.mediaSession.metadata = null; } catch(e){} }
  Object.assign(PL, {id:'', el:null, box:null, at:0, last:-999, tries:0, want:null, resume:false, seeking:false});
}
async function plLink(){
  const el = PL.el, id = PL.id;
  plMsg('');
  try {
    const r = await pb.send('/api/molitva/materials/' + id + '/media-link', {});
    if(PL.el !== el) return;
    el.src = r.url;
    el.load();
  } catch(e){ if(PL.el === el) plMsg(errText(e)); }
}
// Ссылка устарела (прошло больше двух часов) или связь прервалась: просим новую и продолжаем с того же места
function plError(){
  const el = PL.el;
  if(!el || !el.getAttribute('src')) return;
  if(PL.tries >= 2){ plMsg('Файл не открылся. Проверьте интернет и откройте материал заново.'); return; }
  PL.tries++;
  PL.want = PL.at || (markOf(PL.id) || {}).position || 0;
  PL.resume = !el.paused;
  plLink();
}
// Продолжаем с места, где человек остановился
function plStart(){
  const el = PL.el;
  const want = PL.want != null ? PL.want : ((markOf(PL.id) || {}).position || 0);
  PL.want = null;
  if(want > 5 && el.duration && want < el.duration - 5){ try { el.currentTime = want; } catch(e){} }
  PL.last = Math.floor(el.currentTime || 0);
  if(PL.resume){ PL.resume = false; el.play().catch(() => {}); }
}
function plTick(){
  const el = PL.el, box = PL.box;
  if(!el || !box) return;
  PL.at = el.currentTime || 0;
  const d = isFinite(el.duration) ? el.duration : 0;
  const seek = box.querySelector('.pl-seek');
  if(seek && !PL.seeking){ seek.max = Math.max(1, Math.floor(d)); seek.value = Math.floor(PL.at); }
  const now = box.querySelector('.pl-time .now'), dur = box.querySelector('.pl-time .dur');
  if(now) now.textContent = mmss(PL.at);
  if(dur) dur.textContent = d ? mmss(d) : '—';
}
function plBtn(){
  const b = PL.box && PL.box.querySelector('.pl-play');
  if(!b || !PL.el) return;
  const on = !PL.el.paused && !PL.el.ended;
  b.innerHTML = on ? ICON.pause : ICON.play;
  b.setAttribute('aria-label', on ? 'Пауза' : 'Играть');
}
function plSkip(k){
  const el = PL.el;
  if(!el || !el.duration) return;
  el.currentTime = Math.max(0, Math.min(el.duration - 0.5, (el.currentTime || 0) + k));
  plTick(); savePos(true);
}
// Место остановки сохраняем раз в 15 секунд, при паузе и при уходе с экрана.
// Дослушал до конца: в следующий раз начнём сначала.
function savePos(force){
  const el = PL.el, id = PL.id;
  if(!el || !id || !el.duration || !isFinite(el.duration)) return;
  const t = Math.floor(el.currentTime || 0);
  if(!force && Math.abs(t - PL.last) < 15) return;
  PL.last = t;
  setMark(id, {position: el.duration - t < 15 ? 0 : t}).catch(() => {});
}
// Название и кнопки на экране блокировки телефона, если браузер это умеет
function plSession(m, el){
  if(!('mediaSession' in navigator)) return;
  try {
    const art = m.cover ? photoSrc(m, 'cover', '200x200') : '';
    navigator.mediaSession.metadata = new MediaMetadata({title: m.title, artist: 'Молитвенный дневник',
      artwork: art ? [{src: art, sizes: '200x200', type: 'image/jpeg'}] : []});
    const set = (k, fn) => { try { navigator.mediaSession.setActionHandler(k, fn); } catch(e){} };
    set('play', () => el.play().catch(() => {}));
    set('pause', () => el.pause());
    set('seekbackward', () => plSkip(-15));
    set('seekforward', () => plSkip(15));
    set('seekto', d => { if(d && d.seekTime != null){ el.currentTime = d.seekTime; plTick(); } });
  } catch(e){}
}

/* ---------- Загрузка файла материала (только администратор) ---------- */
function matAdminHTML(m){
  const about = m.kind === 'video' ? 'Видео MP4 (H.264 и AAC), до 1 ГБ.' : 'Аудио MP3 или M4A, до 100 МБ.';
  const accept = m.kind === 'video' ? 'video/mp4,.mp4' : 'audio/mpeg,audio/mp4,.mp3,.m4a';
  const have = m.media ? `<p class="hint">Загружен файл ${fsize(m.media_size || 1)}${m.duration ? ', ' + m.duration + ' ' + plural(m.duration, MINS) : ''}.</p>` : '';
  return `<section class="card mat-admin"><h2>Файл материала</h2>
    <p class="hint">${about} Файл лежит на сервере отдельно от базы, поэтому в ежедневную копию базы он не попадает. Загружайте с устойчивого интернета: большой файл идёт несколько минут.</p>
    ${have}
    <div class="up-row">
      <label class="btn sm upload" for="mat-file">${m.media ? 'Заменить файл' : 'Загрузить файл'}<input type="file" id="mat-file" accept="${accept}"></label>
      ${m.media && !m.published ? '<button type="button" class="btn sm ghost danger" data-act="mat-file-del" data-id="' + esc(m.id) + '">Убрать файл</button>' : ''}
    </div>
    <div class="up-bar" id="up-bar" hidden><i></i></div>
    <p class="hint" id="up-space">${esc(S.mediaUsage ? mediaSpaceText(S.mediaUsage) : '')}</p></section>`;
}
const mediaSpaceText = u => `Материалы занимают ${fsize(u.used || 1)}, на диске сервера свободно ${fsize(u.free)}.`;
async function loadMediaUsage(){
  if(!isAdmin()) return;
  try { S.mediaUsage = await pb.send('/api/molitva/media-usage', {}); } catch(e){ return; }
  const p = $('#up-space');
  if(p) p.textContent = mediaSpaceText(S.mediaUsage);
}
// Длительность берём из самого файла, если она не вписана
function fileMinutes(file){
  return new Promise(res => {
    const el = document.createElement(file.type.indexOf('video') === 0 ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = v => { URL.revokeObjectURL(url); res(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(isFinite(el.duration) && el.duration > 0 ? Math.max(1, Math.round(el.duration / 60)) : 0);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 15000);
    el.src = url;
  });
}
function uploadMedia(id, file, minutes, onProgress){
  return new Promise((res, rej) => {
    const fd = new FormData();
    fd.append('file', file);
    if(minutes) fd.append('duration', String(minutes));
    const x = new XMLHttpRequest();
    x.open('POST', '/api/molitva/materials/' + encodeURIComponent(id) + '/media');
    x.setRequestHeader('Authorization', pb.authStore.token);
    x.upload.onprogress = e => { if(e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch(e){}
      if(x.status >= 200 && x.status < 300) res(d);
      else rej(new Error(d.message || (x.status === 413 ? 'Файл слишком большой.' : 'Файл не загрузился. Попробуйте ещё раз.')));
    };
    x.onerror = () => rej(new Error('Связь прервалась. Попробуйте ещё раз с устойчивого интернета.'));
    x.send(fd);
  });
}
async function pickMedia(file){
  const m = byId('materials', route().id);
  if(!m) return;
  const bar = $('#up-bar'), fill = bar && bar.querySelector('i');
  UI.up = 1;
  if(bar){ bar.hidden = false; fill.style.width = '2%'; }
  toast('Определяю длительность…');
  try {
    const minutes = m.duration ? 0 : await fileMinutes(file);
    toast('Загружаю файл…');
    await uploadMedia(m.id, file, minutes, p => { if(fill) fill.style.width = Math.max(2, Math.round(p * 100)) + '%'; });
    await loadAll(['materials']);
    toast('Файл загружен');
  } catch(e){ toast(errText(e)); }
  finally {
    UI.up = 0;
    if(bar) bar.hidden = true;
    render(true);
    loadMediaUsage();
  }
}
function matMenu(btn, m){
  const k = markOf(m.id) || {};
  openMenu(btn, [
    {label: k.pinned && !k.archived ? 'Открепить' : 'Закрепить', run: () => matMark(m, {pinned: !(k.pinned && !k.archived), archived: false})},
    {label: k.archived ? 'Вернуть из архива' : 'В архив', run: () => matMark(m, {archived: !k.archived})}
  ]);
}
async function matMark(m, patch){
  try { await setMark(m.id, patch); toast(patch.archived ? 'В архиве' : patch.archived === false && !patch.pinned ? 'Возвращено из архива' : patch.pinned ? 'Закреплено' : 'Откреплено'); }
  catch(e){ toast(errText(e)); }
}
// Первое открытие материала: с этого момента пометка «Новое» пропадает
let openedMat = '';
function touchMaterial(){
  const r = route();
  if(r.name !== 'm' || !S.loaded || openedMat === r.id) return;
  const m = byId('materials', r.id);
  if(!m || !isNewMat(m)) return;
  openedMat = r.id;
  setMark(m.id, {opened_at: todayISO()}).catch(() => {});
}
window.addEventListener('hashchange', touchMaterial);
// На аудио, видео и обложках контекстное меню (правая кнопка, долгое нажатие) не открывается
document.addEventListener('contextmenu', e => { if(e.target.closest('.mat-cover, .mat-pic, .mat-media, audio, video')) e.preventDefault(); });

/* ---------- Профиль ---------- */
function vProfile(){
  const u = me();
  const answered = S.needs.filter(n => n.answered_at).length;
  const inv = S.invites.slice().sort((a, b) => String(b.created).localeCompare(String(a.created)));
  const usage = S.usage ? `<p class="hint">Фото и файлы занимают ${fsize(S.usage.used || 1)} из ${Math.round(S.usage.quota / MB)} МБ.</p>` : '';
  return `<header class="head"><h1>Профиль</h1></header>
    <section class="card me-card"><span class="me" aria-hidden="true">${avatarInner(u)}</span><div class="who"><b>${esc(u.name || 'Без имени')}</b><span>${esc(u.email || '')}</span>
        <button type="button" class="btn sm" data-act="avatar">${u.avatar ? 'Изменить фото' : 'Поставить фото'}</button></div>
      <button type="button" class="icon-btn" data-act="edit-name" aria-label="Изменить имя">${ICON.pen}</button></section>
    <nav class="links" aria-label="Мои записи">
      <a href="#/verses">${ICON.book}Мои стихи<span class="n">${S.verses.length} из ${MAX_VERSES}</span>${ICON.chev}</a>
      <a href="#/answers">${ICON.check}Ответы на молитвы<span class="n">${answered}</span>${ICON.chev}</a>
    </nav>
    <section class="card"><h2>Оформление</h2>
      <div class="seg3" role="radiogroup" aria-label="Тема">${[['light','Светлая'],['dark','Тёмная'],['auto','Как в системе']].map(([k, l]) =>
        `<input type="radio" name="p-theme" id="p-theme-${k}" value="${k}"${themePref() === k ? ' checked' : ''}><label for="p-theme-${k}">${l}</label>`).join('')}</div></section>
    ${isAdmin() ? `<details class="fold"><summary><span>Приглашения</span>${ICON.chev}</summary><div class="fold-body">
      <p class="hint">Новый человек может зарегистрироваться только по приглашению. Создайте его и отправьте ссылку.</p>
      <div class="field"><label for="i-note">Для кого (заметка)</label><input type="text" id="i-note" placeholder="Например: мама"></div>
      <div class="field"><label for="i-max">Сколько регистраций</label><select id="i-max"><option value="1">1 человек</option><option value="5">до 5 человек</option><option value="20">до 20 человек</option><option value="0">без ограничения</option></select></div>
      <div class="field"><label for="i-exp">Действует до (необязательно)</label><input type="date" id="i-exp"></div>
      <button type="button" class="btn primary" data-act="new-invite">Создать и скопировать ссылку</button>
      <div>${inv.length ? inv.map(i => `<div class="inv"><code>${esc(i.code)}</code><span class="muted">${i.note ? esc(i.note) + ' · ' : ''}использовано ${i.uses || 0}${i.max_uses > 0 ? ' из ' + i.max_uses : ', без ограничения'}${i.expires ? ' · до ' + fmtDay(i.expires) : ''}</span>
        <div class="acts"><button type="button" class="btn sm" data-act="copy-invite" data-code="${esc(i.code)}">Скопировать ссылку</button><button type="button" class="btn sm ghost danger" data-act="del-invite" data-id="${esc(i.id)}">Удалить</button></div></div>`).join('') : '<p class="hint">Приглашений пока нет.</p>'}</div>
    </div></details>` : ''}
    <details class="fold"><summary><span>Сменить пароль</span>${ICON.chev}</summary><div class="fold-body">
      <div class="field"><label for="p-old">Текущий пароль</label><input type="password" id="p-old" autocomplete="current-password"></div>
      <div class="field"><label for="p-new">Новый пароль (не короче 8 символов)</label><input type="password" id="p-new" autocomplete="new-password"></div>
      <div class="field"><label for="p-new2">Повторите новый</label><input type="password" id="p-new2" autocomplete="new-password"></div>
      <button type="button" class="btn" data-act="save-pass">Сменить пароль</button></div></details>
    ${usage}
    <button type="button" class="btn wide" data-act="logout">Выйти</button>
    <details class="fold"><summary><span>Удаление аккаунта</span>${ICON.chev}</summary><div class="fold-body">
      <p class="hint">Вместе с аккаунтом удалятся все разделы, нужды, записи молитв, стихи, фото и файлы. Вернуть их будет нельзя. Ваши нужды пропадут из групп; группы, где вы создатель, перейдут к другому участнику.</p>
      <button type="button" class="btn danger" data-act="delete-account">Удалить аккаунт и все данные</button></div></details>
    <p class="hint"><a href="/privacy.html" target="_blank" rel="noopener">Политика конфиденциальности</a></p>`;
}
async function loadProfileExtras(){
  try { S.usage = await pb.send('/api/molitva/usage', {}); } catch(e){}
  if(isAdmin()){ try { S.invites = await pb.collection('invites').getFullList(); } catch(e){} }
  if(route().name === 'profile') schedule();
}
window.addEventListener('hashchange', () => { if(route().name === 'profile' && S.loaded) loadProfileExtras(); });

/* ---------- Фото нужд и файлы: защищённые, открываются по токену ---------- */
let tokP = null, tokAt = 0;
function fileToken(){
  if(!tokP || Date.now() - tokAt > 100e3){ tokAt = Date.now(); tokP = pb.files.getToken().catch(e => { tokP = null; throw e; }); }
  return tokP;
}
// Фото загружаем один раз и держим в памяти: токен в ссылке живёт недолго
const PH = new Map();
function photoSrc(rec, field, thumb){
  const name = rec && rec[field];
  if(!name) return '';
  const k = rec.id + '/' + name + '/' + (thumb || '');
  const v = PH.get(k);
  if(v && v !== 'loading' && v !== 'err') return v;
  if(!v){ PH.set(k, 'loading'); photoBlob(rec, field, thumb).then(b => { PH.set(k, URL.createObjectURL(b)); schedule(); }).catch(() => PH.set(k, 'err')); }
  return '';
}
async function photoBlob(rec, field, thumb){
  const token = await fileToken();
  const res = await fetch(pb.files.getURL(rec, rec[field], thumb ? {thumb, token} : {token}));
  if(!res.ok) throw new Error('Фото не загрузилось.');
  return await res.blob();
}
// Фото уменьшаем в браузере до 1600 точек по длинной стороне и сохраняем как JPEG
async function preparePhoto(file){
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let img;
  try { img = await createImageBitmap(file); }
  catch(e){
    try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
    catch(e2){
      // HEIC открывается не во всех браузерах: тогда сохраняем как есть (обрезать такое фото нельзя)
      if(['heic','heif'].includes(ext) && file.size <= MAX_PHOTO) return file;
      throw new Error('Не удалось открыть картинку. Выберите фото в формате JPG или PNG.');
    }
  }
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.86));
  if(!blob) throw new Error('Не удалось обработать фото.');
  if(blob.size > MAX_PHOTO) throw new Error('Фото больше 10 МБ.');
  return new File([blob], 'photo.jpg', {type: 'image/jpeg'});
}

/* ---------- Окно обрезки фото по кругу: профиль, подраздел, нужда ---------- */
// Обрезка хранится как центр круга в долях фото (x, y) и увеличение z от 1 до 4.
// При z = 1 короткая сторона фото ровно вписана в круг.
const cropDlg = $('#crop'), cropStage = $('#crop-stage'), cropImg = $('#crop-img');
const CR = {img: null, W: 0, H: 0, cx: .5, cy: .5, z: 1, file: null, raw: false, o: null, resolve: null, seq: 0};
const ZMAX = 4, ROUND = 400;
const clampZ = z => Math.min(ZMAX, Math.max(1, +z || 1));
const PV_TEXT = {sub: 'Так будет в подразделе', need: 'Так будет в списке нужд', avatar: 'Так будет в шапке'};
function cropPreviewHTML(o){
  const name = esc(o.name || (o.kind === 'need' ? 'Нужда' : 'Подраздел'));
  if(o.kind === 'sub') return `<div class="sub-tile has-photo pv-tile">${WATER}<span class="sub-ph pv-photo"><img alt=""></span><span class="sub-name">${name}</span></div>`;
  if(o.kind === 'need') return `<div class="need-row pv-row"><span class="pic pv-photo"><img alt=""></span><span class="txt"><b>${name}</b><span class="when">${esc(o.when || prayedText(''))}</span></span></div>`;
  return `<span class="me pv-photo"><img alt=""></span>`;
}
// Открывает окно. o: {kind: 'sub'|'need'|'avatar', name, file (новое фото) или rec+field (уже сохранённое), crop, canRemove}.
// Возвращает {file, round, crop, preview}, {remove: true} или null, если нажали «Отмена».
function cropPhoto(o){
  return new Promise(resolve => {
    if(CR.resolve) CR.resolve(null);
    Object.assign(CR, {o, resolve, img: null, file: null, raw: false});
    const box = $('#crop-pv');
    box.className = 'crop-pv-box k-' + o.kind; box.innerHTML = cropPreviewHTML(o);
    $('#crop-pv-text').textContent = PV_TEXT[o.kind];
    const rm = $('#crop-remove');
    rm.hidden = !o.canRemove; rm.dataset.armed = ''; rm.textContent = 'Убрать фото';
    if(!cropDlg.open) cropDlg.showModal();
    if(o.file) cropLoadFile(o.file, o.crop);
    else cropLoadRec(o.rec, o.field, o.crop);
  });
}
function cropMsg(text){
  const m = $('#crop-msg');
  m.textContent = text || ''; m.hidden = !text;
  cropImg.hidden = !!text;
  cropDlg.classList.toggle('no-img', !!text);
}
async function cropLoadFile(file, crop){
  const seq = ++CR.seq;
  CR.img = null; CR.raw = false; cropMsg('Открываю фото…');
  try {
    const ph = await preparePhoto(file);
    if(seq !== CR.seq) return;
    CR.file = ph;
    if(ph === file && ph.type !== 'image/jpeg'){
      // HEIC, который браузер не открывает: сохраним целиком, в круге будет середина
      CR.raw = true;
      cropMsg(CR.o.kind === 'avatar' ? 'Это фото не открывается в браузере. Выберите фото в формате JPG или PNG.' : 'Это фото в формате HEIC: в этом браузере его нельзя обрезать. Оно сохранится целиком, в круге будет показана середина.');
      return;
    }
    await cropSetImage(URL.createObjectURL(ph), crop, seq);
  } catch(e){ if(seq === CR.seq){ CR.file = null; cropMsg(errText(e)); } }
}
async function cropLoadRec(rec, field, crop){
  const seq = ++CR.seq;
  CR.img = null; CR.raw = false; CR.file = null; cropMsg('Открываю фото…');
  try { const b = await photoBlob(rec, field); if(seq === CR.seq) await cropSetImage(URL.createObjectURL(b), crop, seq); }
  catch(e){ if(seq === CR.seq) cropMsg('Это фото не открывается в этом браузере. Выберите другое фото.'); }
}
function cropSetImage(url, crop, seq){
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      if(seq !== CR.seq) return res();
      const c = crop || {};
      Object.assign(CR, {img: im, W: im.naturalWidth, H: im.naturalHeight, cx: isFinite(c.x) ? +c.x : .5, cy: isFinite(c.y) ? +c.y : .5, z: clampZ(c.z)});
      cropImg.src = url;
      cropDlg.querySelectorAll('.pv-photo img').forEach(i => { i.src = url; });
      cropMsg('');
      cropDraw();
      res();
    };
    im.onerror = rej;
    im.src = url;
  });
}
const cropD = () => cropStage.clientWidth * 0.8; // диаметр круга на экране
// Фото не может уйти так, чтобы в круге осталась пустота
function cropClamp(){
  const k = Math.min(CR.W, CR.H) / CR.z / 2; // половина стороны круга в точках фото
  CR.cx = Math.min(1 - k / CR.W, Math.max(k / CR.W, CR.cx));
  CR.cy = Math.min(1 - k / CR.H, Math.max(k / CR.H, CR.cy));
}
// Ставит фото так, чтобы центр обрезки оказался в точке center, при масштабе s
function cropPlace(img, center, s){
  img.style.width = CR.W + 'px'; img.style.height = CR.H + 'px';
  img.style.transform = `translate(${center - CR.cx * CR.W * s}px, ${center - CR.cy * CR.H * s}px) scale(${s})`;
}
let cropRaf = 0;
function cropDraw(){
  if(cropRaf) return;
  cropRaf = requestAnimationFrame(() => {
    cropRaf = 0;
    if(!CR.img) return;
    cropClamp();
    const D = cropD(), s = D / Math.min(CR.W, CR.H) * CR.z;
    cropPlace(cropImg, cropStage.clientWidth / 2, s);
    $('#crop-z').value = CR.z;
    cropDlg.querySelectorAll('.pv-photo').forEach(el => { const d = el.clientWidth; cropPlace(el.querySelector('img'), d / 2, s * d / D); });
  });
}
// Пальцы и мышь: один палец двигает, два пальца увеличивают и двигают
const ptrs = new Map();
cropStage.addEventListener('pointerdown', e => {
  if(!CR.img) return;
  try { cropStage.setPointerCapture(e.pointerId); } catch(err){}
  ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
});
cropStage.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if(!p || !CR.img) return;
  const before = [...ptrs.values()].map(q => ({...q}));
  p.x = e.clientX; p.y = e.clientY;
  const after = [...ptrs.values()];
  const s = cropD() / Math.min(CR.W, CR.H) * CR.z;
  let dx, dy;
  if(after.length === 1){ dx = after[0].x - before[0].x; dy = after[0].y - before[0].y; }
  else {
    const mid = a => ({x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2});
    const dist = a => Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
    const m0 = mid(before), m1 = mid(after);
    dx = m1.x - m0.x; dy = m1.y - m0.y;
    CR.z = clampZ(CR.z * dist(after) / dist(before));
  }
  CR.cx -= dx / (s * CR.W); CR.cy -= dy / (s * CR.H);
  cropDraw();
});
const ptrEnd = e => ptrs.delete(e.pointerId);
cropStage.addEventListener('pointerup', ptrEnd);
cropStage.addEventListener('pointercancel', ptrEnd);
cropStage.addEventListener('wheel', e => { if(!CR.img) return; e.preventDefault(); CR.z = clampZ(CR.z * Math.exp(-e.deltaY * 0.0015)); cropDraw(); }, {passive: false});
$('#crop-z').addEventListener('input', e => { if(!CR.img) return; CR.z = clampZ(e.target.value); cropDraw(); });
window.addEventListener('resize', () => { if(cropDlg.open) cropDraw(); });
$('#crop-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if(f) cropLoadFile(f, null); });
function cropFinish(result){ const r = CR.resolve; CR.resolve = null; CR.seq++; ptrs.clear(); if(cropDlg.open) cropDlg.close(); r && r(result); }
$('#crop-cancel').addEventListener('click', () => cropFinish(null));
cropDlg.addEventListener('close', () => { if(CR.resolve) cropFinish(null); });
$('#crop-remove').addEventListener('click', e => { if(arm(e.currentTarget, 'Точно убрать фото?')) cropFinish({remove: true}); });
$('#crop-done').addEventListener('click', async e => {
  if(CR.raw && CR.o.kind !== 'avatar') return cropFinish({file: CR.file, round: null, crop: null, preview: ''});
  if(!CR.img){ toast('Сначала выберите фото.'); return; }
  const btn = e.currentTarget; btn.disabled = true;
  try {
    cropClamp();
    const side = Math.min(CR.W, CR.H) / CR.z;
    const cv = document.createElement('canvas');
    cv.width = cv.height = ROUND;
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(CR.img, CR.cx * CR.W - side / 2, CR.cy * CR.H - side / 2, side, side, 0, 0, ROUND, ROUND);
    const round = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.88));
    if(!round) throw new Error('Не удалось обработать фото.');
    const r4 = x => Math.round(x * 1e4) / 1e4;
    cropFinish({file: CR.file, round, crop: {x: r4(CR.cx), y: r4(CR.cy), z: r4(CR.z)}, preview: URL.createObjectURL(round)});
  } catch(err){ toast(errText(err)); }
  finally { btn.disabled = false; }
});

// Выбор файла с телефона: скрытое поле, которое кладём в открытое окно (снаружи окна оно не нажимается)
const picker = document.createElement('input');
picker.type = 'file'; picker.accept = 'image/*,.heic,.heif'; picker.className = 'picker';
let pickCb = null;
picker.addEventListener('change', () => { const f = picker.files[0], cb = pickCb; picker.value = ''; pickCb = null; if(f && cb) cb(f); });
function pickPhoto(cb){
  pickCb = cb;
  (dlg.open ? dlg : document.body).appendChild(picker);
  picker.click();
}
// Фото нужды, подраздела или профиля: если фото уже есть, открываем его в окне обрезки, иначе сначала выбор файла
function askPhoto(kind, rec){
  const field = kind === 'avatar' ? 'avatar' : 'photo';
  const o = {kind, name: kind === 'need' ? rec.title : rec.name, when: kind === 'need' ? prayedText(rec.last_prayed_at) : '', crop: rec.photo_crop, canRemove: !!rec[field]};
  if(rec[field]) return cropPhoto({...o, rec, field});
  return new Promise(res => pickPhoto(file => cropPhoto({...o, file}).then(res)));
}
// Поля записи из результата окна обрезки: исходник, круг 400×400 и параметры обрезки
function photoData(ph){
  if(ph.remove) return {photo: null, photo_round: null, photo_crop: null};
  const d = {photo_round: ph.round ? new File([ph.round], 'round.jpg', {type: 'image/jpeg'}) : null, photo_crop: ph.crop};
  if(ph.file) d.photo = ph.file;
  return d;
}
async function savePhoto(kind, rec, ph){
  if(!ph) return;
  toast(ph.remove ? 'Убираю фото…' : 'Сохраняю фото…');
  try {
    if(kind === 'avatar'){
      const r = await pb.collection('users').update(rec.id, {avatar: ph.remove ? null : new File([ph.round], 'avatar.jpg', {type: 'image/jpeg'})});
      pb.authStore.save(pb.authStore.token, r); render();
    } else await col(kind === 'need' ? 'needs' : 'sections').doc(rec.id).update(photoData(ph));
    toast(ph.remove ? 'Фото убрано' : 'Фото сохранено');
  } catch(e){ toast(errText(e)); }
}
const photoAction = (kind, rec) => askPhoto(kind, rec).then(ph => savePhoto(kind, rec, ph));
function fileRow(f){
  const ext = (f.ext || String(f.name || '').split('.').pop() || '').slice(0, 4);
  const meta = [f.size ? fsize(f.size) : '', fmtDay(createdISO(f))].filter(Boolean).join(' · ');
  const id = esc(f.id);
  const name = viewKind(f) ? `<button type="button" class="fname" data-act="view-file" data-id="${id}">${esc(f.name)}</button>` : `<b>${esc(f.name)}</b>`;
  return `<div class="file"><span class="file-ext">${esc(ext)}</span><div class="file-main">${name}<span>${meta}</span></div>
    <button type="button" class="icon-btn" data-act="dl-file" data-id="${id}" aria-label="Скачать ${esc(f.name)}">${ICON.dl}</button>
    <button type="button" class="icon-btn" data-act="del-file" data-id="${id}" aria-label="Удалить ${esc(f.name)}">${ICON.trash}</button></div>`;
}
async function uploadFile(file, needId){
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if(!FILE_EXT.includes(ext)) throw new Error(`Формат .${ext || '?'} не подходит. Можно PDF, Word (doc, docx) и картинки.`);
  if(file.size > MAX_FILE) throw new Error(`«${file.name}» больше 20 МБ.`);
  const rec = await pb.collection('need_files').create({id: newId(), owner: me().id, need: needId, name: file.name, ext, file});
  upsert('files', rec);
}
function viewKind(f){
  const ext = String(f.ext || String(f.name || '').split('.').pop() || '').toLowerCase();
  if(ext === 'pdf') return 'pdf';
  if(ext === 'docx') return 'docx';
  if(['png','jpg','jpeg','gif','webp'].includes(ext)) return 'img';
  return '';
}
async function fileUrl(f, download){
  const q = {token: await fileToken()};
  if(download) q.download = 1;
  return pb.files.getURL(f, f.file, q);
}
async function getBlob(f){
  const res = await fetch(await fileUrl(f));
  if(!res.ok) throw new Error('Файл не найден на сервере.');
  return await res.blob();
}
const libs = {};
function loadLib(src, global){
  if(window[global]) return Promise.resolve(window[global]);
  if(!libs[src]) libs[src] = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src;
    sc.onload = () => window[global] ? res(window[global]) : rej(new Error('Модуль не загрузился.'));
    sc.onerror = () => { delete libs[src]; rej(new Error('Не удалось загрузить модуль. Проверьте интернет.')); };
    document.head.appendChild(sc);
  });
  return libs[src];
}
const viewer = $('#viewer');
let viewing = null, viewDl = null;
let pdfView = null; // открытый PDF: документ и наблюдатель за страницами
function closePdf(){ if(pdfView){ pdfView.obs.disconnect(); pdfView.doc.destroy(); pdfView = null; } $('#v-body').className = 'v-body'; }
$('#v-close').addEventListener('click', () => viewer.close());
$('#v-dl').addEventListener('click', () => viewDl && viewDl());
viewer.addEventListener('close', () => { viewing = null; viewDl = null; closePdf(); $('#v-body').innerHTML = ''; });
// PDF показываем сами через pdf.js: сервер отдаёт файлы с CSP sandbox, и встроенный
// просмотрщик Chrome в новой вкладке не запускается (пустая вкладка и скачивание).
async function loadPdfJs(){
  const lib = await import('/vendor/pdfjs/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  return lib;
}
async function showPdf(f, body){
  const [lib, blob] = await Promise.all([loadPdfJs(), getBlob(f)]);
  const doc = await lib.getDocument({data: new Uint8Array(await blob.arrayBuffer()), standardFontDataUrl: '/vendor/pdfjs/standard_fonts/', cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true}).promise;
  if(viewing !== f){ doc.destroy(); return; }
  const first = (await doc.getPage(1)).getViewport({scale: 1});
  body.classList.add('is-pdf');
  body.innerHTML = Array.from({length: doc.numPages}, (_, n) => `<div class="pdf-page" data-n="${n + 1}" style="aspect-ratio:${first.width}/${first.height}"><span>${n + 1}</span></div>`).join('');
  // Страницы рисуются, когда до них доходит прокрутка: большой файл не съест память телефона
  const draw = async el => {
    const page = await doc.getPage(+el.dataset.n);
    const vp1 = page.getViewport({scale: 1});
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({scale: el.clientWidth / vp1.width * ratio});
    const cv = document.createElement('canvas');
    cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    el.style.aspectRatio = `${vp1.width}/${vp1.height}`;
    await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
    el.replaceChildren(cv);
  };
  const obs = new IntersectionObserver(entries => entries.forEach(e => {
    if(!e.isIntersecting) return;
    obs.unobserve(e.target);
    draw(e.target).catch(() => { e.target.textContent = 'Страница не открылась'; });
  }), {root: body, rootMargin: '600px 0px'});
  pdfView = {doc, obs};
  body.querySelectorAll('.pdf-page').forEach(el => obs.observe(el));
}
function startView(title, item, dl){
  closePdf();
  viewing = item; viewDl = dl;
  $('#v-title').textContent = title;
  const body = $('#v-body');
  body.innerHTML = '<div class="v-msg">Открываю…</div>';
  if(!viewer.open) viewer.showModal();
  return body;
}
async function openFile(f){
  const kind = viewKind(f);
  const body = startView(f.name, f, () => downloadFile(f));
  try{
    if(kind === 'pdf'){ await showPdf(f, body); return; }
    if(kind === 'img'){ const url = URL.createObjectURL(await getBlob(f)); if(viewing === f){ body.classList.add('is-img'); body.innerHTML = `<img class="v-img" src="${esc(url)}" alt="${esc(f.name)}">`; } return; }
    if(kind === 'docx'){
      const [m, blob] = await Promise.all([loadLib('/vendor/mammoth.browser.min.js', 'mammoth'), getBlob(f)]);
      const r = await m.convertToHtml({arrayBuffer: await blob.arrayBuffer()});
      if(viewing !== f) return;
      const html = (r.value || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=/gi, ' data-x=');
      body.innerHTML = html.trim() ? `<article class="doc-view">${html}</article>` : '<div class="v-msg">Документ пустой.</div>';
      return;
    }
    body.innerHTML = '<div class="v-msg">Этот формат здесь не просматривается. Скачайте файл и откройте его на устройстве.</div>';
  }catch(e){
    if(viewing === f) body.innerHTML = `<div class="v-msg">${esc(errText(e))}<span>Попробуйте скачать файл кнопкой вверху.</span></div>`;
  }
}
async function openPhoto(n){
  const body = startView(n.title, n, async () => { try { downloadUrl(pb.files.getURL(n, n.photo, {token: await fileToken(), download: 1}), n.photo); } catch(e){ toast(errText(e)); } });
  try {
    const res = await fetch(pb.files.getURL(n, n.photo, {token: await fileToken()}));
    if(!res.ok) throw new Error('Фото не загрузилось.');
    const url = URL.createObjectURL(await res.blob());
    if(viewing === n){ body.classList.add('is-img'); body.innerHTML = `<img class="v-img" src="${esc(url)}" alt="${esc(n.title)}">`; }
  } catch(e){ if(viewing === n) body.innerHTML = `<div class="v-msg">${esc(errText(e))}</div>`; }
}
function downloadUrl(url, name){
  const a = document.createElement('a');
  a.href = url; a.download = name || 'file'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}
async function downloadFile(f){ try { downloadUrl(await fileUrl(f, true), f.name); } catch(e){ toast(errText(e)); } }

/* ---------- Диалог с формой ---------- */
const dlg = $('#dlg'), form = $('#dlg-form');
let cur = null;
function fieldHTML(fd, v){
  const id = 'fld-' + fd.key, val = v ?? '';
  if(fd.type === 'photo') return `<div class="field"><span class="flabel">${esc(fd.label)}</span><div class="ph-pick" id="ph-pick">${phPickInner(val, fd.has)}</div>
      <p class="hint" style="font-size:12.5px">JPG, PNG, WEBP или HEIC, до 10 МБ.</p></div>`;
  // галочка: значение да/нет
  if(fd.type === 'check') return `<label class="check-row"><input type="checkbox" id="${id}"${val ? ' checked' : ''}><span><b>${esc(fd.label)}</b>${fd.hint ? `<small>${esc(fd.hint)}</small>` : ''}</span></label>`;
  // несколько галочек: options = [[значение, подпись, пояснение]], значение поля = список отмеченных
  if(fd.type === 'checks') return `<fieldset class="checks"><legend class="flabel">${esc(fd.label)}</legend>${(fd.options || []).map(([k, l, sub]) =>
    `<label class="check-row"><input type="checkbox" name="${id}" value="${esc(k)}"${(val || []).includes(k) ? ' checked' : ''}><span><b>${esc(l)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`).join('')}</fieldset>`;
  let input;
  if(fd.type === 'textarea') input = `<textarea id="${id}" rows="${fd.rows || 4}" maxlength="${fd.max || 10000}" placeholder="${esc(fd.placeholder || '')}">${esc(val)}</textarea>`;
  else if(fd.type === 'select') input = `<select id="${id}">${(fd.options || []).map(([k, l]) => `<option value="${esc(k)}"${String(val) === String(k) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else input = `<input type="${fd.type || 'text'}" id="${id}" value="${esc(val)}" maxlength="${fd.max || 300}" placeholder="${esc(fd.placeholder || '')}" autocomplete="off">`;
  return `<div class="field"><label for="${id}">${esc(fd.label)}</label>${input}</div>`;
}
// Фото в форме: круглая миниатюра и кнопки, обрезка в общем окне
const phPickInner = (src, has) => `<span class="thumb round">${imgTag(src) || ICON.photo}</span>
  <div class="acts"><button type="button" class="btn sm" id="ph-edit">${has ? 'Изменить фото' : 'Поставить фото'}</button>${has ? '<button type="button" class="btn sm ghost danger" id="ph-remove">Убрать</button>' : ''}</div>`;
function openForm(o){
  cur = {...o, saved: false, ph: null};
  form.innerHTML = `<div class="dlg-head"><h2>${esc(o.title)}</h2><button type="button" class="icon-btn" data-close aria-label="Закрыть">×</button></div>
    <div class="dlg-body">${o.text ? `<p class="dlg-text">${esc(o.text)}</p>` : ''}${(o.fields || []).map(fd => fieldHTML(fd, (o.values || {})[fd.key])).join('')}${o.html || ''}</div>
    <p class="dlg-err" id="dlg-err" hidden></p>
    <div class="dlg-foot">${o.onDelete ? `<button type="button" class="btn ghost danger" id="dlg-del">${esc(o.deleteLabel || 'Удалить')}</button>` : ''}${o.noCancel ? '' : '<button type="button" class="btn" data-close>Отмена</button>'}<button type="submit" class="btn ${o.danger ? 'danger-fill' : 'primary'}" id="dlg-ok">${esc(o.submit || 'Сохранить')}</button></div>`;
  if(!dlg.open) dlg.showModal();
  const first = form.querySelector('.dlg-body input[type=text], .dlg-body textarea');
  if(first && window.matchMedia('(min-width: 700px)').matches) first.focus();
}
function formErr(msg){ const p = $('#dlg-err'); if(!p) return; p.textContent = msg; p.hidden = !msg; }
function collect(){
  const v = {};
  for(const fd of cur.fields || []){
    if(fd.type === 'photo') continue;
    if(fd.type === 'checks'){ v[fd.key] = [...form.querySelectorAll(`input[name="fld-${fd.key}"]:checked`)].map(i => i.value); continue; }
    const el = form.querySelector('#fld-' + fd.key);
    v[fd.key] = fd.type === 'check' ? !!(el && el.checked) : el ? el.value.trim() : '';
  }
  return v;
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  if(!cur) return;
  const v = collect();
  const miss = (cur.fields || []).find(fd => fd.required && !v[fd.key]);
  if(miss){ formErr(`Заполните поле «${miss.label}».`); return; }
  const ok = $('#dlg-ok'); ok.disabled = true; formErr('');
  try { await cur.onSave(v, cur); cur.saved = true; dlg.close(); }
  catch(err){ formErr(errText(err)); }
  finally { ok.disabled = false; }
});
form.addEventListener('click', async e => {
  if(e.target.closest('[data-close]')){ dlg.close(); return; }
  // свои кнопки внутри окна (группы: скопировать ссылку, исключить и т. п.)
  const own = e.target.closest('[data-dlg]');
  if(own && cur && cur.onClick){ cur.onClick(own); return; }
  if(e.target.closest('#ph-remove')){
    cur.ph = {remove: true};
    $('#ph-pick').innerHTML = phPickInner('', false);
    return;
  }
  if(e.target.closest('#ph-edit')){ formPhoto(); return; }
  const del = e.target.closest('#dlg-del');
  if(del){
    if(!arm(del, cur.confirmText || 'Нажмите ещё раз')) return;
    del.disabled = true;
    try { await cur.onDelete(); cur.saved = true; dlg.close(); }
    catch(err){ formErr(errText(err)); del.disabled = false; }
  }
});
// «Поставить фото» / «Изменить фото» в форме нужды: окно обрезки поверх формы, сохраняется вместе с формой
function formPhoto(){
  const c = cur, rec = c.photoRec, ph = c.ph;
  const name = (form.querySelector('#fld-title')?.value || '').trim() || (rec && rec.title) || '';
  const done = res => {
    if(!res || cur !== c) return;
    if(res.remove){ c.ph = {remove: true}; $('#ph-pick').innerHTML = phPickInner('', false); return; }
    c.ph = res;
    $('#ph-pick').innerHTML = phPickInner(res.preview, true);
  };
  const o = {kind: 'need', name, when: prayedText(rec && rec.last_prayed_at), canRemove: true};
  if(ph && ph.file && !ph.remove) cropPhoto({...o, file: ph.file, crop: ph.crop}).then(done);
  else if(rec && rec.photo && !(ph && ph.remove)) cropPhoto({...o, rec, field: 'photo', crop: (ph && ph.crop) || rec.photo_crop}).then(done);
  else pickPhoto(file => cropPhoto({...o, file, canRemove: false}).then(done));
}
dlg.addEventListener('close', () => { const c = cur; cur = null; c && c.onClose && c.onClose(c.saved); });
// Открыть следующее окно после того, как текущее закроется (событие close приходит не сразу)
function thenOpen(fn){ if(dlg.open) dlg.addEventListener('close', () => setTimeout(fn, 0), {once: true}); else fn(); }
function arm(btn, text){
  if(btn.dataset.armed === '1') return true;
  btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = text;
  setTimeout(() => { if(btn.isConnected){ btn.dataset.armed = ''; btn.textContent = old; } }, 3500);
  return false;
}
const FIELD_RU = {email:'почта', password:'пароль', passwordConfirm:'повтор пароля', oldPassword:'текущий пароль', name:'название', title:'название', text:'текст', file:'файл', photo:'фото', date:'дата', code:'код'};
function errText(e){
  if(!e) return 'Неизвестная ошибка.';
  if(e.isAbort) return 'Запрос прерван.';
  if(e.status === 0) return 'Нет связи с сервером. Проверьте интернет.';
  const r = e.response || {};
  const msg = r.message || e.message || '';
  if(/[а-яё]/i.test(msg)) return msg;
  const data = r.data || {};
  const keys = Object.keys(data);
  if(e.status === 400 && keys.length){
    if(data.email && data.email.code === 'validation_not_unique') return 'Этот адрес почты уже зарегистрирован.';
    if(data.password && /length/.test(data.password.code || '')) return 'Пароль должен быть не короче 8 символов.';
    if(data.passwordConfirm) return 'Пароли не совпадают.';
    if(data.oldPassword) return 'Текущий пароль введён неверно.';
    if(data.photo) return 'Фото не принято: подходят JPG, PNG, WEBP и HEIC до 10 МБ.';
    if(data.file) return 'Файл не принят: проверьте формат и размер (до 20 МБ).';
    return 'Проверьте поля: ' + keys.map(k => FIELD_RU[k] || k).join(', ') + '.';
  }
  if(e.status === 401 || e.status === 403) return 'Нет доступа. Войдите заново.';
  if(e.status === 404) return 'Запись не найдена: возможно, её уже удалили.';
  if(e.status === 413) return 'Файл слишком большой.';
  if(e.status === 429) return 'Слишком много запросов подряд. Подождите немного.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

/* ---------- Формы ---------- */
// groupId: новая нужда для группы, тогда спрашиваем, в какой раздел дневника её положить
function openNeed(needId, sectionId, groupId){
  const n = needId ? byId('needs', needId) : null;
  const g = groupId ? byId('groups', groupId) : null;
  if(g && !S.sections.length){ info('Сначала создайте раздел', 'Каждая нужда лежит в разделе вашего дневника. Создайте раздел на главной, потом добавьте нужду в группу.'); return; }
  openForm({title: n ? 'Изменить нужду' : g ? 'Новая нужда в группу' : 'Новая нужда',
    text: g ? `Нужда появится в группе «${g.name}» и в выбранном разделе вашего дневника.` : '',
    fields: [
      ...(g ? [{key:'section', label:'Раздел дневника', type:'select', options: sectionOptions()}] : []),
      {key:'title', label:'Название', required:true, placeholder:'Например, здоровье мамы'},
      {key:'description', label:'Описание', type:'textarea', rows:4, max:5000, placeholder:'О чём молиться (по желанию)'},
      {key:'photo', label:'Фото (по желанию)', type:'photo', has: !!(n && n.photo)}],
    values: n ? {...n, photo: n.photo ? roundSrc(n) : ''} : {},
    photoRec: n,
    submit: n ? 'Сохранить' : 'Добавить',
    async onSave(v, c){
      const data = {title: v.title, description: v.description};
      if(c.ph && !(c.ph.remove && !n)) Object.assign(data, photoData(c.ph));
      if(n) await col('needs').doc(n.id).update(data);
      else {
        const rec = await col('needs').doc().create({...data, section: g ? v.section : sectionId, answered_at: '', answer_note: '', last_prayed_at: ''});
        if(g) await shareNeed(rec.id, g.id);
      }
      toast(n ? 'Сохранено' : g ? 'Нужда добавлена в группу' : 'Нужда добавлена');
    }});
}
function sectionOptions(){
  const out = [];
  for(const s of topSections()){ out.push([s.id, s.name]); for(const c of childrenOf(s.id)) out.push([c.id, s.name + ' › ' + c.name]); }
  return out;
}
function openMoveNeed(n){
  openForm({title: 'Перенести в другой раздел', fields: [{key:'section', label:'Раздел', type:'select', options: sectionOptions()}], values: n, submit: 'Перенести',
    async onSave(v){ if(v.section !== n.section){ await col('needs').doc(n.id).update({section: v.section}); toast('Нужда перенесена'); } }});
}
function confirmDeleteNeed(n){
  const p = S.prayers.filter(x => x.need === n.id).length, f = S.files.filter(x => x.need === n.id).length;
  const gs = linksOfNeed(n.id).length ? ' Она пропадёт и из групп.' : '';
  openForm({title: 'Удалить нужду?', text: `«${n.title}» удалится вместе с записями молитв (${p}) и файлами (${f}). Вернуть их будет нельзя.${gs}`, submit: 'Удалить', danger: true,
    async onSave(){
      await col('needs').doc(n.id).delete();
      S.prayers = S.prayers.filter(x => x.need !== n.id); S.files = S.files.filter(x => x.need !== n.id); S.glinks = S.glinks.filter(x => x.need !== n.id);
      toast('Нужда удалена'); go('#/s/' + n.section, true);
    }});
}
function openAnswered(n){
  // «Поделиться ответом с группой» показываем, только если нужда отдана хотя бы в одну группу
  const shared = linksOfNeed(n.id).length > 0;
  openForm({title: n.answered_at ? 'Отвечено' : 'Молитва отвечена',
    fields: [{key:'answered_at', label:'Когда', type:'date', required:true}, {key:'answer_note', label:'Как Бог ответил', type:'textarea', rows:4, max:2000, placeholder:'Коротко, по желанию'},
      ...(shared ? [{key:'answer_shared', label:'Поделиться ответом с группой', type:'check', hint:'Заметку увидят участники всех групп, где есть эта нужда.'}] : [])],
    values: {answered_at: n.answered_at || todayISO(), answer_note: n.answer_note || '', answer_shared: !!n.answer_shared},
    onDelete: n.answered_at ? async () => { await col('needs').doc(n.id).update({answered_at: '', answer_note: '', answer_shared: false}); toast('Пометка снята'); } : null,
    deleteLabel: 'Снять пометку', confirmText: 'Точно снять?',
    async onSave(v){ await col('needs').doc(n.id).update(v); toast('Отмечено: молитва отвечена'); }});
}
function openPrayer(prayerId, needId){
  const p = prayerId ? byId('prayers', prayerId) : null;
  openForm({title: p ? 'Запись молитвы' : 'Записать молитву',
    fields: [{key:'text', label:'Молитва', type:'textarea', rows:6, required:true, placeholder:'Что вы сказали Богу об этой нужде'}, {key:'date', label:'Дата', type:'date', required:true}],
    values: p || {date: todayISO()},
    onDelete: p ? async () => { await col('prayers').doc(p.id).delete(); toast('Запись удалена'); } : null,
    confirmText: 'Точно удалить?',
    async onSave(v){
      if(p){ await col('prayers').doc(p.id).update(v); toast('Сохранено'); return; }
      await col('prayers').doc().create({...v, need: needId});
      // запись молитвы тоже считается молитвой: обновляем «последнюю молитву», а за сегодня ставим отметку дня
      const n = byId('needs', needId);
      if(n && v.date > (n.last_prayed_at || '') && v.date <= todayISO()) await col('needs').doc(n.id).update({last_prayed_at: v.date}).catch(() => {});
      if(v.date === todayISO()) await markDay().catch(() => {});
      toast('Молитва записана');
    }});
}
function openVerse(id){
  const v = id ? byId('verses', id) : null;
  if(!v && S.verses.length >= MAX_VERSES){ toast(`Можно вписать не больше ${MAX_VERSES} стихов.`); return; }
  openForm({title: v ? 'Изменить стих' : 'Новый стих',
    fields: [{key:'text', label:'Текст стиха', type:'textarea', rows:5, required:true, max:2000}, {key:'ref', label:'Место в Библии', placeholder:'Например, Филиппийцам 4:6', max:200}],
    values: v || {},
    onDelete: v ? async () => { await col('verses').doc(v.id).delete(); toast('Стих удалён'); } : null,
    confirmText: 'Точно удалить?',
    async onSave(x){
      if(v) await col('verses').doc(v.id).update(x);
      else await col('verses').doc().create({...x, sort: nextSort(S.verses)});
      toast('Стих сохранён');
    }});
}
function openName(){
  openForm({title: 'Имя', fields: [{key:'name', label:'Как вас называть', max:100}], values: me(),
    async onSave(v){ const rec = await pb.collection('users').update(me().id, {name: v.name}); pb.authStore.save(pb.authStore.token, rec); render(); toast('Имя сохранено'); }});
}
function info(title, text){ openForm({title, text, submit: 'Понятно', noCancel: true, async onSave(){}}); }

/* ---------- Отметка дня ---------- */
async function markDay(iso){
  const t = iso || todayISO();
  if(dayRec(t)) return;
  try { const rec = await pb.collection('prayer_days').create({id: newId(), user: me().id, date: t}); upsert('days', rec); }
  catch(e){ await loadAll(['days']).catch(() => {}); if(!dayRec(t)) throw e; } // отметку уже поставили с другого устройства
}
// Поставить или снять отметку: сегодня, вчера или позавчера
async function toggleDay(iso){
  const rec = dayRec(iso);
  if(rec){ await pb.collection('prayer_days').delete(rec.id); removeLocal('days', rec.id); return false; }
  await markDay(iso); return true;
}
async function toggleToday(btn){
  btn.disabled = true;
  try {
    toast(await toggleDay(todayISO()) ? 'Отмечено' : 'Отметка снята');
  } catch(e){ toast(errText(e)); }
  finally { btn.disabled = false; }
}

/* ---------- Календарь молитв: месяц и год ---------- */
const calDlg = $('#cal');
const CAL = {view: 'month', y: 0, m: 0};
const marksIn = prefix => S.days.filter(d => String(d.date).startsWith(prefix)).length;
function calMonthCells(y, m, mini){
  const first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), t = todayISO();
  let html = '<span class="cd blank"></span>'.repeat(monIndex(first));
  for(let d = 1; d <= n; d++){
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`, on = !!dayRec(iso);
    const cls = `cd${on ? ' on' : ''}${iso === t ? ' today' : ''}${iso > t ? ' future' : ''}`;
    if(mini) html += `<span class="${cls}"></span>`;
    else if(canMark(iso)) html += `<button type="button" class="${cls} can" data-cal="toggle" data-date="${iso}" aria-pressed="${on}" aria-label="${d} ${MONF[m]}${on ? ', молился' : ''}. Нажмите, чтобы ${on ? 'снять отметку' : 'отметить'}">${d}</button>`;
    else html += `<span class="${cls}" aria-label="${d} ${MONF[m]}${on ? ', молился' : ''}">${d}</span>`;
  }
  return html;
}
// Селектор кнопки календаря, чтобы вернуть на неё фокус после перерисовки
function calSel(el){
  const d = el && calDlg.contains(el) ? el.dataset : null;
  if(!d || !d.cal) return '';
  return d.date ? `[data-date="${d.date}"]` : d.m ? `[data-cal="open"][data-m="${d.m}"]` : `[data-cal="${d.cal}"]`;
}
function renderCal(sel){
  const {view, y, m} = CAL, month = view === 'month';
  const thisYear = new Date().getFullYear();
  const title = month ? `${MONN[m]} ${y}` : String(y);
  const sum = month ? marksIn(`${y}-${pad(m + 1)}-`) : marksIn(`${y}-`);
  const body = month
    ? `<div class="cal-wd" aria-hidden="true">${WDM.map(w => `<span>${w}</span>`).join('')}</div><div class="cal-grid">${calMonthCells(y, m)}</div>`
    : `<div class="cal-year">${MONN.map((name, i) => { const k = marksIn(`${y}-${pad(i + 1)}-`); return `<button type="button" class="cal-mini" data-cal="open" data-m="${i}" aria-label="${name}: ${k} ${plural(k, DAYS)}"><b>${name}</b><span class="mini-grid" aria-hidden="true">${calMonthCells(y, i, true)}</span></button>`; }).join('')}</div>`;
  if(sel === undefined) sel = calSel(document.activeElement);
  calDlg.innerHTML = `<div class="cal-in">
    <div class="dlg-head"><h2>Мои молитвы</h2><button type="button" class="icon-btn" data-cal="close" aria-label="Закрыть">×</button></div>
    <div class="cal-body">
      <div class="choice"><button type="button" data-cal="month" aria-pressed="${month}">Месяц</button><button type="button" data-cal="year" aria-pressed="${!month}">Год</button></div>
      <div class="cal-nav"><button type="button" class="icon-btn" data-cal="prev" aria-label="${month ? 'Предыдущий месяц' : 'Предыдущий год'}">${ICON.left}</button><b aria-live="polite">${title}</b><button type="button" class="icon-btn" data-cal="next" aria-label="${month ? 'Следующий месяц' : 'Следующий год'}">${ICON.right}</button></div>
      ${body}
      <p class="cal-sum">${month ? `В ${MONP[m]}${y !== thisYear ? ' ' + y : ''}` : `В ${y} году`}: ${sum} ${plural(sum, DAYS)}</p>
      <p class="hint">Отметить можно сегодня, вчера и позавчера.</p>
    </div></div>`;
  const el = sel && calDlg.querySelector(sel);
  if(el) el.focus();
}
// Календарь закрывается крестиком, по фону, клавишей Esc и жестом «назад» (для этого шаг в истории)
function openCalendar(){
  const d = new Date();
  Object.assign(CAL, {view: 'month', y: d.getFullYear(), m: d.getMonth()});
  renderCal();
  calDlg.showModal();
  history.pushState({cal: 1}, '');
}
calDlg.addEventListener('close', () => { if(history.state && history.state.cal) history.back(); });
window.addEventListener('popstate', () => { if(calDlg.open) calDlg.close(); });
calDlg.addEventListener('click', async e => {
  if(e.target === calDlg){ calDlg.close(); return; }
  const b = e.target.closest('[data-cal]');
  if(!b) return;
  const act = b.dataset.cal, sel = act === 'open' ? '[data-cal="month"]' : calSel(b);
  if(act === 'close'){ calDlg.close(); return; }
  if(act === 'month' || act === 'year') CAL.view = act;
  else if(act === 'open'){ CAL.view = 'month'; CAL.m = +b.dataset.m; }
  else if(act === 'prev' || act === 'next'){
    const k = act === 'prev' ? -1 : 1;
    if(CAL.view === 'year') CAL.y += k;
    else { const d = new Date(CAL.y, CAL.m + k, 1); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); }
  } else if(act === 'toggle'){
    const iso = b.dataset.date;
    if(!canMark(iso)) return;
    b.disabled = true;
    try { await toggleDay(iso); } catch(err){ toast(errText(err)); }
  }
  renderCal(sel);
});

/* ---------- Меню «⋯» ---------- */
let menu = null;
function closeMenu(){ if(menu){ menu.el.remove(); menu.btn.setAttribute('aria-expanded', 'false'); menu = null; } }
function openMenu(btn, items){
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu'; el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" data-i="${i}"${it.danger ? ' class="danger"' : ''}>${esc(it.label)}</button>`).join('');
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  el.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - h - 8)) + 'px';
  el.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  menu = {el, btn, items};
  el.querySelector('button').focus();
}
window.addEventListener('resize', closeMenu);
document.addEventListener('keydown', e => {
  if(!menu) return;
  if(e.key === 'Escape'){ const b = menu.btn; closeMenu(); b.focus(); return; }
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    const items = [...menu.el.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    e.preventDefault();
  }
});
function sectionMenu(btn, s){
  openMenu(btn, [
    {label: s.parent ? 'Изменить: название, фото, место' : 'Изменить: название, цвет, место', run: () => go('#/edit/' + s.id)},
    ...(s.parent ? [{label: s.photo ? 'Изменить фото' : 'Поставить фото', run: () => photoAction('sub', s)}] : []),
    {label: 'Удалить раздел', danger: true, run: () => {
      const subs = childrenOf(s.id).length, needs = needsIn(s.id).length;
      if(subs || needs){ info('Раздел не пустой', `Удалить можно только пустой раздел. Сейчас в нём ${[subs ? `${subs} ${plural(subs, SUBS)}` : '', needs ? `${needs} ${plural(needs, NEEDS)}` : ''].filter(Boolean).join(' и ')}. Сначала перенесите или удалите их.`); return; }
      openForm({title: 'Удалить раздел?', text: `Раздел «${s.name}» пустой и удалится полностью.`, submit: 'Удалить', danger: true,
        async onSave(){ await col('sections').doc(s.id).delete(); toast('Раздел удалён'); go(s.parent ? '#/s/' + s.parent : '#/', true); }});
    }}
  ]);
}
function needMenu(btn, n){
  openMenu(btn, [
    {label: 'Изменить', run: () => openNeed(n.id)},
    {label: n.photo ? 'Изменить фото' : 'Поставить фото', run: () => photoAction('need', n)},
    {label: 'Перенести в другой раздел', run: () => openMoveNeed(n)},
    {label: 'Удалить нужду', danger: true, run: () => confirmDeleteNeed(n)}
  ]);
}

/* ---------- Перестановка камней и стихов ---------- */
async function moveItem(key, id, dir){
  const item = byId(key, id); if(!item) return;
  const list = key === 'verses' ? sortedVerses() : S.sections.filter(s => (s.parent || '') === (item.parent || '')).sort(bySort);
  const i = list.findIndex(x => x.id === id), j = i + dir;
  if(j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  const changed = [];
  list.forEach((x, n) => { if((x.sort ?? 0) !== n){ x.sort = n; changed.push(x); } });
  render();
  try { for(const x of changed) upsert(key, await pb.collection(PBN[key]).update(x.id, {sort: x.sort})); }
  catch(e){ toast(errText(e)); loadAll([key]).catch(() => {}); }
}

/* ---------- Нажатия ---------- */
document.addEventListener('click', async e => {
  if(menu){
    const it = e.target.closest('.menu [data-i]');
    const m = menu; closeMenu();
    if(it){ m.items[+it.dataset.i].run(); return; }
    if(e.target.closest('[data-act$="-menu"]') === m.btn) return;
  }
  const a = e.target.closest('#main [data-act]');
  if(!a || !S.loaded) return;
  const d = a.dataset;
  const r = route();
  switch(d.act){
    case 'today': toggleToday(a); break;
    case 'calendar': openCalendar(); break;
    case 'sub-photo': { const s = byId('sections', d.id); if(s) photoAction('sub', s); break; }
    case 'avatar': photoAction('avatar', me()); break;
    case 'form-photo': {
      const f = UI.form; if(!f) return;
      f.name = $('#f-name').value;
      const s = f.id ? byId('sections', f.id) : null;
      const o = {kind: 'sub', name: f.name.trim(), canRemove: true};
      const done = res => { if(!res || UI.form !== f) return; f.ph = res; render(true); };
      if(f.ph && f.ph.file) cropPhoto({...o, file: f.ph.file, crop: f.ph.crop}).then(done);
      else if(s && s.photo && !(f.ph && f.ph.remove)) cropPhoto({...o, rec: s, field: 'photo', crop: (f.ph && f.ph.crop) || s.photo_crop}).then(done);
      else pickPhoto(file => cropPhoto({...o, file, canRemove: false}).then(done));
      break;
    }
    case 'form-photo-remove': { const f = UI.form; if(!f) return; f.name = $('#f-name').value; f.ph = {remove: true}; render(true); break; }
    case 'new-verse': openVerse(); break;
    case 'edit-verse': openVerse(d.id); break;
    case 'reorder': UI.reorder = UI.reorder === d.scope ? '' : d.scope; render(); break;
    case 'move': moveItem(d.key, d.id, +d.dir); break;
    case 'sec-menu': { const s = byId('sections', d.id); if(s) sectionMenu(a, s); break; }
    case 'need-menu': { const n = byId('needs', d.id); if(n) needMenu(a, n); break; }
    case 'new-need': openNeed(null, d.id); break;
    case 'prayed': {
      const n = byId('needs', d.id); if(!n) return;
      if(n.last_prayed_at === todayISO()){ toast('Сегодня уже отмечено'); return; }
      a.disabled = true;
      try { await col('needs').doc(n.id).update({last_prayed_at: todayISO()}); await markDay(); toast('Отмечено: помолился'); }
      catch(err){ toast(errText(err)); a.disabled = false; }
      break;
    }
    case 'answered': { const n = byId('needs', d.id); if(n) openAnswered(n); break; }
    case 'new-prayer': openPrayer(null, d.id); break;
    case 'edit-prayer': openPrayer(d.id); break;
    case 'view-photo': { const n = byId('needs', d.id) || byId('shared', d.id); if(n) openPhoto(n); break; }
    case 'mat-menu': { const m = byId('materials', d.id); if(m) matMenu(a, m); break; }
    case 'pl-play': { const el = PL.el; if(!el) return; el.paused ? el.play().catch(err => plMsg(errText(err))) : el.pause(); break; }
    case 'pl-skip': plSkip(+d.k); break;
    case 'pl-restart': { const el = PL.el; if(!el) return; el.currentTime = 0; plTick(); savePos(true); break; }
    case 'pl-rate': {
      const el = PL.el; if(!el) return;
      el.playbackRate = +d.r;
      document.querySelectorAll('.pl-rates button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.r === d.r)));
      break;
    }
    case 'mat-file-del': {
      const m = byId('materials', d.id); if(!m) return;
      openForm({title: 'Убрать файл?', text: `Файл материала «${m.title}» удалится с сервера. Вернуть его можно только новой загрузкой.`, submit: 'Убрать', danger: true,
        async onSave(){
          await pb.send('/api/molitva/materials/' + m.id + '/media', {method: 'DELETE'});
          await loadAll(['materials']);
          render(true); loadMediaUsage(); toast('Файл убран');
        }});
      break;
    }
    case 'new-group': openNewGroup(); break;
    case 'g-menu': { const g = byId('groups', d.id); if(g) groupMenu(a, g); break; }
    case 'g-invite': { const g = byId('groups', d.id); if(g) openInvite(g); break; }
    case 'g-add-need': { const g = byId('groups', d.id); if(g) openAddToGroup(g); break; }
    case 'g-pray': togglePraying(d.id, a); break;
    case 'g-who': openPraying(d.id); break;
    case 'share-need': { const n = byId('needs', d.id); if(n) openShare(n); break; }
    case 'answer-share': {
      const n = byId('needs', d.id); if(!n) return;
      a.disabled = true;
      try { await col('needs').doc(n.id).update({answer_shared: !n.answer_shared}); toast(n.answer_shared ? 'Ответ виден только вам' : 'Ответ виден группе'); }
      catch(err){ toast(errText(err)); a.disabled = false; }
      break;
    }
    case 'join': {
      a.disabled = true;
      try {
        const res = await pb.send('/api/molitva/join/' + encodeURIComponent(d.code), {method: 'POST'});
        await loadAll(GKEYS); UI.join = null;
        toast('Вы вступили в группу'); go('#/g/' + res.id, true);
      } catch(err){ toast(errText(err)); a.disabled = false; }
      break;
    }
    case 'view-file': { const f = byId('files', d.id); if(f) openFile(f); break; }
    case 'dl-file': { const f = byId('files', d.id); if(f) downloadFile(f); break; }
    case 'del-file': {
      const f = byId('files', d.id); if(!f) return;
      openForm({title: 'Удалить файл?', text: `«${f.name}» удалится без возможности вернуть.`, submit: 'Удалить', danger: true,
        async onSave(){ await col('files').doc(f.id).delete(); toast('Файл удалён'); }});
      break;
    }
    case 'pick-color': {
      const f = UI.form; if(!f) return;
      f.name = $('#f-name').value; f.color = d.color;
      const c = COLORS[f.color];
      $('#pv-stone').style.backgroundColor = c.c;
      $('#pv').className = 'preview ink-' + c.ink;
      $('#f-color-l').textContent = 'Цвет камня: ' + c.n;
      document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === f.color)));
      break;
    }
    case 'place': { const f = UI.form; if(!f) return; f.name = $('#f-name').value; f.place = d.place; render(true); break; }
    case 'cancel-form': UI.form = null; goBack(r.name === 'edit' ? '#/s/' + r.id : (r.q.get('in') ? '#/s/' + r.q.get('in') : '#/')); break;
    case 'save-section': saveSection(a); break;
    case 'period': {
      try { const rec = await pb.collection('users').update(me().id, {verse_period: d.period}); pb.authStore.save(pb.authStore.token, rec); render(); toast('Стих будет меняться: ' + PERIODS[d.period][0].toLowerCase()); }
      catch(err){ toast(errText(err)); }
      break;
    }
    case 'edit-name': openName(); break;
    default: accountAction(a, d);
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if(t.name === 'p-theme'){ setTheme(t.value); return; }
  if(t.name === 'f-parent' && UI.form){ UI.form.parent = t.value; return; }
  if(t.id === 'mat-file'){
    const file = t.files[0]; t.value = '';
    if(file) pickMedia(file);
    return;
  }
  // ползунок перемотки: ведём пальцем без перескоков, переходим при отпускании
  if(t.classList && t.classList.contains('pl-seek')){
    PL.seeking = false;
    if(PL.el && PL.el.duration){ PL.el.currentTime = Math.min(+t.value, PL.el.duration - 0.2); plTick(); savePos(true); }
    return;
  }
  if(t.id === 'nf-input'){
    const list = [...t.files]; t.value = '';
    const n = byId('needs', route().id); if(!n) return;
    UI.filesOpen = true;
    for(const file of list){
      toast(`Загружаю «${file.name}»…`);
      try { await uploadFile(file, n.id); toast('Файл прикреплён'); }
      catch(err){ toast(errText(err)); }
    }
  }
});
document.addEventListener('input', e => {
  if(e.target.id === 'f-name' && UI.form){ UI.form.name = e.target.value; $('#pv-name').textContent = e.target.value.trim() || 'Название'; }
  if(e.target.classList && e.target.classList.contains('pl-seek')){
    PL.seeking = true;
    const now = PL.box && PL.box.querySelector('.pl-time .now');
    if(now) now.textContent = mmss(+e.target.value);
  }
});
document.addEventListener('toggle', e => {
  if(e.target.id === 'files-fold') UI.filesOpen = e.target.open;
  if(e.target.id === 'arch-fold') UI.archOpen = e.target.open;
}, true);

/* ---------- Вход и регистрация ---------- */
let authMode = 'login', authInvite = '', authEmail = '', isFirstRun = false;
// «Забыли пароль?»: повторная отправка через 2 минуты. Раньше PocketBase сам не отправит второе письмо на ту же почту
const RESET_WAIT = 120e3;
const RESET_SENT = 'Если такой адрес зарегистрирован, письмо придёт в течение нескольких минут. Проверьте папку «Спам».';
let resetSent = false, resetTimer = 0;
async function showAuth(mode, invite){
  $('#app').hidden = true; $('#auth').hidden = false;
  authMode = mode || 'login'; if(invite) authInvite = invite;
  try { const r = await fetch('/api/molitva/setup'); if(r.ok) isFirstRun = !!(await r.json()).firstRun; } catch(e){}
  if(isFirstRun) authMode = 'register';
  renderAuth();
}
// Поле пароля с кнопкой «показать или скрыть»
const passInput = (id, auto, extra) => `<span class="pass"><input type="password" id="${id}" autocomplete="${auto}"${extra || ''}><button type="button" class="eye" data-eye="${id}" aria-label="Показать пароль" aria-pressed="false">${ICON.eye}</button></span>`;
$('#auth').addEventListener('click', e => {
  const b = e.target.closest('[data-eye]'); if(!b) return;
  const inp = document.getElementById(b.dataset.eye), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.innerHTML = show ? ICON.eyeOff : ICON.eye;
  b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
});
function resetLeft(){ return Math.max(0, loadLS('resetAt', 0) + RESET_WAIT - Date.now()); }
// Обратный отсчёт на кнопке «Отправить ещё раз»
function tickReset(){
  clearInterval(resetTimer);
  const upd = () => {
    const btn = $('#auth-form[data-mode="reset"] [type=submit]');
    if(!btn){ clearInterval(resetTimer); return; }
    const left = Math.ceil(resetLeft() / 1000);
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? `Отправить ещё раз через ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : resetSent ? 'Отправить ещё раз' : 'Отправить ссылку';
    if(left <= 0) clearInterval(resetTimer);
  };
  upd(); resetTimer = setInterval(upd, 1000);
}
function renderAuth(msg, ok){
  const b = $('#auth-body');
  const note = msg ? `<p class="${ok ? 'form-ok' : 'form-err'}">${esc(msg)}</p>` : '';
  // пришли по ссылке в группу: после входа приложение предложит вступить
  const joinNote = loadLS('join', '') ? `<p class="auth-note">Вас пригласили в группу. ${authMode === 'register'
    ? 'Зарегистрироваться можно только по коду приглашения в само приложение от администратора. После регистрации приложение предложит вступить в группу.'
    : 'Войдите, и приложение предложит вступить. Если аккаунта ещё нет, сначала нужно приглашение в само приложение от администратора: регистрация только по нему.'}</p>` : '';
  if(authMode === 'register'){
    $('#auth-sub').textContent = isFirstRun ? 'Создайте аккаунт владельца. Вы станете администратором и сможете приглашать других.' : 'Регистрация по приглашению.';
    b.innerHTML = `<form class="stack" id="auth-form" data-mode="register" novalidate>${joinNote}
      ${isFirstRun ? '' : `<label>Код приглашения<input type="text" id="a-invite" autocomplete="off" autocapitalize="characters" value="${esc(authInvite)}" required></label>`}
      <label>Имя<input type="text" id="a-name" autocomplete="name"></label>
      <label>Почта<input type="email" id="a-email" autocomplete="email" required></label>
      <label>Пароль (не короче 8 символов)${passInput('a-pass', 'new-password', ' minlength="8" required')}</label>
      <label>Повторите пароль${passInput('a-pass2', 'new-password', ' required')}</label>
      <label class="check"><input type="checkbox" id="a-consent"><span>Согласен на обработку персональных данных по <a href="/privacy.html" target="_blank" rel="noopener">политике конфиденциальности</a></span></label>
      ${note}<button class="btn primary big wide" type="submit">Создать аккаунт</button>
      ${isFirstRun ? '' : `<div class="auth-links"><button type="button" class="linkbtn" data-auth="login">У меня уже есть аккаунт</button></div>`}
    </form>`;
  } else if(authMode === 'reset'){
    $('#auth-sub').textContent = 'Пришлём ссылку для нового пароля на вашу почту.';
    b.innerHTML = `<form class="stack" id="auth-form" data-mode="reset" novalidate>
      <label>Почта<input type="email" id="a-email" autocomplete="email" value="${esc(authEmail)}" required></label>
      ${resetSent ? `<p class="form-ok" role="status">${esc(RESET_SENT)}</p>` : ''}
      ${note}<button class="btn primary big wide" type="submit">Отправить ссылку</button>
      <div class="auth-links"><button type="button" class="linkbtn" data-auth="login">Вернуться ко входу</button></div>
    </form>`;
    tickReset();
  } else {
    $('#auth-sub').textContent = 'Нужды, молитвы и дни молитвы в одном месте.';
    b.innerHTML = `<form class="stack" id="auth-form" data-mode="login" novalidate>${joinNote}
      <label>Почта<input type="email" id="a-email" autocomplete="email" value="${esc(authEmail)}" required></label>
      <label>Пароль${passInput('a-pass', 'current-password', ' required')}</label>
      ${note}<button class="btn primary big wide" type="submit">Войти</button>
      <div class="auth-links"><button type="button" class="linkbtn" data-auth="register">Регистрация по приглашению</button><button type="button" class="linkbtn" data-auth="reset">Забыли пароль?</button></div>
    </form>`;
  }
}
$('#auth').addEventListener('click', e => {
  const b = e.target.closest('[data-auth]'); if(!b) return;
  const em = $('#a-email'); if(em && em.value.trim()) authEmail = em.value.trim();
  if(b.dataset.auth !== 'reset') resetSent = false;
  authMode = b.dataset.auth; renderAuth();
});
$('#auth').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('[type=submit]');
  const v = id => (f.querySelector('#' + id)?.value || '').trim();
  if(f.dataset.mode === 'newpass'){ submitNewPass(f); return; }
  btn.disabled = true;
  try{
    if(f.dataset.mode === 'login'){
      if(!v('a-email') || !v('a-pass')) throw {msg:'Введите почту и пароль.'};
      try { await pb.collection('users').authWithPassword(v('a-email'), f.querySelector('#a-pass').value); }
      catch(err){ if(err.status === 400) throw {msg:'Неверная почта или пароль.'}; throw err; }
      startApp();
    } else if(f.dataset.mode === 'register'){
      const pass = f.querySelector('#a-pass').value, pass2 = f.querySelector('#a-pass2').value;
      if(!isFirstRun && !v('a-invite')) throw {msg:'Введите код приглашения.'};
      if(!v('a-email')) throw {msg:'Введите почту.'};
      if(pass.length < 8) throw {msg:'Пароль должен быть не короче 8 символов.'};
      if(pass !== pass2) throw {msg:'Пароли не совпадают.'};
      if(!f.querySelector('#a-consent').checked) throw {msg:'Нужно согласие на обработку персональных данных.'};
      const body = {email: v('a-email'), password: pass, passwordConfirm: pass2, name: v('a-name'), theme: themePref()};
      if(!isFirstRun) body.invite = v('a-invite');
      await pb.collection('users').create(body);
      await pb.collection('users').authWithPassword(body.email, pass);
      isFirstRun = false;
      startApp();
    } else {
      // Ответ сервера одинаковый для любого адреса, поэтому и сообщение всегда одно
      const email = v('a-email');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw {msg:'Проверьте адрес почты.'};
      if(resetLeft() > 0) return;
      try { await pb.collection('users').requestPasswordReset(email); }
      catch(err){
        if(err.status === 429) throw {msg:'Писем было слишком много. Попробуйте снова через час.'};
        if(err.status === 400) throw {msg:'Проверьте адрес почты.'};
        throw err;
      }
      authEmail = email; resetSent = true; saveLS('resetAt', Date.now());
      renderAuth(); return;
    }
  }catch(err){ authErr(err.msg || errText(err)); }
  finally{ if(f.dataset.mode === 'reset') tickReset(); else btn.disabled = false; }
});
function authErr(text){
  const fe = $('#auth-form'); if(!fe) return;
  let p = fe.querySelector('.form-err');
  if(!p){ p = document.createElement('p'); p.className = 'form-err'; fe.querySelector('[type=submit]').before(p); }
  p.textContent = text;
}

/* ---------- Ссылки из писем ---------- */
const MAIL_LINKS = ['reset', 'verify', 'email-change'];
// Ключ из письма: id, почта и срок (exp) лежат в его средней части
function tokenInfo(token){
  try { return JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))) || {}; }
  catch(e){ return {}; }
}
let mailToken = '';
function showMailLink(kind, token){
  $('#app').hidden = true; $('#auth').hidden = false;
  mailToken = token;
  const info = tokenInfo(token);
  if(info.email) authEmail = info.email;
  const expired = !info.exp || info.exp * 1000 < Date.now();
  if(kind === 'reset') expired ? mailDone('reset-old') : renderNewPass();
  else if(kind === 'verify') confirmVerify(expired);
  else mailDone('change');
}
// Открыть дневник после экрана из письма: вход, если нужно
function openDiary(){ pb.authStore.isValid ? boot() : showAuth('login'); }
const MAIL_SCREENS = {
  'reset-ok': ['Пароль изменён', 'Теперь войдите с новым паролем.', 'Войти', 'login'],
  'reset-old': ['Ссылка устарела', 'Ссылка для нового пароля действует ограниченное время и срабатывает один раз. Запросите новое письмо.', 'Запросить новое письмо', 'reset'],
  'verify-ok': ['Почта подтверждена', 'Спасибо. Теперь можно вернуться к дневнику.', 'Открыть дневник', 'diary'],
  'verify-old': ['Ссылка устарела', 'Ссылка для подтверждения почты устарела или уже использована. Если почта уже подтверждена, ничего делать не нужно.', 'Открыть дневник', 'diary'],
  'change': ['Смена почты', 'Смена почты в приложении пока не поддерживается, почта для входа осталась прежней. Чтобы сменить её, напишите администратору.', 'Открыть дневник', 'diary'],
};
function mailDone(key){
  const [title, text, btn, next] = MAIL_SCREENS[key];
  $('#auth-sub').textContent = '';
  $('#auth-body').innerHTML = `<div class="stack" role="status"><h2 class="auth-title">${esc(title)}</h2><p class="muted">${esc(text)}</p>
    <button type="button" class="btn primary big wide" id="mail-next">${esc(btn)}</button></div>`;
  $('#mail-next').onclick = () => {
    if(next === 'diary') openDiary();
    else { authMode = next; resetSent = false; renderAuth(); }
  };
}
function renderNewPass(){
  $('#auth-sub').textContent = authEmail ? 'Новый пароль для ' + authEmail : 'Придумайте новый пароль.';
  $('#auth-body').innerHTML = `<form class="stack" id="auth-form" data-mode="newpass" novalidate>
    <input type="email" autocomplete="username" value="${esc(authEmail)}" hidden>
    <label>Новый пароль (не короче 8 символов)${passInput('n-pass', 'new-password', ' minlength="8" required')}</label>
    <label>Повторите пароль${passInput('n-pass2', 'new-password', ' required')}</label>
    <button class="btn primary big wide" type="submit">Сохранить пароль</button>
  </form>`;
}
async function submitNewPass(f){
  const p1 = f.querySelector('#n-pass').value, p2 = f.querySelector('#n-pass2').value;
  if(p1.length < 8) return authErr('Пароль должен быть не короче 8 символов.');
  if(p1 !== p2) return authErr('Пароли не совпадают.');
  const btn = f.querySelector('[type=submit]'); btn.disabled = true;
  try {
    await pb.collection('users').confirmPasswordReset(mailToken, p1, p2);
    // после смены пароля прежние входы этого человека больше не действуют
    const info = tokenInfo(mailToken);
    if(pb.authStore.record && pb.authStore.record.id === info.id) pb.authStore.clear();
    mailDone('reset-ok');
  } catch(err){
    const data = (err.response || {}).data || {};
    if(data.token || err.status === 404) mailDone('reset-old');
    else { authErr(errText(err)); btn.disabled = false; }
  }
}
async function confirmVerify(expired){
  if(expired){ mailDone('verify-old'); return; }
  $('#auth-sub').textContent = '';
  $('#auth-body').innerHTML = '<p class="muted" role="status">Подтверждаю почту…</p>';
  try { await pb.collection('users').confirmVerification(mailToken); mailDone('verify-ok'); }
  catch(err){
    if(err.status !== 0){ mailDone('verify-old'); return; }
    $('#auth-body').innerHTML = `<div class="stack"><p class="form-err">${esc(errText(err))}</p><button type="button" class="btn primary big wide" id="mail-next">Попробовать ещё раз</button></div>`;
    $('#mail-next').onclick = () => confirmVerify(false);
  }
}

/* ---------- Профиль: пароль, приглашения, выход ---------- */
const INV_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function inviteCode(){ const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, x => INV_ABC[x % INV_ABC.length]).join(''); }
async function copyText(text){
  try { await navigator.clipboard.writeText(text); toast('Ссылка скопирована'); }
  catch(e){ window.prompt && window.prompt('Скопируйте:', text); }
}
async function accountAction(a, d){
  try{
    switch(d.act){
      case 'save-pass': {
        const old = $('#p-old').value, n1 = $('#p-new').value, n2 = $('#p-new2').value;
        if(n1.length < 8){ toast('Новый пароль должен быть не короче 8 символов.'); return; }
        if(n1 !== n2){ toast('Новые пароли не совпадают.'); return; }
        const email = me().email;
        await pb.collection('users').update(me().id, {oldPassword: old, password: n1, passwordConfirm: n2});
        await pb.collection('users').authWithPassword(email, n1);
        toast('Пароль изменён'); render(); break;
      }
      case 'new-invite': {
        const body = {code: inviteCode(), note: $('#i-note').value.trim(), max_uses: Number($('#i-max').value), uses: 0, expires: $('#i-exp').value};
        const rec = await pb.collection('invites').create(body);
        S.invites.push(rec); render();
        copyText(`${location.origin}/?invite=${rec.code}`);
        break;
      }
      case 'copy-invite': copyText(`${location.origin}/?invite=${d.code}`); break;
      case 'del-invite': {
        if(!arm(a, 'Точно?')) return;
        await pb.collection('invites').delete(d.id);
        S.invites = S.invites.filter(i => i.id !== d.id); render(); break;
      }
      case 'logout': pb.authStore.clear(); location.hash = ''; location.reload(); break;
      case 'delete-account': {
        if(!arm(a, 'Всё будет удалено. Нажмите ещё раз')) return;
        await pb.collection('users').delete(me().id);
        pb.authStore.clear(); location.hash = ''; location.reload(); break;
      }
    }
  }catch(e){ toast(errText(e)); }
}

let tt = 0;
function toast(msg){ const el = $('#toast'); const host = [cropDlg, viewer, calDlg, dlg].find(x => x.open) || document.body; if(el.parentNode !== host) host.appendChild(el); el.textContent = msg; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2800); }

boot();
})();
