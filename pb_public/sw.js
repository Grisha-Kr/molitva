// Сервис-воркер: хранит оболочку приложения, чтобы оно быстро открывалось.
// Данные (/api/) никогда не кэшируются. Материалы (их список, обложки, аудио и видео) идут
// только через /api/, поэтому на устройстве от них ничего не остаётся: без интернета
// вкладка «Материалы» показывает сообщение, что нужно подключение.
const VERSION = 'molitva-v6';
const SHELL = ['/', '/index.html', '/app.css?v=6', '/app.js?v=6', '/vendor/pocketbase.umd.js', '/manifest.webmanifest', '/icons/icon-192.png?v=2', '/img/stone.webp', '/img/water.webp', '/img/wave-mask.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;
  // Сначала сеть, при отсутствии связи берём из кэша
  e.respondWith(
    fetch(e.request).then(res => {
      // адреса с ключами из писем и приглашений (/?reset=…, /?invite=…) не кэшируем: подходит только пустой адрес или ?v=
      const plain = !url.search || /^\?v=\d+$/.test(url.search);
      if (res.ok && plain && (url.pathname === '/' || /\.(html|css|js|woff2|png|webp|svg|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});
