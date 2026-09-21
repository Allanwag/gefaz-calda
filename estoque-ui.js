'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — estoque-ui.js
   Aba Estoque (subir PDF ou planilha, conferir, saldo, entradas), baixa automática
   por aplicação realizada (receita × litros de calda) e estorno.
   Usa app.js (DB, $, esc, fmt, toast…), estoque.js (ES) e fazenda.js.
   ═══════════════════════════════════════════════════════════════════════════ */

const arred4 = v => Math.round((+v || 0) * 1e4) / 1e4;
const fmtQtd = (v, u) => `${fmt(v, 3)} ${u || ''}`.trim();
function abrirModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }

/* ───────── itens e movimentos do estoque ───────── */
const acharEstoque = nome => DB.estoque.find(e => norm(e.nome) === norm(nome));
function novoItemEstoque(nome, unidade, qtd, fonte) {
  const e = { id: uid(), nome: String(nome).trim(), unidade, qtd: arred4(qtd), minimo: null, fonte: fonte || 'manual', atualizado: new Date().toISOString() };
  DB.estoque.push(e); return e;
}
function registrarMov(tipo, e, delta, extra) {
  const m = { id: uid(), iso: new Date().toISOString(), dia: hoje(), tipo, estoqueId: e.id, nome: e.nome, delta: arred4(delta), unidade: e.unidade, ...(extra || {}) };
  DB.movEstoque.unshift(m); if (DB.movEstoque.length > 600) DB.movEstoque.length = 600;
  return m;
}
function ajustarSaldo(e, novo, tipo, obs) {
  const delta = arred4(novo - e.qtd); if (!delta) return;
  registrarMov(tipo || 'ajuste', e, delta, { obs: obs || 'ajuste manual' });
  e.qtd = arred4(novo); e.atualizado = new Date().toISOString(); saveDB();
}
function refrescarTudo() {
  renderEstoque(); renderMovs(); renderNecessidade(); renderHistorico(); renderTalhoes(); renderItens();
  if (typeof renderMetas === 'function') renderMetas();
}

/* ───────── tarefas em aberto (usadas pela baixa e pela necessidade de estoque) ───────── */
function progressoGeral() { return ES.progresso({ tarefas: DB.tarefas, realizacoes: DB.realizacoes, hoje: hoje(), metaPct: DB.config.meta.pct }); }
function tarefasEmAberto() {
  const p = progressoGeral();
  return p.tarefas.filter(t => p.porTarefa[t.id].situacao !== 'concluida' && !t.concluida);
}

