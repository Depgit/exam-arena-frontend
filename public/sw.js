// Mind Race service worker.
//
// Its only jobs: make the site installable (Chrome and the Android app need
// a service worker) and show a friendly page when there's no connection.
// Pages are ALWAYS fetched from the network, so every deploy reaches
// players — browser and Android app alike — on their next open. Only the
// build's hashed files (/assets/*, which never change once published) and
// the offline page are cached. The backend API (another origin) is never
// touched.

const CACHE = 'mindrace-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // API, fonts: straight to the network

  // Pages: always the latest from the network; offline page if that fails.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Hashed build files never change: serve from cache once fetched.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          })
      )
    )
  }
})
