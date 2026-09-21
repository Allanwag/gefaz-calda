/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — produtos.js
   Lógica pura de "Meus produtos" (sem DOM): cadastro permanente dos produtos que a
   base não traz — sobretudo fertilizantes foliares e adjuvantes. Guarda classe,
   formulação, dose e preço padrão, os nutrientes (ligados à base de conhecimento,
   para valerem as regras de mistura) e a matéria-prima, quando o rótulo informa.
   Busca, conversão para item da calda e planilha CSV.
   Funciona no navegador (window.GCProdutos) e no Node (module.exports) para testes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kb.js'), require('./engine.js'), require('./estoque.js'));
  else root.GCProdutos = factory(root.GC_KB, root.GCEngine, root.GCEstoque);
})(typeof self !== 'undefined' ? self : this, function (KB, E, ES) {
  'use strict';
  const norm = E.norm;
  const uniq = a => [...new Set(a)];
  const txt = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const numero = v => { const n = typeof v === 'number' ? v : ES.parseNumero(v); return Number.isFinite(n) && n > 0 ? n : 0; };

  /* ───────── composição: o que o produto é, ligado às entradas da base ───────── */
  // Só foliares e adjuvantes têm composição em botões: os defensivos são reconhecidos pelo nome do ingrediente ativo.
  const CLASSES_COM_COMPOSICAO = ['Fertilizante Foliar', 'Adjuvante'];
  const ROTULO = { ureia: 'Nitrogênio (N / ureia)', map: 'Fósforo (P / MAP, MKP)', fosfito: 'Fosfito (P)', potassio: 'Potássio (K)', calcio: 'Cálcio (Ca)', magnesio: 'Magnésio (Mg)', boro: 'Boro (B)', zinco: 'Zinco (Zn)', manganes: 'Manganês (Mn)', ferro: 'Ferro (Fe)', 'cobre-foliar': 'Cobre (Cu)', molibdenio: 'Molibdênio (Mo)', quelato: 'Quelatos (EDTA / EDDHA)', aminoacidos: 'Aminoácidos / algas / bioestimulante' };
  const nomeCurto = chave => { const a = KB.ativos[chave]; return a ? a.nome.replace(/\s*\(.*\)\s*$/, '') : ''; };
  const rotuloDe = chave => ROTULO[chave] || nomeCurto(chave);
  function componentes(classe) {
    if (!CLASSES_COM_COMPOSICAO.includes(classe)) return [];
    return Object.entries(KB.ativos).filter(([, a]) => a.classe === classe).map(([chave]) => ({ chave, rotulo: rotuloDe(chave), curto: nomeCurto(chave) }));
  }
  // Numa matéria-prima de foliar, "sulfato de cobre" é o cobre do foliar (não o fungicida) e EDTA é quelato (não o condicionador de água)
  const EQUIVALENTE_FOLIAR = { 'sulfato-cobre': 'cobre-foliar', sequestrante: 'quelato' };
  const sepTokens = /[+;,\/\n]| e (?=[a-z])/;
  // Nutrientes/funções da base que um texto livre (matéria-prima, composição, nomes separados por +) menciona; só os da classe do produto
  function reconhecer(texto, classe) {
    const t = txt(texto); if (!t) return [];
    const grupo = componentes(classe); if (!grupo.length) return [];
    const doGrupo = new Set(grupo.map(c => c.chave)), achados = new Set();
    E.resolverAtivos({ nome: '', ingredientes: [t] }).forEach(a => {
      const k = classe === 'Fertilizante Foliar' && EQUIVALENTE_FOLIAR[a.chave] ? EQUIVALENTE_FOLIAR[a.chave] : a.chave;
      if (doGrupo.has(k)) achados.add(k);
    });
    // "Potássio (K)", "Cálcio"… escritos como no botão (é o que a planilha exportada traz)
    const n = norm(t);
    grupo.forEach(c => { if (n.includes(norm(c.rotulo))) achados.add(c.chave); });
    t.split(sepTokens).map(norm).filter(Boolean).forEach(tok => grupo.forEach(c => { if (tok === norm(c.curto)) achados.add(c.chave); }));
    return grupo.map(c => c.chave).filter(k => achados.has(k));
  }

  /* ───────── o produto guardado ───────── */
  const unidadeDoPreco = u => { const n = norm(u); return n.includes('kg') || n.startsWith('g/') ? 'kg' : 'L'; };
  const unidadePadrao = classe => CLASSES_COM_COMPOSICAO.includes(classe) ? 'mL/100L' : 'L/ha';
  function limpar(d) {
    d = d || {};
    const classe = KB.classes.includes(d.classe) ? d.classe : 'Outro';
    const form = String(d.formulacao || '').toUpperCase();
    return {
      nome: txt(d.nome), classe, formulacao: KB.formulacoes[form] ? form : '',
      unidade: KB.unidades.includes(d.unidade) ? d.unidade : unidadePadrao(classe),
      dose: numero(d.dose), preco: numero(d.preco),
      ativos: uniq((Array.isArray(d.ativos) ? d.ativos : []).filter(k => KB.ativos[k])),
      ingredientes: txt(d.ingredientes), materiaPrima: txt(d.materiaPrima), nota: txt(d.nota)
    };
  }
  const existente = (lista, nome, exceto) => lista.find(p => p.id !== exceto && norm(p.nome) === norm(nome));
  let seq = 0;
  const idPadrao = () => 'p' + Date.now().toString(36) + (seq++).toString(36);
  // Grava um produto novo ou a edição de um existente (por id) e devolve { produto, criado } ou { erro }; nunca deixa dois com o mesmo nome
  function salvar(lista, dados, { id, agora, novoId } = {}) {
    const p = limpar(dados);
    if (!p.nome) return { erro: 'Informe o nome do produto.' };
    const igual = existente(lista, p.nome, id);
    if (igual) return { erro: `Já existe “${igual.nome}” em Meus produtos — procure pelo nome na busca ou edite o que já está guardado.`, existente: igual };
    const quando = agora || new Date().toISOString();
    if (id) {
      const atual = lista.find(x => x.id === id);
      if (!atual) return { erro: 'Produto não encontrado.' };
      Object.assign(atual, p, { atualizado: quando });
      return { produto: atual, criado: false };
    }
    const novo = { id: (novoId || idPadrao)(), ...p, usos: 0, criado: quando, atualizado: quando };
    lista.push(novo);
    return { produto: novo, criado: true };
  }
  function remover(lista, id) { const i = lista.findIndex(p => p.id === id); if (i < 0) return false; lista.splice(i, 1); return true; }

  /* ───────── busca ───────── */
  const textoBusca = p => norm([p.nome, p.classe, p.materiaPrima, p.ingredientes, p.nota, ...(p.ativos || []).map(nomeCurto)].join(' '));
  function buscar(lista, consulta, { limite = 8 } = {}) {
    const toks = norm(consulta).split(' ').filter(Boolean); if (!toks.length) return [];
    return lista.map(p => ({ p, h: textoBusca(p) })).filter(({ h }) => toks.every(t => h.includes(t)))
      .map(({ p }) => ({ p, score: norm(p.nome).startsWith(toks[0]) ? 3 : toks.every(t => norm(p.nome).includes(t)) ? 2 : 1 }))
      .sort((a, b) => b.score - a.score || (b.p.usos || 0) - (a.p.usos || 0) || a.p.nome.localeCompare(b.p.nome, 'pt-BR'))
      .slice(0, limite).map(x => x.p);
  }
  // "Boro · Zinco" (nutrientes marcados) ou, sem nenhum, o texto de composição
  function resumo(p) { const n = (p.ativos || []).map(nomeCurto).filter(Boolean); return n.length ? n.join(' · ') : (p.ingredientes || ''); }

  /* ───────── de/para com a calda ───────── */
  function paraItem(p, novoId) {
    const it = { id: novoId(), nome: p.nome, classe: p.classe, formulacao: p.formulacao || '', unidade: p.unidade || unidadePadrao(p.classe), dose: p.dose || 0, preco: p.preco || 0, fonte: 'meus produtos' };
    if (p.ativos && p.ativos.length) it.ativos = [...p.ativos];
    if (p.ingredientes) it.ingredientes = [p.ingredientes];
    if (p.materiaPrima) it.materiaPrima = p.materiaPrima;
    return it;
  }
  // Dados para pré-preencher o cadastro a partir de uma linha da calda (a base já reconheceu o que dava)
  function deItem(it) {
    const classe = KB.classes.includes(it.classe) ? it.classe : 'Outro';
    const reconhecidos = E.resolverAtivos(it).filter(a => a.classe === classe).map(a => a.chave);
    return { nome: it.nome || '', classe, formulacao: it.formulacao || '', unidade: it.unidade, dose: it.dose, preco: it.preco,
      ativos: uniq([...(it.ativos || []), ...reconhecidos]).filter(k => KB.ativos[k] && (KB.ativos[k].classe === classe || (it.ativos || []).includes(k))),
      ingredientes: Array.isArray(it.ingredientes) ? it.ingredientes.join(' + ') : txt(it.ingredientes), materiaPrima: it.materiaPrima || '', nota: it.nota || '' };
  }

  /* ───────── planilha (CSV do Excel) ───────── */
  const CAB = ['Produto', 'Classe', 'Formulação', 'Nutrientes / funções', 'Composição / ingredientes ativos', 'Matéria-prima', 'Dose padrão', 'Unidade da dose', 'Preço (R$ por L ou kg)', 'Observação'];
  function paraCSV(lista) {
    return ES.toCSV([CAB, ...lista.map(p => [p.nome, p.classe, p.formulacao, (p.ativos || []).map(rotuloDe).join(' + '), p.ingredientes, p.materiaPrima, ES.numCSV(p.dose), p.unidade, ES.numCSV(p.preco), p.nota])]);
  }
  const classeDoTexto = t => {
    const n = norm(t); if (!n) return null;
    const exata = KB.classes.find(c => norm(c) === n); if (exata) return exata;
    const regras = [[/foliar|fertiliz|nutri|adubo/, 'Fertilizante Foliar'], [/adjuv|espalh|surfact|oleo|condicion/, 'Adjuvante'], [/fungic/, 'Fungicida'], [/inseticid/, 'Inseticida'], [/acaricid/, 'Acaricida'], [/nematicid/, 'Nematicida'], [/herbicid/, 'Herbicida'], [/biolog|bioracion/, 'Bioracional'], [/cupric|cobre/, 'Cúprico']];
    const r = regras.find(([re]) => re.test(n)); return r ? r[1] : 'Outro';
  };
  const unidadeDoTexto = t => { const n = norm(t).replace(/\s/g, ''); return n ? (KB.unidades.find(u => norm(u).replace(/\s/g, '') === n) || null) : ''; };
  function colunas(cab) {
    const h = cab.map(norm), acha = f => h.findIndex(f);
    return { nome: acha(x => /^(produto|nome|descricao|item)/.test(x)), classe: acha(x => /^(classe|categoria|tipo)/.test(x)), formulacao: acha(x => /^formul/.test(x)),
      nutrientes: acha(x => /^nutriente|^funco/.test(x)), composicao: acha(x => /(composicao|garantia|ingrediente)/.test(x)), materiaPrima: acha(x => x.includes('materia')),
      dose: acha(x => /^dose/.test(x) && !x.includes('unid')), unidade: acha(x => /^un(id|\b)/.test(x) || x.includes('unidade')), preco: acha(x => /(preco|valor|custo)/.test(x)), nota: acha(x => /(obs|nota|coment)/.test(x)) };
  }
  // Lê a planilha (a exportada por paraCSV ou uma sua): devolve só o que veio preenchido em cada linha, mais os avisos
  // `lista` (opcional) é o cadastro atual: linha de produto que já existe e vem sem classe mantém a classe dele; só produto novo recebe a padrão
  function produtosDeTabela(tab, { classePadrao = 'Outro', lista = [] } = {}) {
    const col = colunas(tab.cab), itens = [], erros = [];
    if (col.nome < 0) return { itens, erros: ['Não achei a coluna do produto (cabeçalho “Produto” ou “Nome”).'], colunas: col };
    tab.linhas.forEach((l, i) => {
      const cel = c => (c >= 0 ? txt(l[c]) : ''), nome = cel(col.nome); if (!nome) return;
      const onde = `Linha ${i + 2} (${nome})`, d = { nome };
      const cl = classeDoTexto(cel(col.classe)); if (cl) d.classe = cl;
      const f = cel(col.formulacao).toUpperCase(); if (f) { if (KB.formulacoes[f]) d.formulacao = f; else erros.push(`${onde}: formulação “${f}” não é conhecida — ignorei.`); }
      if (cel(col.composicao)) d.ingredientes = cel(col.composicao);
      if (cel(col.materiaPrima)) d.materiaPrima = cel(col.materiaPrima);
      if (cel(col.nota)) d.nota = cel(col.nota);
      const u = unidadeDoTexto(cel(col.unidade)); if (u) d.unidade = u; else if (u === null) erros.push(`${onde}: unidade “${cel(col.unidade)}” não reconhecida (use mL/100L, L/ha…) — usei a padrão.`);
      [['dose', 'dose'], ['preco', 'preço']].forEach(([campo, rot]) => {
        const b = cel(col[campo]); if (!b) return;
        const n = ES.parseNumero(b); if (n === null || n < 0) erros.push(`${onde}: “${b}” não é número válido em ${rot}.`); else d[campo] = n;
      });
      const atual = existente(lista, nome);
      if (!d.classe && !atual) d.classe = classeDoTexto(classePadrao) || 'Outro';
      const ativos = new Set(), classeEf = d.classe || atual.classe;
      [cel(col.nutrientes), cel(col.materiaPrima)].forEach(t => reconhecer(t, classeEf).forEach(k => ativos.add(k)));
      if (ativos.size) d.ativos = [...ativos];
      itens.push(d);
    });
    return { itens, erros, colunas: col };
  }
  // Aplica as linhas da planilha: nome novo cria, nome que já existe atualiza só o que veio preenchido (nutrientes se somam)
  function importar(lista, itens, { agora, novoId } = {}) {
    let novos = 0, atualizados = 0; const erros = [];
    itens.forEach(d => {
      const atual = existente(lista, d.nome);
      const dados = atual ? { ...atual, ...d, nome: atual.nome, ativos: uniq([...(atual.ativos || []), ...(d.ativos || [])]) } : d; // o nome já guardado não muda por causa de maiúscula/acento na planilha
      const r = salvar(lista, dados, { id: atual && atual.id, agora, novoId });
      if (r.erro) erros.push(r.erro); else if (r.criado) novos++; else atualizados++;
    });
    return { novos, atualizados, erros };
  }

  return { CLASSES_COM_COMPOSICAO, componentes, reconhecer, rotuloDe, nomeCurto, limpar, existente, salvar, remover, textoBusca, buscar, resumo, unidadeDoPreco, unidadePadrao, paraItem, deItem, paraCSV, produtosDeTabela, importar };
});