/* ───────── tela: lista do estoque ───────── */
function renderEstoque() {
  const tb = $('#estTabela'); if (!tb) return;
  const f = norm($('#estFiltro').value || '');
  const lista = DB.estoque.filter(e => !f || norm(e.nome).includes(f)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const baixos = DB.estoque.filter(e => e.qtd <= 0 || (e.minimo > 0 && e.qtd < e.minimo)).length;
  $('#estResumo').textContent = DB.estoque.length ? `${DB.estoque.length} produto(s)${baixos ? ' · ' + baixos + ' baixo(s)/zerado(s)' : ''}` : 'estoque vazio';
  tb.innerHTML = lista.length ? `<thead><tr><th>Produto</th><th class="num">Saldo</th><th>Un.</th><th class="num">Mínimo</th><th>Atualizado</th><th></th></tr></thead><tbody>${lista.map(e => {
    const cls = e.qtd <= 0 ? 'danger-txt' : (e.minimo > 0 && e.qtd < e.minimo ? 'aviso-txt' : '');
    return `<tr><td>${esc(e.nome)}${e.fonte ? ` <small class="muted">${esc(e.fonte)}</small>` : ''}</td>
      <td class="num"><input type="number" step="any" class="${cls}" data-eid="${esc(e.id)}" data-ef="qtd" value="${e.qtd}" aria-label="Saldo de ${esc(e.nome)}"></td><td>${esc(e.unidade)}</td>
      <td class="num"><input type="number" step="any" min="0" data-eid="${esc(e.id)}" data-ef="minimo" value="${e.minimo == null ? '' : e.minimo}" placeholder="—" aria-label="Estoque mínimo de ${esc(e.nome)}"></td>
      <td><small>${e.atualizado ? dataBR(e.atualizado.slice(0, 10)) : '—'}</small></td>
      <td><button type="button" class="btn sm ghost" data-eent="${esc(e.id)}" title="Registrar uma compra/entrada">＋ entrada</button><button type="button" class="btn sm ghost danger" data-edel="${esc(e.id)}" aria-label="Excluir ${esc(e.nome)}">✕</button></td></tr>`;
  }).join('')}</tbody>` : '<tbody><tr><td class="muted">Nenhum produto no estoque. Suba o PDF do estoque acima, importe uma planilha ou adicione à mão.</td></tr></tbody>';
  tb.querySelectorAll('[data-ef]').forEach(i => i.onchange = () => {
    const e = DB.estoque.find(x => x.id === i.dataset.eid); if (!e) return;
    if (i.dataset.ef === 'minimo') { e.minimo = i.value === '' ? null : Math.max(0, num(i.value)); saveDB(); }
    else if (i.value !== '') ajustarSaldo(e, num(i.value));
    refrescarTudo();
  });
  tb.querySelectorAll('[data-eent]').forEach(b => b.onclick = () => {
    const e = DB.estoque.find(x => x.id === b.dataset.eent); if (!e) return;
    const v = prompt(`Quanto entrou de ${e.nome} (em ${e.unidade})?`); if (v === null) return;
    const n = num(v); if (!(n > 0)) return toast('Informe um número maior que zero', 'err');
    registrarMov('entrada', e, n, { obs: 'entrada/compra' }); e.qtd = arred4(e.qtd + n); e.atualizado = new Date().toISOString(); saveDB(); refrescarTudo();
  });
  tb.querySelectorAll('[data-edel]').forEach(b => b.onclick = () => {
    const e = DB.estoque.find(x => x.id === b.dataset.edel); if (!e) return;
    if (!confirm(`Tirar ${e.nome} do estoque? (o histórico de movimentos fica)`)) return;
    DB.estoque = DB.estoque.filter(x => x.id !== e.id);
    Object.keys(DB.mapEstoque).forEach(k => { if (DB.mapEstoque[k] === e.id) delete DB.mapEstoque[k]; });
    saveDB(); refrescarTudo();
  });
}
function renderMovs() {
  const el = $('#estMovs'); if (!el) return;
  const rot = { baixa: 'baixa', entrada: 'entrada', ajuste: 'ajuste', inventario: 'inventário', estorno: 'estorno' };
  el.innerHTML = DB.movEstoque.length ? DB.movEstoque.slice(0, 40).map(m => `<div class="row"><div><b>${esc(m.nome)}</b><small>${dataBR(m.dia)} · ${rot[m.tipo] || m.tipo}${m.obs ? ' · ' + esc(m.obs) : ''}${m.estornado ? ' · estornada' : ''}</small></div>
    <div class="acts"><span class="tag ${m.delta < 0 ? 'noreg' : 'reg'}">${m.delta > 0 ? '+' : ''}${fmt(m.delta, 3)} ${esc(m.unidade)}</span>${m.tipo === 'baixa' && m.realizacaoId && !m.estornado ? `<button type="button" class="btn sm ghost" data-mundo="${esc(m.realizacaoId)}">↩ desfazer</button>` : ''}</div></div>`).join('')
    : '<div class="small muted">Nenhuma movimentação ainda.</div>';
  el.querySelectorAll('[data-mundo]').forEach(b => b.onclick = () => estornarRealizacao(b.dataset.mundo));
}
/* o que as tarefas abertas ainda vão consumir × o que há no estoque */
function necessidadeTarefas() {
  const p = progressoGeral(), acc = new Map();
  p.tarefas.forEach(t => {
    const r = p.porTarefa[t.id]; if (!r || r.situacao === 'concluida' || t.concluida) return;
    const faltaHa = Math.max(0, (t.haPrev || 0) - r.ha); if (!(faltaHa > 0)) return;
    ES.baixaDaReceita({ itens: t.itens, volumeHa: t.volumeHa, ha: faltaHa }).linhas.forEach(l => {
      const k = norm(l.nome) + '|' + l.base, a = acc.get(k) || { nome: l.nome, base: l.base, qtd: 0 };
      a.qtd += l.qtd; acc.set(k, a);
    });
  });
  return [...acc.values()].map(a => {
    const c = ES.casarProduto(a.nome, DB.estoque, DB.mapEstoque), e = c.item && c.item.unidade === a.base ? c.item : null;
    return { ...a, qtd: arred4(a.qtd), estoque: e, falta: e ? Math.max(0, arred4(a.qtd - e.qtd)) : null };
  }).sort((x, y) => (y.falta || 0) - (x.falta || 0) || x.nome.localeCompare(y.nome, 'pt-BR'));
}
function renderNecessidade() {
  const el = $('#estNecessidade'); if (!el) return;
  const l = necessidadeTarefas();
  if (!l.length) { el.innerHTML = '<div class="small muted">Sem tarefas abertas com produtos a consumir. Programe tarefas na aba Metas para ver aqui o que falta comprar.</div>'; return; }
  el.innerHTML = `<div class="tabela-rolavel"><table class="tb"><thead><tr><th>Produto</th><th class="num">Ainda vai usar</th><th class="num">Em estoque</th><th class="num">Falta</th></tr></thead><tbody>${l.map(x => `<tr><td>${esc(x.nome)}</td><td class="num">${fmtQtd(x.qtd, x.base)}</td><td class="num">${x.estoque ? fmtQtd(x.estoque.qtd, x.estoque.unidade) : '<span class="muted">sem item no estoque</span>'}</td><td class="num">${x.falta === null ? '—' : x.falta > 0 ? `<b class="danger-txt">${fmtQtd(x.falta, x.base)}</b>` : '<span class="tag reg">ok</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
/* etiqueta no cartão do produto da calda: saldo e se dá para a área */
function tagEstoque(it) {
  if (!DB.estoque.length) return '';
  const c = ES.casarProduto(it.nome, DB.estoque, DB.mapEstoque);
  if (!c.item) return '<span class="tag" title="Nenhum item do estoque combina com este produto">sem item no estoque</span>';
  const e = c.item, d = E.dosePorHa({ dose: it.dose, unidade: it.unidade }, num($('#fVolume').value) || 100), area = num($('#fArea').value);
  const precisa = d.base === e.unidade && it.dose > 0 ? d.qtd * area : null, falta = precisa !== null && precisa > e.qtd + 1e-9;
  return `<span class="tag ${falta ? 'noreg' : 'reg'}" title="${esc(e.nome)} no estoque">estoque ${fmt(e.qtd, 2)} ${esc(e.unidade)}${falta ? ' · falta ' + fmt(precisa - e.qtd, 2) : ''}</span>`;
}

/* ───────── subir o estoque: PDF ou planilha ───────── */
let rev = null; // revisão em andamento
const msgEstoque = (html, erro) => { const m = $('#estMsg'); m.innerHTML = html; m.className = 'small' + (erro ? ' danger-txt' : ''); };
async function carregarPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((ok, falha) => {
    const s = document.createElement('script'); s.src = 'vendor/pdfjs/pdf.min.js'; s.onload = ok;
    s.onerror = () => falha(new Error('não consegui carregar o leitor de PDF (a primeira vez precisa de conexão)'));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  return window.pdfjsLib;
}
async function lerPdf(file) {
  const lib = await carregarPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p), tc = await pg.getTextContent();
    const itens = tc.items.filter(i => i.str != null).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) }));
    linhas.push(...ES.agruparLinhas(itens));
  }
  return { linhas, paginas: doc.numPages };
}
async function escolherPdf(file) {
  msgEstoque('Lendo o PDF…');
  try {
    const { linhas, paginas } = await lerPdf(file);
    if (!linhas.length) return msgEstoque('Esse PDF não tem texto (parece uma foto/escaneado). Exporte o relatório em planilha (CSV/Excel) ou cadastre à mão.', true);
    rev = { origem: 'pdf', arquivo: file.name, paginas, linhas, qtdPos: 'auto' };
    reinterpretarRevisao();
    msgEstoque(`PDF lido: ${paginas} página(s), ${linhas.length} linha(s) de texto.`);
  } catch (e) { msgEstoque('Não consegui ler o PDF: ' + esc(e.message), true); }
}
async function escolherCsv(file) {
  try {
    const r = ES.estoqueDeTabela(ES.parseCSV(await lerTextoArquivo(file)));
    if (!r.itens.length) return msgEstoque(esc(r.erros[0] || 'Nenhuma linha reconhecida na planilha.'), true);
    rev = { origem: 'csv', arquivo: file.name, itens: r.itens, ignoradas: r.erros, cabecalho: true, maxNumericas: 1, qtdPos: 'auto' };
    rev.rows = r.itens.map(linhaDeRevisao);
    renderRevisao(); msgEstoque(`Planilha lida: ${r.itens.length} produto(s).`);
  } catch (e) { msgEstoque('Não consegui ler a planilha: ' + esc(e.message), true); }
}
function linhaDeRevisao(i) {
  return { ok: true, nome: i.nome, qtd: i.qtd, un: i.unidadeNorm || 'L', emb: '', embUn: 'L', bruto: i.bruto, conf: i.confianca, semUnidade: !i.unidadeNorm };
}
function reinterpretarRevisao() {
  const r = ES.interpretarEstoque(rev.linhas, { qtdPos: rev.qtdPos });
  Object.assign(rev, { itens: r.itens, ignoradas: r.ignoradas, cabecalho: r.cabecalho, maxNumericas: r.maxNumericas });
  rev.rows = r.itens.map(linhaDeRevisao);
  renderRevisao();
}
function renderRevisao() {
  const box = $('#estRevisao'); if (!rev) { box.innerHTML = ''; return; }
  const un = ['L', 'kg', 'mL', 'g', 't', 'un'];
  const escolha = rev.origem === 'pdf' && !rev.cabecalho && rev.maxNumericas > 1
    ? `<label>Qual número é a quantidade? <small class="muted">o PDF não tem cabeçalho de colunas</small><select id="estQtdPos"><option value="auto">automático (o número antes da unidade)</option>${[1, 2, 3, 4].filter(n => n <= rev.maxNumericas).map(n => `<option value="esq${n}">${n}º número, contando da esquerda</option><option value="dir${n}">${n}º número, contando da direita</option>`).join('')}</select></label>` : '';
  box.innerHTML = `<div class="subcard">
    <div class="sub-hd"><b>Conferir antes de importar</b><span class="hint">${esc(rev.arquivo)} · ${rev.rows.length} produto(s) reconhecido(s)${rev.ignoradas && rev.ignoradas.length ? ' · ' + rev.ignoradas.length + ' linha(s) ignorada(s)' : ''}</span></div>
    ${escolha}
    <div class="tabela-rolavel"><table class="tb" id="estRevTabela"><thead><tr><th></th><th>Produto</th><th class="num">Quantidade</th><th>Unidade</th><th>Linha do arquivo</th></tr></thead><tbody>${rev.rows.map((r, i) => `<tr class="${r.conf === 'baixa' ? 'linha-duvida' : ''}">
      <td><input type="checkbox" data-ri="${i}" data-rf="ok" ${r.ok ? 'checked' : ''} aria-label="Importar ${esc(r.nome)}"></td>
      <td><input data-ri="${i}" data-rf="nome" value="${esc(r.nome)}"></td>
      <td class="num"><input type="number" step="any" data-ri="${i}" data-rf="qtd" value="${r.qtd}"></td>
      <td><select data-ri="${i}" data-rf="un">${un.map(u => `<option ${u === r.un ? 'selected' : ''}>${u}</option>`).join('')}</select>${r.un === 'un' ? `<span class="emb"> × <input type="number" step="any" min="0" data-ri="${i}" data-rf="emb" value="${esc(r.emb)}" placeholder="tamanho" title="Quanto tem em cada unidade (ex.: 5 para um galão de 5 L)"><select data-ri="${i}" data-rf="embUn"><option ${r.embUn === 'L' ? 'selected' : ''}>L</option><option ${r.embUn === 'kg' ? 'selected' : ''}>kg</option></select></span>` : ''}${r.semUnidade ? ' <span class="tag noreg" title="O arquivo não trazia unidade reconhecida: confirme">unidade?</span>' : ''}</td>
      <td><small class="muted">${esc(r.bruto || '')}</small></td></tr>`).join('')}</tbody></table></div>
    <div class="grid2" style="margin-top:8px">
      <label class="check"><input type="radio" name="estModo" value="substituir" checked> O arquivo é o retrato do estoque agora: os saldos passam a ser estes</label>
      <label class="check"><input type="radio" name="estModo" value="somar"> Somar ao saldo que já existe (é uma entrada)</label>
    </div>
    <label class="check"><input type="checkbox" id="estZerar"> Zerar os produtos do estoque que não aparecem neste arquivo</label>
    ${rev.ignoradas && rev.ignoradas.length ? `<details class="small"><summary>Linhas ignoradas (${rev.ignoradas.length})</summary><div class="muted">${rev.ignoradas.slice(0, 40).map(t => esc(t)).join('<br>')}</div></details>` : ''}
    <div class="row-btns"><button type="button" class="btn primary" id="btnEstImportar">Importar ${rev.rows.filter(r => r.ok).length} produto(s)</button><button type="button" class="btn ghost" id="btnEstCancelar">Cancelar</button></div>
  </div>`;
  const pos = $('#estQtdPos'); if (pos) { pos.value = rev.qtdPos === 'auto' ? 'auto' : rev.qtdPos.lado + rev.qtdPos.n; pos.onchange = () => { const v = pos.value; rev.qtdPos = v === 'auto' ? 'auto' : { lado: v.slice(0, 3), n: +v.slice(3) }; reinterpretarRevisao(); }; }
  box.querySelectorAll('[data-rf]').forEach(el => el.onchange = () => {
    const r = rev.rows[+el.dataset.ri], f = el.dataset.rf;
    r[f] = f === 'ok' ? el.checked : f === 'qtd' ? num(el.value) : el.value;
    if (f === 'un') { r.semUnidade = false; renderRevisao(); } else if (f === 'ok') $('#btnEstImportar').textContent = `Importar ${rev.rows.filter(x => x.ok).length} produto(s)`;
  });
  $('#btnEstCancelar').onclick = () => { rev = null; renderRevisao(); msgEstoque(''); };
  $('#btnEstImportar').onclick = importarRevisao;
}
/* saldo passa a valer (ou soma) e cada mudança vira um movimento; unidade diferente da já cadastrada não é misturada */
function aplicarImportacaoEstoque(linhas, { modo, zerar, origem, arquivo }) {
  const obs = `${origem === 'pdf' ? 'PDF' : 'planilha'} ${arquivo}`, vistos = new Set(), conflitos = [];
  let novos = 0, alterados = 0;
  linhas.forEach(l => {
    vistos.add(norm(l.nome));
    let e = acharEstoque(l.nome);
    if (!e) { e = novoItemEstoque(l.nome, l.base, 0, origem); novos++; }
    if (e.unidade !== l.base) { conflitos.push(`${l.nome} (estoque em ${e.unidade}, arquivo em ${l.base})`); return; }
    const novo = modo === 'somar' ? e.qtd + l.qtd : l.qtd;
    if (arred4(novo - e.qtd)) { registrarMov(modo === 'somar' ? 'entrada' : 'inventario', e, novo - e.qtd, { obs }); alterados++; }
    e.qtd = arred4(novo); e.atualizado = new Date().toISOString(); e.fonte = origem;
  });
  let zerados = 0;
  if (zerar && modo !== 'somar') DB.estoque.forEach(e => { if (!vistos.has(norm(e.nome)) && e.qtd !== 0) { registrarMov('inventario', e, -e.qtd, { obs: obs + ' (não constava)' }); e.qtd = 0; zerados++; } });
  saveDB();
  return { novos, alterados, zerados, conflitos };
}
function importarRevisao() {
  if (!rev) return;
  const modo = document.querySelector('input[name="estModo"]:checked').value, zerar = $('#estZerar').checked;
  const agreg = new Map(), problemas = [];
  rev.rows.filter(r => r.ok && String(r.nome).trim()).forEach(r => {
    const b = ES.paraBase(r.qtd, r.un, { qtd: num(r.emb), unidade: r.embUn });
    if (!b) { problemas.push(`${r.nome}: informe o tamanho da unidade`); return; }
    const k = norm(r.nome) + '|' + b.base, a = agreg.get(k) || { nome: String(r.nome).trim(), base: b.base, qtd: 0 };
    a.qtd += b.qtd; agreg.set(k, a);
  });
  if (problemas.length) return msgEstoque('Falta informar: ' + esc(problemas.slice(0, 4).join(' · ')), true);
  if (!agreg.size) return msgEstoque('Nenhum produto marcado para importar.', true);
  const n = aplicarImportacaoEstoque([...agreg.values()], { modo, zerar, origem: rev.origem, arquivo: rev.arquivo });
  rev = null; renderRevisao(); refrescarTudo();
  msgEstoque(`Estoque atualizado: ${n.novos} produto(s) novo(s), ${n.alterados} saldo(s) alterado(s)${n.zerados ? ', ' + n.zerados + ' zerado(s)' : ''}.` + (n.conflitos.length ? ` <span class="danger-txt">Não misturei unidades: ${esc(n.conflitos.slice(0, 3).join(' · '))}</span>` : ''));
  toast('Estoque importado');
}
function exportarEstoqueCSV() {
  const linhas = [['Produto', 'Saldo', 'Unidade', 'Mínimo', 'Atualizado'], ...DB.estoque.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(e => [e.nome, ES.numCSV(e.qtd), e.unidade, ES.numCSV(e.minimo), e.atualizado ? dataBR(e.atualizado.slice(0, 10)) : ''])];
  download(`estoque-${hoje()}.csv`, '﻿' + ES.toCSV(linhas), 'text/csv;charset=utf-8');
}
function estoqueManual() {
  const nome = prompt('Nome do produto'); if (!nome || !nome.trim()) return;
  if (acharEstoque(nome)) return toast('Esse produto já está no estoque', 'err');
  const un = (prompt('Unidade do estoque: L ou kg', 'L') || '').trim().toLowerCase();
  if (un !== 'l' && un !== 'kg') return toast('Use L ou kg', 'err');
  const q = prompt(`Saldo atual de ${nome.trim()} (em ${un === 'l' ? 'L' : 'kg'})`, '0'); if (q === null) return;
  const e = novoItemEstoque(nome, un === 'l' ? 'L' : 'kg', num(q), 'manual');
  if (e.qtd) registrarMov('inventario', e, e.qtd, { obs: 'cadastro manual' });
  saveDB(); refrescarTudo();
}

