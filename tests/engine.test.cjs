// Testes do motor: node --test tests/*.test.cjs  (Node 24 do Codex funciona)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const it = (nome, dose, unidade, extra) => Object.assign({ nome, dose, unidade }, extra || {});
const has = (res, regraOuTitulo) => res.alertas.some(a => a.regra === regraOuTitulo || a.titulo.includes(regraOuTitulo));

test('glifosato + sulfato de zinco é incompatível (R01)', () => {
  const r = E.analisar([it('Glifosato 480 SL', 3, 'L/ha', { formulacao: 'SL' }), it('Sulfato de zinco', 1, 'kg/ha')], { volumeHa: 100, agua: { ph: 6, dureza: 50 } });
  assert.equal(r.status, 'incompativel');
  assert.ok(has(r, 'R01'));
  assert.equal(r.pares[0].status, 'incompativel');
});

test('triazol + estrobilurina com Wetcit e água pH 7,5 pede correção e ordena Wetcit no passo 3', () => {
  const r = E.analisar([
    it('Azoxistrobina + Ciproconazol', 0.5, 'L/ha', { formulacao: 'SC' }),
    it('Wetcit', 100, 'mL/100L')
  ], { volumeHa: 400, agua: { ph: 7.5, dureza: 80 }, cultura: 'Café' });
  assert.equal(r.ph.alvoMin, 5.5); assert.equal(r.ph.alvoMax, 6.5);
  assert.ok(r.ph.precisaCorrigir && r.ph.direcao === 'reduzir');
  assert.ok(/Wetcit/.test(r.ph.sugestao));
  assert.ok(has(r, 'Triazol + estrobilurina'));
  const p3 = r.ordem.find(p => p.passo === 3), p6 = r.ordem.find(p => p.passo === 6);
  assert.ok(p3.itens.some(x => x.nome === 'Wetcit'));
  assert.ok(p6.itens.some(x => /Azoxistrobina/.test(x.nome)));
  // com acidificante já previsto, a correção de pH vira atenção (baixa) e a mistura clássica sai compatível
  const ph = r.alertas.find(a => a.tipo === 'ph');
  assert.equal(ph.severidade, 'baixa');
  assert.equal(r.status, 'compativel');
  const semWetcit = E.analisar([it('Azoxistrobina + Ciproconazol', 0.5, 'L/ha', { formulacao: 'SC' })], { volumeHa: 400, agua: { ph: 7.5 } });
  assert.equal(semWetcit.alertas.find(a => a.tipo === 'ph').severidade, 'media');
  assert.equal(semWetcit.status, 'restricoes');
});

test('cúprico + Wetcit é restrição (não bloqueio); cúprico + fosfito bloqueia', () => {
  const a = E.analisar([it('Oxicloreto de cobre', 2, 'kg/ha', { formulacao: 'WP' }), it('Wetcit', 50, 'mL/100L')], { volumeHa: 400, agua: { ph: 7 } });
  assert.ok(has(a, 'R03b')); assert.ok(!has(a, 'R03')); assert.equal(a.status, 'restricoes');
  const b = E.analisar([it('Oxicloreto de cobre', 2, 'kg/ha', { formulacao: 'WP' }), it('Kantphos', 150, 'mL/100L')], { volumeHa: 400, agua: { ph: 7 } });
  assert.ok(has(b, 'R03')); assert.equal(b.status, 'incompativel');
});

test('regra da fazenda move o acidificante para o passo 9', () => {
  const r = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' }), it('Wetcit', 50, 'mL/100L')], { volumeHa: 400, regraFazenda: { acidificanteUltimo: true } });
  assert.ok(r.ordem.find(p => p.passo === 9).itens.some(x => x.nome === 'Wetcit'));
  assert.ok(r.ordem.find(p => p.passo === 9).itens[0].notas.some(n => /Regra da fazenda/.test(n)));
});

test('mesmo modo de ação repetido gera alerta de resistência', () => {
  const r = E.analisar([it('Azoxistrobina', 0.3, 'L/ha'), it('Piraclostrobina', 0.3, 'L/ha')], { volumeHa: 150, agua: { ph: 6 } });
  assert.ok(has(r, 'Mesmo modo de ação repetido (FRAC 11)'));
});

