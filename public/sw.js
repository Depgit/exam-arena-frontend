// Mind Race service worker.
//
// Its only jobs: make the site installable (Chrome and the Android app need
// a service worker) and show a friendly page when there's no connection.
// Pages are ALWAYS fetched from the network, so every deploy reaches
// players — browser and Android app alike — on their next open. Only the
// build's hashed files (/assets/*, which never change once published) and
// the offline page are cached. The backend API (another origin) is never
// touched.

// v2: v1 could hold index.html saved under a stylesheet's name (see below);
// a new name makes 'activate' delete it for everyone.
const CACHE = 'mindrace-v2'
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
      caches.match(req).then((hit) => (hit && !isPage(hit) ? hit : fetchAsset(req)))
    )
  }
})

// A build file that's missing (mid-deploy, or from an older build) comes
// back as index.html with status 200, since the host serves the app for
// unknown paths, and marked cacheable for a year because of its /assets/
// path. Saving that would stand in for the real file for good, leaving the
// site unstyled. So such a response is never cached, and is retried once
// past the browser's own cache in case that is where it came from.
const isPage = (res) => (res.headers.get('content-type') || '').includes('text/html')

function fetchAsset(req) {
  return fetch(req)
    .then((res) => (isPage(res) ? fetch(req, { cache: 'reload' }) : res))
    .then((res) => {
      if (res.ok && !isPage(res)) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })
}