/* ═════════════════ baixa automática por aplicação realizada ═════════════════ */
let bx = null; // diálogo de baixa aberto
/* análise silenciosa só para tirar do motor os perfis (ativos, MoA, carência) e o custo do registro */
function analisarParaRegistro(cfg, ha) {
  const opts = { cultura: cfg.cultura, equipamento: cfg.equipamento, volumeHa: cfg.volumeReal || cfg.volumeHa, area: ha, tanque: num($('#fTanque').value) || 2000,
    agua: { ph: DB.config.ph, dureza: DB.config.dureza, turbidez: 'limpa' }, regraFazenda: { acidificanteUltimo: !!DB.config.acidificanteUltimo },
    custoOperacional: DB.config.custo, historicoJar: DB.jarTests, kbVersao: KB.versao, data: agora() };
  try { return E.analisar(cfg.itens.map(i => ({ ...i })), opts); } catch (e) { return { status: 'testar', itens: [], custo: null, resumo: { frase: '' } }; }
}
function registroRealizado(cfg, res, ha, litros, data, rid) {
  const c = res.custo || {};
  return {
    data: agora(), iso: new Date().toISOString(), quando: data, codigo: null, status: res.status, aplicada: true, chave: chaveDeItens(cfg.cultura, cfg.volumeHa, cfg.itens),
    cultura: cfg.cultura, area: ha, volumeHa: cfg.volumeReal || cfg.volumeHa, equip: cfg.equipamento,
    produtos: cfg.itens.map(i => i.nome), itens: cfg.itens.map(i => ({ nome: i.nome, dose: i.dose, unidade: i.unidade, lote: i.lote || '' })),
    perfis: (res.itens || []).map(perfilProduto), alvos: cfg.alvos || '', resumo: 'Registrada como realizada (baixa do estoque)',
    rast: { operador: '', maquina: '', receituario: '', responsavel: '', crea: '', inicio: '', termino: '', ...(cfg.rast || {}) },
    custoHa: c.totalHa != null ? arred2(c.totalHa) : null, custo: c.totalHa != null ? arred2(c.totalHa * ha) : null, semPreco: (c.semPreco || []).length,
    litros: arred4(litros), realizacaoId: rid
  };
}
/* grava a aplicação no histórico do talhão; se já havia uma análise igual ainda "só análise", ela vira a aplicada */
function registrarNoTalhao(nome, ha, reg, unico) {
  let t = achaTalhao(nome);
  if (!t) { t = { nome, area: unico ? ha : 0, cultura: reg.cultura, fonte: 'manual', aplicacoes: [] }; DB.talhoes.push(t); }
  t.aplicacoes = t.aplicacoes || [];
  const r = { ...reg, area: ha, custo: reg.custoHa != null ? arred2(reg.custoHa * ha) : null, litros: arred4((reg.litros || 0) * (ha / (reg.area || ha || 1))) };
  const ja = t.aplicacoes.find(a => a.chave === r.chave && !a.aplicada);
  let ref;
  if (ja) { ref = { id: ja.id, criado: false, antes: { ...ja } }; Object.assign(ja, r, { id: ja.id }); }
  else { const novo = { id: uid(), ...r }; t.aplicacoes.unshift(novo); ref = { id: novo.id, criado: true }; }
  t.aplicacoes = t.aplicacoes.slice(0, 100);
  return { nome: t.nome, ha, ref };
}
function ratearHa(nomes, ha) {
  const areas = nomes.map(n => (achaTalhao(n) || {}).area || 0), soma = areas.reduce((s, a) => s + a, 0);
  return nomes.map((n, i) => ({ nome: n, ha: arred4(ha * (soma > 0 ? areas[i] / soma : 1 / nomes.length)) }));
}
/* cfg: {itens, volumeHa, cultura, equipamento, talhoes:[nomes], tarefaId, receitaNome, litros, data, alvos, rast} */
function abrirBaixa(cfg) {
  if (!cfg.itens || !cfg.itens.length) return toast('A receita não tem produtos', 'err');
  bx = { ...cfg, sel: {}, data: cfg.data || hoje(), vol: +cfg.volumeHa > 0 ? +cfg.volumeHa : 0, litros: +cfg.litros > 0 ? +cfg.litros : 0, ha: 0 };
  if (bx.vol > 0 && bx.litros > 0) bx.ha = arred4(bx.litros / bx.vol);
  const tar = tarefasEmAberto();
  abrirModal(`<h2>Registrar aplicação realizada</h2>
    <p class="small muted">Receita: <b>${esc(cfg.receitaNome || 'calda')}</b>. A baixa do estoque é a dose por hectare × os hectares pulverizados (litros de calda ÷ volume por hectare).</p>
    <div class="grid2">
      <label>Data da aplicação<input type="date" id="bxData" value="${esc(bx.data)}"></label>
      <label>Tarefa programada<select id="bxTarefa"><option value="">— nenhuma —</option>${tar.map(t => `<option value="${esc(t.id)}" ${t.id === cfg.tarefaId ? 'selected' : ''}>${esc(t.titulo)} · ${dataBR(t.dataPrev)}</option>`).join('')}</select></label>
      <label>Litros de calda pulverizados<input type="number" id="bxLitros" min="0" step="any" value="${bx.litros || ''}" placeholder="ex.: 3000"></label>
      <label>Volume de calda (L/ha)<input type="number" id="bxVol" min="1" step="1" value="${bx.vol || ''}"></label>
      <label>Hectares realizados<input type="number" id="bxHa" min="0" step="any" value="${bx.ha || ''}"></label>
    </div>
    <div id="bxTalhoes" class="small" style="margin:6px 0"></div>
    <div class="tabela-rolavel"><table class="tb" id="bxTabela"></table></div>
    <div id="bxAvisos"></div>
    <div class="row-btns"><button type="button" class="btn primary" id="bxOk">Confirmar e baixar do estoque</button><button type="button" class="btn ghost" id="bxCancela">Cancelar</button></div>`);
  $('#bxLitros').oninput = () => bxRecalcular('litros'); $('#bxHa').oninput = () => bxRecalcular('ha'); $('#bxVol').oninput = () => bxRecalcular('vol');
  $('#bxCancela').onclick = () => { bx = null; closeModal(); }; $('#bxOk').onclick = confirmarBaixa;
  bxRecalcular('ini');
}
function bxSugerido(l) { // item do estoque que combina com o produto e tem a mesma unidade-base
  const c = ES.casarProduto(l.nome, DB.estoque, DB.mapEstoque);
  return c.item && c.item.unidade === l.base ? c.item.id : '';
}
function bxRecalcular(origem) {
  if (!bx) return;
  const vol = num($('#bxVol').value), litros = num($('#bxLitros').value), ha = num($('#bxHa').value);
  if (vol > 0) {
    if (origem === 'ha') { const l = arred4(ha * vol); $('#bxLitros').value = l || ''; bx.litros = l; bx.ha = ha; }
    else if (origem === 'litros' || origem === 'vol') { const h = arred4(litros / vol); $('#bxHa').value = h || ''; bx.litros = litros; bx.ha = h; }
    else { bx.litros = litros; bx.ha = ha || (litros ? arred4(litros / vol) : 0); }
  } else { bx.litros = litros; bx.ha = ha; }
  bx.vol = vol;
  bx.b = ES.baixaDaReceita({ itens: bx.itens, volumeHa: vol, litros: bx.litros, ha: bx.ha });
  bx.rateio = bx.talhoes && bx.talhoes.length && bx.b.ha > 0 ? ratearHa(bx.talhoes, bx.b.ha) : [];
  $('#bxTalhoes').innerHTML = bx.talhoes && bx.talhoes.length
    ? (bx.rateio.length ? 'Vai para o histórico de: ' + bx.rateio.map(r => `<b>${esc(r.nome)}</b> ${fmt(r.ha, 2)} ha`).join(' · ') : 'Talhões: ' + esc(bx.talhoes.join(', ')))
    : '<span class="muted">Nenhum talhão marcado: só o estoque será baixado (marque o talhão na aba Calda para alimentar o histórico).</span>';
  const linhas = bx.b.linhas;
  linhas.forEach((l, i) => { if (bx.sel[i] === undefined) bx.sel[i] = bxSugerido(l); });
  const avisos = [];
  $('#bxTabela').innerHTML = `<thead><tr><th>Produto</th><th class="num">Dose</th><th class="num">A baixar</th><th>Item do estoque</th><th class="num">Saldo depois</th></tr></thead><tbody>${linhas.map((l, i) => {
    const e = DB.estoque.find(x => x.id === bx.sel[i]), depois = e ? arred4(e.qtd - l.qtd) : null;
    if (e && depois < -1e-9) avisos.push(`<b>${esc(l.nome)}</b>: faltam ${fmtQtd(-depois, e.unidade)} no estoque`);
    const opts = DB.estoque.filter(x => x.unidade === l.base).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(x => `<option value="${esc(x.id)}" ${x.id === bx.sel[i] ? 'selected' : ''}>${esc(x.nome)} (${fmt(x.qtd, 2)} ${x.unidade})</option>`).join('');
    return `<tr><td>${esc(l.nome)}</td><td class="num">${fmt(l.dose, 3)} ${esc(l.unidadeDose)}</td><td class="num"><b>${fmtQtd(l.qtd, l.base)}</b></td><td><select data-bxs="${i}"><option value="">não controlar</option>${opts}</select></td><td class="num ${depois !== null && depois < -1e-9 ? 'danger-txt' : ''}">${e ? fmtQtd(depois, e.unidade) : '—'}</td></tr>`;
  }).join('')}</tbody>`;
  $('#bxTabela').querySelectorAll('[data-bxs]').forEach(s => s.onchange = () => { bx.sel[+s.dataset.bxs] = s.value; bxRecalcular('sel'); });
  const semItem = linhas.filter((l, i) => !bx.sel[i]).length;
  if (!(bx.b.ha > 0)) avisos.unshift('Informe os <b>litros de calda pulverizados</b> (ou os hectares) e o volume por hectare.');
  if (semItem && DB.estoque.length) avisos.push(`${semItem} produto(s) sem item de estoque não serão baixados.`);
  if (!DB.estoque.length) avisos.push('O estoque está vazio: suba o PDF do estoque na aba Estoque para as baixas acontecerem.');
  $('#bxAvisos').innerHTML = avisos.map(a => `<div class="al media"><div class="d">${a}</div></div>`).join('');
}
function confirmarBaixa() {
  if (!bx || !bx.b || !(bx.b.ha > 0)) return toast('Informe os litros de calda pulverizados', 'err');
  const data = $('#bxData').value || hoje(), tarefaId = $('#bxTarefa').value || null, b = bx.b;
  const linhas = b.linhas.map((l, i) => ({ ...l, estoqueId: bx.sel[i] || null }));
  const faltas = linhas.map(l => ({ l, e: l.estoqueId ? DB.estoque.find(x => x.id === l.estoqueId) : null })).filter(x => x.e && x.e.qtd - x.l.qtd < -1e-9);
  if (faltas.length && !confirm('Estoque insuficiente para: ' + faltas.map(x => `${x.l.nome} (faltam ${fmtQtd(x.l.qtd - x.e.qtd, x.e.unidade)})`).join(', ') + '.\nRegistrar mesmo assim? O saldo ficará negativo.')) return;
  const rid = uid(), talTxt = bx.rateio.length ? ' · ' + bx.rateio.map(r => r.nome).join(', ') : '';
  linhas.forEach(l => {
    const e = l.estoqueId ? DB.estoque.find(x => x.id === l.estoqueId) : null;
    if (!e || !(l.qtd > 0)) return;
    const m = registrarMov('baixa', e, -l.qtd, { realizacaoId: rid, dia: data, obs: `${bx.receitaNome || 'calda'} · ${fmt(b.litros, 0)} L de calda${talTxt}` });
    e.qtd = arred4(e.qtd - l.qtd); e.atualizado = new Date().toISOString(); l.movId = m.id; DB.mapEstoque[norm(l.nome)] = e.id;
  });
  const cfgReg = { ...bx, volumeReal: bx.vol }, res = analisarParaRegistro(cfgReg, b.ha), reg = registroRealizado(cfgReg, res, b.ha, b.litros, data, rid);
  const tal = bx.rateio.map(r => registrarNoTalhao(r.nome, r.ha, reg, bx.rateio.length === 1));
  DB.realizacoes.unshift({ id: rid, tarefaId, data, litros: b.litros, ha: b.ha, volumeHa: b.volumeHa, receitaNome: bx.receitaNome || '', cultura: bx.cultura, itens: linhas, talhoes: tal, criadaEm: new Date().toISOString() });
  if (DB.realizacoes.length > 500) DB.realizacoes.length = 500;
  saveDB(); const n = linhas.filter(l => l.movId).length; bx = null; closeModal(); refrescarTudo();
  toast(`Aplicação registrada: ${fmt(b.litros, 0)} L de calda (${fmt(b.ha, 2)} ha)${n ? ' · ' + n + ' produto(s) baixado(s) do estoque' : ''}`);
}
/* desfaz a realização: devolve os produtos ao estoque e tira (ou restaura) o que ela gravou nos talhões */
function estornarRealizacao(id) {
  const r = DB.realizacoes.find(x => x.id === id); if (!r || r.estornada) return;
  if (!confirm(`Desfazer a aplicação de ${dataBR(r.data)} (${fmt(r.litros, 0)} L de calda)? Os produtos voltam ao estoque e o registro sai do histórico dos talhões.`)) return;
  r.itens.forEach(l => {
    if (!l.movId) return;
    const e = DB.estoque.find(x => x.id === l.estoqueId), m = DB.movEstoque.find(x => x.id === l.movId);
    if (m) m.estornado = true;
    if (e) { registrarMov('estorno', e, l.qtd, { realizacaoId: id, obs: 'aplicação desfeita' }); e.qtd = arred4(e.qtd + l.qtd); e.atualizado = new Date().toISOString(); }
  });
  (r.talhoes || []).forEach(x => {
    const t = achaTalhao(x.nome); if (!t || !x.ref) return;
    if (x.ref.criado) t.aplicacoes = (t.aplicacoes || []).filter(a => a.id !== x.ref.id);
    else { const i = (t.aplicacoes || []).findIndex(a => a.id === x.ref.id); if (i >= 0) t.aplicacoes[i] = x.ref.antes; }
  });
  r.estornada = true; saveDB(); refrescarTudo(); toast('Aplicação desfeita: estoque e histórico restaurados');
}
/* botão da aba Calda: registra a calda montada como realizada */
function realizadoDaCalda() {
  if (!calda.itens.length) return toast('Monte a calda primeiro', 'err');
  const ctx = lerContexto(), chave = chaveDeItens(ctx.cultura, ctx.volumeHa, calda.itens);
  const igual = tarefasEmAberto().find(t => t.chave === chave);
  abrirBaixa({ itens: calda.itens.map(i => ({ ...i })), volumeHa: ctx.volumeHa, cultura: ctx.cultura, equipamento: ctx.equipamento, talhoes: talhoesSel.slice(),
    tarefaId: igual ? igual.id : null, receitaNome: caldaComoReceita().nome, litros: ctx.area > 0 && ctx.volumeHa > 0 ? ctx.area * ctx.volumeHa : 0,
    data: hoje(), alvos: textoAlvos(ctx.alvos, true).join(', '), rast: ctx.rastreio });
}

function initEstoqueUI() {
  $('#estPdf').onchange = e => { const f = e.target.files[0]; if (f) escolherPdf(f); e.target.value = ''; };
  $('#estCsv').onchange = e => { const f = e.target.files[0]; if (f) escolherCsv(f); e.target.value = ''; };
  $('#btnEstManual').onclick = estoqueManual; $('#btnEstCSV').onclick = exportarEstoqueCSV;
  $('#estFiltro').oninput = renderEstoque;
  $('#btnRealizado').onclick = realizadoDaCalda;
  ['#fArea', '#fVolume'].forEach(s => $(s).addEventListener('change', () => renderItens()));
  renderEstoque(); renderMovs(); renderNecessidade(); renderItens();
}
