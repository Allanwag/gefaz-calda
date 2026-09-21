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

/* ───────── estoque lido de PDF ───────── */
const I = (s, x, y, w) => ({ s, x, y, w: w == null ? s.length * 4.5 : w, h: 9 });
const linhasDe = (...rows) => ES.agruparLinhas(rows.flat());

test('PDF: agrupa por linha e junta palavras coladas numa mesma célula', () => {
  const l = linhasDe(
    [I('Produto', 100, 700), I('Saldo', 360, 700)],
    [I('ABADIN', 100, 680), I('72 EC', 100 + 6 * 4.5 + 2.5, 680), I('12,50', 360, 680)]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[1].cells.map(c => c.s), ['ABADIN 72 EC', '12,50'], 'ABADIN e 72 EC ficam na mesma célula');
  assert.deepEqual(l.map(x => x.cells.length), [2, 2]);
  assert.equal(ES.agruparLinhas([]).length, 0);
});

test('PDF: com cabeçalho, a quantidade é a coluna do saldo (e não o custo nem o código)', () => {
  const cab = [I('Código', 40, 700), I('Produto', 100, 700), I('Un', 300, 700), I('Saldo', 360, 700), I('Custo', 450, 700)];
  const linha = (y, cod, nome, un, saldo, custo) => [I(cod, 40, y), I(nome, 100, y), I(un, 300, y), I(saldo, 360 + 5 * 4.5 - saldo.length * 4.5, y), I(custo, 450, y)];
  const r = ES.interpretarEstoque(linhasDe(cab, linha(680, '000123', 'ABADIN 72 EC', 'L', '12,50', '85,00'), linha(660, '000456', 'GLIFOSATO 480', 'L', '1.250,00', '30,00'), linha(640, '000789', 'MANCOZEBE WP', 'KG', '8,25', '40,10'), linha(620, '', 'TOTAL GERAL', '', '1.270,75', '')));
  assert.equal(r.cabecalho, true);
  assert.deepEqual(r.itens.map(i => [i.nome, i.qtd, i.unidade]), [['ABADIN 72 EC', 12.5, 'L'], ['GLIFOSATO 480', 1250, 'L'], ['MANCOZEBE WP', 8.25, 'KG']]);
  assert.ok(r.itens.every(i => i.confianca === 'alta'));
  assert.ok(r.ignoradas.some(t => /TOTAL/.test(t)), 'total não vira produto');
});

test('PDF: sem cabeçalho, a quantidade é o número que vem antes da unidade; "12,5 L" numa célula só também vale', () => {
  const r = ES.interpretarEstoque(linhasDe(
    [I('ABADIN 72 EC', 40, 700), I('12,50', 300, 700), I('L', 340, 700), I('85,00', 400, 700)],
    [I('KARATE ZEON', 40, 680), I('3 L', 300, 680), I('120,00', 400, 680)],
    [I('HERBICIDAS', 40, 660)]));
  assert.deepEqual(r.itens.map(i => [i.nome, i.qtd, i.unidade]), [['ABADIN 72 EC', 12.5, 'L'], ['KARATE ZEON', 3, 'L']]);
  assert.equal(r.cabecalho, false);
  assert.equal(r.itens[0].confianca, 'media');
});

test('PDF: o usuário escolhe qual coluna numérica é a quantidade quando o layout é ambíguo', () => {
  const rows = linhasDe([I('PRODUTO X', 40, 700), I('10', 200, 700), I('25,5', 260, 700), I('300,00', 320, 700)], [I('PRODUTO Y', 40, 680), I('4', 200, 680), I('7,0', 260, 680), I('90,00', 320, 680)]);
  assert.deepEqual(ES.interpretarEstoque(rows, { qtdPos: { lado: 'esq', n: 2 } }).itens.map(i => i.qtd), [25.5, 7]);
  assert.deepEqual(ES.interpretarEstoque(rows, { qtdPos: { lado: 'dir', n: 1 } }).itens.map(i => i.qtd), [300, 90]);
  assert.equal(ES.interpretarEstoque(rows).maxNumericas, 3);
});

