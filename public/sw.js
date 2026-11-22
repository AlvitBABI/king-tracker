// Minimal service worker: network-first for the app, cache-first for covers.
// __BUILD_ID__ is replaced with a fresh id on every build (vite.config.js),
// so each deploy gets a new app cache and old files are deleted.
const APP_CACHE = 'king-app-__BUILD_ID__'
const COVER_CACHE = 'king-covers-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== COVER_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Book covers rarely change: serve from cache, fetch once.
  if (url.hostname === 'covers.openlibrary.org') {
    event.respondWith(
      caches.open(COVER_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Own files: try the network (fresh deploys), fall back to cache offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(APP_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req)),
    )
  }
})
