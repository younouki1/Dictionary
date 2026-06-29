// Service worker: caches the app shell for offline use.
// Bump the CACHE version when files change to refresh the cache.
const CACHE = 'dict-v8';
const SHELL = [
  '.',
  'index.html',
  'css/styles.css',
  'js/storage.js',
  'js/translate.js',
  'js/dictionary.js',
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

  // Never cache translation API requests — network only.
  if (url.hostname.endsWith('mymemory.translated.net')) {
    return; // the browser performs the request normally
  }

  // Serve the shell cache-first, falling back to the network.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
