/**
 * sw.js — Service Worker for StringSync
 * Provides offline capability via Cache-First strategy
 */

const CACHE_NAME = 'stringsync-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './main.js',
    './pitchDetector.js',
    './ui.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS.filter(url => !url.startsWith('https://fonts')));
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Cache-First, fall back to network ──
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension and non-http requests
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => {
                // Return cached index.html for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});