/**
 * TripShare Service Worker
 * Provides offline capability and caching for the PWA.
 */
'use strict';

const CACHE_NAME = 'tripshare-v2';
const OFFLINE_URL = '/';

// Files to pre-cache (app shell)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
];

/* ─── INSTALL ─────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ─── ACTIVATE ────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ─── FETCH ───────────────────────────────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests to same origin
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Let Firebase SDK requests pass through to network
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for navigation requests (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || !response.ok || response.type !== 'basic') return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => null);
    })
  );
});

/* ─── BACKGROUND SYNC ─────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-expenses') {
    // Notify all clients that background sync is available
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: 'SYNC_EXPENSES' }))
      )
    );
  }
});

/* ─── PUSH NOTIFICATIONS ──────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'TripShare', {
      body: data.body || 'New update on your trip',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: 'tripshare-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/')
  );
});
