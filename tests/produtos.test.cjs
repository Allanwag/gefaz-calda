/* Testes de Meus produtos: cadastro permanente, busca, matéria-prima, ligação com o motor e planilha (node --test tests/*.test.cjs) */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const ES = require('../estoque.js');
const P = require('../produtos.js');

const contador = () => { let n = 0; return () => 'id' + (++n); };
const FOLIAR = 'Fertilizante Foliar';

test('limpar: classe, unidade e números inválidos voltam ao padrão; ativos que a base não conhece saem', () => {
  const p = P.limpar({ nome: '  Zintrac   700 ', classe: 'Coisa', formulacao: 'sl', unidade: 'xx', dose: '2,5', preco: -3, ativos: ['zinco', 'nada', 'zinco'], ingredientes: ' Zn  70% ' });
  assert.equal(p.nome, 'Zintrac 700');
  assert.equal(p.classe, 'Outro');
  assert.equal(p.formulacao, 'SL');
  assert.equal(p.unidade, 'L/ha');
  assert.equal(p.dose, 2.5);
  assert.equal(p.preco, 0);
  assert.deepEqual(p.ativos, ['zinco']);
  assert.equal(p.ingredientes, 'Zn 70%');
  assert.equal(P.limpar({ classe: FOLIAR }).unidade, 'mL/100L', 'foliar é dosado por 100 L');
  assert.equal(P.limpar({ classe: 'Adjuvante' }).unidade, 'mL/100L');
  assert.equal(P.limpar({ dose: 1.234 }).dose, 1.234, 'número puro não é lido como milhar');
  assert.equal(P.limpar({ formulacao: 'ZZ' }).formulacao, '');
});

test('salvar: cria, barra nome repetido (sem acento/caixa) e edita mantendo id, usos e data de criação', () => {
  const lista = [], novoId = contador();
  const a = P.salvar(lista, { nome: 'Nutri Boro', classe: FOLIAR, ativos: ['boro'] }, { novoId, agora: '2026-09-21T10:00:00Z' });
  assert.ok(a.criado);
  assert.equal(lista.length, 1);
  assert.equal(a.produto.id, 'id1');
  assert.equal(a.produto.usos, 0);
  assert.match(P.salvar(lista, { nome: ' nutri  BORO ' }, { novoId }).erro, /Já existe/);
  assert.equal(lista.length, 1);
  assert.match(P.salvar(lista, { nome: '   ' }, { novoId }).erro, /nome/i);
  a.produto.usos = 5;
  const ed = P.salvar(lista, { nome: 'Nutri Boro Plus', classe: FOLIAR, dose: 200 }, { id: 'id1', novoId, agora: '2026-09-22T10:00:00Z' });
  assert.equal(ed.criado, false);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].usos, 5);
  assert.equal(lista[0].criado, '2026-09-21T10:00:00Z');
  assert.equal(lista[0].atualizado, '2026-09-22T10:00:00Z');
  assert.equal(lista[0].dose, 200);
  const b = P.salvar(lista, { nome: 'Outro' }, { novoId });
  assert.match(P.salvar(lista, { nome: 'outro' }, { id: 'id1', novoId }).erro, /Já existe/, 'renomear para o nome de outro produto é barrado');
  assert.match(P.salvar(lista, { nome: 'X' }, { id: 'nao-existe', novoId }).erro, /não encontrado/);
  assert.ok(P.remover(lista, b.produto.id));
  assert.equal(P.remover(lista, 'nao-existe'), false);
  assert.equal(lista.length, 1);
});

