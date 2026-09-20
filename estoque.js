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

  return { norm, parseNumero, detectarSeparador, parseCSV, toCSV, numCSV, COLUNAS_FICHA, colunasDaFicha, fichaDeTabela, fichaParaCSV };
});
