const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../engine.js');
const KB = require('../kb.js');

function app() {
  const elements = new Map();
  const element = s => {
    if (!elements.has(s)) elements.set(s, { value: '', dataset: {}, innerHTML: '', textContent: '',
      classList: { toggle() {}, add() {}, remove() {} }, options: [] });
    return elements.get(s);
  };
  const ctx = vm.createContext({ window: { GC_KB: KB, GCEngine: E, GCPontas: require('../pontas.js'), scrollTo() {}, addEventListener() {} },
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} }, crypto: { randomUUID: () => 'id' },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {}, console });
  vm.runInContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), ctx);
  const run = s => vm.runInContext(s, ctx);
  run(`DB = defaultDB();
    regulagemDoLaudo = () => null;
    renderResultado = renderJar = renderHistorico = renderTalhoes = renderItens = () => {};
    atualizarAlvos = atualizarListasCultura = notaRegulagem = () => {};
    definirTalhoes = nomes => { talhoesSel = nomes; $('#fTalhao').value = nomes.join('; '); };
    calda.itens = [{ nome: 'Wetcit', dose: 100, unidade: 'mL/100L', lote: 'L001' }];`);
  Object.entries({ fCultura: 'Café', fEquip: 'turbo', fVolume: '400', fArea: '10', fTanque: '2000', fPh: '7.5' })
    .forEach(([id, value]) => { element('#' + id).value = value; });
  return { run, element };
}

test('editar volume invalida laudo e jar test sem duplicar histórico', () => {
  const a = app();
  a.run('analisar(true)');
  assert.equal(a.run('conferirResultadoAtual()'), true);
  a.element('#fVolume').value = '200';
  a.run("navTo('resultado')");
  assert.equal(a.run('resultado'), null);
  assert.match(a.element('#jar').innerHTML, /mudou/);
  assert.equal(a.run('DB.historico.length'), 1);
  a.run('analisar(true)');
  assert.equal(a.run('resultado.contexto.volumeHa'), 200);
  assert.equal(a.run('resultado.tanque.volumeTotal'), 2000);
});

test('remoção, dose, lote, água, configuração e histórico invalidam análise', () => {
  for (const change of ["calda.itens = []", "calda.itens[0].dose = 200", "calda.itens[0].lote = 'L002'",
    "$('#fPh').value = '6'", 'DB.config.custo.turbo = 120', "DB.talhoes.push({nome:'Novo', aplicacoes:[]})",
    "DB.jarTests.push({chave:'wetcit', resultado:'incompativel'})"]) {
    const a = app(); a.run('analisar(true)'); a.run(change);
    assert.equal(a.run('conferirResultadoAtual()'), false, change);
  }
});

test('calda salva não recebe status de um cálculo anterior', () => {
  const a = app(); a.run('analisar(true); calda.itens[0].dose = 200');
  assert.equal(a.run('caldaComoReceita().status'), null);
});

test('calda salva preserva lote, rastreio e valores vazios ao recarregar', () => {
  const a = app();
  a.element('#fInicio').value = '2026-09-20T08:00';
  a.run('var receita = caldaComoReceita()');
  a.element('#fSeveridade').value = 'Alta — generalizada';
  a.element('#fParte').value = 'Flor';
  a.element('#fVolume').value = '100';
  a.element('#fInicio').value = '2026-09-21T08:00';
  a.run('carregarReceita(receita)');
  assert.equal(a.element('#fInicio').value, '2026-09-20T08:00');
  assert.equal(a.element('#fSeveridade').value, '');
  assert.equal(a.element('#fParte').value, '');
  assert.equal(a.run('calda.itens[0].lote'), 'L001');
  assert.match(a.element('#fAreaTanque').innerHTML, /400/);
});

test('receita importada sem rastreio não herda aplicação anterior', () => {
  const a = app();
  a.element('#fTermino').value = '2026-09-20T10:00';
  a.element('#fTalhao').value = 'Talhão antigo';
  a.element('#fReceituario').value = '123';
  a.run("carregarReceita({ nome: 'Importada', itens: [], volumeHa: 250 })");
  for (const id of ['#fTermino', '#fTalhao', '#fReceituario']) assert.equal(a.element(id).value, '');
});

test('volume zero e valores negativos não geram cálculos ou histórico', () => {
  for (const change of ["$('#fVolume').value = '0'", "$('#fVolume').value = '-10'", "$('#fArea').value = '-1'",
    "$('#fTanque').value = '-2000'", 'calda.itens[0].dose = -1']) {
    const a = app(); a.run(change);
    assert.equal(a.run('analisar(true)'), null, change);
    assert.equal(a.run('DB.historico.length'), 0);
    assert.match(a.element('#toast').textContent, /maior que zero/);
  }
});
