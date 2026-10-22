/* 离线缓存：让页面在断网时也能打开（仅在 http/https 下生效，file:// 浏览器会禁用 SW） */
const CACHE = 'screener-v1'
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => caches.match('./index.html').then(r => r || Response.error()))
    })
  )
})
