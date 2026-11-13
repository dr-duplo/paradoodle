// Offline support. The app page is fetched fresh when online and served from the cache when
// offline. The pinned CDN libraries and the fonts are kept after their first download, so
// sketching, playback and export also work without a connection.

const VERSION = 'dev'; // replaced by scripts/build.mjs with a hash of the built page
const APP_CACHE = `paradoodle-app-${VERSION}`;
const LIB_CACHE = 'paradoodle-libs';
const APP_FILES = [
  './',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const LIB_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(APP_CACHE)
      .then((c) => c.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('paradoodle-app-') && k !== APP_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// only the app's own page is the offline shell; other navigations (an image, a file) are not
const SCOPE_PATH = new URL('./', self.registration.scope).pathname;
const isAppPage = (url) =>
  url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + 'index.html';

async function fromNetworkFirst(req, url) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && isAppPage(url) && (res.headers.get('content-type') || '').startsWith('text/html'))
      cache.put('./', res.clone());
    return res;
  } catch {
    return (await cache.match('./')) || Response.error();
  }
}

async function fromCacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fromNetworkFirst(req, url));
  } else if (url.origin === location.origin) {
    e.respondWith(fromCacheFirst(req, APP_CACHE));
  } else if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(fromCacheFirst(req, LIB_CACHE));
  }
});