test('estoque em planilha CSV', () => {
  const r = ES.estoqueDeTabela(ES.parseCSV('Descrição;Unidade;Saldo atual;Estoque mínimo\nABADIN 72 EC;L;12,5;5\nKARATE;L;abc;1\n'));
  assert.deepEqual(r.itens.map(i => [i.nome, i.qtd, i.unidadeNorm]), [['ABADIN 72 EC', 12.5, 'L']]);
  assert.equal(r.erros.length, 1);
  assert.equal(ES.estoqueDeTabela(ES.parseCSV('Foo;Bar\n1;2')).erros.length, 1);
});

test('unidades: tudo vira litro ou quilo; embalagem precisa do tamanho', () => {
  assert.deepEqual(ES.paraBase(500, 'mL'), { qtd: 0.5, base: 'L' });
  assert.deepEqual(ES.paraBase(250, 'g'), { qtd: 0.25, base: 'kg' });
  assert.deepEqual(ES.paraBase(2, 'Lts.'), { qtd: 2, base: 'L' });
  assert.deepEqual(ES.paraBase(3, 'UN', { qtd: 5, unidade: 'L' }), { qtd: 15, base: 'L' });
  assert.equal(ES.paraBase(3, 'UN'), null);
  assert.equal(ES.paraBase(3, 'xx'), null);
});

/* ───────── ligar receita e estoque ───────── */
test('casar produto: exato, parecido, escolha manual e ambiguidade', () => {
  const est = [{ id: 'a', nome: 'ABADIN 72 EC' }, { id: 'b', nome: 'Glifosato Atanor 480 SL' }, { id: 'c', nome: 'Glifosato Nortox 480' }, { id: 'd', nome: 'Wetcit' }];
  assert.equal(ES.casarProduto('abadin 72 ec', est).tipo, 'exato');
  const p = ES.casarProduto('Abadin', est); assert.deepEqual([p.item && p.item.id, p.tipo], ['a', 'parecido']);
  const amb = ES.casarProduto('Glifosato 480', est); assert.equal(amb.item, null, 'dois glifosatos: não chuta'); assert.equal(amb.candidatos.length, 2);
  assert.equal(ES.casarProduto('Glifosato 480', est, { 'glifosato 480': 'c' }).item.id, 'c', 'a escolha manual vale');
  assert.equal(ES.casarProduto('Produto que não existe', est).item, null);
  assert.equal(ES.casarProduto('Wetcit', est).item.id, 'd');
});

/* ───────── baixa por aplicação ───────── */
test('baixa: 3.000 L de calda a 400 L/ha = 7,5 ha; doses por hectare e por 100 L dão o mesmo consumo', () => {
  const b = ES.baixaDaReceita({ volumeHa: 400, litros: 3000, itens: [{ nome: 'A', dose: 0.5, unidade: 'L/ha' }, { nome: 'B', dose: 300, unidade: 'mL/100L' }, { nome: 'C', dose: 200, unidade: 'g/ha' }] });
  assert.equal(b.ha, 7.5);
  assert.equal(b.litros, 3000);
  assert.deepEqual(b.linhas.map(l => [l.nome, l.qtd, l.base]), [['A', 3.75, 'L'], ['B', 9, 'L'], ['C', 1.5, 'kg']]);
  assert.equal(ES.baixaDaReceita({ volumeHa: 400, ha: 10, itens: [{ nome: 'A', dose: 1, unidade: 'L/ha' }] }).litros, 4000, 'só hectares: litros de calda saem do volume');
  assert.equal(ES.baixaDaReceita({ volumeHa: 0, litros: 1000, itens: [{ nome: 'A', dose: 1, unidade: 'L/ha' }] }).linhas[0].qtd, 0, 'sem volume por hectare não dá para converter litros em área');
});

