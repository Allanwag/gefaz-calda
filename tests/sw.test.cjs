const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const CODIGO_SW = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
const CACHE_ATUAL = /const CACHE = '(gefaz-calda-v\d+)'/.exec(CODIGO_SW)[1]; // o teste vale para qualquer versão do cache

function worker({ failInstall = false, status = 200, offline = false } = {}) {
  const handlers = {}, deleted = [], writes = [];
  let claimed = false, skipped = false;
  const cached = { offline: true };
  const cache = { addAll: async () => { if (failInstall) throw Error('offline'); },
    match: async () => cached, put: async (req) => writes.push(req.url) };
  const self = { location: { origin: 'https://allanwag.github.io' }, registration: { scope: 'https://allanwag.github.io/gefaz-calda/' },
    addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => { skipped = true; },
    clients: { claim: async () => { claimed = true; } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), { self, URL, Response,
    caches: { open: async () => cache, keys: async () => ['pvgest-v5', 'gefaz360-v2', 'gefaz-calda-v19', 'gefaz-calda-v20', 'gefaz-calda-v21', CACHE_ATUAL], delete: async key => deleted.push(key) },
    fetch: async () => { if (offline) throw Error('offline'); return { status, clone: () => ({ status }) }; } });
  async function dispatch(type, path = 'app.js') {
    const pending = []; let response;
    handlers[type]({ request: { method: 'GET', url: new URL(path, self.registration.scope).href },
      waitUntil: p => pending.push(p), respondWith: p => { response = p; } });
    const result = await response; await Promise.all(pending); return result;
  }
  return { dispatch, deleted, writes, cached, state: () => ({ claimed, skipped }) };
}
test('atualizar PWA preserva caches do PVGest e Gefaz360', async () => {
  const w = worker(); await w.dispatch('activate');
  assert.deepEqual(w.deleted, ['gefaz-calda-v19', 'gefaz-calda-v20', 'gefaz-calda-v21']); assert.equal(w.state().claimed, true);
});
test('instalação incompleta não substitui versão offline funcional', async () => {
  const w = worker({ failInstall: true }); await assert.rejects(w.dispatch('install'), /offline/);
  assert.equal(w.state().skipped, false);
});
test('service worker não intercepta recursos fora do app', async () => {
  const w = worker();
  assert.equal(await w.dispatch('fetch', '../pvgest/app.js'), undefined);
  assert.equal(await w.dispatch('fetch', 'https://example.com/app.js'), undefined);
  assert.deepEqual(w.writes, []);
});
test('resposta 404 não sobrescreve cache e falha de rede usa cache próprio', async () => {
  const bad = worker({ status: 404 }); await bad.dispatch('fetch'); assert.deepEqual(bad.writes, []);
  const off = worker({ offline: true }); assert.equal(await off.dispatch('fetch'), off.cached);
  const ok = worker(); await ok.dispatch('fetch'); assert.equal(ok.writes.length, 1);
});

test('todo arquivo do pré-cache existe: se um faltar, o addAll derruba a instalação inteira', () => {
  const assets = JSON.parse(/const ASSETS = (\[.*?\]);/.exec(CODIGO_SW)[1].replace(/'/g, '"'));
  assert.ok(assets.length > 10);
  const faltam = assets.filter(a => a !== './' && !fs.existsSync(require('node:path').join(__dirname, '..', a)));
  assert.deepEqual(faltam, []);
  ['./estoque.js', './fazenda.js', './estoque-ui.js', './metas-ui.js'].forEach(a => assert.ok(assets.includes(a), a + ' precisa estar no pré-cache'));
});

test('o leitor de PDF vem do cache depois da primeira vez e todos os scripts do index.html são pré-cacheados', async () => {
  const w = worker(); const r = await w.dispatch('fetch', 'vendor/pdfjs/pdf.min.js');
  assert.equal(r, w.cached, 'cache primeiro para o vendor');
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => './' + m[1]);
  const assets = JSON.parse(/const ASSETS = (\[.*?\]);/.exec(CODIGO_SW)[1].replace(/'/g, '"'));
  assert.deepEqual(scripts.filter(s => !assets.includes(s)), [], 'script do index.html fora do pré-cache não funciona offline');
});
