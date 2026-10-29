const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../pontas.js');
const base = { modo: 'area', larguraEfetiva: 18, espacamento: 0.4, nBicos: 46,
  volumeHa: 200, velocidade: 6, tanque: 2000, area: 20, ponta: 'tj-aixr', iso: '02' };

test('Columbia: largura efetiva de 18 m é independente de 46 pontas a 40 cm', () => {
  const r = P.calcular(base);
  assert.equal(r.larguraTrabalho, 18);
  assert.equal(r.espacamento, 0.4);
  assert.equal(r.nBicos, 46);
  assert.equal(r.vazaoNecessaria, 0.783);
  assert.equal(r.vazaoTotal, 36);
  assert.equal(r.volumeAplicado, 200);
  assert.equal(r.rendimento, 10.8);
  assert.equal(r.altura, 40);
  assert.equal(r.ficha.haPorTanque, 10);
  assert.equal(r.ficha.cargas, 2);
  assert.ok(r.formulas.some(f => f.formula.includes('N') && f.calculo.includes('46')));
});

test('Columbia: pressão fixa usa vazão total dividida pela largura efetiva', () => {
  const r = P.calcular({ ...base, fixarPressao: true, pressao: 3 });
  assert.equal(r.vazaoTotal, 36.34);
  assert.equal(r.volumeAplicado, 201.9);
});

test('Columbia: coleta de 800 mL por minuto dá 204,4 L/ha em passadas de 18 m', () => {
  const c = P.calibracao({ ...base, segundos: 60, coletas: Array(46).fill(800) });
  assert.equal(c.bicos.length, 46);
  assert.equal(c.volumeReal, 204.4);
  assert.equal(c.volumeLavoura, 204.4);
  assert.equal(c.erro, 2.2);
});

test('largura vazia conserva cálculo anterior por espaçamento e quantidade de pontas', () => {
  const r = P.calcular({ ...base, larguraEfetiva: null });
  assert.equal(r.larguraTrabalho, 18.4);
  assert.equal(r.vazaoNecessaria, 0.8);
});

test('sugestão de ponta usa a largura efetiva sem alterar espaçamento físico', () => {
  const s = P.selecionar(base);
  assert.equal(s.vazaoAlvo, 0.783);
  assert.ok(s.opcoes.length > 0);
});

test('largura explícita inválida não gera regulagem nem calibração', () => {
  for (const larguraEfetiva of [0, -1, 'inválida']) {
    assert.throws(() => P.calcular({ ...base, larguraEfetiva }), /largura/i);
    assert.equal(P.calibracao({ ...base, larguraEfetiva, segundos: 60, coletas: [800] }), null);
  }
});

test('faixa dirigida ignora a largura de área total e mantém seu cálculo anterior', () => {
  const r = P.calcular({ ...base, modo: 'faixa', larguraFaixa: 1.6, bicosPorPassada: 4, entreLinhas: 3.5, velocidade: 4.5 });
  assert.equal(r.larguraTrabalho, 3.5);
  assert.equal(r.volumeLavoura, 91.4);
});
