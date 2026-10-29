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
      classList: { toggle() {}, add() {}, remove() {} }, options: [], childNodes: [{ nodeValue: '' }], scrollIntoView() {}, addEventListener() {} });
    return elements.get(s);
  };
  const ctx = vm.createContext({ window: { GC_KB: KB, GCEngine: E, GCPontas: require('../pontas.js'), scrollTo() {}, addEventListener() {} },
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} }, crypto: { randomUUID: () => 'id' },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {}, console });
  vm.runInContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), ctx);
  const run = s => vm.runInContext(s, ctx);
  run(`DB = defaultDB();
    const regulagemDoLaudoOriginal = regulagemDoLaudo;
    regulagemDoLaudo = () => null;
    renderResultado = renderJar = renderHistorico = renderTalhoes = renderItens = () => {};
    atualizarAlvos = atualizarListasCultura = notaRegulagem = () => {};
    definirTalhoes = nomes => { talhoesSel = nomes; $('#fTalhao').value = nomes.join('; '); };
    calda.itens = [{ nome: 'Wetcit', dose: 100, unidade: 'mL/100L', lote: 'L001' }];`);
  Object.entries({ fCultura: 'Café', fEquip: 'turbo', fVolume: '400', fArea: '10', fTanque: '2000', fPh: '7.5' })
    .forEach(([id, value]) => { element('#' + id).value = value; });
  return { run, element };
}

function appFaixa() {
  const a = app();
  a.run('initPontas()');
  Object.entries({ pModo: 'faixa', pVol: '200', pVel: '4.5', pLf: '1.6', pBf: '4',
    pEl: '3.5', pNb: '40', pEsp: '0.5', pPonta: 'tj-aixr', pIso: '02', pAng: '110',
    pTq: '600', pArea: '13.125', cSeg: '30', cColetas: '300 300 300 300', cPress: '3',
    xModo: 'vazao', xAlvo: '0.6' }).forEach(([id, v]) => { a.element('#' + id).value = v; });
  a.element('#pFixar').checked = false;
  return a;
}

test('PSI: converte pressão fixa preservando vazão, volume e unidade nos dados', () => {
  const a = appFaixa(); a.element('#pFixar').checked = true; a.element('#pPress').value = '3';
  a.run('calcularRegulagem(true)'); const vol = a.run('regulagem.volumeAplicado');
  a.element('#cPress').value = '3.86'; a.element('#xP1').value = '3';
  a.run("mudarUnidadePressao('psi')");
  assert.equal(a.element('#pPress').value, 43.51);
  assert.match(a.element('#pPressTitulo').textContent, /PSI/);
  assert.match(a.element('#pResultado').innerHTML, /43,51 PSI/);
  assert.match(a.element('#xTabela').innerHTML, /<th>PSI<\/th>/);
  assert.equal(a.run('lerRegulagem().pressao'), 3);
  a.run('calcularRegulagem(true)');
  assert.equal(a.run('regulagem.volumeAplicado'), vol);
  assert.equal(a.run('DB.config.pontas.pressao'), 3);
  assert.equal(a.run('DB.config.unidadePressao'), 'psi');
});

test('PSI: pressão digitada de 50 não vira 50,04 por arredondamento em bar', () => {
  const a = appFaixa(); a.run("mudarUnidadePressao('psi')");
  a.element('#pFixar').checked = true; a.element('#pPress').value = '50'; a.run('calcularRegulagem(true)');
  assert.match(a.element('#pResultado').innerHTML, /<b>50 PSI<\/b>/);
  a.run("DB.regulagens = [{nome:'TESTE-PSI', resumo:'faixa · 3,45 bar', entrada:lerRegulagem()}]; renderRegulagens()");
  assert.match(a.element('#listaRegulagens').innerHTML, /50 PSI/);
  assert.doesNotMatch(a.element('#listaRegulagens').innerHTML, /50,04/);
  a.element('#xModo').value = 'pressao'; a.element('#xQ1').value = '0.6';
  a.element('#xP1').value = '40'; a.element('#xAlvo').value = '50'; a.run('cruzarVazaoPressao()');
  assert.match(a.element('#xResultado').innerHTML, /<b>50 PSI<\/b>/);
});

test('PSI: alternar unidade preserva média, desgaste e referência da calibração', () => {
  const a = appFaixa(); a.run('renderCalibracao(); preencherCruzarDaCalibracao()');
  const antes = a.run('JSON.stringify(ultimaCalibracao)');
  a.run("mudarUnidadePressao('psi')");
  assert.equal(a.run('JSON.stringify(ultimaCalibracao)'), antes);
  assert.match(a.element('#cResultado').innerHTML, /43,51 PSI/);
  assert.equal(a.element('#xP1').value, 43.51);
  a.run("mudarUnidadePressao('bar')");
  assert.equal(a.element('#cPress').value, 3);
  assert.equal(a.run('JSON.stringify(ultimaCalibracao)'), antes);
});

