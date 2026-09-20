/* Testes da rotina da fazenda: planilhas, ficha de produtos, estoque, baixa e metas (node --test tests/*.test.cjs) */
const test = require('node:test');
const assert = require('node:assert/strict');
const ES = require('../estoque.js');

test('números no formato brasileiro', () => {
  const c = [['1.234,56', 1234.56], ['12,5', 12.5], ['12.5', 12.5], ['1.234', 1234], ['0.125', 0.125], ['1,234,567', 1234567], ['(3,2)', -3.2], ['-4', -4], ['R$ 1.050,00', 1050], ['0', 0]];
  c.forEach(([txt, esperado]) => assert.equal(ES.parseNumero(txt), esperado, txt));
  ['', 'abc', '12 L', null, '--'].forEach(x => assert.equal(ES.parseNumero(x), null, String(x)));
});

test('CSV do Excel: ponto e vírgula, aspas, BOM e quebra de linha dentro do campo', () => {
  const t = ES.parseCSV('﻿Produto;Carência (dias)\r\n"Fungicida ""X"" 500; SC";30\r\nOutro;7,5\r\n\r\n');
  assert.equal(t.sep, ';');
  assert.deepEqual(t.cab, ['Produto', 'Carência (dias)']);
  assert.deepEqual(t.linhas, [['Fungicida "X" 500; SC', '30'], ['Outro', '7,5']]);
  assert.equal(ES.parseCSV('a,b\n1,2').sep, ',');
  assert.equal(ES.parseCSV('a\tb\n1\t2').sep, '\t');
  const ida = ES.toCSV([['a;b', 'c'], ['1', '"x"']]);
  assert.deepEqual(ES.parseCSV(ida).linhas, [['1', '"x"']]);
  assert.deepEqual(ES.parseCSV(ida).cab, ['a;b', 'c']);
});

test('ficha de produtos: acha as colunas pelo cabeçalho, em qualquer ordem, e aponta o que não é número', () => {
  const tab = ES.parseCSV('Reentrada (horas);Produto;Carência (dias);Intervalo entre aplicações (dias);Máx. aplicações por ciclo\n24;Folicur;30;14;3\n;Karate;7;;\n12;Erro;abc;10;2\n;;;;');
  const f = ES.fichaDeTabela(tab);
  assert.deepEqual(f.itens[0], { nome: 'Folicur', reentrada: 24, carencia: 30, intervalo: 14, maxAplic: 3 });
  assert.deepEqual(f.itens[1], { nome: 'Karate', carencia: 7 });
  assert.equal(f.itens.length, 3, 'linha em branco não entra');
  assert.equal(f.erros.length, 1);
  assert.match(f.erros[0], /Erro.*abc/);
  assert.equal(ES.fichaDeTabela(ES.parseCSV('Nome;Preço\nA;3')).erros.length, 1, 'sem coluna de ficha é erro');
  assert.equal(ES.fichaDeTabela(ES.parseCSV('Preço;Carência\n3;4')).erros.length, 1, 'sem coluna de produto é erro');
});

test('ficha de produtos: planilha exportada volta igual na importação', () => {
  const prod = [{ nome: 'Folicur', intervalo: 14, carencia: 30, maxAplic: 3, reentrada: 24 }, { nome: 'Kantphos; 10-40', carencia: 0 }];
  const volta = ES.fichaDeTabela(ES.parseCSV(ES.fichaParaCSV(prod))).itens;
  assert.deepEqual(volta[0], prod[0]);
  assert.deepEqual(volta[1], { nome: 'Kantphos; 10-40', carencia: 0 }, 'zero é valor (sem carência), vazio é "não informado"');
});