test('estoque: movimentar não altera o original e aceita saldo negativo (o app avisa)', () => {
  const est = [{ id: 'a', nome: 'A', qtd: 10 }, { id: 'b', nome: 'B', qtd: 2 }];
  const novo = ES.movimentar(est, [{ estoqueId: 'a', delta: -3.75 }, { estoqueId: 'b', delta: -9 }, { estoqueId: 'zz', delta: 1 }]);
  assert.deepEqual(novo.map(e => e.qtd), [6.25, -7]);
  assert.deepEqual(est.map(e => e.qtd), [10, 2]);
});

/* ───────── previsto × realizado ───────── */
test('metas: hectares, litros e tarefas, atraso e meta de conclusão', () => {
  const tarefas = [
    { id: 't1', dataPrev: '2026-09-10', haPrev: 10, litrosPrev: 4000 },
    { id: 't2', dataPrev: '2026-09-15', haPrev: 20, litrosPrev: 8000 },
    { id: 't3', dataPrev: '2026-09-25', haPrev: 10, litrosPrev: 4000 },
    { id: 't4', dataPrev: '2026-09-12', haPrev: 5, litrosPrev: 2000, status: 'cancelada' },
    { id: 't5', dataPrev: '2026-10-30', haPrev: 8, litrosPrev: 3200 }];
  const real = [{ tarefaId: 't1', data: '2026-09-10', ha: 10, litros: 4000 }, { tarefaId: 't2', data: '2026-09-16', ha: 8, litros: 3200 }, { tarefaId: 't2', data: '2026-09-17', ha: 99, litros: 9999, estornada: true }];
  const p = ES.progresso({ tarefas, realizacoes: real, de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-21', metaPct: 80 });
  assert.equal(p.n, 3, 'cancelada e fora do período não contam');
  assert.equal(p.concluidas, 1);
  assert.equal(p.atrasadas, 1, 't2 passou do prazo com 40% feito');
  assert.equal(p.porTarefa.t2.situacao, 'atrasada');
  assert.equal(p.porTarefa.t2.pct, 0.4);
  assert.equal(p.porTarefa.t3.situacao, 'aberta');
  assert.equal(p.haPrev, 40); assert.equal(p.haReal, 18);
  assert.equal(p.litrosReal, 7200);
  assert.equal(Math.round(p.pctTarefas * 100), 33);
  assert.equal(p.atingiuMeta, false); assert.equal(p.faltamParaMeta, 2, '80% de 3 tarefas = 3; falta concluir 2');
  assert.equal(p.esperadas, 2); assert.equal(p.noRitmo, false, 'deviam estar prontas 2 e só 1 está');
  const so = ES.progresso({ tarefas: [{ id: 'x', dataPrev: '2026-09-30', haPrev: 10 }], realizacoes: [{ tarefaId: 'x', ha: 12, litros: 1 }], hoje: '2026-09-21', metaPct: 100 });
  assert.equal(so.porTarefa.x.situacao, 'concluida', 'passou do previsto: concluída, e o excedente não infla o percentual');
  assert.equal(so.haReal, 10); assert.equal(so.atingiuMeta, true);
});

/* ───────── agenda ───────── */
test('agenda .ics: dia inteiro, escape de texto e linhas dobradas em 75 octetos', () => {
  const ics = ES.icsAgenda([{ uid: 'u1', dia: '2026-12-31', titulo: 'Colheita liberada, Gleba 1; café', descricao: 'Linha 1\nLinha 2 ' + 'x'.repeat(120) }, { dia: 'lixo', titulo: 'ignorado' }], { nome: 'Fazenda', agora: new Date('2026-09-20T12:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'), 'virada de ano');
  assert.ok(ics.includes('SUMMARY:Colheita liberada\\, Gleba 1\\; café'));
  assert.ok(ics.includes('DTSTAMP:20260920T120000Z'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1, 'data inválida fica de fora');
  ics.split('\r\n').forEach(l => assert.ok(new TextEncoder().encode(l).length <= 75, 'linha longa: ' + l.length));
  assert.ok(ics.includes('\r\n x'), 'continuação começa com espaço');
});