test('busca: por nome, nutriente, matéria-prima e classe, sem acento; os mais usados primeiro', () => {
  const lista = [], novoId = contador();
  P.salvar(lista, { nome: 'Zintrac 700', classe: FOLIAR, ativos: ['zinco'], materiaPrima: 'sulfato de zinco' }, { novoId });
  P.salvar(lista, { nome: 'Nutri Boro', classe: FOLIAR, ativos: ['boro'], materiaPrima: 'ácido bórico' }, { novoId });
  P.salvar(lista, { nome: 'Bor Mix', classe: FOLIAR, ativos: ['boro', 'molibdenio'] }, { novoId });
  const nomes = c => P.buscar(lista, c).map(p => p.nome);
  assert.deepEqual(nomes('zintrac'), ['Zintrac 700']);
  assert.deepEqual(nomes('ZINCO'), ['Zintrac 700'], 'pelo nutriente marcado');
  assert.deepEqual(nomes('acido borico'), ['Nutri Boro'], 'pela matéria-prima, sem acento');
  assert.deepEqual(nomes('boro'), ['Nutri Boro', 'Bor Mix'], 'nome que contém a busca vem antes de quem só marcou o nutriente');
  assert.equal(nomes('foliar').length, 3, 'pela classe');
  lista.find(p => p.nome === 'Bor Mix').usos = 9;
  lista.find(p => p.nome === 'Zintrac 700').usos = 3;
  assert.deepEqual(nomes('foliar'), ['Bor Mix', 'Zintrac 700', 'Nutri Boro'], 'em empate, o mais usado sobe');
  assert.deepEqual(nomes(''), []);
  assert.deepEqual(nomes('zzz'), []);
  assert.equal(P.buscar(lista, 'foliar', { limite: 2 }).length, 2);
});

test('reconhecer: nutrientes na matéria-prima e no texto dos botões; só os da classe do produto', () => {
  assert.deepEqual(P.reconhecer('ácido bórico, sulfato de zinco e molibdato de sódio', FOLIAR), ['boro', 'zinco', 'molibdenio']);
  assert.deepEqual(P.reconhecer('nitrato de cálcio + ureia', FOLIAR), ['calcio', 'ureia']);
  assert.deepEqual(P.reconhecer('borato de sódio', FOLIAR), ['boro']);
  assert.deepEqual(P.reconhecer('fosfato monopotássico (MKP)', FOLIAR), ['map']);
  assert.deepEqual(P.reconhecer('sulfato de cobre', FOLIAR), ['cobre-foliar'], 'é o cobre do foliar, não o fungicida cúprico');
  assert.deepEqual(P.reconhecer('quelato de zinco (EDTA)', FOLIAR), ['zinco', 'quelato'], 'EDTA é quelato, não o condicionador de água');
  assert.deepEqual(P.reconhecer('Potássio (K) + Boro (B)', FOLIAR), ['boro', 'potassio'], 'rótulos dos botões (é o que a planilha exportada traz)');
  assert.deepEqual(P.reconhecer('Potássio; cálcio', FOLIAR), ['calcio', 'potassio'], 'nome curto sozinho');
  assert.deepEqual(P.reconhecer('espalhante adesivo', 'Adjuvante'), ['espalhante']);
  assert.deepEqual(P.reconhecer('sulfato de zinco', 'Herbicida'), [], 'classe sem botões de composição');
  assert.deepEqual(P.reconhecer('', FOLIAR), []);
  assert.deepEqual(P.reconhecer('algo que a base não conhece', FOLIAR), []);
  assert.ok(P.componentes(FOLIAR).length >= 14);
  assert.deepEqual(P.componentes('Fungicida'), []);
});

test('produto guardado vira item da calda e o motor aplica as regras dos nutrientes marcados', () => {
  const lista = [], novoId = contador();
  const zn = P.salvar(lista, { nome: 'Zintrac 700', classe: FOLIAR, ativos: ['zinco'], materiaPrima: 'sulfato de zinco', dose: 200, unidade: 'mL/100L', preco: 30 }, { novoId }).produto;
  const item = P.paraItem(zn, novoId);
  assert.equal(item.nome, 'Zintrac 700');
  assert.equal(item.classe, FOLIAR);
  assert.equal(item.unidade, 'mL/100L');
  assert.equal(item.dose, 200);
  assert.equal(item.preco, 30);
  assert.equal(item.fonte, 'meus produtos');
  assert.deepEqual(item.ativos, ['zinco']);
  assert.equal(item.materiaPrima, 'sulfato de zinco');
  assert.notEqual(item.ativos, zn.ativos, 'a linha da calda não divide o array com o cadastro');
  const r = E.analisar([{ nome: 'Glifosato 480 SL', dose: 3, unidade: 'L/ha', formulacao: 'SL' }, item], { volumeHa: 100, agua: { ph: 6, dureza: 50 } });
  assert.equal(r.status, 'incompativel');
  assert.ok(r.alertas.some(a => a.regra === 'R01'), 'glifosato × cátion de foliar (zinco marcado)');
  assert.ok(!r.alertas.some(a => /sem ingrediente ativo reconhecido/.test(a.titulo)));
  const passo10 = r.ordem.find(p => p.passo === 10);
  assert.ok(passo10.itens[0].notas.includes('Matéria-prima: sulfato de zinco.'), 'a matéria-prima aparece na ordem de adição');
  const dosePorHa = E.dosePorHa(item, 400);
  assert.deepEqual(dosePorHa, { qtd: 0.8, base: 'L' }, '200 mL/100 L a 400 L/ha = 0,8 L/ha');
});

