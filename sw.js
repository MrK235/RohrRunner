const CACHE_NAME = 'rohrrunner-pwa-v14';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/rohrRunner-192.svg',
  './icons/rohrRunner-512.svg',
  './icons/rohrRunner-192.png',
  './icons/rohrRunner-512.png',
  './src/style.css',
  './src/theme.css',
  './src/pwa.js',
  './src/app.js',
  './src/editor-core.js',
  './src/materials.js',
  './src/engine.js',
  './src/fast-data.js',
  './src/stoffdaten.js',
  './src/worker.js',
  './src/worker-bundle.js',
  './src/zip.js',
  './data/pipe-catalog.js',
  './data/pipe-catalog.json',
  './data/fluid-references.json',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/pdf-lib/pdf-lib.min.js',
  './vendor/coolprop/coolprop-local.js',
  './vendor/coolprop/coolprop.wasm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
