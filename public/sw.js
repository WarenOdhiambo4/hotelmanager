// Skool service worker: makes the site installable and shows the last loaded app shell when the phone is offline.
// Pages always come from the network first, so a new deploy shows at once; API calls and payments are never cached.
const CACHE = 'skool-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/app/skool-192.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put('/', copy)) }
        return res
      })
      .catch(() => caches.match('/').then((hit) => hit || Response.error())),
  )
})
