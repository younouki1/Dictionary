// Service worker: кэширует оболочку приложения для офлайна.
// При изменении файлов поднимите версию CACHE, чтобы обновить кэш.
const CACHE = 'dict-v1';
const SHELL = [
  '.',
  'index.html',
  'css/styles.css',
  'js/storage.js',
  'js/translate.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Запросы к API перевода никогда не кэшируем — только сеть.
  if (url.hostname.endsWith('mymemory.translated.net')) {
    return; // браузер выполнит запрос как обычно
  }

  // Оболочку отдаём cache-first, с подстраховкой из сети.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
