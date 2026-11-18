// Service worker: makes the installed app work offline.
// (This is NOT the auto-save; auto-save lives in src/storage.js and uses localStorage.)
//
// Bump CACHE_VERSION whenever you deploy changes so users pick them up.

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `payroll-calculator-${CACHE_VERSION}`;

const APP_SHELL = [
    './',
    'index.html',
    'manifest.webmanifest',
    'styles/main.css',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'src/app.js',
    'src/dataLoader.js',
    'src/expenses.js',
    'src/income.js',
    'src/storage.js',
    'src/tax/federal.js',
    'src/tax/helpers.js',
    'src/tax/state.js',
    'src/ui/customItems.js',
    'src/ui/dom.js',
    'src/ui/format.js',
    'src/ui/render.js',
    'src/data/index.json',
    'src/data/2026/federal.json',
    'src/data/2026/states.json'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

function putInCache(request, response) {
    if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    // Pages and tax data: network first so updates show up, cache when offline.
    const networkFirst = request.mode === 'navigate' || request.url.endsWith('.json');
    if (networkFirst) {
        event.respondWith(
            fetch(request)
                .then(response => putInCache(request, response))
                .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
        );
        return;
    }

    // Everything else: cache first, fall back to network.
    event.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(response => putInCache(request, response)))
    );
});
