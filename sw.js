const CACHE_NAME = 'rohrrunner-pwa-v42-update-links';
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
  './src/desktop-cache.js',
  './src/update-check.js',
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
  './data/secondary-fluids.js',
  './data/pipe-catalog.json',
  './data/fluid-references.json',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/pdf-lib/pdf-lib.min.js',
  './vendor/coolprop/coolprop-local.js',
  './vendor/coolprop/coolprop.wasm',
  './vendor/fonts/NotoSans-Regular.woff2',
  './vendor/fonts/NotoSans-Bold.woff2',
  './vendor/fonts/NotoSansMono-Regular.woff2',
  './vendor/fonts/NotoSansMono-Bold.woff2',
  './vendor/fonts/DejaVuSans-Symbols.woff2',
  './vendor/fonts/DejaVuSans-Bold-Symbols.woff2'
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
      .then(keys => Promise.all(keys.filter(key => key.startsWith('rohrrunner-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const shellUrls = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));
const homeUrl = new URL('./', self.registration.scope);
const indexUrl = new URL('./index.html', self.registration.scope);

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    if (requestUrl.pathname !== homeUrl.pathname && requestUrl.pathname !== indexUrl.pathname) return;
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          if (response.ok && response.headers.get('content-type')?.includes('text/html'))
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (!shellUrls.has(requestUrl.href)) return;
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
