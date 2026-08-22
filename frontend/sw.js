// Bump this version whenever the cached files change, so browsers pick up updates.
const CACHE_NAME = 'quizboard-cache-v2';

// The "app shell" — static files needed to load the pages even with a slow/offline connection.
// Quiz/question/result DATA itself always comes fresh from the backend (never cached here),
// so students can't take an outdated or offline quiz — but the page itself loads instantly.
const APP_SHELL = [
    'index.html',
    'quiz.html',
    'results.html',
    'style.css?v=2.0',
    'admin.js',
    'quiz.js?v=2.0',
    'results.js',
    'logo.png',
    'manifest-admin.json',
    'manifest-quiz.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin GET requests (the static frontend files).
    // Anything else (API calls to the backend, POST requests, etc.) goes straight to the network
    // so quiz data, scores, and results are always fresh and never served from cache.
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkFetch = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse); // offline: fall back to cache

            // Cache-first for instant loads; refresh the cache in the background.
            return cachedResponse || networkFetch;
        })
    );
});
