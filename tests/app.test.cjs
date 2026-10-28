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

test('banco antigo ou backup sem Meus produtos ganha a lista; lixo na lista não entra', () => {
  const a = app();
  a.run("DB = { version: 1, meusProdutos: [{ id: 'a', nome: 'Zintrac' }, null, { id: 'b', nome: '  ' }, { nome: 'sem id' }, 'x'] }; normalizarDB();");
  assert.equal(a.run("DB.meusProdutos.map(p => p.nome).join('|')"), 'Zintrac');
  a.run('DB = { version: 1 }; normalizarDB();');
  assert.equal(a.run('Array.isArray(DB.meusProdutos) && DB.meusProdutos.length'), 0);
  assert.equal(a.run('defaultDB().meusProdutos.length'), 0);
});

test('laudo resumido: veredito, preparo com dose por carga e lote, prazos e assinaturas numa folha', () => {
  const a = app();
  a.run("Object.assign(calda.itens[0], { reentrada: 4, intervalo: 15, carencia: 0 })");
  a.element('#fTermino').value = '2026-10-27T10:30';
  a.element('#fOperador').value = 'João';
  a.run('analisar(true)');
  const html = a.run('laudoResumoHTML(resultado)');
  assert.match(html, new RegExp(a.run('resultado.rastreio.codigo')));
  assert.match(html, /Wetcit/); assert.match(html, /L001/);
  assert.match(html, /Carga cheia/); // tanque de 2000 L informado
  assert.match(html, /Reentrada: <b>27\/10\/2026 14:30/);
  assert.match(html, /Próxima aplicação: <b>11\/11\/2026/);
  assert.match(html, /Checklist pré-saída/); assert.match(html, /assinaturas/); assert.match(html, /João/);
  assert.doesNotMatch(html, /Fonte:/); // fonte e detalhe de cada alerta ficam no laudo completo
});

test('laudo resumido sem tanque não mostra colunas de carga e avisa lote não anotado', () => {
  const a = app();
  a.element('#fTanque').value = '0';
  a.run("calda.itens[0].lote = ''; analisar(true)");
  const html = a.run('laudoResumoHTML(resultado)');
  assert.doesNotMatch(html, /Carga cheia/);
  assert.match(html, /não anotado/);
});

function prazosDe(r) { const a = app(); a.run('var rr = ' + JSON.stringify(r)); return a.run('blocoPrazos(rr)'); }

test('prazos num cartão só: uma linha por produto e "acima do máximo" uma vez', () => {
  const html = prazosDe({
    reentrada: { liberadoEm: '2026-10-28T10:30', limitante: 'A', origemBase: 'termino', base: '2026-10-27T10:30', linhas: [{ nome: 'A', horas: 24, liberadoEm: '2026-10-28T10:30' }], semReentrada: ['B'] },
    proximaAplicacao: { liberadoEm: '2026-11-17', limitante: 'B', origemBase: 'termino', base: '2026-10-27', linhas: [{ nome: 'A', intervalo: 14, liberadoEm: '2026-11-10' }, { nome: 'B', intervalo: 21, liberadoEm: '2026-11-17' }], semIntervalo: [], conflitos: [] },
    colheitaLiberada: { liberadoEm: '2026-11-26', limitante: 'A', origemBase: 'termino', base: '2026-10-27', linhas: [{ nome: 'A', carencia: 30, liberadoEm: '2026-11-26' }, { nome: 'B', carencia: 0, liberadoEm: '2026-10-27' }], semCarencia: [], talhoes: [] },
    aplicacoesCiclo: { linhas: [{ nome: 'B', talhao: 'T3', cicloInicio: '2026-09-01', feitas: 2, comEsta: 3, max: 2, situacao: 'excedido' }], excedidos: [{ nome: 'B', talhao: 'T3', comEsta: 3, max: 2 }], ultimas: [], semLimite: ['A'], semTalhao: false }
  });
  assert.equal((html.match(/<h2>/g) || []).length, 1);
  assert.equal((html.match(/<tr><td>[AB]<\/td>/g) || []).length, 2);
  assert.equal((html.match(/Acima do máximo de aplicações/g) || []).length, 1);
  assert.match(html, /24 h → 28\/10\/2026 10:30/); assert.match(html, /sem carência/);
  assert.match(html, /<b>reentrada:<\/b> B/); assert.match(html, /<b>máximo por ciclo:<\/b> A/);
});

test('prazos sem nada informado viram um aviso só, sem tabela', () => {
  const html = prazosDe({
    reentrada: { liberadoEm: null, linhas: [], semReentrada: ['A'] },
    proximaAplicacao: { liberadoEm: null, linhas: [], semIntervalo: ['A'], conflitos: [] },
    colheitaLiberada: { liberadoEm: null, linhas: [], semCarencia: ['A'], talhoes: [] },
    aplicacoesCiclo: { linhas: [], excedidos: [], ultimas: [], semLimite: ['A'] }
  });
  assert.match(html, /Sem prazos: nada informado/);
  assert.doesNotMatch(html, /<table/);
});