test('PSI: cruzamento usa pressão conhecida e desejada convertidas e aplica a pressão correta', () => {
  const a = appFaixa(); a.element('#xModo').value = 'pressao';
  a.element('#xQ1').value = '0.6'; a.element('#xP1').value = '3'; a.element('#xAlvo').value = '6';
  a.run("mudarUnidadePressao('psi'); cruzarVazaoPressao()");
  assert.match(a.element('#xResultado').innerHTML, /87,02 PSI/);
  assert.match(a.element('#xAlvoLabel').childNodes[0].nodeValue, /PSI/);
  a.element('#btnUsarPressao').onclick();
  assert.equal(a.run('lerRegulagem().pressao'), 6);
  assert.equal(a.run('regulagem.pressao'), 6);
});

test('PSI: trocar unidade não converte alvo de volume nem campos vazios', () => {
  const a = appFaixa(); a.element('#xModo').value = 'volume'; a.element('#xAlvo').value = '200';
  a.element('#pPress').value = ''; a.element('#cPress').value = '';
  a.run("mudarUnidadePressao('psi')");
  assert.equal(a.element('#xAlvo').value, '200');
  assert.equal(a.element('#pPress').value, ''); assert.equal(a.element('#cPress').value, '');
  a.run("mudarUnidadePressao('bar', false)"); a.element('#cPress').value = '3.86';
  for (let i = 0; i < 10; i++) a.run("mudarUnidadePressao('bar', false); mudarUnidadePressao('psi', false)");
  a.run("mudarUnidadePressao('bar', false)");
  assert.equal(a.element('#cPress').value, 3.86);
  assert.equal(a.element('#plPmin').value, ''); // vazio do DOM de teste permanece vazio
});

test('PSI: regulagem antiga em bar e preferência PSI são carregadas sem reinterpretar a pressão', () => {
  const a = appFaixa(); a.element('#pFixar').checked = true; a.element('#pPress').value = '3';
  a.run("calcularRegulagem(true); DB.config.unidadePressao = 'psi'; initPontas()");
  assert.equal(a.run('lerRegulagem().pressao'), 3);
  assert.equal(a.element('#pPress').value, 43.51);
  a.run("var exportado; download = (n, c) => { exportado = JSON.parse(c); }; calcularRegulagem(true)");
  a.element('#btnExpReg').onclick();
  assert.equal(a.run('exportado.unidadePressao'), 'bar');
  assert.equal(a.run('exportado.unidadePressaoExibicao'), 'psi');
  assert.equal(a.run('exportado.regulagem.pressao'), 3);
});

test('PSI: tabela da ponta própria é convertida para exibir e volta a bar sem perder vazão', () => {
  const a = appFaixa();
  a.run("mudarUnidadePressao('psi', false); var dados = { id:'teste-psi', marca:'TESTE-PSI', modelo:'Coleta', tipo:'leque', angulos:'110', pressaoMin:1, pressaoMax:6, tamanhos:'SF-02: 0,8@3' }; editarPontaLivre(dados)");
  assert.equal(a.element('#plPmin').value, 14.5);
  assert.match(a.element('#plTam').value, /@43\.511/);
  a.run("usarPonta = () => {}; salvarPontaLivre()");
  assert.equal(a.run('DB.pontasLivres[0].pressaoMin'), 1);
  assert.equal(a.run('DB.pontasLivres[0].pressaoMax'), 6);
  assert.equal(a.run("PT.vazaoDaPonta(DB.pontasLivres[0].id, 'SF-02', 3)"), 0.8);
  a.run('PT.removerPonta(DB.pontasLivres[0].id)');
});

test('imagem: 1800 mL em 60 s é um único bico de 1,8 L/min e 198,2 L/ha', () => {
  const a = appFaixa();
  a.element('#pVel').value = '5.45'; a.element('#pLf').value = '1'; a.element('#pBf').value = '1';
  a.element('#cSeg').value = '60'; a.element('#cPress').value = '3.86';
  a.element('#cColetas').value = '1,800'; a.run('renderCalibracao()');
  assert.equal(a.run('ultimaCalibracao'), null);
  assert.match(a.element('#cResultado').innerHTML, /1800/);
  a.element('#cColetas').value = '1800'; a.run('renderCalibracao()');
  assert.equal(a.run('ultimaCalibracao.bicos.length'), 1);
  assert.equal(a.run('ultimaCalibracao.media'), 1.8);
  assert.equal(a.run('ultimaCalibracao.volumeReal'), 198.2);
  assert.equal(a.run('ultimaCalibracao.erro'), -0.9);
  assert.equal(a.run('ultimaCalibracao.correcao.length'), 0);
  assert.match(a.element('#cResultado').innerHTML, /[Uu]ma coleta não avalia a uniformidade|uniformidade do conjunto não avaliada/);
  a.element('#cUnidadeColeta').value = 'L'; a.element('#cUnidadeColeta').onchange();
  a.element('#cColetas').value = '1,800'; a.run('renderCalibracao()');
  assert.equal(a.run('ultimaCalibracao.media'), 1.8);
  assert.equal(a.run('ultimaCalibracao.bicos.length'), 1);
});

