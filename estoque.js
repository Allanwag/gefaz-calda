/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — estoque.js
   Lógica pura da rotina da fazenda (sem DOM): planilhas CSV, ficha de produtos
   (intervalo, carência, máximo de aplicações, reentrada), estoque lido de PDF ou
   planilha, baixa por aplicação, previsto × realizado e agenda (.ics).
   Funciona no navegador (window.GCEstoque) e no Node (module.exports) para testes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.GCEstoque = factory(root.GCEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const norm = E.norm;
  const round = (v, d = 3) => { const f = Math.pow(10, d); return Math.round((+v || 0) * f) / f; };

  /* ───────── números no formato brasileiro ───────── */
  // "1.234,56" → 1234.56 · "12,5" → 12.5 · "12.5" → 12.5 · "1.234" → 1234 (ponto de milhar) · "(3,2)" → -3.2
  function parseNumero(txt) {
    let s = String(txt == null ? '' : txt).trim();
    if (!s) return null;
    let neg = false;
    if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    s = s.replace(/\s/g, '').replace(/^R\$/, '');
    if (!s || !/^[0-9.,]+$/.test(s)) return null;
    const ponto = s.lastIndexOf('.'), virg = s.lastIndexOf(',');
    if (ponto >= 0 && virg >= 0) {
      // o último separador é o decimal
      if (virg > ponto) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    } else if (virg >= 0) {
      s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (ponto >= 0) {
      const partes = s.split('.');
      // vários pontos, ou um ponto seguido de exatamente 3 dígitos e mais de um dígito antes: milhar
      if (partes.length > 2 || (partes[1].length === 3 && partes[0].length >= 1 && partes[0] !== '0')) s = s.replace(/\./g, '');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  /* ───────── CSV (Excel em português usa ; e vírgula decimal) ───────── */
  function detectarSeparador(texto) {
    const primeira = String(texto).split(/\r?\n/).find(l => l.trim()) || '';
    const cont = c => primeira.split(c).length - 1;
    const cand = [[';', cont(';')], ['\t', cont('\t')], [',', cont(',')]].sort((a, b) => b[1] - a[1]);
    return cand[0][1] > 0 ? cand[0][0] : ';';
  }
  function parseCSV(texto, sep) {
    let t = String(texto == null ? '' : texto);
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    sep = sep || detectarSeparador(t);
    const linhas = []; let campo = '', linha = [], aspas = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (aspas) {
        if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); campo = ''; if (linha.some(x => x.trim() !== '')) linhas.push(linha); linha = []; }
      else campo += c;
    }
    linha.push(campo); if (linha.some(x => x.trim() !== '')) linhas.push(linha);
    return { sep, cab: (linhas[0] || []).map(x => x.trim()), linhas: linhas.slice(1).map(l => l.map(x => x.trim())) };
  }
  function toCSV(linhas, sep) {
    sep = sep || ';';
    const esc = v => { const s = v == null ? '' : String(v); return (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return linhas.map(l => l.map(esc).join(sep)).join('\r\n') + '\r\n';
  }
  const numCSV = v => (v == null || v === '' ? '' : String(round(v, 4)).replace('.', ','));

  /* ───────── ficha de produtos: o que a bula diz e o app não traz ───────── */
  const COLUNAS_FICHA = [
    ['produto', 'Produto'],
    ['intervalo', 'Intervalo entre aplicações (dias)'],
    ['carencia', 'Carência (dias)'],
    ['maxAplic', 'Máx. aplicações por ciclo'],
    ['reentrada', 'Reentrada (horas)']
  ];
  // acha a coluna de cada campo pelo texto do cabeçalho (sem acento, qualquer ordem)
  function colunasDaFicha(cab) {
    const col = {}, h = cab.map(norm);
    const acha = pred => h.findIndex(pred);
    col.produto = acha(x => /^(produto|nome|descricao|item|defensivo)/.test(x));
    col.reentrada = acha(x => x.includes('reentrada'));
    col.carencia = acha(x => x.includes('carencia') || x.includes('seguranca'));
    col.maxAplic = acha(x => (x.includes('max') || x.includes('ciclo') || x.includes('safra')) && x.includes('aplic'));
    col.intervalo = acha((x, i) => x.includes('intervalo') && i !== col.reentrada && i !== col.carencia && !x.includes('seguranca') && !x.includes('reentrada'));
    return col;
  }
  function fichaDeTabela(tab) {
    const col = colunasDaFicha(tab.cab), erros = [], itens = [];
    if (col.produto < 0) erros.push('Não achei a coluna do produto (cabeçalho "Produto" ou "Nome").');
    const campos = ['intervalo', 'carencia', 'maxAplic', 'reentrada'];
    if (col.produto >= 0 && !campos.some(c => col[c] >= 0)) erros.push('Não achei nenhuma coluna de intervalo, carência, máximo de aplicações ou reentrada.');
    if (erros.length) return { itens, erros, colunas: col };
    tab.linhas.forEach((l, i) => {
      const nome = (l[col.produto] || '').trim(); if (!nome) return;
      const it = { nome };
      campos.forEach(c => {
        if (col[c] < 0) return;
        const bruto = (l[col[c]] || '').trim(); if (bruto === '') return;
        const n = parseNumero(bruto);
        if (n === null || n < 0) erros.push(`Linha ${i + 2} (${nome}): "${bruto}" não é um número válido em ${c}.`); else it[c] = n;
      });
      itens.push(it);
    });
    return { itens, erros, colunas: col };
  }
  function fichaParaCSV(produtos) {
    const cab = COLUNAS_FICHA.map(c => c[1]);
    return toCSV([cab, ...produtos.map(p => [p.nome, numCSV(p.intervalo), numCSV(p.carencia), numCSV(p.maxAplic), numCSV(p.reentrada)])]);
  }

  /* ═════════════════════════ ESTOQUE ═════════════════════════ */

  /* ───────── unidades: o estoque guarda em litros ou quilos ───────── */
  const TABELA_UNIDADES = {
    l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', quilo: 'kg', quilos: 'kg',
    ml: 'mL', g: 'g', gr: 'g', grama: 'g', gramas: 'g', t: 't', ton: 't',
    un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', cx: 'un', sc: 'un', saco: 'un', gl: 'un', gal: 'un', galao: 'un', fr: 'un', frasco: 'un', bd: 'un', balde: 'un', pc: 'un', pct: 'un'
  };
  function normUnidade(u) { return TABELA_UNIDADES[norm(String(u == null ? '' : u)).replace(/[^a-z]/g, '')] || null; }
  const PARA_BASE = { L: [1, 'L'], kg: [1, 'kg'], mL: [0.001, 'L'], g: [0.001, 'kg'], t: [1000, 'kg'] };
  // (12, 'mL') → {qtd: 0.012, base: 'L'} · (3, 'un', {qtd: 5, unidade: 'L'}) → {qtd: 15, base: 'L'} · sem conversão → null
  function paraBase(qtd, unidade, embalagem) {
    const q = +qtd; if (!Number.isFinite(q)) return null;
    let u = normUnidade(unidade);
    if (u === 'un') {
      const e = embalagem && PARA_BASE[normUnidade(embalagem.unidade)];
      if (!e || !(+embalagem.qtd > 0)) return null;
      return { qtd: round(q * embalagem.qtd * e[0], 4), base: e[1] };
    }
    const c = PARA_BASE[u]; if (!c) return null;
    return { qtd: round(q * c[0], 4), base: c[1] };
  }

  /* ───────── PDF → linhas de tabela ─────────
     Entrada: itens de texto como o pdf.js entrega, já em {s, x, y, w, h} (y cresce para cima).
     Saída: linhas de cima para baixo, cada uma com as células (colunas) em ordem.            */
  function agruparLinhas(itens) {
    const it = (itens || []).filter(i => i && String(i.s).trim() !== '');
    if (!it.length) return [];
    const alturas = it.map(i => i.h || 0).filter(h => h > 0).sort((a, b) => a - b);
    const h0 = alturas.length ? alturas[Math.floor(alturas.length / 2)] : 10;
    it.sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos = [];
    it.forEach(i => {
      const g = grupos[grupos.length - 1];
      if (g && Math.abs(g.y - i.y) <= Math.max(2, h0 * 0.5)) g.itens.push(i); else grupos.push({ y: i.y, itens: [i] });
    });
    return grupos.map(g => {
      g.itens.sort((a, b) => a.x - b.x);
      const cel = [];
      g.itens.forEach(i => {
        const w = i.w > 0 ? i.w : String(i.s).length * h0 * 0.5, ult = cel[cel.length - 1];
        const gap = ult ? i.x - ult.x2 : Infinity, ref = i.h || h0;
        if (ult && gap < ref * 0.9) { ult.s += (gap > ref * 0.12 ? ' ' : '') + i.s; ult.x2 = i.x + w; }
        else cel.push({ s: String(i.s), x: i.x, x2: i.x + w });
      });
      cel.forEach(c => { c.s = c.s.replace(/\s+/g, ' ').trim(); });
      return { y: g.y, cells: cel.filter(c => c.s), texto: cel.map(c => c.s).join(' | ') };
    }).filter(l => l.cells.length);
  }

  /* ───────── linhas → produtos e quantidades ───────── */
  const RE_UNIDADE_CEL = /^(l|lt|lts|litros?|kg|kgs|kilos?|quilos?|ml|g|gr|gramas?|un|und|unid|unidades?|cx|sc|gl|gal|galao|fr|frasco|bd|balde|pc|pct|t|ton)\.?$/;
  const RE_PULAR = /^(total|subtotal|sub-total|soma|pagina|p[aá]gina|emitido|relat[oó]rio|data|hora|fazenda|estoque\b|saldo\b)/;
  const CAB_PRODUTO = /^(produto|descricao|item|material|insumo|nome|mercadoria|defensivo)/;
  const CAB_QTD = /(quant|qtd|qtde|saldo|estoque|disponivel|existencia)/;
  const CAB_QTD_RUIM = /(min|max|ideal|reserv|custo|valor|preco|entrada|saida|unit)/;
  const CAB_UN = /^(un\b|unid|und|medida|um\b)/;
  const ehUnidadeCel = s => RE_UNIDADE_CEL.test(norm(s).replace(/\s/g, ''));
  const numeroPuro = s => (/^[\s\d.,()\-]+$/.test(s) && /\d/.test(s)) ? parseNumero(s) : null;
  const centro = c => (c.x + c.x2) / 2;

  function acharCabecalho(linha) {
    const cel = linha.cells.map(c => ({ c, n: norm(c.s) }));
    const prod = cel.find(x => CAB_PRODUTO.test(x.n));
    const qtds = cel.filter(x => CAB_QTD.test(x.n) && !CAB_QTD_RUIM.test(x.n));
    const qtdPref = qtds.find(x => /(saldo|atual|disponivel|estoque)/.test(x.n)) || qtds[0];
    if (!prod || !qtdPref) return null;
    const un = cel.find(x => CAB_UN.test(x.n));
    return { produto: prod.c, qtd: qtdPref.c, unidade: un ? un.c : null };
  }
  /* opts.qtdPos: 'auto' | {lado: 'esq'|'dir', n: 1..}  → qual das colunas numéricas é a quantidade quando não há cabeçalho */
  function interpretarEstoque(linhas, opts) {
    opts = opts || {};
    const itens = [], ignoradas = []; let cab = null, maxNumericas = 0;
    (linhas || []).forEach((linha, idx) => {
      const texto = linha.texto || '';
      const c = acharCabecalho(linha);
      if (c) { cab = c; return; }
      const cels = linha.cells;
      if (cels.length < 2 && !cels.some(x => /^([\d.,]+)\s*[A-Za-z]+$/.test(x.s))) { if (texto) ignoradas.push(texto); return; }
      if (RE_PULAR.test(norm(cels[0].s))) { ignoradas.push(texto); return; }
      // célula → papel
      const papeis = cels.map((x, i) => {
        const n = numeroPuro(x.s), m = /^([\d.,]+)\s*([A-Za-z]{1,8})\.?$/.exec(x.s);
        if (n !== null) return { c: x, i, tipo: 'num', v: n };
        if (m && ehUnidadeCel(m[2]) && parseNumero(m[1]) !== null) return { c: x, i, tipo: 'numun', v: parseNumero(m[1]), un: m[2] };
        if (ehUnidadeCel(x.s)) return { c: x, i, tipo: 'un' };
        return { c: x, i, tipo: 'txt' };
      });
      // código do produto: primeira célula só de dígitos (ou com zero à esquerda) quando ainda há outro número depois
      const numericas = papeis.filter(p => p.tipo === 'num' || p.tipo === 'numun');
      const primeira = papeis[0];
      const ehCodigo = primeira && primeira.tipo === 'num' && numericas.length > 1 && /^\d+$/.test(primeira.c.s.replace(/\s/g, ''));
      const candidatas = numericas.filter(p => !(ehCodigo && p === primeira));
      maxNumericas = Math.max(maxNumericas, candidatas.length);
      const nomeCels = papeis.filter(p => p.tipo === 'txt' && (p.c.s.match(/[A-Za-zÀ-ú]/g) || []).length >= 2);
      if (!nomeCels.length || !candidatas.length) { ignoradas.push(texto); return; }
      // qual número é a quantidade
      let q = null, como = 'baixa';
      if (cab) {
        const cx = centro(cab.qtd);
        const orden = candidatas.map(p => ({ p, d: Math.min(Math.abs(centro(p.c) - cx), Math.abs(p.c.x2 - cab.qtd.x2)) })).sort((a, b) => a.d - b.d);
        const larg = Math.max(30, (cab.qtd.x2 - cab.qtd.x) * 1.2);
        if (orden[0].d <= larg) { q = orden[0].p; como = 'alta'; }
      }
      if (!q && opts.qtdPos && opts.qtdPos !== 'auto') {
        const n = Math.max(1, opts.qtdPos.n || 1), lista = opts.qtdPos.lado === 'dir' ? [...candidatas].reverse() : candidatas;
        q = lista[n - 1] || null; como = 'escolhida';
      }
      if (!q) {
        const un = papeis.find(p => p.tipo === 'un');
        if (un) { q = [...candidatas].reverse().find(p => p.i < un.i) || null; if (q) como = 'media'; }
        if (!q) { q = candidatas[0]; como = 'baixa'; }
      }
      if (!q) { ignoradas.push(texto); return; }
      // unidade: na própria célula, na coluna de unidade do cabeçalho, ou a célula de unidade mais próxima da quantidade
      let unidade = q.un || '';
      if (!unidade) {
        const un = papeis.filter(p => p.tipo === 'un');
        if (cab && cab.unidade && un.length) un.sort((a, b) => Math.abs(centro(a.c) - centro(cab.unidade)) - Math.abs(centro(b.c) - centro(cab.unidade)));
        else un.sort((a, b) => Math.abs(a.i - q.i) - Math.abs(b.i - q.i));
        unidade = un.length ? un[0].c.s : '';
      }
      // nome: textos à esquerda da quantidade (sem unidade e sem código)
      const nome = nomeCels.filter(p => p.c.x <= q.c.x).map(p => p.c.s).join(' ').replace(/\s+/g, ' ').trim() || nomeCels.map(p => p.c.s).join(' ').trim();
      if ((nome.match(/[A-Za-zÀ-ú]/g) || []).length < 3) { ignoradas.push(texto); return; }
      itens.push({ nome, qtd: q.v, unidade: unidade.replace(/\.$/, ''), unidadeNorm: normUnidade(unidade), bruto: texto, confianca: como, linha: idx });
    });
    return { itens, ignoradas, cabecalho: !!cab, maxNumericas };
  }

  /* estoque numa planilha CSV: colunas produto, quantidade e (opcional) unidade */
  function estoqueDeTabela(tab) {
    const h = tab.cab.map(norm), erros = [], itens = [];
    const p = h.findIndex(x => CAB_PRODUTO.test(x));
    const qs = h.map((x, i) => ({ x, i })).filter(o => CAB_QTD.test(o.x) && !CAB_QTD_RUIM.test(o.x));
    const q = (qs.find(o => /(saldo|atual|disponivel|estoque)/.test(o.x)) || qs[0] || { i: -1 }).i;
    const u = h.findIndex(x => CAB_UN.test(x));
    if (p < 0 || q < 0) return { itens, erros: ['Não achei as colunas de produto e quantidade (cabeçalhos como "Produto" e "Quantidade" ou "Saldo").'], cabecalho: true };
    tab.linhas.forEach((l, i) => {
      const nome = (l[p] || '').trim(), n = parseNumero(l[q]); if (!nome) return;
      if (n === null) { erros.push(`Linha ${i + 2} (${nome}): quantidade "${l[q] || ''}" não é número.`); return; }
      const un = u >= 0 ? (l[u] || '') : '';
      itens.push({ nome, qtd: n, unidade: un, unidadeNorm: normUnidade(un), bruto: l.join(' | '), confianca: 'alta', linha: i });
    });
    return { itens, erros, cabecalho: true };
  }

  /* ───────── ligar o produto da receita ao item do estoque ───────── */
  const STOP = new Set(['ec', 'sc', 'wg', 'sl', 'wp', 'ew', 'od', 'se', 'gr', 'cs', 'sp', 'de', 'da', 'do', 'com', 'para', 'kg', 'ml', 'un', 'cx', 'lt', 'litro', 'litros', 'frasco', 'galao', 'emb', 'embalagem']);
  const tokens = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(t => t.length >= 2 && !STOP.has(t) && !/^\d+(l|kg|g|ml)$/.test(t));
  function similaridade(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
    if (!inter) return 0;
    const cont = inter / Math.min(A.size, B.size), jac = inter / (A.size + B.size - inter);
    const marca = [...A].some(t => t.length >= 4 && B.has(t));
    return Math.min(1, 0.5 * cont + 0.5 * jac + (cont === 1 && marca ? 0.25 : 0));
  }
  /* mapa: {nomeNormalizadoDoProduto: idDoEstoque} guardado quando o usuário escolhe à mão */
  function casarProduto(nome, estoque, mapa) {
    const lista = estoque || [], k = norm(nome);
    const doMapa = mapa && mapa[k] && lista.find(e => e.id === mapa[k]);
    if (doMapa) return { item: doMapa, tipo: 'mapa', candidatos: [] };
    const exato = lista.find(e => norm(e.nome) === k);
    if (exato) return { item: exato, tipo: 'exato', candidatos: [] };
    const pont = lista.map(e => ({ item: e, score: round(similaridade(nome, e.nome), 3) })).filter(x => x.score >= 0.4).sort((a, b) => b.score - a.score);
    if (pont.length && pont[0].score >= 0.75 && (pont.length === 1 || pont[0].score - pont[1].score >= 0.1)) return { item: pont[0].item, tipo: 'parecido', candidatos: pont.slice(0, 4) };
    return { item: null, tipo: null, candidatos: pont.slice(0, 4) };
  }

  /* ───────── baixa por aplicação ─────────
     Quantidade de cada produto = dose por hectare × hectares pulverizados. Os hectares vêm dos litros de calda
     aplicados ÷ o volume de calda por hectare da receita (ou são informados).                                  */
  function baixaDaReceita({ itens, volumeHa, litros, ha }) {
    const vol = +volumeHa > 0 ? +volumeHa : 0;
    const area = +ha > 0 ? +ha : (+litros > 0 && vol > 0 ? +litros / vol : 0);
    const litrosCalda = +litros > 0 ? +litros : (area > 0 && vol > 0 ? area * vol : 0);
    const linhas = (itens || []).map(i => {
      const d = E.dosePorHa({ dose: i.dose, unidade: i.unidade }, vol || 100);
      return { nome: i.nome, dose: +i.dose || 0, unidadeDose: i.unidade, dosePorHa: round(d.qtd, 4), base: d.base, qtd: round(d.qtd * area, 3) };
    });
    return { ha: round(area, 3), litros: round(litrosCalda, 1), volumeHa: vol, linhas };
  }
  /* aplica movimentos ao estoque sem mexer no original; delta em L/kg (negativo baixa) */
  function movimentar(estoque, movs) {
    const copia = (estoque || []).map(e => ({ ...e }));
    (movs || []).forEach(m => { const e = copia.find(x => x.id === m.estoqueId); if (e) e.qtd = round((+e.qtd || 0) + (+m.delta || 0), 4); });
    return copia;
  }

  /* ═════════════════════ PREVISTO × REALIZADO (metas) ═════════════════════ */
  /* tarefa: {id, dataPrev:'AAAA-MM-DD', haPrev, litrosPrev, status?:'cancelada', concluida?:bool}
     realizacao: {tarefaId, data, ha, litros, estornada?:bool}                                           */
  function situacaoTarefa(t, real, hoje) {
    if (t.status === 'cancelada') return 'cancelada';
    const haOk = t.haPrev > 0 && real.ha >= t.haPrev * 0.999, litOk = !(t.haPrev > 0) && t.litrosPrev > 0 && real.litros >= t.litrosPrev * 0.999;
    if (t.concluida || haOk || litOk) return 'concluida';
    if (t.dataPrev && hoje && t.dataPrev < hoje) return 'atrasada';
    return real.ha > 0 || real.litros > 0 ? 'parcial' : 'aberta';
  }
  function progresso({ tarefas, realizacoes, de, ate, hoje, metaPct }) {
    const validas = (realizacoes || []).filter(r => !r.estornada);
    const meta = metaPct > 0 ? +metaPct : 100;
    const noPeriodo = (tarefas || []).filter(t => t.status !== 'cancelada' && (!de || !t.dataPrev || t.dataPrev >= de) && (!ate || !t.dataPrev || t.dataPrev <= ate));
    const porTarefa = {};
    noPeriodo.forEach(t => {
      const rs = validas.filter(r => r.tarefaId === t.id);
      const real = { ha: round(rs.reduce((s, r) => s + (+r.ha || 0), 0), 3), litros: round(rs.reduce((s, r) => s + (+r.litros || 0), 0), 1) };
      const pct = t.haPrev > 0 ? real.ha / t.haPrev : (t.litrosPrev > 0 ? real.litros / t.litrosPrev : 0);
      porTarefa[t.id] = { ...real, pct: Math.min(1, pct), situacao: situacaoTarefa(t, real, hoje) };
    });
    const conta = s => noPeriodo.filter(t => porTarefa[t.id].situacao === s).length;
    const haPrev = noPeriodo.reduce((s, t) => s + (+t.haPrev || 0), 0), litrosPrev = noPeriodo.reduce((s, t) => s + (+t.litrosPrev || 0), 0);
    const haReal = noPeriodo.reduce((s, t) => s + Math.min(porTarefa[t.id].ha, t.haPrev > 0 ? t.haPrev : porTarefa[t.id].ha), 0);
    const litrosReal = noPeriodo.reduce((s, t) => s + porTarefa[t.id].litros, 0);
    const n = noPeriodo.length, concluidas = conta('concluida');
    const esperadas = noPeriodo.filter(t => t.dataPrev && hoje && t.dataPrev <= hoje).length; // já deviam estar prontas
    const pctTarefas = n ? concluidas / n : 0;
    return {
      n, concluidas, abertas: conta('aberta'), parciais: conta('parcial'), atrasadas: conta('atrasada'), esperadas,
      haPrev: round(haPrev, 2), haReal: round(haReal, 2), pctHa: haPrev > 0 ? Math.min(1, haReal / haPrev) : 0,
      litrosPrev: round(litrosPrev, 0), litrosReal: round(litrosReal, 0), pctLitros: litrosPrev > 0 ? litrosReal / litrosPrev : 0,
      pctTarefas, metaPct: meta, atingiuMeta: n > 0 && pctTarefas * 100 >= meta - 1e-9,
      faltamParaMeta: Math.max(0, Math.ceil(n * meta / 100 - 1e-9) - concluidas), noRitmo: concluidas >= esperadas,
      porTarefa, tarefas: noPeriodo
    };
  }

  /* ═════════════════════ AGENDA (.ics) ═════════════════════ */
  const icsTexto = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function dobrarLinha(linha) { // RFC 5545: até 75 octetos por linha; a continuação começa com um espaço
    const enc = new TextEncoder(), partes = []; let atual = '', bytes = 0;
    for (const ch of linha) {
      const b = enc.encode(ch).length;
      if (bytes + b > 74) { partes.push(atual); atual = ' ' + ch; bytes = 1 + b; } else { atual += ch; bytes += b; }
    }
    partes.push(atual);
    return partes.join('\r\n');
  }
  const soDigitos = iso => String(iso).replace(/-/g, '').slice(0, 8);
  function diaSeguinte(iso) { const [a, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d + 1)); return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`; }
  /* eventos: [{uid, dia:'AAAA-MM-DD', titulo, descricao}] — dia inteiro */
  function icsAgenda(eventos, opts) {
    opts = opts || {};
    const agora = opts.agora instanceof Date ? opts.agora : new Date();
    const stamp = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gefaz Calda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsTexto(opts.nome || 'Gefaz Calda')];
    (eventos || []).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.dia || '')).forEach((e, i) => {
      linhas.push('BEGIN:VEVENT', 'UID:' + (e.uid || ('gc-' + i + '-' + soDigitos(e.dia))) + '@gefaz-calda', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + soDigitos(e.dia), 'DTEND;VALUE=DATE:' + diaSeguinte(e.dia), 'SUMMARY:' + icsTexto(e.titulo));
      if (e.descricao) linhas.push('DESCRIPTION:' + icsTexto(e.descricao));
      linhas.push('END:VEVENT');
    });
    linhas.push('END:VCALENDAR');
    return linhas.map(dobrarLinha).join('\r\n') + '\r\n';
  }

  return {
    norm, parseNumero, detectarSeparador, parseCSV, toCSV, numCSV, COLUNAS_FICHA, colunasDaFicha, fichaDeTabela, fichaParaCSV,
    normUnidade, paraBase, agruparLinhas, interpretarEstoque, estoqueDeTabela, similaridade, casarProduto,
    baixaDaReceita, movimentar, situacaoTarefa, progresso, icsAgenda
  };
});
