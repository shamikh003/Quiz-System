// v5: cache only static assets. Private API responses are never cached.
const CACHE_NAME = 'quizboard-cache-v5.4';
const APP_SHELL = ['/config.js?v=5.0','/index.html','/admin/index.html','/admin/results.html','/admin/students.html',
    '/admin/admin.js?v=5.1','/admin/report-utils.js?v=5.0','/admin/results.js?v=5.0','/admin/students.js?v=5.0',
    '/student/quiz.html','/student/quiz.js?v=5.0','/style.css?v=5.4','/logo.png','/manifest-admin.json','/manifest-quiz.json']
    .map(path => new URL(path.slice(1), self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('quizboard-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
    if (!url.href.startsWith(self.registration.scope)) return;
    if (!APP_SHELL.includes(url.href) && event.request.mode !== 'navigate') return;
    // Network first prevents a cached old page from retaining the retired anonymous flow.
    event.respondWith(fetch(event.request).then(response => {
        if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))); }
        return response;
    }).catch(() => caches.match(event.request)));
});