test('organofosforado + sulfonilureia só bloqueia em milho/sorgo', () => {
  const itens = [it('Clorpirifós 480 EC', 1, 'L/ha', { formulacao: 'EC' }), it('Nicosulfuron 40 OD', 1.25, 'L/ha', { formulacao: 'OD' })];
  assert.ok(has(E.analisar(itens, { cultura: 'Milho', volumeHa: 150 }), 'R13'));
  assert.ok(has(E.analisar(itens, { cultura: 'Sorgo', volumeHa: 150 }), 'R13'));
  assert.ok(!has(E.analisar(itens, { cultura: 'Soja', volumeHa: 150 }), 'R13'));
});

test('conversão de dose: 100 mL/100 L a 400 L/ha = 0,4 L/ha; jar test 1 mL/L', () => {
  const d = E.dosePorHa({ dose: 100, unidade: 'mL/100L' }, 400);
  assert.equal(+d.qtd.toFixed(3), 0.4); assert.equal(d.base, 'L');
  const r = E.analisar([it('Wetcit', 100, 'mL/100L')], { volumeHa: 400 });
  assert.equal(r.jarTest.proporcao[0].porLitro, 1);
  assert.equal(r.jarTest.proporcao[0].unidade, 'mL/L');
});

test('quatro produtos disparam alerta de conjunto e status não é compatível', () => {
  const r = E.analisar([it('Mancozebe', 2, 'kg/ha', { formulacao: 'WG' }), it('Tebuconazol', 0.5, 'L/ha'), it('Tiametoxam', 0.2, 'kg/ha'), it('Iharol Gold', 100, 'mL/100L')], { volumeHa: 400, agua: { ph: 6 } });
  assert.ok(has(r, '4 produtos na mesma calda'));
  assert.notEqual(r.status, 'compativel');
});

test('registro Agrofit: sem cultura registrada gera alerta legal alto', () => {
  const r = E.analisar([it('Herbicida X', 1, 'L/ha', { ativos: ['atrazina'], registro: { culturas: ['Milho', 'Sorgo'], alvos: {} } })], { cultura: 'Café', volumeHa: 400 });
  assert.equal(r.registro[0].registrado, false);
  assert.ok(r.alertas.some(a => a.tipo === 'legal' && a.severidade === 'alta'));
  const ok = E.analisar([it('Herbicida X', 1, 'L/ha', { ativos: ['atrazina'], registro: { culturas: ['Milho', 'Sorgo'], alvos: {} } })], { cultura: 'Sorgo', volumeHa: 150 });
  assert.equal(ok.registro[0].registrado, true);
});

test('ficha de tanque e custo por hectare', () => {
  const r = E.analisar([it('Azoxistrobina', 0.5, 'L/ha', { preco: 185 }), it('Wetcit', 100, 'mL/100L', { preco: 40 })], { volumeHa: 400, area: 10, tanque: 2000, equipamento: 'turbo', agua: { ph: 6 } });
  assert.equal(r.tanque.cargasCheias, 2); assert.equal(r.tanque.ultimaCarga, 0);
  assert.equal(r.tanque.haPorCarga, 5);
  assert.equal(r.tanque.porCargaCheia.find(x => /Azoxistrobina/.test(x.nome)).qtd, 2.5);
  assert.equal(r.custo.produtosHa, 108.5); // 0,5×185 + 0,4×40
  assert.equal(r.custo.operacionalHa, 90);
  assert.equal(r.custo.totalArea, 1985);
});

test('sem faixa de pH comum: cúprico (6–8) + glifosato (4,5–6) → alerta alto', () => {
  const r = E.analisar([it('Oxicloreto de cobre', 2, 'kg/ha'), it('Glifosato', 2, 'L/ha')], { volumeHa: 200, agua: { ph: 6 } });
  assert.equal(r.status, 'incompativel');
  assert.ok(has(r, 'R02'));
});

test('alertas da mesma regra são agrupados e a matriz continua marcando cada par', () => {
  const r = E.analisar([it('Azoxistrobina', 0.3, 'L/ha', { formulacao: 'SC' }), it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'SC' }), it('Sulfato de zinco', 1, 'kg/ha')], { volumeHa: 400, agua: { ph: 6 } });
  const r26 = r.alertas.filter(a => a.regra === 'R26');
  assert.equal(r26.length, 1);
  assert.equal(r26[0].pares.length, 2);
  assert.ok(/Sulfato de zinco × Azoxistrobina; Sulfato de zinco × Tebuconazol/.test(r26[0].paresTexto), r26[0].paresTexto);
  const par = r.pares.find(p => p.alertas.some(t => /salino/.test(t)));
  assert.ok(par);
});

