const CACHE = 'gefaz-calda-v17';
const ASSETS = ['./', './index.html', './app.css', './app.js', './kb.js', './engine.js', './pontas.js', './sdk.js', './manifest.json', './icon-192.png', './icon-512.png', './data/agrofit-index.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Rede primeiro para o app (atualiza rápido); cache como fallback offline. Dados grandes: cache primeiro.
  const cacheFirst = /agrofit-index\.json$/.test(url.pathname) || /icon-\d+\.png$/.test(url.pathname);
  if (cacheFirst) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => { const cl = r.clone(); caches.open(CACHE).then(c2 => c2.put(e.request, cl)); return r; })));
    return;
  }
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.status === 200 && url.origin === location.origin) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
    return r;
  }).catch(() => caches.match(e.request).then(c => c || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
