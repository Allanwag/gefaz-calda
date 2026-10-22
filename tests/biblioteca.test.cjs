const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../biblioteca.js');
const E = require('../engine.js');
const P = require('../pontas.js');
const agro = require('../data/agrofit-index.json');
const mj = require('../data/magnojet.json');
const lista = B.montarDaninhas(agro);

test('biblioteca cobre todos os alvos daninhos de herbicidas e exclui fungos e insetos', () => {
  const cats = E.classificarAlvos(agro), esperados = new Set();
  agro.produtos.filter(p => /herbicida/i.test(p.cl)).forEach(p => Object.values(p.a).flat().forEach(i => {
    if (cats[i] === 'daninha') esperados.add(i);
  }));
  assert.deepEqual(new Set(lista.flatMap(d => d.alvoIds)), esperados);
  assert.equal(lista.length, 304);
  assert.ok(!lista.some(d => /colletotrichum|fusarium|atta sexdens/i.test(d.cientifico)));
  assert.equal(new Set(lista.map(d => d.id)).size, lista.length);
});

test('pesquisa encontra nome original, nome usual, científico e termos sem acento', () => {
  assert.equal(B.buscarDaninhas(lista, 'buva')[0].cientifico, 'Conyza bonariensis');
  assert.equal(B.buscarDaninhas(lista, 'amargoso digitaria')[0].cientifico, 'Digitaria insularis');
  assert.equal(B.buscarDaninhas(lista, 'fura-capa')[0].cientifico, 'Bidens pilosa');
  assert.equal(B.buscarDaninhas(lista, 'tiririca')[0].cientifico, 'Cyperus rotundus');
  assert.ok(B.buscarDaninhas(lista, 'picao preto').length);
  assert.equal(B.buscarDaninhas(lista, 'inexistente-xxx').length, 0);
});

test('cada produto listado tem vínculo explícito com o alvo e a cultura escolhida', () => {
  lista.forEach(d => d.culturas.forEach(ci => {
    const controles = B.controles(d, agro, ci);
    assert.ok(controles.length);
    controles.forEach(r => {
      assert.deepEqual(r.culturas, [agro.culturas[ci]]);
      assert.ok((r.produto.a[ci] || []).some(i => d.alvoIds.includes(i)));
    });
  }));
});

test('não cruza culturas distintas do mesmo produto nem amplia Todas as culturas', () => {
  const a = { culturas: ['Café', 'Soja', 'Todas as culturas'], alvos: ['Buva (Conyza bonariensis)', 'Leiteiro (Euphorbia heterophylla)'], produtos: [
    { m: 'Teste A', r: 'A', cl: 'Herbicida', ia: [], a: { 0: [0], 1: [1] } },
    { m: 'Teste B', r: 'B', cl: 'Herbicida', ia: [], a: { 2: [0] } }
  ] };
  const d = B.montarDaninhas(a).find(d => /conyza/.test(d.id));
  assert.equal(B.controles(d, a, 1).length, 0);
  assert.deepEqual(B.controles(d, a, 0).map(r => r.produto.r), ['A']);
  assert.equal(B.alvoNaCultura(d, a, 'Soja'), null);
  assert.equal(B.alvoNaCultura(d, a, 'Café'), a.alvos[0]);
});

test('todas as fichas com sinais têm referência pública e não incluem doses', () => {
  assert.equal(lista.filter(d => d.perfil).length, 11);
  B.PERFIS.forEach(p => {
    assert.match(p.fonte, /^https:\/\//);
    assert.ok(p.pagina > 0 || p.referencia);
    assert.ok(!/\b(L\/ha|kg\/ha|mL\/)/.test(p.sinais));
  });
});

test('índice Magnojet cobre as 51 entradas, mantém páginas e só liga calculadores existentes', () => {
  assert.equal(mj.modelos.length, 51);
  assert.equal(new Set(mj.modelos.map(p => p.modelo)).size, 51);
  assert.equal(mj.modelos.find(p => p.modelo === 'AD-IA').pagina, 31);
  assert.equal(mj.modelos.find(p => p.modelo === 'MAG').pagina, 56);
  mj.modelos.forEach(p => {
    assert.ok(p.pagina >= 18 && p.pagina <= mj.paginasPDF);
    if (p.calculador) assert.equal(P.PONTA_MAP[p.calculador].marca, 'Magnojet');
  });
  assert.equal(mj.modelos.filter(p => p.calculador).length, 8);
  assert.equal(B.buscarMagnojet(mj.modelos, 'solido').length, 4);
  assert.equal(B.buscarMagnojet(mj.modelos, 'MGA 40')[0].pagina, 64);
});