test('produto desconhecido fica como não testado', () => {
  const r = E.analisar([it('Produto Misterioso', 1, 'L/ha'), it('Tebuconazol', 0.5, 'L/ha')], { volumeHa: 200, agua: { ph: 6 } });
  assert.ok(r.itens[0].conhecido === false);
  assert.ok(r.pares[0].status === 'nao-testado' || r.status === 'restricoes');
});

/* ═══════ regulagem no laudo e rastreabilidade ═══════ */
const PT = require('../pontas.js');

const regBase = () => PT.calcular({ modo: 'area', velocidade: 8, volumeHa: 150, espacamento: 0.5, nBicos: 40, ponta: 'tj-tt', iso: '04', angulo: 110 });
const rastreioCheio = {
  fazenda: 'Fazenda Santa Clara', talhao: 'Gleba 4', maquina: 'MF 4275 + Jacto Arbus 2000',
  operador: 'João da Silva', responsavel: 'Maria Souza', crea: 'CREA-MG 123456/D',
  receituario: 'RA-2026-0771', inicio: '2026-09-19T06:30', termino: '2026-09-19T10:10'
};
const itLote = (nome, dose, unidade, lote, extra) => Object.assign({ id: nome, nome, dose, unidade, lote }, extra || {});

test('a regulagem entra no laudo com ponta, pressão e volume entregue', () => {
  const g = regBase();
  const r = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' })], { volumeHa: 150, regulagem: g, data: 'fixa' });
  assert.ok(r.regulagem, 'o laudo tem de carregar a regulagem');
  assert.equal(r.regulagem.ponta.marca, 'TeeJet');
  assert.equal(r.regulagem.volumeDosado, 150);
  assert.ok(Math.abs(r.regulagem.volumeEntregue - 150) <= 150 * 0.05);
  assert.ok(Math.abs(r.regulagem.desvio) <= 5, 'sem desvio quando o volume da calda é o da regulagem');
  assert.ok(!r.alertas.some(a => /Regulagem entrega/.test(a.titulo)), 'volume batendo não gera alerta');
  // o checklist passa a cobrar a ponta e a pressão que o laudo afirma
  assert.ok(r.checklist.some(c => /TeeJet TT/.test(c)));
  assert.ok(r.checklist.some(c => /Pressão .* bar e velocidade .* km\/h/.test(c)));
});

test('volume da regulagem diferente do volume da calda vira alerta de dose', () => {
  const g = regBase(); // 150 L/ha
  const r = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' })], { volumeHa: 300, regulagem: g, data: 'fixa' });
  const al = r.alertas.find(a => /Regulagem entrega/.test(a.titulo));
  assert.ok(al, 'tem de acusar o descompasso');
  assert.equal(al.severidade, 'alta'); // desvio de -50 %
  assert.equal(al.tipo, 'operacional');
  assert.ok(r.regulagem.desvio < -15);
  assert.notEqual(r.status, 'compativel', 'laudo com volume errado não sai compatível');
  // desvio pequeno é restrição, não crítico
  const brando = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' })], { volumeHa: 165, regulagem: g, data: 'fixa' });
  assert.equal(brando.alertas.find(a => /Regulagem entrega/.test(a.titulo)).severidade, 'media');
});

test('em faixa o laudo confere o L/ha de lavoura, não o da faixa', () => {
  const g = PT.calcular({ modo: 'faixa', velocidade: 5, volumeHa: 200, larguraFaixa: 1.6, bicosPorPassada: 4, entreLinhas: 3.6, ponta: 'tj-tf', iso: 'TF-2.5', protecao: true });
  const r = E.analisar([it('Glifosato', 3, 'L/ha', { formulacao: 'SL' })], { volumeHa: g.volumeLavoura, regulagem: g, data: 'fixa' });
  assert.equal(r.regulagem.modo, 'faixa');
  assert.ok(Math.abs(r.regulagem.volumeEntregue - g.volumeLavoura) < 0.5);
  assert.ok(r.regulagem.volumeEntregue < g.volumeAplicado, 'lavoura é menor que faixa');
  assert.ok(!r.alertas.some(a => /Regulagem entrega/.test(a.titulo)));
});

test('laudo sem regulagem avisa que não prova como foi aplicado', () => {
  const r = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' })], { volumeHa: 150, data: 'fixa' });
  assert.equal(r.regulagem, null);
  assert.ok(r.alertas.some(a => a.titulo === 'Laudo sem regulagem anexada'));
});

