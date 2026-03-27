const CACHE_NAME = 'ai-toolkit-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
// API calls to Gemini always go to network
self.addEventListener('fetch', event => {
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
    return; // Never cache API calls
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});