test('regulagem: separa vírgula decimal e mantém bico de coleta zero', () => {
  const a = app();
  assert.equal(a.run("JSON.stringify(lerColetas('820,5 0;790.5'))"), '[820.5,0,790.5]');
  assert.equal(a.run("lerColetas('820 erro 790')"), null);
  assert.equal(a.run("lerColetas('820,790,900')"), null);
});

test('faixa: resumo e ficha concordam e uma carga não vira duas por arredondamento', () => {
  const a = appFaixa();
  a.run('calcularRegulagem(true)');
  assert.match(a.element('#pAreaTanque').innerHTML, /6,56 ha de lavoura/);
  assert.match(a.element('#pAreaTanque').innerHTML, /91,4 L\/ha de lavoura/);
  assert.equal(a.run('regulagem.ficha.cargas'), 2);
  a.element('#btnUsarAreaTanque').onclick();
  assert.equal(a.run('regulagem.ficha.cargas'), 1);
});

test('faixa: pressão fixa atualiza autonomia mesmo sem clicar em calcular', () => {
  const a = appFaixa();
  a.element('#pFixar').checked = true; a.element('#pPress').value = '3';
  a.run('atualizarAreaTanque()');
  assert.match(a.element('#pAreaTanque').innerHTML, /4,98 ha de lavoura/);
  assert.match(a.element('#pAreaTanque').innerHTML, /pressão fixa/);
});

test('calibração: mostra os dois hectares e invalida coleta e referência ao editar o arranjo', () => {
  const a = appFaixa();
  a.run('renderCalibracao(); preencherCruzarDaCalibracao()');
  assert.match(a.element('#cResultado').innerHTML, /91,4/);
  assert.match(a.element('#cResultado').innerHTML, /na faixa tratada/);
  assert.equal(a.element('#xQ1').value, 0.6);
  a.element('#pLf').value = '1.2'; a.element('#pLf').oninput();
  assert.equal(a.run('ultimaCalibracao'), null);
  assert.equal(a.element('#xQ1').value, '');
  assert.match(a.element('#cResultado').innerHTML, /mudaram/);
});

test('calibração: coleta editada remove o resultado anterior', () => {
  const a = appFaixa(); a.run('renderCalibracao()');
  a.element('#cColetas').value = '300 0 300'; a.element('#cColetas').oninput();
  assert.equal(a.run('ultimaCalibracao'), null);
  a.run('renderCalibracao()');
  assert.equal(a.run('ultimaCalibracao.bicos.length'), 3);
  assert.equal(a.run('ultimaCalibracao.bicos[1].vazao'), 0);
});

test('cruzamento usa a referência da tabela própria e a pressão da coleta original', () => {
  const a = appFaixa(); a.element('#pPonta').value = 'mj-tm-ia'; a.element('#pIso').value = '1.5';
  a.run('preencherCruzarDaPonta()');
  assert.ok(a.element('#xQ1').value > 0);
  assert.equal(a.element('#xQ1').value, a.run("PT.vazaoDaPonta('mj-tm-ia', '1.5', 3)"));
  a.run('renderCalibracao()');
  a.element('#cPress').value = '6'; // alteração sem evento: nunca misturar média antiga com pressão nova
  a.run('preencherCruzarDaCalibracao()');
  assert.equal(a.element('#xP1').value, 3);
});

test('regulagem inválida retira a ficha anterior e impede salvar resultado antigo', () => {
  const a = appFaixa(); a.run('calcularRegulagem(true)');
  a.element('#pLf').value = '0'; a.element('#pLf').oninput();
  assert.equal(a.run('regulagem'), null);
  assert.match(a.element('#pResultado').innerHTML, /maiores que zero/);
  assert.equal(a.element('#pAreaTanque').innerHTML, '');
  a.element('#fRegulagem').value = 'atual';
  a.run('regulagemDoLaudo = regulagemDoLaudoOriginal');
  assert.equal(a.run('regulagemDoLaudo()'), null, 'a configuração anterior salva não pode reaparecer como atual');
});

test('transferir L/ha de lavoura para calda conserva a casa decimal', () => {
  const a = appFaixa(); a.run('calcularRegulagem(true)');
  a.element('#btnUsarVolume').onclick();
  assert.equal(a.element('#fVolume').value, 91.4);
  assert.equal(a.run('DB.config.volumeHa'), 91.4);
});

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