test('condição do ar crítica da regulagem sobe para os alertas do laudo', () => {
  const g = PT.calcular({ modo: 'area', velocidade: 8, volumeHa: 150, espacamento: 0.5, nBicos: 40, ponta: 'tj-tt', iso: '04', temperatura: 34, umidade: 25, vento: 4 });
  const r = E.analisar([it('Tebuconazol', 0.5, 'L/ha', { formulacao: 'EC' })], { volumeHa: 150, regulagem: g, data: 'fixa' });
  const al = r.alertas.find(a => /Delta T/.test(a.titulo));
  assert.ok(al, 'o Delta T crítico tem de aparecer no laudo');
  assert.equal(al.severidade, 'alta');
  assert.equal(al.fonte, 'Regulagem (aba Pontas)');
  assert.ok(r.checklist.some(c => /Delta T .* e vento .* medidos no talhão/.test(c)));
});

test('código de conferência muda com qualquer mudança no registro', () => {
  const base = { volumeHa: 150, cultura: 'Café', regulagem: regBase(), rastreio: rastreioCheio, data: '19/09/2026 07:00', kbVersao: '1.0' };
  const itens = [itLote('Tebuconazol', 0.5, 'L/ha', 'L-2026-88', { formulacao: 'EC' })];
  const r = E.analisar(itens, base);
  assert.match(r.rastreio.codigo, /^GC-[0-9A-Z]{7}$/);
  assert.equal(r.rastreio.completo, true);
  assert.deepEqual(r.rastreio.pendencias, []);
  assert.equal(E.analisar(itens, base).rastreio.codigo, r.rastreio.codigo, 'mesmo registro, mesmo código');
  const outraDose = E.analisar([itLote('Tebuconazol', 0.6, 'L/ha', 'L-2026-88', { formulacao: 'EC' })], base);
  assert.notEqual(outraDose.rastreio.codigo, r.rastreio.codigo, 'mudou a dose, muda o código');
  const outroLote = E.analisar([itLote('Tebuconazol', 0.5, 'L/ha', 'L-2026-99', { formulacao: 'EC' })], base);
  assert.notEqual(outroLote.rastreio.codigo, r.rastreio.codigo, 'mudou o lote, muda o código');
  const outroTalhao = E.analisar(itens, { ...base, rastreio: { ...rastreioCheio, talhao: 'Gleba 5' } });
  assert.notEqual(outroTalhao.rastreio.codigo, r.rastreio.codigo, 'mudou o talhão, muda o código');
  const outraPressao = E.analisar(itens, { ...base, regulagem: PT.calcular({ modo: 'area', velocidade: 6, volumeHa: 150, espacamento: 0.5, nBicos: 40, ponta: 'tj-tt', iso: '04', angulo: 110 }) });
  assert.notEqual(outraPressao.rastreio.codigo, r.rastreio.codigo, 'mudou a regulagem, muda o código');
  // o código é reproduzível a partir do texto canônico publicado no laudo
  assert.equal(E.codigoDe(r.rastreio.canonico), r.rastreio.codigo);
});

test('campos exigidos em branco viram pendência e alerta, sem travar o laudo', () => {
  const r = E.analisar([itLote('Tebuconazol', 0.5, 'L/ha', 'L-1', { formulacao: 'EC' })], { volumeHa: 150, regulagem: regBase(), rastreio: { talhao: 'Gleba 4' }, data: 'fixa' });
  assert.equal(r.rastreio.completo, false);
  assert.deepEqual(r.rastreio.pendencias, ['Trator / pulverizador', 'Operador (aplicador)', 'Responsável técnico', 'Início da aplicação']);
  const al = r.alertas.find(a => /Rastreabilidade incompleta/.test(a.titulo));
  assert.ok(al && al.severidade === 'baixa', 'falta de registro é apontada, não bloqueia');
  assert.ok(r.checklist.some(c => c.includes(r.rastreio.codigo)));
});

test('produto sem lote é apontado nominalmente', () => {
  const r = E.analisar([itLote('Tebuconazol', 0.5, 'L/ha', 'L-1', { formulacao: 'EC' }), it('Wetcit', 50, 'mL/100L')], { volumeHa: 150, rastreio: rastreioCheio, data: 'fixa' });
  assert.deepEqual(r.rastreio.semLote, ['Wetcit']);
  assert.ok(r.alertas.some(a => a.titulo === 'Sem lote registrado: Wetcit'));
  assert.deepEqual(r.rastreio.lotes.find(l => l.nome === 'Tebuconazol').lote, 'L-1');
});