test('foliar sem nutriente marcado é honesto: o laudo diz que não reconheceu o ativo, mas já segue as regras gerais de foliar', () => {
  const lista = [], novoId = contador();
  const sem = P.salvar(lista, { nome: 'Foliar X', classe: FOLIAR, dose: 100 }, { novoId }).produto;
  const item = P.paraItem(sem, novoId);
  assert.equal(item.ativos, undefined);
  const r = E.analisar([item], { volumeHa: 100, agua: { ph: 6 } });
  assert.ok(r.alertas.some(a => /sem ingrediente ativo reconhecido/.test(a.titulo)), 'sem composição, jar test');
  assert.ok(E.resolverItem(item, 0).tags.includes('foliar'), 'a classe sozinha já dá a etiqueta de foliar');
  const com = E.analisar([{ nome: 'Fosetil-Al', dose: 2.5, unidade: 'kg/ha', formulacao: 'WG' }, item], { volumeHa: 400, agua: { ph: 6 } });
  assert.ok(com.alertas.some(a => a.regra === 'R29'), 'fosetil × foliar vale também para o foliar cadastrado sem composição');
});

test('deItem: pré-preenche o cadastro com o que a base já reconheceu na linha da calda', () => {
  const d = P.deItem({ nome: 'Sulfato de zinco', classe: FOLIAR, formulacao: 'SP', unidade: 'kg/ha', dose: 2, preco: 8, ativos: ['zinco'], ingredientes: ['boro'], materiaPrima: 'x' });
  assert.deepEqual([...d.ativos].sort(), ['boro', 'zinco']);
  assert.equal(d.materiaPrima, 'x');
  assert.equal(d.unidade, 'kg/ha');
  const ag = P.deItem({ nome: 'Folicur', classe: 'Fungicida', ingredientes: ['Tebuconazol (250 g/L)'], unidade: 'L/ha', dose: 0.5 });
  assert.equal(ag.classe, 'Fungicida');
  assert.deepEqual(ag.ativos, ['tebuconazol']);
  assert.equal(ag.ingredientes, 'Tebuconazol (250 g/L)');
  assert.equal(P.deItem({ nome: 'X', classe: 'Qualquer' }).classe, 'Outro');
});

test('resumo e unidade do preço', () => {
  assert.equal(P.resumo({ ativos: ['boro', 'zinco'], ingredientes: 'x' }), 'Boro · Zinco');
  assert.equal(P.resumo({ ativos: [], ingredientes: 'N 10%' }), 'N 10%');
  assert.equal(P.resumo({}), '');
  assert.deepEqual(['L/ha', 'mL/100L', 'kg/ha', 'g/ha', 'g/100L', 'mL/ha'].map(P.unidadeDoPreco), ['L', 'L', 'kg', 'kg', 'kg', 'L']);
});

test('planilha: exporta, lê de volta e importa sem perder nada — inclusive campo com ponto e vírgula', () => {
  const lista = [], novoId = contador();
  P.salvar(lista, { nome: 'Zintrac 700', classe: FOLIAR, formulacao: 'SL', ativos: ['zinco', 'potassio'], ingredientes: 'Zn 7% · K 3%', materiaPrima: 'sulfato de zinco; cloreto de potássio', dose: 200, unidade: 'mL/100L', preco: 32.5, nota: 'não misturar; com cobre' }, { novoId });
  P.salvar(lista, { nome: 'Acidez X', classe: 'Adjuvante', ativos: ['acidificante', 'espalhante'], dose: 0.1, unidade: 'L/100L' }, { novoId });
  P.salvar(lista, { nome: 'Fungo Y', classe: 'Fungicida', ingredientes: 'azoxistrobina', dose: 0.3, unidade: 'L/ha', preco: 250 }, { novoId });
  const csv = P.paraCSV(lista), lido = P.produtosDeTabela(ES.parseCSV(csv));
  assert.deepEqual(lido.erros, []);
  const nova = [], r = P.importar(nova, lido.itens, { novoId: contador() });
  assert.deepEqual([r.novos, r.atualizados, r.erros.length], [3, 0, 0]);
  lista.forEach(p => {
    const q = nova.find(x => x.nome === p.nome);
    ['classe', 'formulacao', 'unidade', 'dose', 'preco', 'ingredientes', 'materiaPrima', 'nota'].forEach(c => assert.equal(q[c], p[c], `${p.nome}: ${c}`));
    assert.deepEqual([...q.ativos].sort(), [...p.ativos].sort(), `${p.nome}: ativos`);
  });
});

