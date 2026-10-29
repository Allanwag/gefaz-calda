const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../pontas.js');
test('PSI e bar: conversão conhecida e retorno conservam a pressão física', () => {
  assert.ok(Math.abs(P.pressaoNaUnidade(3, 'psi') - 43.5113213191) < 1e-9);
  assert.ok(Math.abs(P.pressaoEmBar(45, 'psi') - 3.10264078193) < 1e-9);
  assert.ok(Math.abs(P.pressaoEmBar(P.pressaoNaUnidade(3.86, 'psi'), 'psi') - 3.86) < 1e-12);
  assert.equal(P.pressaoEmBar(3.86, 'bar'), 3.86);
});
const faixa = { modo: 'faixa', volumeHa: 200, velocidade: 4.5, larguraFaixa: 1.6,
  bicosPorPassada: 4, entreLinhas: 3.5, ponta: 'tj-aixr', iso: '02', tanque: 600 };

test('alvo de 100 L/ha não vira 100,1 por arredondar vazão antes de calcular cargas', () => {
  const r = P.calcular({ modo: 'area', volumeHa: 100, velocidade: 8, espacamento: 0.5,
    nBicos: 40, ponta: 'tj-aixr', iso: '02', tanque: 2000, area: 40 });
  assert.equal(r.volumeAplicado, 100);
  assert.equal(r.ficha.haPorTanque, 20);
  assert.equal(r.ficha.cargas, 2);
});

test('faixa: autonomia usa hectares de lavoura e cargas sem arredondamento intermediário', () => {
  const r = P.calcular({ ...faixa, area: 13.125 });
  assert.equal(r.volumeAplicado, 200);
  assert.equal(r.volumeLavoura, 91.4);
  assert.equal(r.ficha.haPorTanque, 6.56);
  assert.equal(r.ficha.cargas, 2);
  assert.equal(r.ficha.distancia, 18750);
});

test('calibração usa tabela própria da ponta na pressão medida', () => {
  const c = P.calibracao({ ...faixa, ponta: 'mj-tm-ia', iso: '1.5', pressao: 4.14,
    segundos: 60, coletas: [1410, 1410] });
  assert.equal(c.nominal, 1.41);
  assert.equal(c.bicos[0].desgaste, 0);
});

test('coleta zero conserva posição do bico e indica falha de vazão', () => {
  const c = P.calibracao({ ...faixa, segundos: 60, coletas: [800, 0, 800] });
  assert.equal(c.bicos.length, 3);
  assert.equal(c.bicos[1].n, 2);
  assert.equal(c.bicos[1].vazao, 0);
  assert.equal(c.bicos[1].trocar, true);
  assert.equal(c.veredito, 'irregular');
  assert.equal(c.correcao.length, 0);
});

test('conjunto sem vazão não recebe veredito uniforme e no alvo', () => {
  const c = P.calibracao({ ...faixa, segundos: 60, coletas: [0, 0] });
  assert.ok(c);
  assert.equal(c.veredito, 'irregular');
  assert.ok(c.bicos.every(b => b.trocar));
  assert.equal(c.correcao.length, 0);
});

test('calibração em faixa informa volume tratado e volume por hectare de lavoura', () => {
  const c = P.calibracao({ ...faixa, segundos: 30, coletas: [300, 300, 300, 300] });
  assert.equal(c.volumeReal, 200);
  assert.equal(c.volumeLavoura, 91.4);
  assert.equal(c.erro, 0);
});

test('tempo e geometria inválidos não geram ficha nem correção enganosa', () => {
  for (const change of [{ segundos: 0 }, { segundos: -1 }, { velocidade: 0 },
    { larguraFaixa: 0 }, { bicosPorPassada: 0 }, { entreLinhas: 0 }, { larguraFaixa: 4 },
    { coletas: [800, -1] }, { coletas: [800, 'errado'] }]) {
    assert.equal(P.calibracao({ ...faixa, segundos: 60, coletas: [800, 800], ...change }), null);
  }
});
