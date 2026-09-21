const CACHE = 'gefaz-calda-v27';
const ASSETS = ['./', './index.html', './app.css', './app.js', './kb.js', './engine.js', './pontas.js', './estoque.js', './fazenda.js', './estoque-ui.js', './metas-ui.js', './sdk.js', './manifest.json', './icon-192.png', './icon-512.png', './data/agrofit-index.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => /^gefaz-calda-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const salvo = () => caches.open(CACHE).then(c => c.match(e.request));
  const guardar = r => {
    if (r && r.status === 200) {
      const copia = r.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {}));
    }
    return r;
  };
  // Rede primeiro para o app (atualiza rápido); cache como fallback offline. Dados grandes: cache primeiro
  // (o leitor de PDF do estoque, em vendor/pdfjs/, entra no cache na primeira vez que é usado).
  const cacheFirst = /vendor\/pdfjs\//.test(url.pathname) || /agrofit-index\.json$/.test(url.pathname) || /icon-\d+\.png$/.test(url.pathname);
  if (cacheFirst) {
    e.respondWith(salvo().then(c => c || fetch(e.request).then(guardar)));
    return;
  }
  e.respondWith(fetch(e.request).then(guardar).catch(() => salvo().then(c => c || (e.request.mode === 'navigate' ? caches.open(CACHE).then(cache => cache.match('./index.html')) : Response.error()))));
});