test('planilha: só atualiza o que veio preenchido; produto existente sem coluna de classe mantém a dele; produto novo recebe a padrão', () => {
  const lista = [], novoId = contador();
  P.salvar(lista, { nome: 'Zintrac 700', classe: FOLIAR, ativos: ['potassio'], dose: 200, unidade: 'mL/100L', preco: 32.5 }, { novoId });
  P.salvar(lista, { nome: 'Acidez X', classe: 'Adjuvante', dose: 100 }, { novoId });
  const tab = ES.parseCSV('Produto;Preço;Matéria-prima\nzintrac 700;40,00;sulfato de zinco, ácido bórico\nAcidez X;12;\nProduto Novo;;sulfato de magnésio');
  const lido = P.produtosDeTabela(tab, { classePadrao: FOLIAR, lista });
  assert.equal(lido.itens[1].classe, undefined, 'existente sem coluna de classe não recebe a padrão');
  assert.equal(lido.itens[2].classe, FOLIAR);
  const r = P.importar(lista, lido.itens, { novoId });
  assert.deepEqual([r.novos, r.atualizados], [1, 2]);
  const zn = lista.find(p => p.nome === 'Zintrac 700');
  assert.equal(zn.preco, 40);
  assert.equal(zn.dose, 200, 'o que não veio na planilha fica');
  assert.equal(zn.materiaPrima, 'sulfato de zinco, ácido bórico');
  assert.deepEqual([...zn.ativos].sort(), ['boro', 'potassio', 'zinco'], 'nutrientes reconhecidos se somam aos que já estavam');
  assert.equal(lista.find(p => p.nome === 'Acidez X').classe, 'Adjuvante');
  const novo = lista.find(p => p.nome === 'Produto Novo');
  assert.equal(novo.classe, FOLIAR);
  assert.deepEqual(novo.ativos, ['magnesio']);
  assert.equal(novo.unidade, 'mL/100L');
});

test('planilha: cabeçalhos em qualquer ordem; unidade, número e formulação inválidos viram aviso; linha em branco não entra', () => {
  const t = ES.parseCSV('Nome;Unidade;Dose;Formulação\nFoliar A;ml/100 L;250;SL\nFoliar B;galão;abc;ZZ\n;;;');
  const r = P.produtosDeTabela(t, { classePadrao: FOLIAR });
  assert.equal(r.itens.length, 2);
  assert.deepEqual(r.itens[0], { nome: 'Foliar A', classe: FOLIAR, formulacao: 'SL', unidade: 'mL/100L', dose: 250 });
  assert.deepEqual(r.itens[1], { nome: 'Foliar B', classe: FOLIAR });
  assert.equal(r.erros.length, 3);
  assert.ok(r.erros.every(e => /^Linha 3 \(Foliar B\)/.test(e)));
  assert.match(P.produtosDeTabela(ES.parseCSV('A;B\n1;2')).erros[0], /coluna do produto/);
  const cl = P.produtosDeTabela(ES.parseCSV('Produto;Classe\nA;foliar\nB;Adjuvante\nC;fungicida\nD;xyz\nE;'));
  assert.deepEqual(cl.itens.map(i => i.classe), [FOLIAR, 'Adjuvante', 'Fungicida', 'Outro', 'Outro']);
});

test('planilha exportada de um cadastro vazio é só o modelo, com todas as colunas', () => {
  const tab = ES.parseCSV(P.paraCSV([]));
  assert.equal(tab.cab.length, 10);
  assert.deepEqual(tab.linhas, []);
  assert.ok(tab.cab.includes('Matéria-prima'));
  assert.ok(tab.cab.includes('Nutrientes / funções'));
});
