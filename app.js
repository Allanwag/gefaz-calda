'use strict';
/* ═══════════════════════════════════════════════════════════════════
   Gefaz Calda — app.js (interface, armazenamento, integração)
   Motor em engine.js; conhecimento em kb.js; índice Agrofit em data/.
   ═══════════════════════════════════════════════════════════════════ */
const LS = 'gefazcalda_v1';
const KB = window.GC_KB, E = window.GCEngine;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const fmt = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const agora = () => new Date().toLocaleString('pt-BR');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const norm = E.norm;

/* ───────── armazenamento ───────── */
let DB;
function defaultDB() {
  return { version: 1, config: { ph: 7.5, dureza: null, cultura: 'Café', equipamento: 'turbo', volumeHa: 400, custo: { barra: 60, turbo: 90, drone: 120, costal: 40, aviao: 110, 'herbicida-cafe': 55 }, acidificanteUltimo: false, fazenda: 'Fazenda', rastreio: { maquina: '', operador: '', responsavel: '', crea: '' }, backup: { ultimo: null, lembrarDias: 7, adiadoAte: null }, meta: { pct: 100, de: '', ate: '' } }, catalogo: [], receitas: [], talhoes: [], caldas: [], historico: [], jarTests: [], regulagens: [], pontasLivres: [], estoque: [], movEstoque: [], tarefas: [], realizacoes: [], meusProdutos: [], intervalos: {}, carencias: {}, maxAplic: {}, reentradas: {}, fichaNomes: {}, mapEstoque: {} };
}
const DB_LISTAS = ['catalogo', 'receitas', 'talhoes', 'caldas', 'historico', 'jarTests', 'regulagens', 'pontasLivres', 'estoque', 'movEstoque', 'tarefas', 'realizacoes', 'meusProdutos'];
const DB_MAPAS = ['intervalos', 'carencias', 'maxAplic', 'reentradas', 'fichaNomes', 'mapEstoque'];
/* completa o que faltar num banco antigo, importado ou restaurado de backup */
function normalizarDB() {
  const d = defaultDB();
  if (!DB || !DB.version) DB = d;
  DB.config = { ...d.config, ...(DB.config || {}) };
  ['custo', 'rastreio', 'backup', 'meta'].forEach(k => { DB.config[k] = { ...d.config[k], ...(DB.config[k] || {}) }; });
  DB_LISTAS.forEach(k => { if (!Array.isArray(DB[k])) DB[k] = []; });
  DB.meusProdutos = DB.meusProdutos.filter(p => p && typeof p.nome === 'string' && p.nome.trim() && p.id); // backup/edição à mão com lixo não derruba a busca
  DB_MAPAS.forEach(k => { if (!DB[k] || typeof DB[k] !== 'object' || Array.isArray(DB[k])) DB[k] = {}; });
}
function loadDB() { try { DB = JSON.parse(localStorage.getItem(LS)) || null; } catch { DB = null; } normalizarDB(); }
function saveDB() { try { localStorage.setItem(LS, JSON.stringify(DB)); } catch (e) { toast('Não foi possível salvar (armazenamento cheio?)', 'err'); } }

/* ───────── estado da calda ───────── */
let calda = { itens: [], obs: '' };
let resultado = null;
/* resumo barato dos talhões (nome, área, ciclo e, por aplicação, id + situação + data) para notar mudança sem serializar o histórico a cada tecla */
function digestTalhoes() { return DB.talhoes.map(t => [t.nome, t.area, t.cultura, t.cicloInicio, (t.aplicacoes || []).map(a => [a.id, a.aplicada, a.quando])]); }
let assinaturaResultado = null;
function assinaturaDaAnalise() {
  return JSON.stringify([calda.itens, lerContexto(), regulagemDoLaudo(), DB.config.custo,
    DB.config.acidificanteUltimo, DB.jarTests, digestTalhoes()]);
}
function invalidarResultado() {
  resultado = null; assinaturaResultado = null;
  clearInterval(jarTimer); jarTimer = null; jarStart = null;
  const aviso = '<div class="card">A calda ou o contexto mudou. Clique em “Analisar compatibilidade” na aba Calda para atualizar o laudo e o jar test.</div>';
  $('#resultado').innerHTML = aviso; $('#jar').innerHTML = aviso;
}
function conferirResultadoAtual() {
  if (resultado && assinaturaResultado !== assinaturaDaAnalise()) invalidarResultado();
  return !!resultado;
}
let AGRO = null; // índice Agrofit
let agroBusca = [];

/* ───────── UI básica ───────── */
let toastT = null;
function toast(msg, cls = '') { const el = $('#toast'); el.textContent = msg; el.className = 'toast ' + cls; clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 3200); }
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function navTo(tab) { conferirResultadoAtual(); $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab)); $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); window.scrollTo(0, 0); }
function download(nome, conteudo, tipo = 'application/json') { const b = new Blob([conteudo], { type: tipo }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ───────── Agrofit ───────── */
async function carregarAgrofit() {
  const st = $('#agroStatus');
  try {
    const r = await fetch('data/agrofit-index.json'); if (!r.ok) throw new Error(r.status);
    AGRO = await r.json();
    agroBusca = AGRO.produtos.map(p => ({ p, txt: norm(p.m + ' ' + p.ia.map(x => x[0]).join(' ')) }));
    st.textContent = `Agrofit ✔ ${AGRO.produtos.length.toLocaleString('pt-BR')}`; st.title = `Índice AGROFIT/MAPA gerado em ${AGRO.gerado} — ${AGRO.produtos.length} produtos com registro ativo`; st.className = 'pill ok';
    atualizarAlvos();
  } catch (e) { st.textContent = 'Agrofit indisponível'; st.className = 'pill bad'; }
}
function classeAgrofit(cl, iaTxt) {
  const c = norm(cl), ia = norm(iaTxt);
  const tags = [];
  if (/microbiol|biolog|agente/.test(c) || /bacillus|beauveria|metarhizium|trichoderma|baculovirus|virus|cordyceps|isaria|heterorhabditis|steinernema|nematoide/.test(ia)) {
    tags.push('biologico');
    if (/beauveria|metarhizium|trichoderma|cordyceps|isaria|paecilomyces|purpureocillium|pochonia/.test(ia)) tags.push('biologico-fungo');
    else if (/bacillus|pseudomonas|streptomyces|azospirillum|bradyrhizobium/.test(ia)) tags.push('biologico-bacteria');
    else if (/virus|baculovirus|npv|vpn/.test(ia)) tags.push('biologico-virus');
    return { classe: 'Bioracional', tags };
  }
  if (/cobre|cupros|cuprico/.test(ia)) return { classe: 'Cúprico', tags };
  if (/herbicida/.test(c)) return { classe: 'Herbicida', tags };
  if (/fungicida|bactericida/.test(c)) return { classe: 'Fungicida', tags };
  if (/nematicida/.test(c) && !/inseticida|acaricida/.test(c)) return { classe: 'Nematicida', tags };
  if (/acaricida/.test(c) && !/inseticida/.test(c)) return { classe: 'Acaricida', tags };
  if (/inseticida|cupinicida|formicida/.test(c)) return { classe: 'Inseticida', tags };
  return { classe: 'Outro', tags };
}
function itemDeAgrofit(p) {
  const nomes = p.m.split(';').map(s => s.trim()).filter(Boolean);
  const iaTxt = p.ia.map(x => x[0]).join(' + ');
  const cls = classeAgrofit(p.cl, iaTxt);
  const registro = { culturas: p.c.map(i => AGRO.culturas[i]), alvos: Object.fromEntries(Object.entries(p.a).map(([ci, arr]) => [AGRO.culturas[+ci], arr.map(i => AGRO.alvos[i])])) };
  const it = { id: uid(), nome: nomes[0], nomesAlt: nomes.slice(1), dose: 0, unidade: 'L/ha', classe: cls.classe, formulacao: p.f, ingredientes: p.ia.map(x => x[0] + (x[1] ? ' (' + x[1] + ')' : '')), concentracao: p.ia.map(x => x[2]).join(' + '), tags: cls.tags, registro, agrofit: { r: p.r, tit: p.tit, tox: p.tox, cl: p.cl }, fonte: 'agrofit', preco: 0 };
  if (/kg|g\b/.test(norm(p.ia[0] ? p.ia[0][2] : '')) && /WG|WP|SG|SP|GR/.test(p.f)) it.unidade = 'kg/ha';
  if (cls.tags.includes('biologico') && !E.resolverAtivos(it).length) it.ativos = ['bio-generico'];
  return it;
}
function buscarAgrofit(q) {
  if (!AGRO) return [];
  const toks = norm(q).split(' ').filter(t => t.length > 1); if (!toks.length) return [];
  const cult = norm($('#fCultura').value);
  const ci = AGRO.culturas.findIndex(c => norm(c) === cult), todas = AGRO.culturas.findIndex(c => norm(c) === 'todas as culturas');
  const res = [];
  for (const { p, txt } of agroBusca) {
    if (!toks.every(t => txt.includes(t))) continue;
    const reg = p.c.includes(ci) || p.c.includes(todas);
    const score = (norm(p.m).startsWith(toks[0]) ? 2 : 0) + (reg ? 1 : 0);
    res.push({ p, reg, score }); if (res.length > 400) break;
  }
  return res.sort((a, b) => b.score - a.score || a.p.m.localeCompare(b.p.m)).slice(0, 25);
}
/* ───────── alvos: doenças · insetos · ácaros e outras pragas · plantas daninhas ───────── */
const CATS_ALVO = E.CATEGORIAS_ALVO;
let alvosSel = { doenca: [], inseto: [], praga: [], daninha: [] };
let alvosCat = { doenca: [], inseto: [], praga: [], daninha: [] };
let catAlvoAgro = null;
const MAX_CAMPOS_ALVO = 30;
let alvosVazios = { doenca: 1, inseto: 1, praga: 1, daninha: 1 };
function montarAlvos() {
  $('#alvosGrid').innerHTML = CATS_ALVO.map(c => `<div class="alvo-grupo" data-cat="${c.id}">
      <b><span>${c.icone} ${esc(c.nome)}</span><small id="n-${c.id}"></small></b>
      <div class="alvo-rows" id="rows-${c.id}"></div>
      <datalist id="dl-${c.id}"></datalist>
      <div class="chips alvo-chips" id="ch-${c.id}"></div>
      <button type="button" class="btn sm ghost alvo-mais" data-mais="${c.id}">＋ Adicionar campo</button></div>`).join('');
  const grid = $('#alvosGrid');
  grid.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.mais) { const c = b.dataset.mais; alvosVazios[c] = Math.min(MAX_CAMPOS_ALVO, alvosVazios[c] + 1); renderAlvos(c); return; }
    if (b.dataset.rm) { const [c, i] = b.dataset.rm.split(':'); alvosSel[c].splice(+i, 1); renderAlvos(c); return; }
    if (b.dataset.rmv) { const c = b.dataset.rmv; alvosVazios[c] = Math.max(1, alvosVazios[c] - 1); renderAlvos(c); return; }
    if (b.dataset.ok) { const c = b.dataset.ok, inp = b.previousElementSibling; confirmarVazio(c, inp, true); }
  };
  grid.onchange = ev => {
    const inp = ev.target; if (inp.tagName !== 'INPUT') return;
    const c = inp.dataset.cat; if (!c) return;
    if (inp.dataset.i != null) editarAlvo(c, +inp.dataset.i, inp);
    else confirmarVazio(c, inp, false);
  };
  grid.onkeydown = ev => {
    if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
    ev.preventDefault();
    const inp = ev.target, c = inp.dataset.cat;
    if (inp.dataset.i != null) inp.blur(); else confirmarVazio(c, inp, true);
  };
}
/* campo em branco: só entra o que está na lista da cultura (ou qualquer texto com Enter/＋) */
function confirmarVazio(cat, inp, livre) {
  const v = inp.value.trim(); if (!v) return;
  if (!adicionarAlvo(cat, v, livre)) return;
  alvosVazios[cat] = Math.max(1, alvosVazios[cat] - 1);
  renderAlvos(cat, true);
}
/* campo já preenchido: troca o nome sem redesenhar (não perde o foco de quem clicou em outro botão) */
function editarAlvo(cat, i, inp) {
  const v = inp.value.trim();
  if (!v) { alvosSel[cat].splice(i, 1); renderAlvos(cat); return; }
  const nome = acharNoCatalogo(cat, v) || v;
  if (alvosSel[cat].some((x, j) => j !== i && norm(x) === norm(nome))) { alvosSel[cat].splice(i, 1); renderAlvos(cat); return; }
  alvosSel[cat][i] = nome; inp.value = nome; atualizarContagemAlvos();
}
function acharNoCatalogo(cat, texto) {
  const n = norm(texto), lista = alvosCat[cat] || [];
  const exato = lista.find(x => norm(x) === n);
  if (exato) return exato;
  const parecidos = lista.filter(x => E.alvoCombina(texto, x));
  return parecidos.length === 1 ? parecidos[0] : null;
}
function adicionarAlvo(cat, texto, livre) {
  const nome = acharNoCatalogo(cat, texto) || (livre ? texto.trim() : null);
  if (!nome) return false;
  if (!alvosSel[cat].some(x => norm(x) === norm(nome))) { alvosSel[cat].push(nome); renderAlvos(); }
  return true;
}
function catDoAlvo(nome) {
  for (const c of CATS_ALVO) if (acharNoCatalogo(c.id, nome)) return c.id;
  if (AGRO && catAlvoAgro) { const i = AGRO.alvos.findIndex(a => E.alvoCombina(nome, a)); if (i >= 0) return catAlvoAgro[i]; }
  return E.categoriaPorNome(nome) || 'praga';
}
function atualizarContagemAlvos() {
  CATS_ALVO.forEach(c => {
    const n = alvosCat[c.id].length, k = alvosSel[c.id].length;
    $('#n-' + c.id).textContent = [k ? k + (k > 1 ? ' marcados' : ' marcado') : '', n ? n + ' na cultura' : ''].filter(Boolean).join(' · ');
  });
}
/* um campo por alvo marcado + campos em branco (botão "Adicionar campo"); só = grupo a redesenhar, foco = focar o 1º campo em branco */
function renderAlvos(so, foco) {
  CATS_ALVO.filter(c => !so || c.id === so).forEach(c => {
    const cheios = alvosSel[c.id].map((n, i) => `<div class="alvo-row"><input list="dl-${c.id}" value="${esc(n)}" data-cat="${c.id}" data-i="${i}" autocomplete="off" aria-label="${esc(c.nome)} ${i + 1}"><button type="button" class="btn sm ghost" data-rm="${c.id}:${i}" title="Remover" aria-label="Remover ${esc(n)}">×</button></div>`);
    const vazios = Array.from({ length: alvosVazios[c.id] }, (_, j) => `<div class="alvo-row"><input list="dl-${c.id}" data-cat="${c.id}" placeholder="${esc(c.dica)}" autocomplete="off" aria-label="${esc(c.nome)} (novo)"><button type="button" class="btn sm" data-ok="${c.id}" title="Adicionar" aria-label="Adicionar ${esc(c.nome)}">＋</button>${alvosVazios[c.id] > 1 ? `<button type="button" class="btn sm ghost" data-rmv="${c.id}" title="Tirar este campo" aria-label="Tirar campo em branco">×</button>` : ''}</div>`);
    $('#rows-' + c.id).innerHTML = cheios.concat(vazios).join('');
    $('#ch-' + c.id).innerHTML = alvosSel[c.id].map((n, i) => `<span class="chip sel" title="${esc(n)}">${esc(n)}<button type="button" data-rm="${c.id}:${i}" aria-label="Remover ${esc(n)}">×</button></span>`).join('');
    $('[data-mais="' + c.id + '"]').disabled = alvosVazios[c.id] >= MAX_CAMPOS_ALVO;
    if (foco) { const v = $('#rows-' + c.id + ' input:not([data-i])'); if (v) v.focus(); }
  });
  atualizarContagemAlvos();
}
function definirAlvos(sel) {
  alvosSel = { doenca: [], inseto: [], praga: [], daninha: [] };
  alvosVazios = { doenca: 1, inseto: 1, praga: 1, daninha: 1 };
  const ja = new Set();
  CATS_ALVO.forEach(c => ((sel || {})[c.id] || []).forEach(n => { if (String(n).trim() && !ja.has(c.id + norm(n))) { ja.add(c.id + norm(n)); alvosSel[c.id].push(String(n).trim()); } }));
  renderAlvos();
}
function alvosLegados(c) {
  if (c.alvos && typeof c.alvos === 'object') return c.alvos;
  const sel = { doenca: [], inseto: [], praga: [], daninha: [] };
  E.alvosLista(c).forEach(a => { const cat = a.cat || catDoAlvo(a.nome); sel[cat].push(acharNoCatalogo(cat, a.nome) || a.nome); });
  return sel;
}
function textoAlvos(sel, curto) {
  const base = n => String(n).replace(/\s*\([^()]*\)\s*$/, '').trim() || n;
  return CATS_ALVO.map(c => (sel[c.id] || []).map(n => curto ? base(n) : n)).flat();
}
function atualizarAlvos() { atualizarListasCultura(); }
function atualizarListasCultura() {
  const cultura = $('#fCultura').value;
  const lista = (KB.alvosCultura || {})[cultura] || { doencas: [], pragas: [], estadios: [] };
  const opts = arr => arr.map(x => `<option value="${esc(x)}">`).join('');
  if (AGRO && !catAlvoAgro) catAlvoAgro = E.classificarAlvos(AGRO);
  alvosCat = E.alvosDaCultura(AGRO, catAlvoAgro, cultura, lista);
  CATS_ALVO.forEach(c => { const dl = $('#dl-' + c.id); if (dl) dl.innerHTML = opts(alvosCat[c.id]); });
  $('#dlEstadios').innerHTML = opts(lista.estadios);
  if ($('#alvosGrid').children.length) renderAlvos();
}

/* ───────── busca unificada ───────── */
function buscarKB(q) {
  const n = norm(q); if (n.length < 2) return [];
  const out = [];
  KB.comerciais.forEach(c => { if (c.alias.some(a => norm(a).includes(n)) || norm(c.nome).includes(n)) out.push({ tipo: 'kb', nome: c.nome, sub: c.nota || c.funcao, item: { nome: c.nome, classe: c.classe, formulacao: c.formulacao, unidade: 'mL/100L', dose: 0, fonte: 'kb' } }); });
  Object.entries(KB.ativos).forEach(([k, a]) => { if (a.alias.some(al => norm(al).includes(n))) out.push({ tipo: 'kb', nome: a.nome, sub: `${a.classe} · ${a.grupo}${a.moa ? ' · ' + a.moa.sistema + ' ' + a.moa.codigo : ''}`, item: { nome: a.nome, classe: a.classe, formulacao: a.formulacao || '', unidade: a.classe === 'Adjuvante' || a.classe === 'Fertilizante Foliar' ? 'mL/100L' : 'L/ha', dose: 0, ativos: [k], fonte: 'kb' } }); });
  return out.slice(0, 12);
}
function buscarCatalogo(q) {
  const n = norm(q); if (n.length < 2) return [];
  return DB.catalogo.filter(p => norm(p.nome).includes(n)).slice(0, 10).map(p => ({ tipo: 'cat', nome: p.nome, sub: `${p.classe || '—'} · ${p.fonte} · ${p.preco ? BRL(p.preco) + '/' + p.unidade : 'sem preço'}`, item: { nome: p.nome, classe: p.classe, unidade: (p.unidade || 'L') + '/ha', dose: 0, preco: p.preco, fonte: p.fonte } }));
}
function renderBusca(q) {
  const box = $('#buscaRes');
  if (norm(q).length < 2) { box.classList.add('hidden'); return; }
  const meus = typeof buscarMeus === 'function' ? buscarMeus(q) : [];
  const cat = buscarCatalogo(q), kb = buscarKB(q), agro = buscarAgrofit(q);
  const html = [];
  meus.forEach((r, i) => html.push(`<button type="button" class="it" data-src="meu" data-i="${i}"><span><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small></span><span class="src meu">meu produto</span></button>`));
  cat.forEach((r, i) => html.push(`<button type="button" class="it" data-src="cat" data-i="${i}"><span><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small></span><span class="src cat">catálogo</span></button>`));
  kb.forEach((r, i) => html.push(`<button type="button" class="it" data-src="kb" data-i="${i}"><span><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small></span><span class="src kb">base</span></button>`));
  agro.forEach((r, i) => html.push(`<button type="button" class="it" data-src="agro" data-i="${i}"><span><b>${esc(r.p.m.split(';')[0])}</b><small>${esc(r.p.ia.map(x => x[0].split(' (')[0] + (x[2] ? ' ' + x[2] : '')).join(' + '))} · ${esc(r.p.f || '?')} · ${esc(r.p.cl)}</small></span><span class="src agro">${r.reg ? '✔ ' + esc($('#fCultura').value) : 'Agrofit'}</span></button>`));
  if (!html.length) html.push('<div class="it"><small>Nada encontrado na base.</small></div>');
  // sempre por último: produto que a base não tem (foliar, adjuvante…) entra para Meus produtos e não precisa ser cadastrado de novo
  if (typeof abrirFormProduto === 'function') html.push(`<button type="button" class="it" data-src="novo"><span><b>＋ Cadastrar “${esc(q.trim())}”</b><small>fica guardado em Meus produtos para as próximas caldas</small></span><span class="src meu">novo</span></button>`);
  box.innerHTML = html.join(''); box.classList.remove('hidden');
  box.querySelectorAll('.it[data-src]').forEach(el => el.onclick = () => {
    const src = el.dataset.src, i = +el.dataset.i;
    if (src === 'novo') formManual({ nome: q.trim() });
    else if (src === 'meu') adicionarMeu(meus[i].produto);
    else if (src === 'agro') addItem(itemDeAgrofit(agro[i].p));
    else if (src === 'kb') addItem({ id: uid(), ...kb[i].item });
    else addItem({ id: uid(), ...cat[i].item });
    $('#busca').value = ''; box.classList.add('hidden');
  });
}

/* ───────── itens ───────── */
/* intervalo, carência, máximo de aplicações e reentrada vêm da bula: digita-se uma vez por produto e o app lembra */
const FICHA_CAMPOS = { intervalo: 'intervalos', carencia: 'carencias', maxAplic: 'maxAplic', reentrada: 'reentradas' };
function salvarFichaProduto(nome, campo, valor) { // valor vazio/nulo apaga o campo
  const k = norm(nome), mapa = DB[FICHA_CAMPOS[campo]];
  const n = valor === '' || valor == null ? null : num(valor);
  const zeroVale = campo === 'carencia' || campo === 'reentrada'; // 0 = sem carência / sem restrição
  if (n === null || n < 0 || (n === 0 && !zeroVale)) delete mapa[k]; else mapa[k] = campo === 'maxAplic' ? Math.round(n) : n;
  if (Object.values(FICHA_CAMPOS).some(m => k in DB[m])) DB.fichaNomes[k] = nome; else delete DB.fichaNomes[k];
  saveDB();
}
function salvarFichaItem(it, campo, valor) {
  salvarFichaProduto(it.nome, campo, valor);
  const v = DB[FICHA_CAMPOS[campo]][norm(it.nome)];
  if (v === undefined) delete it[campo]; else it[campo] = v;
}
const temNumero = v => v !== undefined && v !== null && v !== '' && isFinite(+v) && +v >= 0;
function addItem(it) {
  if (calda.itens.some(x => norm(x.nome) === norm(it.nome))) { toast('Produto já está na calda'); return; }
  const cat = DB.catalogo.find(p => norm(p.nome) === norm(it.nome));
  if (cat && !it.preco) it.preco = cat.preco || 0;
  if (!it.intervalo && DB.intervalos[norm(it.nome)]) it.intervalo = DB.intervalos[norm(it.nome)]; // informado uma vez, volta sozinho
  if (!(it.maxAplic > 0) && DB.maxAplic[norm(it.nome)]) it.maxAplic = DB.maxAplic[norm(it.nome)];
  if (!temNumero(it.carencia)) { const c = DB.carencias[norm(it.nome)] ?? (cat && cat.carencia); if (temNumero(c)) it.carencia = +c; else delete it.carencia; } // a do Gefaz360 vale se você ainda não informou
  if (!temNumero(it.reentrada)) { if (temNumero(DB.reentradas[norm(it.nome)])) it.reentrada = DB.reentradas[norm(it.nome)]; else delete it.reentrada; }
  calda.itens.push(it); renderItens(); toast(`${it.nome} adicionado`);
}
function renderItens() {
  const el = $('#itens'); $('#nItens').textContent = `${calda.itens.length} produto(s)`;
  const cult = $('#fCultura').value;
  el.innerHTML = calda.itens.map((it, i) => {
    const ativos = E.resolverAtivos(it);
    const reg = it.registro ? (it.registro.culturas.some(c => norm(c) === norm(cult) || norm(c) === 'todas as culturas') ? `<span class="tag reg">registro ✔ ${esc(cult)}</span>` : `<span class="tag noreg">sem registro em ${esc(cult)}</span>`) : '';
    return `<div class="item" data-i="${i}">
      <div><div class="nm">${esc(it.nome)}</div><div class="meta">${it.fonte ? `<span class="tag">${esc(it.fonte)}</span>` : ''}${ativos.map(a => `<span class="tag ${a.tags && a.tags.includes('biologico') ? 'bio' : ''}">${esc(a.nome)}${a.moa ? ' · ' + esc(a.moa.sistema + ' ' + a.moa.codigo) : ''}</span>`).join('')}${!ativos.length ? '<span class="tag noreg">ativo não identificado</span>' : ''}${reg}${it.concentracao ? `<span class="tag">${esc(it.concentracao)}</span>` : ''}${typeof tagEstoque === 'function' ? tagEstoque(it) : ''}</div>${typeof linhaMeuProduto === 'function' ? linhaMeuProduto(it) : ''}</div>
      <button class="x" data-del="${i}" title="Remover">✕</button>
      <div class="ctl">
        <label>Dose<input type="number" step="any" min="0" data-f="dose" value="${it.dose || ''}"></label>
        <label>Unidade<select data-f="unidade">${KB.unidades.map(u => `<option ${u === it.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label>Formulação<select data-f="formulacao"><option value="">?</option>${Object.keys(KB.formulacoes).map(f => `<option ${f === it.formulacao ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label>Classe<select data-f="classe">${KB.classes.map(c => `<option ${c === it.classe ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Preço R$/${it.unidade && it.unidade.includes('kg') || it.unidade === 'g/ha' || it.unidade === 'g/100L' ? 'kg' : 'L'}<input type="number" step="any" min="0" data-f="preco" value="${it.preco || ''}"></label>
        <label>Lote<input data-f="lote" value="${esc(it.lote || '')}" placeholder="da embalagem"></label>
        <label title="Intervalo mínimo entre aplicações, conforme a bula/receituário">Intervalo mín. (dias)<input type="number" step="1" min="0" data-f="intervalo" value="${it.intervalo || ''}" placeholder="bula"></label>
        <label title="Número máximo de aplicações do produto por ciclo, conforme a bula/receituário">Máx. aplic./ciclo<input type="number" step="1" min="1" data-f="maxAplic" value="${it.maxAplic || ''}" placeholder="bula"></label>
        <label title="Carência: dias entre a última aplicação e a colheita, conforme a bula/receituário (0 = sem carência)">Carência (dias)<input type="number" step="1" min="0" data-f="carencia" value="${temNumero(it.carencia) ? it.carencia : ''}" placeholder="bula"></label>
        <label title="Reentrada: horas depois do término da aplicação até poder entrar na área tratada, conforme a bula/receituário (0 = sem restrição)">Reentrada (horas)<input type="number" step="1" min="0" data-f="reentrada" value="${temNumero(it.reentrada) ? it.reentrada : ''}" placeholder="bula"></label>
      </div>${typeof botaoMeuProduto === 'function' ? botaoMeuProduto(it) : ''}</div>`;
  }).join('');
  if (typeof ligarMeusProdutos === 'function') ligarMeusProdutos(el);
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { calda.itens.splice(+b.dataset.del, 1); renderItens(); });
  el.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
    const it = calda.itens[+inp.closest('.item').dataset.i], f = inp.dataset.f;
    if (FICHA_CAMPOS[f]) { salvarFichaItem(it, f, inp.value); return; }
    it[f] = f === 'dose' || f === 'preco' ? num(inp.value) : inp.value.trim();
    if (f === 'unidade') renderItens();
  });
}
/* atalhos sob a busca: os produtos de estoque da fazenda que a base já conhece + os mais usados de Meus produtos */
function renderChipsRapidos() {
  $('#chipsRapidos').innerHTML = KB.comerciais.filter(c => c.tags && c.tags.includes('estoque-fazenda')).map(c => `<button type="button" class="chip" data-chip="${esc(c.nome)}">+ ${esc(c.nome)}</button>`).join('') + (typeof chipsMeusProdutos === 'function' ? chipsMeusProdutos() : '');
  $$('#chipsRapidos [data-chip]').forEach(ch => ch.onclick = () => { const c = KB.comerciais.find(x => x.nome === ch.dataset.chip); addItem({ id: uid(), nome: c.nome, classe: c.classe, formulacao: c.formulacao, unidade: 'mL/100L', dose: 0, fonte: 'fazenda' }); });
  if (typeof ligarChipsMeus === 'function') ligarChipsMeus();
}
/* “+ Produto manual” e “＋ Cadastrar” da busca: a janela de cadastro fica em produtos-ui.js e, por padrão, guarda o produto em Meus produtos */
function formManual(pre) { abrirFormProduto({ modo: 'nova', pre: pre || {} }); }

/* ───────── contexto ───────── */
function areaPorTanqueCalda() {
  const tanque = num($('#fTanque').value), volume = num($('#fVolume').value), el = $('#fAreaTanque');
  if (!el) return;
  if (!(tanque > 0) || !(volume > 0)) { el.innerHTML = ''; return; }
  const ha = tanque / volume, cargas = num($('#fArea').value) > 0 ? Math.ceil(num($('#fArea').value) / ha) : 0;
  el.innerHTML = `Cada carga cobre <b>${fmt(ha, 2)} ha</b> — ${fmt(tanque, 0)} L ÷ ${fmt(volume, 0)} L/ha${cargas ? ` · ${cargas} carga(s) para ${fmt(num($('#fArea').value), 1)} ha` : ''}.
    <button class="btn sm ghost" id="btnAreaUmaCarga">usar 1 carga como área</button>`;
  $('#btnAreaUmaCarga').onclick = () => { $('#fArea').value = Math.round(ha * 100) / 100; areaPorTanqueCalda(); toast(`Área ajustada para uma carga: ${fmt(ha, 2)} ha`); };
}
const CAMPO_RASTREIO = { talhao: '#fTalhao', maquina: '#fMaquina', operador: '#fOperador', responsavel: '#fResponsavel', crea: '#fCrea', receituario: '#fReceituario', inicio: '#fInicio', termino: '#fTermino' };
function lerRastreio() {
  const r = { fazenda: DB.config.fazenda || '' };
  Object.entries(CAMPO_RASTREIO).forEach(([k, sel]) => { r[k] = ($(sel).value || '').trim(); });
  return r;
}
function aplicarRastreio(r) {
  if (!r) return;
  Object.entries(CAMPO_RASTREIO).forEach(([k, sel]) => { if (r[k] != null) $(sel).value = r[k]; });
}
// O que não muda de uma aplicação para outra (máquina, operador, RT) volta sozinho;
// talhão, receituário e horário são de cada aplicação e ficam em branco de propósito.
function guardarPadroesRastreio() {
  DB.config.rastreio = { maquina: $('#fMaquina').value.trim(), operador: $('#fOperador').value.trim(), responsavel: $('#fResponsavel').value.trim(), crea: $('#fCrea').value.trim() };
  saveDB();
}
/* ───────── talhões: marcar o pulverizado, puxar a área e guardar o histórico ───────── */
let talhoesSel = [];
let talhaoEditando = null; // talhão aberto no formulário, ou null para um novo
const splitTalhoes = s => String(s || '').split(/\s*[;\n]\s*/).map(x => x.trim()).filter(Boolean);
const achaTalhao = nome => DB.talhoes.find(t => norm(t.nome) === norm(nome));
const diasDesde = iso => { const d = Date.parse(iso); return isNaN(d) ? null : Math.max(0, Math.floor((Date.now() - d) / 864e5)); };
const soData = a => String(a.data || '').split(',')[0];
function definirTalhoes(nomes, puxar) {
  const vistos = new Set();
  talhoesSel = (nomes || []).map(n => String(n).trim()).filter(n => n && !vistos.has(norm(n)) && vistos.add(norm(n))).map(n => (achaTalhao(n) || { nome: n }).nome);
  $('#fTalhao').value = talhoesSel.join('; ');
  if (puxar) puxarDadosTalhoes();
  renderTalhoes();
}
function alternarTalhao(nome) {
  const tem = talhoesSel.some(n => norm(n) === norm(nome));
  definirTalhoes(tem ? talhoesSel.filter(n => norm(n) !== norm(nome)) : [...talhoesSel, nome], true);
}
/* área = soma dos talhões marcados; cultura = a deles, quando todos têm a mesma */
function puxarDadosTalhoes() {
  const ts = talhoesSel.map(achaTalhao).filter(Boolean);
  const area = ts.reduce((s, t) => s + (+t.area || 0), 0);
  if (area > 0) { $('#fArea').value = Math.round(area * 100) / 100; areaPorTanqueCalda(); }
  const culturas = [...new Set(ts.map(t => t.cultura).filter(Boolean).map(norm))];
  if (culturas.length === 1) {
    const c = KB.culturas.find(x => norm(x) === culturas[0]);
    if (c && $('#fCultura').value !== c) { $('#fCultura').value = c; $('#fCultura').onchange(); }
  }
  if (ts.length === 1) aplicarPadroesDoTalhao(ts[0]);
}
/* equipamento, regulagem salva ou entrelinhas/faixa do talhão passam para a calda e para a aba Pontas */
function aplicarPadroesDoTalhao(t) {
  const feitos = [];
  if (t.equip && KB.equipamentos[t.equip] && $('#fEquip').value !== t.equip) { $('#fEquip').value = t.equip; $('#fEquip').onchange(); feitos.push('equipamento'); }
  const reg = t.regulagemId && DB.regulagens.find(r => r.id === t.regulagemId);
  if (reg) {
    aplicarRegulagem(reg.entrada); preencherSelectRegulagem(); $('#fRegulagem').value = 's' + DB.regulagens.indexOf(reg); notaRegulagem(); feitos.push('regulagem “' + reg.nome + '”');
  } else if (t.faixa > 0 || t.entreLinhas > 0) {
    if (t.faixa > 0) { $('#pModo').value = 'faixa'; $('#pLf').value = t.faixa; }
    if (t.entreLinhas > 0) $('#pEl').value = t.entreLinhas;
    camposPorModo(); atualizarVazaoAlvo(); if (regulagem) calcularRegulagem(true);
    feitos.push('faixa e entrelinhas na aba Pontas');
  }
  if (feitos.length) toast('Talhão ' + t.nome + ': ' + feitos.join(', '));
}
function renderTalhoes() {
  const box = $('#talhaoChips'); if (!box) return;
  const todos = DB.talhoes.map(t => t.nome).concat(talhoesSel.filter(n => !achaTalhao(n)));
  box.innerHTML = todos.length ? todos.map((n, i) => {
    const t = achaTalhao(n), on = talhoesSel.some(s => norm(s) === norm(n));
    return `<button type="button" class="chip talhao-chip${on ? ' sel' : ''}" aria-pressed="${on}" data-tl="${i}">${on ? '✔ ' : ''}${esc(n)}${t && t.area ? ' · ' + fmt(t.area, 1) + ' ha' : ''}</button>`;
  }).join('') : '<span class="small muted">Nenhum talhão cadastrado — use “＋ Novo talhão” ou importe do PVGest/Gefaz360 na aba Integração.</span>';
  box.querySelectorAll('[data-tl]').forEach(b => b.onclick = () => alternarTalhao(todos[+b.dataset.tl]));
  const linhas = talhoesSel.map((n, i) => {
    const t = achaTalhao(n);
    if (!t) return `<div><b>${esc(n)}</b> — ainda não cadastrado; entra na lista quando você analisar a calda.</div>`;
    const ap = t.aplicacoes || [], u = ap.find(a => a.aplicada), dias = u ? diasDesde(u.iso) : null;
    const hist = u ? `última aplicação ${esc(soData(u))}${dias != null ? ' (há ' + dias + ' d)' : ''}: ${esc(u.produtos.join(' + '))}`
      : ap.length ? `só análises registradas (última em ${esc(soData(ap[0]))})` : 'sem histórico';
    return `<div><b>${esc(t.nome)}</b> — ${t.area ? fmt(t.area, 2) + ' ha' : '<span class="danger-txt">sem área cadastrada</span>'}${t.cultura ? ' · ' + esc(t.cultura) : ''}${t.cicloInicio ? ' · ciclo desde ' + dataBR(t.cicloInicio) : ''} · ${hist}${dias != null && dias <= 7 ? ' <span class="danger-txt">⚠ aplicado há poucos dias — confira intervalo e rotação de modo de ação</span>' : ''} <button type="button" class="btn sm ghost" data-edt="${i}" aria-label="Editar ${esc(t.nome)}">✎</button></div>`;
  });
  const soma = talhoesSel.map(achaTalhao).filter(Boolean).reduce((s, t) => s + (+t.area || 0), 0);
  const culturasSel = new Set(talhoesSel.map(achaTalhao).filter(t => t && t.cultura).map(t => norm(t.cultura)));
  if (culturasSel.size > 1) linhas.push(`<div class="danger-txt">⚠ Talhões de culturas diferentes: a análise vale para a cultura escolhida abaixo (${esc($('#fCultura').value)}).</div>`);
  if (talhoesSel.length > 1 && soma > 0) linhas.push(`<div><b>Área somada: ${fmt(soma, 2)} ha</b> (já lançada no campo Área)</div>`);
  $('#talhaoInfo').innerHTML = linhas.join('');
  $$('#talhaoInfo [data-edt]').forEach(b => b.onclick = () => abrirFormTalhao(achaTalhao(talhoesSel[+b.dataset.edt])));
}
function abrirFormTalhao(t) {
  talhaoEditando = t || null;
  $('#tfCultura').innerHTML = '<option value="">—</option>' + KB.culturas.map(c => `<option>${esc(c)}</option>`).join('');
  $('#tfTitulo').textContent = t ? 'Editar talhão' : 'Novo talhão';
  $('#tfNome').value = t ? t.nome : ''; $('#tfArea').value = t && t.area ? t.area : ''; $('#tfCiclo').value = (t && t.cicloInicio) || '';
  $('#tfEntreLinhas').value = (t && t.entreLinhas) || ''; $('#tfFaixa').value = (t && t.faixa) || '';
  $('#tfEquip').innerHTML = '<option value="">—</option>' + Object.entries(KB.equipamentos).map(([k, e]) => `<option value="${k}">${esc(e.nome)}</option>`).join('');
  $('#tfEquip').value = (t && t.equip) || '';
  $('#tfRegulagem').innerHTML = '<option value="">—</option>' + DB.regulagens.map(r => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join('');
  $('#tfRegulagem').value = (t && t.regulagemId) || '';
  $('#tfCultura').value = t ? (t.cultura || '') : $('#fCultura').value;
  $('#talhaoForm').classList.remove('hidden'); $('#tfNome').focus();
}
function fecharFormTalhao() { talhaoEditando = null; $('#talhaoForm').classList.add('hidden'); }
function salvarFormTalhao() {
  const nome = $('#tfNome').value.trim(), area = num($('#tfArea').value), cultura = $('#tfCultura').value, cicloInicio = $('#tfCiclo').value || '';
  const padroes = { entreLinhas: num($('#tfEntreLinhas').value) || 0, faixa: num($('#tfFaixa').value) || 0, equip: $('#tfEquip').value, regulagemId: $('#tfRegulagem').value };
  if (!nome) return toast('Dê um nome ao talhão', 'err');
  const outro = achaTalhao(nome);
  if (outro && outro !== talhaoEditando) return toast('Já existe um talhão com esse nome', 'err');
  let sel = talhoesSel;
  if (talhaoEditando) { const antigo = talhaoEditando.nome; Object.assign(talhaoEditando, { nome, area, cultura, cicloInicio, ...padroes }); sel = sel.map(n => norm(n) === norm(antigo) ? nome : n); }
  else { DB.talhoes.push({ nome, area, cultura, cicloInicio, ...padroes, fonte: 'manual', aplicacoes: [] }); sel = [...sel, nome]; }
  saveDB(); fecharFormTalhao(); definirTalhoes(sel, true); renderHistorico(); renderIntegracao();
  toast(`Talhão ${nome} salvo`);
}
function excluirTalhao(t) {
  if (!confirm(`Excluir o talhão ${t.nome} e todo o histórico dele (${(t.aplicacoes || []).length} registros)?`)) return;
  DB.talhoes.splice(DB.talhoes.indexOf(t), 1); saveDB();
  definirTalhoes(talhoesSel.filter(n => norm(n) !== norm(t.nome)), true); renderHistorico(); renderIntegracao();
}
function chaveDeItens(cultura, volumeHa, itens) { return JSON.stringify([cultura, volumeHa, itens.map(i => [norm(i.nome), i.dose, i.unidade]).sort()]); }
function chaveDaCalda(ctx) { return chaveDeItens(ctx.cultura, ctx.volumeHa, calda.itens); }
const arred2 = v => Math.round((+v || 0) * 100) / 100;
/* Registro de uma aplicação (ou análise) no histórico de um talhão. Guarda o que o caderno de campo e o custo por
   talhão precisam: doses e lotes, quem aplicou, com o quê, quanto custou. `area` = hectares deste talhão. */
function montarRegistroAplicacao(ctx, res, area) {
  const r = ctx.rastreio, custo = res.custo || {};
  return {
    data: res.data, iso: new Date().toISOString(), quando: r.termino || r.inicio || new Date().toISOString(),
    codigo: res.rastreio ? res.rastreio.codigo : null, status: res.status, aplicada: !!r.termino, chave: chaveDaCalda(ctx),
    cultura: ctx.cultura, area, volumeHa: ctx.volumeHa, equip: ctx.equipamento,
    produtos: calda.itens.map(i => i.nome),
    itens: calda.itens.map(i => ({ nome: i.nome, dose: i.dose, unidade: i.unidade, lote: i.lote || '' })),
    perfis: (res.itens || []).map(perfilProduto),
    alvos: textoAlvos(ctx.alvos, true).join(', '), resumo: res.resumo.frase,
    rast: { operador: r.operador || '', maquina: r.maquina || '', receituario: r.receituario || '', responsavel: r.responsavel || '', crea: r.crea || '', inicio: r.inicio || '', termino: r.termino || '' },
    custoHa: custo.totalHa != null ? arred2(custo.totalHa) : null, custo: custo.totalHa != null ? arred2(custo.totalHa * area) : null, semPreco: (custo.semPreco || []).length
  };
}
/* Cada análise entra no histórico dos talhões marcados. O código do laudo muda a cada emissão (leva a hora),
   então a mesma calda (produtos, doses, volume, cultura) reanalisada só atualiza o registro que ainda é "só análise". */
function registrarAplicacaoTalhoes(ctx, res) {
  const nomes = splitTalhoes(ctx.rastreio.talhao);
  nomes.forEach(nome => {
    let t = achaTalhao(nome);
    if (!t) { t = { nome, area: nomes.length === 1 ? ctx.area : 0, cultura: ctx.cultura, fonte: 'manual', aplicacoes: [] }; DB.talhoes.push(t); }
    t.aplicacoes = t.aplicacoes || [];
    const reg = montarRegistroAplicacao(ctx, res, t.area || (nomes.length === 1 ? ctx.area : 0));
    // com horário informado a aplicação é a mesma calda no mesmo horário; sem horário, a mesma calda ainda "só análise"
    const temHora = !!(ctx.rastreio.termino || ctx.rastreio.inicio);
    const ja = temHora ? t.aplicacoes.find(a => a.chave === reg.chave && a.quando === reg.quando) : t.aplicacoes.find(a => a.chave === reg.chave && !a.aplicada);
    if (ja) { const feita = ja.aplicada; Object.assign(ja, reg); ja.aplicada = feita || reg.aplicada; }
    else t.aplicacoes.unshift({ id: uid(), ...reg });
    t.aplicacoes = t.aplicacoes.slice(0, 100);
  });
}
function atualizarTalhoes() { renderTalhoes(); }
/* Próxima aplicação permitida: dia da aplicação (término, senão início, senão hoje) + o maior intervalo informado. */
function baseDaAplicacao(ctx) { const r = ctx.rastreio; return { base: r.termino || r.inicio || new Date(), origemBase: r.termino ? 'termino' : r.inicio ? 'inicio' : 'emissao' }; }
/* aplicações já feitas (marcadas) dos talhões do laudo, com o dia e o que levaram */
/* o registro desta mesma aplicação (mesma calda, mesmo horário informado) não conta como anterior ao reanalisar */
function ehEstaAplicacao(a, ctx) { const q = ctx.rastreio.termino || ctx.rastreio.inicio; return !!q && a.quando === q && a.chave === chaveDaCalda(ctx); }
function talhoesAplicados(ctx) {
  return splitTalhoes(ctx.rastreio.talhao).map(achaTalhao).filter(Boolean).map(t => ({ nome: t.nome, cicloInicio: t.cicloInicio || '', aplicacoes: (t.aplicacoes || []).filter(a => a.aplicada && !ehEstaAplicacao(a, ctx)).map(a => ({ quando: a.quando || a.iso, produtos: a.produtos, perfis: a.perfis })) }));
}
function calcularProxima(ctx, res) { return E.proximaAplicacao({ itens: res.itens || [], ...baseDaAplicacao(ctx), talhoes: talhoesAplicados(ctx) }); }
function calcularCiclo(ctx, res) { return E.aplicacoesNoCiclo({ itens: res.itens || [], ...baseDaAplicacao(ctx), talhoes: talhoesAplicados(ctx) }); }
function calcularReentrada(ctx, res) { const b = baseDaAplicacao(ctx); return E.reentradaLiberada({ itens: res.itens || [], base: b.base, origemBase: b.origemBase }); }
function calcularColheita(ctx, res) { return E.colheitaLiberada({ itens: res.itens || [], ...baseDaAplicacao(ctx), talhoes: talhoesAplicados(ctx) }); }
/* Perfil do produto para comparar com aplicações passadas: ingredientes ativos, códigos de modo de ação
   (FRAC/IRAC/HRAC, do KB) e grupos químicos (KB ou AGROFIT, para quando o KB não tem o código). */
const SEM_DEFESA = ['Adjuvante', 'Fertilizante Foliar'];
function perfilProduto(i) {
  const res = i.ativosResolvidos || [], ativos = res.map(a => a.nome), grupos = res.map(a => a.grupo).filter(Boolean);
  (i.ingredientes || []).forEach(x => {
    const m = String(x).match(/^(.*?)\s*(?:\(([^()]*)\))?\s*$/), nome = (m[1] || '').trim(), grupo = (m[2] || '').trim();
    if (nome && !ativos.some(a => norm(a).includes(norm(nome)) || norm(nome).includes(norm(a)))) ativos.push(nome);
    if (grupo) grupos.push(grupo);
  });
  const unicos = arr => { const v = new Set(); return arr.filter(x => { const k = norm(x); return k && !v.has(k) && v.add(k); }); };
  return { nome: i.nome, intervalo: +i.intervalo > 0 ? +i.intervalo : null, carencia: temNumero(i.carencia) ? +i.carencia : null, reentrada: temNumero(i.reentrada) ? +i.reentrada : null, defensivo: !SEM_DEFESA.includes(i.classe) && !(i.tags || []).includes('condicionador'), ativos: unicos(ativos), moa: unicos(i.moa || []), grupos: unicos(grupos) };
}
/* O que a calda de hoje repete das últimas 3 aplicações do talhão: produto, ingrediente ativo, modo de ação
   e (só onde falta o código de MoA) grupo químico. Adjuvantes e foliares ficam de fora. */
function repeticoesNoTalhao(atuais, aplicadas) {
  const tipos = [['produto', p => [p.nome]], ['ativo', p => p.ativos], ['moa', p => p.moa], ['grupo', p => (p.moa.length ? [] : p.grupos)]];
  const uniq = a => [...new Set(a)], out = [];
  aplicadas.slice(0, 3).forEach(a => {
    const prev = (a.perfis || a.produtos.map(n => ({ nome: n, defensivo: true, ativos: [], moa: [], grupos: [] }))).filter(p => p.defensivo !== false);
    const linhas = [];
    tipos.forEach(([tipo, get]) => {
      const m = {};
      atuais.filter(p => p.defensivo).forEach(p => get(p).forEach(v => { (m[norm(v)] = m[norm(v)] || { valor: v, atual: [], anterior: [] }).atual.push(p.nome); }));
      prev.forEach(p => get(p).forEach(v => { const e = m[norm(v)]; if (e) e.anterior.push(p.nome); }));
      Object.values(m).filter(e => e.anterior.length).forEach(e => linhas.push({ tipo, valor: e.valor, atual: uniq(e.atual), anterior: uniq(e.anterior), data: soData(a), iso: a.iso }));
    });
    const iguais = new Set(linhas.filter(l => l.tipo === 'produto').map(l => norm(l.valor)));
    // produto idêntico já implica o mesmo ativo e o mesmo modo de ação: não repetir a linha
    out.push(...linhas.filter(l => l.tipo === 'produto' || !(l.atual.every(n => iguais.has(norm(n))) && l.anterior.every(n => iguais.has(norm(n))))));
  });
  return out;
}
/* Retrato do histórico dos talhões marcados até este laudo (tirado antes de registrar a análise atual).
   Vai no laudo impresso e no JSON; não entra no código de conferência, que é só da calda e do registro de campo. */
function historicoDosTalhoes(ctx, res) {
  const atuais = (res.itens || []).map(perfilProduto);
  return splitTalhoes(ctx.rastreio.talhao).map(nome => {
    const t = achaTalhao(nome), tudo = (t && t.aplicacoes) || [];
    const ap = tudo.map(a => ({ data: a.data, iso: a.iso, aplicada: !!a.aplicada, produtos: a.produtos, cultura: a.cultura, alvos: a.alvos, area: a.area, volumeHa: a.volumeHa, status: a.status, codigo: a.codigo }));
    const aplicadas = tudo.filter(a => a.aplicada && !ehEstaAplicacao(a, ctx));
    return { nome: t ? t.nome : nome, cadastrado: !!t, area: t ? t.area || 0 : 0, cultura: t ? t.cultura || '' : '', total: ap.length, nAplicadas: aplicadas.length, ultimaAplicacao: ap.find(a => a.aplicada) || null, repeticoes: repeticoesNoTalhao(atuais, aplicadas), registros: ap.slice(0, 8) };
  });
}
function lerContexto() {
  return {
    rastreio: lerRastreio(),
    cultura: $('#fCultura').value, equipamento: $('#fEquip').value,
    alvos: JSON.parse(JSON.stringify(alvosSel)), alvo: textoAlvos(alvosSel).join('; '),
    doenca: alvosSel.doenca.join('; '), praga: [...alvosSel.inseto, ...alvosSel.praga].join('; '), daninha: alvosSel.daninha.join('; '), severidade: $('#fSeveridade').value,
    estadio: $('#fEstadio').value.trim(), parte: $('#fParte').value,
    volumeHa: num($('#fVolume').value), area: num($('#fArea').value), tanque: num($('#fTanque').value),
    agua: { ph: $('#fPh').value === '' ? null : num($('#fPh').value), dureza: $('#fDureza').value === '' ? null : num($('#fDureza').value), turbidez: $('#fTurbidez').value, fonte: $('#fFonte').value },
    obs: $('#fObs').value
  };
}
function aplicarContexto(c) {
  if (!c) return;
  if (c.cultura) $('#fCultura').value = KB.culturas.includes(c.cultura) ? c.cultura : (KB.culturas.find(x => norm(x) === norm(c.cultura)) || 'Outra');
  if (c.alvos || c.alvo != null || c.doenca != null || c.praga != null) { atualizarListasCultura(); definirAlvos(alvosLegados(c)); }
  if (c.severidade != null) $('#fSeveridade').value = c.severidade;
  if (c.estadio != null) $('#fEstadio').value = c.estadio;
  if (c.parte != null) $('#fParte').value = c.parte;
  if (c.equipamento) $('#fEquip').value = c.equipamento;
  if (c.volumeHa != null) { $('#fVolume').value = c.volumeHa; $('#fVolume').dataset.touched = 1; }
  if (c.area != null) $('#fArea').value = c.area;
  if (c.tanque != null) $('#fTanque').value = c.tanque;
  if (c.agua) { $('#fPh').value = c.agua.ph ?? ''; $('#fDureza').value = c.agua.dureza ?? ''; $('#fTurbidez').value = c.agua.turbidez || 'limpa'; $('#fFonte').value = c.agua.fonte || ''; }
  if (c.obs != null) $('#fObs').value = c.obs;
  aplicarRastreio(c.rastreio);
  if (c.rastreio && c.rastreio.talhao != null) definirTalhoes(splitTalhoes(c.rastreio.talhao));
  $('#droneAviso').classList.toggle('hidden', $('#fEquip').value !== 'drone');
  $('#cafeAviso').classList.toggle('hidden', $('#fEquip').value !== 'herbicida-cafe');
  atualizarAlvos(); atualizarListasCultura(); areaPorTanqueCalda(); notaRegulagem();
}

/* ───────── regulagem anexada ao laudo ───────── */
function preencherSelectRegulagem() {
  const sel = $('#fRegulagem'); if (!sel) return;
  const atual = sel.options.length ? sel.value : 'atual'; // select vazio na primeira carga: 'Sem regulagem' também vale '', não pode virar o padrão
  sel.innerHTML = '<option value="atual">Regulagem atual da aba Pontas</option>'
    + DB.regulagens.map((r, i) => `<option value="s${i}">Salva: ${esc(r.nome)}</option>`).join('')
    + '<option value="">Sem regulagem</option>';
  sel.value = [...sel.options].some(o => o.value === atual) ? atual : 'atual';
  notaRegulagem();
}
function regulagemDoLaudo() {
  const sel = $('#fRegulagem'); if (!sel || sel.value === '') return null;
  if (sel.value.startsWith('s')) {
    const salva = DB.regulagens[+sel.value.slice(1)];
    if (!salva) return null;
    try { const g = PT.calcular(salva.entrada); g.entrada = salva.entrada; g.nome = salva.nome; g.origem = 'regulagem salva em ' + salva.data; return g; } catch (e) { return null; }
  }
  if (regulagem) return { ...regulagem, origem: 'aba Pontas', calibracao: ultimaCalibracao };
  if (DB.config.pontas) { try { const g = PT.calcular(DB.config.pontas); g.entrada = DB.config.pontas; g.origem = 'última regulagem da aba Pontas'; return g; } catch (e) { return null; } }
  return null;
}
function notaRegulagem() {
  const el = $('#fRegNota'); if (!el) return;
  const g = regulagemDoLaudo();
  if (!g) { el.innerHTML = 'Sem regulagem, o laudo registra a receita mas não prova com que ponta, pressão e velocidade ela foi aplicada.'; return; }
  const entregue = g.modo === 'faixa' ? g.volumeLavoura : g.volumeAplicado;
  const vol = num($('#fVolume').value);
  const desvio = vol && entregue ? (entregue - vol) / vol * 100 : null;
  el.innerHTML = `${g.ponta ? esc(g.ponta.marca + ' ' + g.ponta.modelo + ' ' + g.iso) : 'Sem ponta'} · ${fmt(g.pressao, 2)} bar · ${fmt(entregue, 0)} L/ha`
    + (desvio == null ? '' : Math.abs(desvio) <= 5
      ? ` · <b>confere</b> com os ${fmt(vol, 0)} L/ha da calda.`
      : ` · <b class="danger-txt">desvio de ${desvio > 0 ? '+' : ''}${fmt(desvio, 1)} %</b> contra os ${fmt(vol, 0)} L/ha da calda — a dose por hectare sai errada na mesma proporção.`);
}

/* ───────── análise ───────── */
function analisar(silencioso, registrarHistorico = true) {
  const ctx = lerContexto();
  if (!calda.itens.length) { invalidarResultado(); toast('Adicione ao menos um produto', 'err'); return null; }
  if (!(ctx.volumeHa > 0) || ctx.area < 0 || ctx.tanque < 0 || calda.itens.some(i => !Number.isFinite(+i.dose) || +i.dose < 0)) {
    invalidarResultado(); toast('Informe volume maior que zero e área, tanque e doses sem valores negativos.', 'err'); return null;
  }
  const semDose = calda.itens.filter(i => !i.dose);
  if (semDose.length && !silencioso) toast(`Sem dose: ${semDose.map(i => i.nome).join(', ')} — custo e jar test ficam incompletos`);
  const opts = { ...ctx, regraFazenda: { acidificanteUltimo: !!DB.config.acidificanteUltimo }, custoOperacional: DB.config.custo, historicoJar: DB.jarTests, regulagem: regulagemDoLaudo(), kbVersao: KB.versao, data: agora() };
  resultado = E.analisar(calda.itens, opts);
  resultado.contexto = ctx; resultado.data = resultado.data || agora();
  resultado.historicoTalhoes = historicoDosTalhoes(ctx, resultado);
  resultado.proximaAplicacao = calcularProxima(ctx, resultado);
  resultado.colheitaLiberada = calcularColheita(ctx, resultado);
  resultado.aplicacoesCiclo = calcularCiclo(ctx, resultado);
  resultado.reentrada = calcularReentrada(ctx, resultado);
  guardarPadroesRastreio();
  if (registrarHistorico) {
    DB.historico.unshift({ id: uid(), data: resultado.data, status: resultado.status, resumo: resultado.resumo.frase, codigo: resultado.rastreio ? resultado.rastreio.codigo : null, talhao: ctx.rastreio.talhao, itens: calda.itens.map(i => i.nome), calda: JSON.parse(JSON.stringify({ itens: calda.itens, ...ctx })) });
    DB.historico = DB.historico.slice(0, 60);
    registrarAplicacaoTalhoes(ctx, resultado);
  }
  saveDB();
  assinaturaResultado = assinaturaDaAnalise();
  renderResultado(); renderJar(); renderHistorico(); renderTalhoes();
  if (window.parent !== window) { try { window.parent.postMessage({ type: 'gefaz-calda:resultado', resultado: resumoExport(), mix: { itens: calda.itens, ...ctx } }, '*'); } catch (e) { } }
  if (!silencioso) navTo('resultado');
  return resultado;
}
function resumoExport() { if (!resultado) return null; const r = resultado; return { status: r.status, resumo: r.resumo, score: r.score, regulagem: r.regulagem, rastreio: r.rastreio, confianca: r.confianca, alertas: r.alertas, ph: r.ph, ordem: r.ordem.filter(p => p.itens.length || p.passo <= 2 || p.passo >= 11), custo: r.custo, tanque: r.tanque, checklist: r.checklist, registro: r.registro, jarTest: r.jarTest, data: r.data, contexto: r.contexto, historicoTalhoes: r.historicoTalhoes || [], proximaAplicacao: r.proximaAplicacao || null, colheitaLiberada: r.colheitaLiberada || null, aplicacoesCiclo: r.aplicacoesCiclo || null, reentrada: r.reentrada || null, versao: E.versao }; }

const TIPO_LABEL = { legal: 'Registro / legal', quimica: 'Química', fisica: 'Física', agronomica: 'Agronômica', biologica: 'Biológica', ph: 'pH', agua: 'Água', resistencia: 'Resistência (MoA)', operacional: 'Operacional' };
const STATUS_LABEL = { compativel: 'Compatível', restricoes: 'Compatível com restrições', incompativel: 'Incompatível', testar: 'Não testado — jar test', 'nao-testado': 'Não testado', atencao: 'Atenção' };

function renderResultado() {
  const r = resultado; const el = $('#resultado'); if (!r) return;
  const ctx = r.contexto;
  const alertasVis = r.alertas;
  const porTipo = {}; alertasVis.forEach(a => (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a));
  const ordemTipos = ['legal', 'quimica', 'fisica', 'agronomica', 'biologica', 'ph', 'agua', 'resistencia', 'operacional'];
  const nomeDe = id => (r.itens.find(i => i.id === id) || {}).nome || id;
  const phMin = r.ph.alvoMin, phMax = r.ph.alvoMax;
  const phBar = phMin != null && !r.ph.faixaVazia ? `<div class="ph-bar"><div class="range" style="left:${(phMin - 3) / 8 * 100}%;width:${(phMax - phMin) / 8 * 100}%"></div>${r.ph.aguaPh != null ? `<div class="mark" style="left:${Math.min(Math.max((r.ph.aguaPh - 3) / 8 * 100, 0), 100)}%">água ${r.ph.aguaPh}</div>` : ''}</div><div class="small muted">Escala 3–11 · faixa alvo ${phMin.toFixed(1)}–${phMax.toFixed(1)}${r.ph.precisaCorrigir ? ' · <b>' + esc(r.ph.sugestao) + '</b>' : ''}</div>` : (r.ph.faixaVazia ? '<div class="alert warn">Sem faixa de pH comum — ver alerta.</div>' : '<div class="small muted">Nenhum produto com faixa de pH cadastrada.</div>');
  el.innerHTML = `
  <div class="print-only"><h1>Laudo de compatibilidade de calda — ${esc(DB.config.fazenda)}</h1><p>${r.rastreio ? '<b>' + esc(r.rastreio.codigo) + '</b> · ' : ''}${esc(r.data)} · Gefaz Calda ${E.versao} · KB ${KB.versao}${AGRO ? ' · Agrofit ' + esc(AGRO.gerado) : ''}${r.rastreio && r.rastreio.campos[0].valor ? ' · talhão ' + esc(r.rastreio.campos[0].valor) : ''}</p></div>
  <div class="status ${r.status}"><div><h2>${esc(r.resumo.rotulo)}</h2><div class="sub">${esc(ctx.cultura)} · ${esc((KB.equipamentos[ctx.equipamento] || {}).nome || ctx.equipamento)} · ${ctx.volumeHa} L/ha · ${r.itens.length} produtos</div><div class="sub">${CATS_ALVO.filter(c => ((ctx.alvos || {})[c.id] || []).length).map(c => '<b>' + esc(c.nome) + ':</b> ' + ctx.alvos[c.id].map(esc).join('; ')).join(' · ')}</div><div class="sub">${[ctx.severidade, ctx.estadio, ctx.parte].filter(Boolean).map(esc).join(' · ')}</div><div class="sub">${esc(r.resumo.frase)}</div></div><div class="score" title="Índice de risco (100 = sem alertas)">${r.score}</div></div>
  <div class="card"><div class="kpis">
    <div class="kpi"><b>${r.resumo.contagem.alta}</b><small>críticos</small></div><div class="kpi"><b>${r.resumo.contagem.media}</b><small>restrições</small></div><div class="kpi"><b>${Math.round(r.confianca * 100)} %</b><small>confiança</small></div>
    <div class="kpi"><b>${BRL(r.custo.totalHa)}</b><small>custo total/ha</small></div><div class="kpi"><b>${r.jarTest.obrigatorio ? 'Sim' : 'Recomendado'}</b><small>jar test</small></div></div>
    <div class="row-btns"><button class="btn primary" id="btnPrint">🖨️ Laudo completo</button><button class="btn" id="btnPrintRes" title="Uma página: veredito, alertas, ordem de mistura, datas e assinaturas">🖨️ Laudo resumido</button><button class="btn" id="btnJar">🫙 Jar test</button><button class="btn ghost" id="btnExpLaudo">⬇️ JSON do laudo</button><button class="btn ghost" id="btnAgenda" title="Datas do laudo (próxima aplicação, reentrada, colheita) para o calendário">📅 Agenda (.ics)</button><button class="btn ghost" id="btnExpReceita">⬇️ Receita (PVGest/Gefaz360)</button><button class="btn ghost" id="btnEnvPV">📤 PVGest (este navegador)</button><button class="btn ghost" id="btnEnvG360">📤 Gefaz360 (este navegador)</button><button class="btn ghost" id="btnEnvCodex">📤 Codex (atividade)</button></div></div>
  ${ordemTipos.filter(t => porTipo[t]).map(t => `<div class="card"><div class="card-hd"><h2>${esc(TIPO_LABEL[t])}</h2><span class="hint">${porTipo[t].length} alerta(s)</span></div>${porTipo[t].map(a => `<div class="al ${a.severidade}"><div class="t"><span>${esc(a.titulo)}</span><span><span class="sev ${a.severidade}">${a.severidade}</span> <span class="conf">C ${a.confianca.toFixed(2)}</span></span></div><div class="d">${esc(a.detalhe)}${a.paresTexto ? ` <i>(${esc(a.paresTexto)})</i>` : a.nomes ? ` <i>(${esc(a.nomes.join(' × '))})</i>` : ''}</div><div class="c">→ ${esc(a.conduta)}</div><div class="f">Fonte: ${esc(a.fonte)}${a.regra ? ' · ' + a.regra : ''}</div></div>`).join('')}</div>`).join('')}
  ${!alertasVis.length ? '<div class="card"><div class="al info"><div class="t">Nenhum alerta gerado</div><div class="d">Todos os produtos foram reconhecidos e não há regra de incompatibilidade registrada entre eles. Isso não substitui o jar test.</div></div></div>' : ''}
  <div class="card so-completo"><div class="card-hd"><h2>pH da calda</h2></div>${phBar}<div class="small muted" style="margin-top:6px">${r.ph.itensSensiveis.map(i => `${esc(i.nome)}: ${i.ph[0]}–${i.ph[1]}`).join(' · ')}</div></div>
  <div class="card so-completo"><div class="card-hd"><h2>Matriz de pares</h2><span class="hint">como no Koppert / Yara: cada par tem um veredito</span></div><div class="matrix">${matrizHTML(r)}</div><div class="legend"><span><i style="background:#c8e6c9"></i>compatível</span><span><i style="background:#bbdefb"></i>atenção</span><span><i style="background:#ffe082"></i>restrições</span><span><i style="background:#ef9a9a"></i>incompatível</span><span><i style="background:#eee"></i>não testado</span></div></div>
  <div class="card"><div class="card-hd"><h2>Ordem de adição</h2><span class="hint">Embrapa Doc. 437 (formulação)${DB.config.acidificanteUltimo ? ' · regra da fazenda ativa' : ''}</span></div><ol class="steps">${r.ordem.map(p => `<li><div class="n ${p.itens.length ? 'has' : ''}">${p.passo}</div><div><div class="ti">${esc(p.titulo)}</div>${p.nota ? `<div class="no">${esc(p.nota)}</div>` : ''}${p.itens.length ? `<div class="pr">${p.itens.map(i => `<span>${esc(i.nome)}${i.formulacao ? ' <b>' + esc(i.formulacao) + '</b>' : ''}${i.notas.length ? '<small>' + i.notas.map(esc).join(' ') + '</small>' : ''}</span>`).join('')}</div>` : ''}</div></li>`).join('')}</ol></div>
  <div class="card so-completo"><div class="card-hd"><h2>Custo por hectare</h2><span class="hint">produto + operação (${esc((KB.equipamentos[ctx.equipamento] || {}).nome || '')})</span></div><table class="tb"><thead><tr><th>Produto</th><th class="num">Dose/ha</th><th class="num">Preço</th><th class="num">R$/ha</th></tr></thead><tbody>${r.custo.porItem.map(i => `<tr><td>${esc(i.nome)}</td><td class="num">${fmt(i.dosePorHa, 3)} ${i.base}</td><td class="num">${i.semPreco ? '<span class="tag noreg">sem preço</span>' : BRL(i.preco) + '/' + i.base}</td><td class="num">${BRL(i.custoHa)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Produtos</td><td class="num">${BRL(r.custo.produtosHa)}</td></tr><tr><td colspan="3">Operação (${esc(ctx.equipamento)})</td><td class="num">${BRL(r.custo.operacionalHa)}</td></tr><tr><td colspan="3">Total/ha</td><td class="num">${BRL(r.custo.totalHa)}</td></tr><tr><td colspan="3">Total para ${fmt(ctx.area, 1)} ha</td><td class="num">${BRL(r.custo.totalArea)}</td></tr></tfoot></table>${r.custo.semPreco.length ? `<div class="small muted">Sem preço: ${esc(r.custo.semPreco.join(', '))} — importe o estoque do PVGest/Gefaz360 ou informe no item.</div>` : ''}</div>
  ${r.tanque ? `<div class="card"><div class="card-hd"><h2>Ficha de tanque</h2><span class="hint">${r.tanque.tanque} L · ${fmt(r.tanque.haPorCarga, 2)} ha por carga</span></div><div class="kpis"><div class="kpi"><b>${fmt(r.tanque.volumeTotal)}</b><small>L de calda</small></div><div class="kpi"><b>${r.tanque.cargasCheias}</b><small>cargas cheias</small></div><div class="kpi"><b>${fmt(r.tanque.ultimaCarga)}</b><small>L na última carga</small></div></div><table class="tb"><thead><tr><th>Produto (ordem)</th><th class="num">Por carga cheia</th><th class="num">Última carga</th><th class="num">Total</th></tr></thead><tbody>${r.tanque.porCargaCheia.map((i, k) => `<tr><td>${k + 1}. ${esc(i.nome)}</td><td class="num">${fmt(i.qtd, 3)} ${i.unidade}</td><td class="num">${r.tanque.ultimaCargaItens[k] ? fmt(r.tanque.ultimaCargaItens[k].qtd, 3) + ' ' + i.unidade : '—'}</td><td class="num">${fmt(r.tanque.totalPorProduto[k].qtd, 2)} ${i.unidade}</td></tr>`).join('')}</tbody></table></div>` : ''}
  <div class="card"><div class="card-hd"><h2>Registro MAPA (Agrofit)</h2></div><table class="tb"><thead><tr><th>Produto</th><th>${esc(ctx.cultura)}</th><th>Alvo</th><th>Classe toxicológica</th></tr></thead><tbody>${r.registro.map(g => `<tr><td>${esc(g.nome)}</td><td>${g.registrado === null ? '<span class="tag">não verificado</span>' : g.registrado ? '<span class="tag reg">registrado</span>' : '<span class="tag noreg">sem registro</span>'}</td><td>${g.alvoOk === null ? (g.alvos.length ? `<small>${esc(g.alvos.slice(0, 4).join('; '))}${g.alvos.length > 4 ? '…' : ''}</small>` : '—') : g.alvoOk ? '<span class="tag reg">alvo na bula</span>' : '<span class="tag noreg">alvo não consta</span>'}</td><td>${tagTox(r.itens.find(i => i.id === g.id))}</td></tr>`).join('')}</tbody></table>${blocoEPI(r)}</div>
  ${blocoRegulagem(r)}
  ${blocoTalhao(r)}
  ${blocoProxima(r)}
  ${blocoReentrada(r)}
  ${blocoColheita(r)}
  ${blocoCiclo(r)}
  ${blocoRastreio(r)}
  <div class="card"><div class="card-hd"><h2>Checklist pré-saída</h2></div><ul class="check-list">${r.checklist.map(c => `<li><input type="checkbox"><span>${esc(c)}</span></li>`).join('')}</ul></div>
  ${ctx.obs ? `<div class="card"><div class="card-hd"><h2>Observações</h2></div><p>${esc(ctx.obs)}</p></div>` : ''}
  <div class="card small muted">Apoio à decisão técnica. Não substitui bula, receituário agronômico (IN 40/2018) nem o jar test. Confiança abaixo de 0,70 é indicativa.</div>`;
  $('#btnPrint').onclick = () => { document.body.classList.remove('print-resumido'); $$('#resultado details').forEach(d => { d.open = true; }); window.print(); };
  $('#btnPrintRes').onclick = () => { document.body.classList.add('print-resumido'); window.print(); };
  $('#btnJar').onclick = () => navTo('jar');
  $('#btnAgenda').onclick = () => exportarAgendaDoLaudo();
  const itensDoLaudo = JSON.parse(JSON.stringify(calda.itens));
  $('#btnExpLaudo').onclick = () => download(`laudo-calda-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda', versao: E.versao, calda: { itens: itensDoLaudo, ...ctx }, resultado: resumoExport() }, null, 1));
  $('#btnExpReceita').onclick = () => download(`receita-gefaz-calda-${hoje()}.json`, JSON.stringify(exportPVGestFormat([caldaComoReceita()]), null, 1));
  $('#btnEnvPV').onclick = enviarParaPVGest; $('#btnEnvG360').onclick = enviarParaGefaz360; $('#btnEnvCodex').onclick = enviarParaCodex;
  $$('#resultado button').forEach(b => { const acao = b.onclick; if (acao) b.onclick = ev => { if (conferirResultadoAtual()) acao(ev); }; });
}
/* Classe toxicológica do registro no MAPA (AGROFIT traz a categoria 1–5/NC ou o nome da classe antiga) */
const TOX = { 1: ['Cat. 1', 'extremamente tóxico', 'noreg'], 2: ['Cat. 2', 'altamente tóxico', 'noreg'], 3: ['Cat. 3', 'moderadamente tóxico', 'amar'], 4: ['Cat. 4', 'pouco tóxico', 'azul'], 5: ['Cat. 5', 'improvável de causar dano agudo', 'reg'], NC: ['NC', 'não classificado', 'reg'] };
function infoTox(v) {
  const s = String(v == null ? '' : v).trim(); if (!s) return null;
  const k = norm(s), chave = TOX[s] ? s : k.startsWith('extremamente') ? 1 : k.startsWith('altamente') ? 2 : k.startsWith('mediana') || k.startsWith('moderada') ? 3 : k.startsWith('pouco') ? 4 : k === 'nc' ? 'NC' : null;
  return chave ? { chave, sigla: TOX[chave][0], nome: TOX[chave][1], cls: TOX[chave][2] } : { chave: null, sigla: '', nome: s.slice(0, 30).toLowerCase(), cls: '' };
}
function tagTox(item) {
  const t = infoTox(item && item.agrofit && item.agrofit.tox); if (!t) return '<span class="muted">—</span>';
  return `<span class="tag ${t.cls}">${t.sigla ? t.sigla + ' · ' : ''}${esc(t.nome)}</span>`;
}
function blocoEPI(r) {
  const tox = r.itens.map(i => ({ nome: i.nome, t: infoTox(i.agrofit && i.agrofit.tox) })).filter(x => x.t);
  const fortes = tox.filter(x => x.t.chave !== null && [1, 2].includes(Number(x.t.chave)));
  if (!tox.length) return '';
  return `${fortes.length ? `<div class="al alta"><div class="t"><span>Produto de categoria toxicológica 1 ou 2 na calda</span></div><div class="d">${esc(fortes.map(x => x.nome).join(', '))}: atenção redobrada no preparo e na aplicação.</div><div class="c">→ Confira na bula e no receituário os EPIs e os cuidados exigidos; só aplicador treinado.</div></div>` : ''}
    <div class="small muted">Classe toxicológica conforme o registro no MAPA/Anvisa (AGROFIT). Os EPIs e os cuidados de cada produto são os da bula e do receituário agronômico.</div>`;
}
function blocoRegulagem(r) {
  const g = r.regulagem;
  if (!g) return `<div class="card"><div class="card-hd"><h2>Regulagem aplicada</h2><span class="hint">não anexada</span></div><div class="al baixa"><div class="t"><span>Este laudo não registra a regulagem</span></div><div class="d">A dose por hectare só se cumpre se a barra entregar o volume de calda para o qual ela foi calculada.</div><div class="c">→ Calcule na aba <b>Pontas</b> e anexe em <b>3 · Rastreabilidade</b>.</div></div></div>`;
  const p = g.ponta, c = g.clima, cal = g.calibracao;
  const conf = g.desvio == null ? '' : Math.abs(g.desvio) <= 5
    ? `<div class="al info"><div class="t"><span>Volume confere</span></div><div class="d">A regulagem entrega ${fmt(g.volumeEntregue, 0)} L/ha e as doses foram calculadas para ${fmt(g.volumeDosado, 0)} L/ha (desvio de ${fmt(g.desvio, 1)} %).</div></div>`
    : `<div class="al ${Math.abs(g.desvio) > 15 ? 'alta' : 'media'}"><div class="t"><span>Volume fora do alvo: ${g.desvio > 0 ? '+' : ''}${fmt(g.desvio, 1)} %</span></div><div class="d">A regulagem entrega ${fmt(g.volumeEntregue, 0)} L/ha e a calda foi montada para ${fmt(g.volumeDosado, 0)} L/ha.</div><div class="c">→ Acertar pressão ou velocidade, ou refazer as doses para o volume real.</div></div>`;
  return `<div class="card">
    <div class="card-hd"><h2>Regulagem aplicada</h2><span class="hint">${esc(g.nome || g.origem || '')}${g.modo === 'faixa' ? ' · faixa dirigida' : ' · área total'}</span></div>
    <div class="ponta-resumo">${p ? `<b>${esc(p.marca + ' ' + p.modelo)}</b>` : '<b>sem ponta</b>'} ${corBadge(g.iso)} ${gotaBadge(g.gota)}${g.angulo ? `<span class="tag">${g.angulo}°</span>` : ''}${g.modo === 'faixa' && g.protecao ? '<span class="tag">proteção física contra deriva</span>' : ''}</div>
    <div class="kpis">
      <div class="kpi"><b>${fmt(g.pressao, 2)} bar</b><small>${g.pressaoCalculada ? 'pressão necessária' : 'pressão fixada'}</small></div>
      <div class="kpi"><b>${fmt(g.vazaoPorBico, 3)}</b><small>L/min por bico</small></div>
      <div class="kpi"><b>${fmt(g.vazaoTotal, 1)}</b><small>L/min no conjunto</small></div>
      <div class="kpi"><b>${fmt(g.velocidade, 1)}</b><small>km/h${(vm => vm ? ' · medida em ' + fmt(vm.distancia, 0) + ' m: ' + fmt(vm.tempoMedio, 1) + ' s' : '')(g.entrada && PT.velocidadeMedida(g.entrada.distancia, g.entrada.tempos))}</small></div>
      <div class="kpi"><b>${fmt(g.volumeEntregue, 0)}</b><small>L/ha ${g.modo === 'faixa' ? 'de lavoura' : 'aplicados'}</small></div>
      ${g.modo === 'faixa'
      ? `<div class="kpi"><b>${fmt(g.larguraFaixa, 2)} m</b><small>faixa em ${fmt(g.entreLinhas, 1)} m de rua</small></div><div class="kpi"><b>${fmt(g.economia, 0)} %</b><small>economia de produto</small></div>`
      : `<div class="kpi"><b>${g.nBicos}</b><small>bicos a ${fmt(g.espacamento, 2)} m</small></div><div class="kpi"><b>${fmt(g.larguraTrabalho, 1)} m</b><small>largura de trabalho</small></div>`}
      ${g.altura ? `<div class="kpi"><b>${g.altura} cm</b><small>altura da ponta</small></div>` : ''}
      <div class="kpi"><b>${fmt(g.rendimento, 2)}</b><small>ha/h teórico</small></div>
    </div>
    ${conf}
    ${c && c.deltaT != null ? `<div class="al ${c.pode ? 'info' : (c.nivel || 'media')}"><div class="t"><span>Condição do ar no registro: Delta T ${fmt(c.deltaT, 1)} · ${esc(c.rotulo)}</span></div><div class="d">${fmt(c.temperatura, 1)} °C · ${fmt(c.umidade, 0)} % de umidade · vento ${fmt(c.vento, 1)} km/h (${esc(c.ventoRotulo || '')}) · bulbo úmido ${fmt(c.bulboUmido, 1)} °C · ponto de orvalho ${fmt(c.pontoOrvalho, 1)} °C.</div><div class="c">→ ${esc(c.conduta)}</div></div>` : ''}
    ${cal ? `<div class="al ${cal.veredito === 'bom' || cal.veredito === 'aceitavel' ? 'info' : 'media'}"><div class="t"><span>Calibração a campo: ${esc(cal.veredito)}</span></div><div class="d">${cal.bicos} bico(s) coletados em ${cal.segundos} s · média ${fmt(cal.media, 3)} L/min · CV ${fmt(cal.cv, 1)} %${cal.volumeReal ? ' · volume real ' + fmt(cal.volumeReal, 0) + ' L/ha' : ''}${cal.erro != null ? ' (erro de ' + fmt(cal.erro, 1) + ' % contra o alvo)' : ''}.</div>${cal.correcao ? `<div class="c">→ ${esc(cal.correcao)}</div>` : ''}</div>` : ''}
    ${g.formulas && g.formulas.length ? `<details class="small"><summary>Como esses números foram obtidos</summary><table class="tb formulas"><tbody>${g.formulas.map(f => `<tr><td>${esc(f.nome)}</td><td><code>${esc(f.formula)}</code></td><td><code>${esc(f.calculo)}</code></td><td><b>${esc(f.resultado)}</b></td></tr>`).join('')}</tbody></table></details>` : ''}
  </div>`;
}

function blocoTalhao(r) {
  const tl = r.historicoTalhoes || []; if (!tl.length) return '';
  const rotulo = { compativel: 'compatível', restricoes: 'com restrições', incompativel: 'incompatível', testar: 'testar' };
  return `<div class="card so-completo">
    <div class="card-hd"><h2>Histórico do talhão</h2><span class="hint">até a emissão deste laudo · aplicadas = marcadas como feitas</span></div>
    ${tl.map(t => {
      const u = t.ultimaAplicacao, dias = u ? diasDesde(u.iso) : null;
      const cab = `${t.area ? fmt(t.area, 2) + ' ha' : 'sem área cadastrada'}${t.cultura ? ' · ' + esc(t.cultura) : ''} · ${t.nAplicadas} aplicada(s) · ${t.total - t.nAplicadas} só análise`;
      return `<div class="sub-hd">${esc(t.nome)} <span class="hint">${cab}</span></div>
      ${u ? `<div class="small">Última aplicação: <b>${esc(soData(u))}</b>${dias != null ? ' (há ' + dias + ' dia(s))' : ''} — ${esc(u.produtos.join(' + '))}</div>` : `<div class="small muted">${t.total ? 'Nenhuma aplicação marcada como feita ainda.' : 'Talhão sem registros anteriores.'}</div>`}
      ${(t.repeticoes || []).length ? `<div class="al media"><div class="t"><span>Repetido em aplicação recente deste talhão</span><span class="sev media">${t.repeticoes.length}</span></div>
        ${t.repeticoes.map(l => `<div class="d"><b>${{ produto: 'Mesmo produto', ativo: 'Mesmo ingrediente ativo', moa: 'Mesmo modo de ação', grupo: 'Mesmo grupo químico' }[l.tipo]}: ${esc(l.valor)}</b> — ${esc(l.atual.join(', '))} agora × ${esc(l.anterior.join(', '))} em ${esc(l.data)}</div>`).join('')}
        <div class="c">→ Alterne modos de ação (FRAC/IRAC/HRAC) entre aplicações, confira o intervalo de segurança e o número máximo de aplicações por ciclo na bula.</div><div class="f">Comparação com as últimas 3 aplicações marcadas como feitas · adjuvantes e foliares não entram · grupo químico só quando falta o código de modo de ação</div></div>` : ''}
      ${t.registros.length ? `<table class="tb"><thead><tr><th>Data</th><th>Produtos</th><th>Alvos</th><th class="num">ha</th><th>Situação</th></tr></thead><tbody>${t.registros.map(a => `<tr><td>${esc(a.data)}</td><td>${esc(a.produtos.join(' + '))}</td><td>${esc(a.alvos || '—')}</td><td class="num">${a.area ? fmt(a.area, 1) : '—'}</td><td>${a.aplicada ? '<span class="tag reg">aplicada</span>' : '<span class="tag">só análise</span>'} <small>${esc(rotulo[a.status] || a.status || '')}</small></td></tr>`).join('')}</tbody></table>${t.total > t.registros.length ? `<div class="small muted">+ ${t.total - t.registros.length} registro(s) mais antigos no app.</div>` : ''}` : ''}`;
    }).join('')}
  </div>`;
}
const dataBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
function blocoProxima(r) {
  const p = r.proximaAplicacao; if (!p) return '';
  const origem = { termino: 'término da aplicação', inicio: 'início da aplicação', emissao: 'data da emissão do laudo (horário de início/término em branco)' }[p.origemBase];
  const dias = p.liberadoEm ? Math.round((new Date(p.liberadoEm + 'T00:00') - new Date(p.base + 'T00:00')) / 864e5) : 0;
  return `<div class="card">
    <div class="card-hd"><h2>Próxima aplicação permitida</h2><span class="hint">intervalo mínimo entre aplicações informado por produto</span></div>
    ${p.liberadoEm ? `<div class="codigo-laudo"><b>${dataBR(p.liberadoEm)}</b><small>a partir desta data, ${dias} dia(s) após ${dataBR(p.base)} (${origem}) · limitante: ${esc(p.limitante)}</small></div>
      <table class="tb"><thead><tr><th>Produto</th><th class="num">Intervalo</th><th class="num">Liberado em</th></tr></thead><tbody>${p.linhas.map(l => `<tr><td>${esc(l.nome)}</td><td class="num">${l.intervalo} d</td><td class="num">${dataBR(l.liberadoEm)}</td></tr>`).join('')}</tbody></table>`
      : `<div class="al baixa"><div class="t"><span>Sem data: nenhum intervalo informado</span></div><div class="d">Este app não traz o intervalo entre aplicações de nenhum produto, e a data não é estimada.</div><div class="c">→ Preencha “Intervalo mín. (dias)” em cada produto, conforme a bula ou o receituário, e analise de novo.</div></div>`}
    ${((r.aplicacoesCiclo || {}).ultimas || []).concat((r.aplicacoesCiclo || {}).excedidos || []).map(l => `<div class="al alta"><div class="t"><span>${l.situacao === 'excedido' ? 'Acima do máximo de aplicações' : 'Sem próxima aplicação neste ciclo'}${l.talhao ? ' — ' + esc(l.talhao) : ''}</span></div><div class="d">${esc(l.nome)} ${l.situacao === 'excedido' ? 'passaria de' : 'chega a'} ${l.max} aplicação(ões) por ciclo${l.situacao === 'excedido' ? '' : ' com esta: a data acima só vale para produtos que ainda têm aplicações no ciclo'}.</div></div>`).join('')}
    ${p.semIntervalo.length ? `<div class="al media"><div class="t"><span>Sem intervalo informado</span></div><div class="d">${esc(p.semIntervalo.join(', '))} — a data acima não os considera.</div><div class="c">→ Confira na bula antes de programar a próxima entrada.</div></div>` : ''}
    ${p.conflitos.map(c => `<div class="al alta"><div class="t"><span>Dentro do intervalo no talhão ${esc(c.talhao)}</span></div><div class="d">${esc(c.nome)} foi aplicado em ${dataBR(c.ultima)} e o intervalo é de ${c.intervalo} dias: liberado só em <b>${dataBR(c.liberadoEm)}</b> (faltam ${c.diasFaltam} dia(s) em relação à data desta aplicação).</div><div class="c">→ Adiar a aplicação ou trocar o produto, salvo orientação do responsável técnico.</div></div>`).join('')}
    <div class="small muted">O intervalo entre aplicações e o número máximo de aplicações por ciclo são os da bula/receituário — o Agrofit aberto não traz esses valores. Não confundir com a carência (dias até a colheita).</div>
  </div>`;
}
function blocoColheita(r) {
  const c = r.colheitaLiberada; if (!c) return '';
  const origem = { termino: 'término da aplicação', inicio: 'início da aplicação', emissao: 'data da emissão do laudo (horário de início/término em branco)' }[c.origemBase];
  const dias = c.liberadoEm ? Math.round((new Date(c.liberadoEm + 'T00:00') - new Date(c.base + 'T00:00')) / 864e5) : 0;
  const tal = (c.talhoes || []).filter(t => t.liberadoEm);
  return `<div class="card">
    <div class="card-hd"><h2>Carência e colheita liberada</h2><span class="hint">carência informada por produto · dias entre a aplicação e a colheita</span></div>
    ${c.liberadoEm ? `<div class="codigo-laudo"><b>${dataBR(c.liberadoEm)}</b><small>colheita liberada a partir desta data, ${dias} dia(s) após ${dataBR(c.base)} (${origem}) · limitante: ${esc(c.limitante)}</small></div>
      <table class="tb"><thead><tr><th>Produto</th><th class="num">Carência</th><th class="num">Colheita liberada em</th></tr></thead><tbody>${c.linhas.map(l => `<tr><td>${esc(l.nome)}</td><td class="num">${l.carencia ? l.carencia + ' d' : 'sem carência'}</td><td class="num">${dataBR(l.liberadoEm)}</td></tr>`).join('')}</tbody></table>`
      : `<div class="al baixa"><div class="t"><span>Sem data: nenhuma carência informada</span></div><div class="d">Este app não traz a carência dos produtos (o Agrofit aberto não a publica), e a data não é estimada.</div><div class="c">→ Preencha “Carência (dias)” em cada produto, conforme a bula ou o receituário, e analise de novo.</div></div>`}
    ${tal.length ? `<div class="sub-hd">Por talhão <span class="hint">vale o que vence por último, contando aplicações anteriores já marcadas como feitas</span></div>
      <table class="tb"><thead><tr><th>Talhão</th><th class="num">Colheita liberada em</th><th>Limitante</th></tr></thead><tbody>${tal.map(t => `<tr><td>${esc(t.talhao)}</td><td class="num"><b>${dataBR(t.liberadoEm)}</b></td><td>${esc(t.limitante.nome)} <small>${t.limitante.origem === 'esta' ? 'esta aplicação' : 'aplicação de ' + dataBR(t.limitante.aplicadoEm)}</small></td></tr>`).join('')}</tbody></table>` : ''}
    ${c.semCarencia.length ? `<div class="al media"><div class="t"><span>Sem carência informada</span></div><div class="d">${esc(c.semCarencia.join(', '))} — a data acima não os considera.</div><div class="c">→ Confira na bula antes de liberar a colheita.</div></div>` : ''}
    <div class="small muted">A carência (intervalo de segurança) é a da bula/receituário para a cultura; muda entre culturas e produtos. Zero significa sem carência. Não substitui o receituário agronômico.</div>
  </div>`;
}
const dataHoraBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : dataBR(iso); };
function blocoReentrada(r) {
  const c = r.reentrada; if (!c || (!c.linhas.length && !c.semReentrada.length)) return '';
  const origem = { termino: 'término da aplicação', inicio: 'início da aplicação — informe o término para contar certo', emissao: 'hora da emissão do laudo (início/término em branco)' }[c.origemBase];
  return `<div class="card">
    <div class="card-hd"><h2>Reentrada na área tratada</h2><span class="hint">horas informadas por produto · da bula/receituário</span></div>
    ${c.liberadoEm ? `<div class="codigo-laudo"><b>${dataHoraBR(c.liberadoEm)}</b><small>reentrada liberada a partir deste horário · contada do ${origem} (${dataHoraBR(c.base)}) · limitante: ${esc(c.limitante)}</small></div>
      <table class="tb"><thead><tr><th>Produto</th><th class="num">Reentrada</th><th class="num">Liberada em</th></tr></thead><tbody>${c.linhas.map(l => `<tr><td>${esc(l.nome)}</td><td class="num">${l.horas ? l.horas + ' h' : 'sem restrição'}</td><td class="num">${dataHoraBR(l.liberadoEm)}</td></tr>`).join('')}</tbody></table>`
      : `<div class="al baixa"><div class="t"><span>Sem horário: nenhuma reentrada informada</span></div><div class="d">Preencha “Reentrada (horas)” em cada produto, conforme a bula ou o receituário, e analise de novo. O app não estima esse número.</div></div>`}
    ${c.semReentrada.length ? `<div class="al media"><div class="t"><span>Sem reentrada informada</span></div><div class="d">${esc(c.semReentrada.join(', '))} — o horário acima não os considera.</div><div class="c">→ Sinalize a área e só libere a entrada depois de conferir a bula.</div></div>` : ''}
    <div class="small muted">Reentrada é o tempo mínimo, contado do término da aplicação, para pessoas voltarem à área tratada, conforme a bula e o receituário (NR-31). Não substitui o receituário agronômico.</div>
  </div>`;
}
function blocoCiclo(r) {
  const c = r.aplicacoesCiclo; if (!c || (!c.linhas.length && !c.semLimite.length)) return '';
  const sit = { ok: '<span class="tag reg">dentro do limite</span>', ultima: '<span class="tag noreg">última permitida</span>', excedido: '<span class="tag noreg">acima do máximo</span>' };
  const semIni = c.linhas.some(l => l.talhao && !l.cicloInicio);
  return `<div class="card">
    <div class="card-hd"><h2>Aplicações por ciclo</h2><span class="hint">máximo da bula por produto · conta as feitas no talhão + esta</span></div>
    ${c.linhas.length ? `<table class="tb"><thead><tr><th>Produto</th><th>Talhão</th><th class="num">Já feitas</th><th class="num">Esta é a</th><th class="num">Máximo</th><th>Situação</th></tr></thead><tbody>${c.linhas.map(l => `<tr><td>${esc(l.nome)}</td><td>${l.talhao ? esc(l.talhao) : '<span class="muted">—</span>'}${l.cicloInicio ? ` <small class="muted">ciclo desde ${dataBR(l.cicloInicio)}</small>` : ''}</td><td class="num">${l.feitas}</td><td class="num">${l.comEsta}ª</td><td class="num">${l.max}</td><td>${sit[l.situacao]}</td></tr>`).join('')}</tbody></table>`
      : `<div class="al baixa"><div class="t"><span>Nenhum máximo informado</span></div><div class="d">Este app não traz o número máximo de aplicações por ciclo (o Agrofit aberto não o publica).</div><div class="c">→ Preencha “Máx. aplic./ciclo” em cada produto, conforme a bula ou o receituário, e analise de novo.</div></div>`}
    ${c.excedidos.map(l => `<div class="al alta"><div class="t"><span>Acima do máximo de aplicações${l.talhao ? ' no talhão ' + esc(l.talhao) : ''}</span></div><div class="d">${esc(l.nome)}: esta seria a ${l.comEsta}ª aplicação no ciclo e a bula permite ${l.max}.</div><div class="c">→ Não aplicar; trocar de produto ou consultar o responsável técnico.</div></div>`).join('')}
    ${c.ultimas.map(l => `<div class="al media"><div class="t"><span>Última aplicação permitida${l.talhao ? ' no talhão ' + esc(l.talhao) : ''}</span></div><div class="d">${esc(l.nome)}: esta é a ${l.comEsta}ª de ${l.max}; depois dela não há próxima aplicação deste produto neste ciclo.</div><div class="c">→ Planeje o restante do ciclo com outro produto ou modo de ação.</div></div>`).join('')}
    ${c.semLimite.length ? `<div class="al media"><div class="t"><span>Sem máximo informado</span></div><div class="d">${esc(c.semLimite.join(', '))} — não entram na contagem.</div><div class="c">→ Confira o número máximo de aplicações na bula.</div></div>` : ''}
    ${c.semTalhao && c.linhas.length ? '<div class="small muted">Nenhum talhão marcado: só esta aplicação foi contada. Marque o talhão na aba Calda para contar o histórico.</div>' : ''}
    ${semIni ? '<div class="small muted">Talhão sem início de ciclo definido: contadas todas as aplicações registradas. Informe o início do ciclo (safra) no cadastro do talhão para contar só as do ciclo atual.</div>' : ''}
    <div class="small muted">A contagem é por produto (nome), só com aplicações marcadas como feitas no talhão. O limite pode valer também por ingrediente ativo ou por cultura na bula — confira.</div>
  </div>`;
}
function blocoRastreio(r) {
  const t = r.rastreio; if (!t) return '';
  const campo = k => (t.campos.find(c => c.chave === k) || {}).valor || '';
  // datetime-local chega como AAAA-MM-DDTHH:MM; na tela vira data brasileira,
  // no texto canônico fica o ISO, que não muda de formato com o navegador.
  const dtBR = v => (v.length === 16 && v[4] === '-' && v[7] === '-' && v[10] === 'T')
    ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)} ${v.slice(11, 16)}` : v;
  return `<div class="card">
    <div class="card-hd"><h2>Rastreabilidade</h2><span class="hint">${t.completo ? 'registro completo' : t.pendencias.length + ' campo(s) em branco'}</span></div>
    <div class="codigo-laudo"><b>${esc(t.codigo)}</b><small>código de conferência do laudo${t.emitido ? ' · emitido em ' + esc(t.emitido) : ''}</small></div>
    <table class="tb"><tbody>
      ${t.fazenda ? `<tr><th>Fazenda</th><td>${esc(t.fazenda)}</td></tr>` : ''}
      ${t.campos.map(c => `<tr><th>${esc(c.rotulo)}</th><td>${c.valor ? esc(dtBR(c.valor)) : (c.exigido ? '<span class="tag noreg">em branco</span>' : '<span class="muted">—</span>')}</td></tr>`).join('')}
    </tbody></table>
    <div class="sub-hd">Lotes aplicados</div>
    <table class="tb"><thead><tr><th>Produto</th><th>Lote da embalagem</th></tr></thead><tbody>${t.lotes.map(l => `<tr><td>${esc(l.nome)}</td><td>${l.lote ? esc(l.lote) : '<span class="tag noreg">não anotado</span>'}</td></tr>`).join('')}</tbody></table>
    <details class="small"><summary>Texto conferido pelo código</summary><pre class="canonico">${esc(t.canonico)}</pre><p class="muted">O código é um resumo (hash FNV-1a de 32 bits) deste texto. Mudou uma dose, um lote, a regulagem ou o talhão, muda o código — é o que casa o papel impresso com o registro em JSON. Não é assinatura digital: prova que dois registros são o mesmo, não quem os emitiu.</p></details>
    <div class="print-only assinaturas">
      <div><span></span>${esc(campo('operador') || 'Operador')}<br><small>operador / aplicador</small></div>
      <div><span></span>${esc(campo('responsavel') || 'Responsável técnico')}<br><small>responsável técnico${campo('crea') ? ' — ' + esc(campo('crea')) : ''}</small></div>
    </div>
  </div>`;
}

function matrizHTML(r) {
  const its = r.itens; if (its.length < 2) return '<div class="small muted">Adicione dois ou mais produtos para a matriz.</div>';
  const st = (a, b) => { const p = r.pares.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); return p || { status: 'self', alertas: [] }; };
  return `<table><tr><th></th>${its.map(i => `<th>${esc(i.nome.slice(0, 18))}</th>`).join('')}</tr>${its.map(a => `<tr><th>${esc(a.nome.slice(0, 22))}</th>${its.map(b => { if (a.id === b.id) return '<td class="self">—</td>'; const p = st(a.id, b.id); return `<td class="${p.status}" title="${esc(p.alertas.join('; ') || STATUS_LABEL[p.status] || p.status)}">${{ compativel: '✔', atencao: 'ⓘ', restricoes: '△', incompativel: '✖', 'nao-testado': '?' }[p.status] || ''}</td>`; }).join('')}</tr>`).join('')}</table>`;
}

/* ───────── jar test ───────── */
let jarTimer = null, jarStart = null;
function renderJar() {
  const r = resultado, el = $('#jar'); if (!r) return;
  clearInterval(jarTimer); jarTimer = null; jarStart = null;
  const j = r.jarTest;
  el.innerHTML = `<div class="card"><div class="card-hd"><h2>Jar test — ${j.obrigatorio ? '<span class="pill bad">obrigatório</span>' : '<span class="pill info">recomendado</span>'}</h2><span class="hint">proporção real para ${r.contexto.volumeHa} L/ha, em 1 L</span></div>
    ${j.historico.length ? `<div class="alert warn">Esta combinação já foi testada: ${j.historico.map(h => `${esc(h.data)} → <b>${esc(h.resultado)}</b>${h.obs ? ' (' + esc(h.obs) + ')' : ''}`).join(' · ')}</div>` : ''}
    <table class="tb"><thead><tr><th>Ordem</th><th>Produto</th><th class="num">Quantidade em 1 L</th></tr></thead><tbody>${j.proporcao.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nome)}</td><td class="num"><b>${fmt(p.porLitro, 2)} ${p.unidade}</b></td></tr>`).join('')}</tbody></table>
    <ol class="small" style="padding-left:18px">${j.passos.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>
    <div class="card"><div class="card-hd"><h2>Cronômetro</h2><span class="hint">leituras aos 0 · 15 · 30 · 120 min</span></div><div class="timer" id="jarTimer">00:00</div><div class="row-btns"><button class="btn primary" id="jarStart">▶ Iniciar</button><button class="btn ghost" id="jarStop">■ Parar</button></div></div>
    <div class="card"><div class="card-hd"><h2>Registro do teste</h2></div>
      <div class="obs-grid">${['Floculação (flocos)', 'Decantação / sedimento', 'Separação de fases / óleo', 'Cristais', 'Grumos / pasta', 'Espuma excessiva', 'Mudança de cor', 'Aquecimento'].map((o, i) => `<label class="check"><input type="checkbox" class="jarObs" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div>
      <div class="grid2"><label>pH medido da calda<input id="jarPh" type="number" step="0.1"></label><label>Resultado<select id="jarRes"><option value="compativel">Compatível (homogênea após 2 h)</option><option value="restricoes">Compatível com ressalvas (leve sedimento redispersível)</option><option value="incompativel">Incompatível</option></select></label></div>
      <label>Observações<textarea id="jarObsTxt" rows="2" placeholder="água usada, temperatura, o que apareceu e quando"></textarea></label>
      <div class="row-btns"><button class="btn primary" id="jarSave">💾 Registrar jar test</button></div></div>`;
  $('#jarStart').onclick = () => { jarStart = Date.now(); clearInterval(jarTimer); jarTimer = setInterval(() => { const s = Math.floor((Date.now() - jarStart) / 1000); const m = Math.floor(s / 60); $('#jarTimer').textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); if ([15, 30, 120].includes(m) && s % 60 === 0) { toast(`Leitura de ${m} min`); if (navigator.vibrate) navigator.vibrate(300); } }, 1000); };
  $('#jarStop').onclick = () => clearInterval(jarTimer);
  $('#jarSave').onclick = () => {
    if (!conferirResultadoAtual()) return;
    const obs = $$('.jarObs:checked').map(c => c.value);
    const resSel = $('#jarRes').value;
    if (resSel !== 'incompativel' && obs.some(o => /Grumos|Separação|Cristais|Floculação/.test(o))) { if (!confirm('Você marcou sinais de incompatibilidade mas classificou como compatível. Registrar mesmo assim?')) return; }
    DB.jarTests.unshift({ id: uid(), chave: r.chave, data: agora(), itens: r.itens.map(i => i.nome), cultura: r.contexto.cultura, volumeHa: r.contexto.volumeHa, ph: $('#jarPh').value, observacoes: obs, resultado: resSel, obs: $('#jarObsTxt').value });
    saveDB(); toast('Jar test registrado — entra na base da fazenda'); renderHistorico(); analisar(true); navTo('resultado');
  };
}

/* ───────── histórico e caldas ───────── */
function caldaComoReceita() { conferirResultadoAtual(); const ctx = lerContexto(); return { id: uid(), nome: `Calda ${ctx.cultura}${ctx.alvo ? ' — ' + textoAlvos(ctx.alvos, true).slice(0, 3).join(', ') + (textoAlvos(ctx.alvos).length > 3 ? '…' : '') : ''} ${hoje()}`, cultura: ctx.cultura, alvo: ctx.alvo, alvos: ctx.alvos, doenca: ctx.doenca, praga: ctx.praga, severidade: ctx.severidade, estadio: ctx.estadio, parte: ctx.parte, volumeHa: ctx.volumeHa, itens: calda.itens.map(i => ({ nome: i.nome, dose: i.dose, lote: i.lote, unidade: i.unidade, classe: i.classe, formulacao: i.formulacao, preco: i.preco, intervalo: i.intervalo, carencia: i.carencia, maxAplic: i.maxAplic, reentrada: i.reentrada, ativos: i.ativos, ingredientes: i.ingredientes, materiaPrima: i.materiaPrima, registro: i.registro, tags: i.tags, fonte: i.fonte })), agua: ctx.agua, equipamento: ctx.equipamento, area: ctx.area, tanque: ctx.tanque, rastreio: ctx.rastreio, obs: ctx.obs, fonte: 'gefaz-calda', status: resultado ? resultado.status : null }; }
function salvarCalda() { if (!calda.itens.length) return toast('Nada para salvar', 'err'); const nome = prompt('Nome da calda', caldaComoReceita().nome); if (!nome) return; const c = caldaComoReceita(); c.nome = nome; DB.caldas.unshift(c); saveDB(); toast('Calda salva'); renderHistorico(); }
function carregarReceita(rec) {
  calda.itens = rec.itens.map(i => ({ ...i, id: uid(), dose: +i.dose || 0, unidade: i.unidade || 'L/ha' }));
  // Receita não comprova uma aplicação: só usa rastreio quando ele foi salvo nela.
  aplicarContexto({ ...rec, alvos: alvosLegados(rec), severidade: rec.severidade || '',
    estadio: rec.estadio || '', parte: rec.parte || '', obs: rec.obs || '',
    rastreio: { ...DB.config.rastreio, talhao: '', receituario: '', inicio: '', termino: '', ...(rec.rastreio || {}) } });
  renderItens(); navTo('calda'); toast(`Receita “${rec.nome}” carregada`);
}
/* custo de defensivos das aplicações já feitas no ciclo do talhão (desde o início do ciclo, se definido) */
function custoDoCiclo(t) {
  const ini = t.cicloInicio ? Date.parse(t.cicloInicio) : null;
  const feitas = (t.aplicacoes || []).filter(a => a.aplicada && (!ini || Date.parse(a.quando) >= ini));
  const total = feitas.reduce((s, a) => s + (a.custo || 0), 0);
  return { n: feitas.length, total, porHa: t.area > 0 ? total / t.area : null, incompleto: feitas.some(a => a.custo == null || a.semPreco) };
}
function resumoCustoTalhao(t) {
  const c = custoDoCiclo(t); if (!c.n) return '';
  return ' · custo no ciclo ' + BRL(c.total) + (c.porHa != null ? ' (' + BRL(c.porHa) + '/ha)' : '') + (c.incompleto ? ' ⚠ incompleto' : '');
}
function renderHistorico() {
  const badge = s => `<span class="pill ${{ compativel: 'ok', restricoes: 'warn', incompativel: 'bad', testar: 'info' }[s] || 'muted'}">${esc(STATUS_LABEL[s] || s || '—')}</span>`;
  const ordem = DB.talhoes.map((t, i) => ({ t, i })).sort((a, b) => a.t.nome.localeCompare(b.t.nome, 'pt-BR', { numeric: true }));
  $('#listaTalhoes').innerHTML = ordem.length ? ordem.map(({ t, i }) => {
    const ap = t.aplicacoes || [], nAp = ap.filter(a => a.aplicada).length;
    return `<details class="talhao-det"><summary><b>${esc(t.nome)}</b> <small>${t.area ? fmt(t.area, 2) + ' ha' : 'sem área'}${t.cultura ? ' · ' + esc(t.cultura) : ''} · ${nAp} aplicada(s) · ${ap.length - nAp} só análise${resumoCustoTalhao(t)}</small></summary>
      <div class="lista">${ap.length ? ap.map((a, j) => `<div class="row"><div><b>${esc(a.produtos.join(' + '))}</b><small>${esc(a.data)}${a.area ? ' · ' + fmt(a.area, 2) + ' ha' : ''}${a.volumeHa ? ' · ' + a.volumeHa + ' L/ha' : ''} · ${esc(a.alvos || 'sem alvo')}${a.codigo ? ' · ' + esc(a.codigo) : ''}</small></div><div class="acts">${badge(a.status)}<button class="btn sm${a.aplicada ? '' : ' ghost'}" data-apl="${i}:${j}" title="Marque quando a aplicação foi feita de fato">${a.aplicada ? '✔ aplicada' : 'marcar aplicada'}</button></div></div>`).join('') : '<div class="small muted">Sem registros ainda — o talhão marcado na aba Calda entra aqui a cada análise.</div>'}</div>
      <div class="row-btns"><button class="btn sm" data-tuse="${i}">Usar na calda</button><button class="btn sm ghost" data-tcad="${i}" title="Todas as aplicações deste talhão, para imprimir ou abrir no Excel">📒 Caderno de campo</button><button class="btn sm ghost" data-tedit="${i}">✎ Editar</button><button class="btn sm ghost danger" data-tdel="${i}">Excluir</button></div></details>`;
  }).join('') : '<div class="small muted">Nenhum talhão. Cadastre na aba Calda (＋ Novo talhão) ou importe do PVGest/Gefaz360.</div>';
  $$('#listaTalhoes [data-apl]').forEach(b => b.onclick = () => { const [i, j] = b.dataset.apl.split(':'); const a = DB.talhoes[+i].aplicacoes[+j]; a.aplicada = !a.aplicada; saveDB(); renderHistorico(); renderTalhoes(); });
  $$('#listaTalhoes [data-tcad]').forEach(b => b.onclick = () => abrirCaderno([DB.talhoes[+b.dataset.tcad].nome]));
  $$('#listaTalhoes [data-tuse]').forEach(b => b.onclick = () => { definirTalhoes([DB.talhoes[+b.dataset.tuse].nome], true); navTo('calda'); });
  $$('#listaTalhoes [data-tedit]').forEach(b => b.onclick = () => { navTo('calda'); abrirFormTalhao(DB.talhoes[+b.dataset.tedit]); $('#talhaoForm').scrollIntoView({ block: 'center' }); });
  $$('#listaTalhoes [data-tdel]').forEach(b => b.onclick = () => excluirTalhao(DB.talhoes[+b.dataset.tdel]));
  $('#listaCaldas').innerHTML = DB.caldas.length ? DB.caldas.map((c, i) => `<div class="row"><div><b>${esc(c.nome)}</b><small>${esc(c.cultura)} · ${c.itens.length} produtos · ${c.volumeHa} L/ha ${c.status ? badge(c.status) : ''}</small></div><div class="acts"><button class="btn sm" data-load="${i}">Carregar</button><button class="btn sm ghost danger" data-delc="${i}">✕</button></div></div>`).join('') : '<div class="small muted">Nenhuma calda salva.</div>';
  $$('#listaCaldas [data-load]').forEach(b => b.onclick = () => carregarReceita(DB.caldas[+b.dataset.load]));
  $$('#listaCaldas [data-delc]').forEach(b => b.onclick = () => { if (confirm('Excluir esta calda?')) { DB.caldas.splice(+b.dataset.delc, 1); saveDB(); renderHistorico(); } });
  $('#listaHistorico').innerHTML = DB.historico.length ? DB.historico.slice(0, 30).map((h, i) => `<div class="row"><div><b>${esc(h.itens.join(' + '))}</b><small>${esc(h.data)} · ${esc(h.resumo)}</small></div><div class="acts">${badge(h.status)}<button class="btn sm" data-re="${i}">Reabrir</button></div></div>`).join('') : '<div class="small muted">Nenhuma análise ainda.</div>';
  $$('#listaHistorico [data-re]').forEach(b => b.onclick = () => { const h = DB.historico[+b.dataset.re]; calda.itens = h.calda.itens.map(i => ({ ...i, id: uid() })); aplicarContexto(h.calda); renderItens(); analisar(false, false); });
  $('#listaJar').innerHTML = DB.jarTests.length ? DB.jarTests.map((j, i) => `<div class="row"><div><b>${esc(j.itens.join(' + '))}</b><small>${esc(j.data)} · ${esc(j.cultura)} · ${j.volumeHa} L/ha${j.ph ? ' · pH ' + esc(j.ph) : ''}${j.observacoes.length ? ' · ' + esc(j.observacoes.join(', ')) : ''}${j.obs ? ' · ' + esc(j.obs) : ''}</small></div><div class="acts">${badge(j.resultado)}<button class="btn sm ghost danger" data-delj="${i}">✕</button></div></div>`).join('') : '<div class="small muted">Nenhum jar test registrado.</div>';
  $$('#listaJar [data-delj]').forEach(b => b.onclick = () => { if (confirm('Excluir este registro?')) { DB.jarTests.splice(+b.dataset.delj, 1); saveDB(); renderHistorico(); } });
}

/* ───────── integração ───────── */
function detectarApps() {
  const apps = [
    { key: 'pvgest_v1', nome: 'PVGest', parse: d => ({ produtos: (d.produtos || []).length, receitas: (d.receitas || []).length, talhoes: (d.talhoes || []).length }), importar: importPVGest },
    { key: 'pvgest-erp-v1', nome: 'Gefaz360', parse: d => ({ produtos: (d.defensivos || []).length, receitas: (d.receitas || []).length, talhoes: (d.talhoes || []).length }), importar: importGefaz360 },
    { key: 'pvgest-activities', nome: 'Gefaz360 Codex (Central PVGest)', parse: d => ({ atividades: Array.isArray(d) ? d.length : 0 }), importar: null }
  ];
  const el = $('#appsLocais');
  el.innerHTML = apps.map((a, i) => {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(a.key)); } catch { }
    if (!raw) return `<div class="row"><div><b>${a.nome}</b><small><code>${a.key}</code> não encontrado neste navegador/origem</small></div><span class="pill muted">ausente</span></div>`;
    const info = a.parse(raw);
    return `<div class="row"><div><b>${a.nome}</b><small>${Object.entries(info).map(([k, v]) => `${v} ${k}`).join(' · ')}</small></div><div class="acts">${a.importar ? `<button class="btn sm" data-app="${i}">Importar</button>` : '<span class="pill ok">conectado</span>'}</div></div>`;
  }).join('');
  el.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { const a = apps[+b.dataset.app]; try { a.importar(JSON.parse(localStorage.getItem(a.key))); } catch (e) { toast('Falha: ' + e.message, 'err'); } });
}
function mesclarCatalogo(lista) { let n = 0; lista.forEach(p => { const i = DB.catalogo.findIndex(x => norm(x.nome) === norm(p.nome)); if (i >= 0) DB.catalogo[i] = { ...DB.catalogo[i], ...p }; else { DB.catalogo.push(p); n++; } }); return n; }
function importPVGest(d) {
  if (d && d.app === 'gefaz-calda' && d.calda) { carregarReceita({ nome: 'Laudo importado', ...d.calda }); return; }
  if (!d || (!d.produtos && !d.receitas)) throw new Error('não parece um JSON do PVGest (esperado produtos/receitas)');
  const byId = id => (d.produtos || []).find(p => p.id === id) || {};
  const n = mesclarCatalogo((d.produtos || []).map(p => ({ id: 'pv:' + p.id, nome: p.nome, classe: p.classe, unidade: p.unidade, preco: +p.preco || 0, estoque: +p.estoque_atual || 0, fabricante: p.fabricante, fonte: 'pvgest' })));
  const recs = (d.receitas || []).map(r => ({ id: 'pv:' + r.id, nome: r.nome, cultura: r.cultura, alvo: r.alvo, volumeHa: +r.volume_ha || 200, obs: r.obs, fonte: 'pvgest', itens: (r.itens || []).map(i => { const p = byId(i.produto); return { nome: p.nome || i.nome_livre || '?', dose: +i.dose || 0, unidade: i.unidade || 'L/ha', classe: p.classe, preco: +p.preco || 0, fonte: 'pvgest' }; }) }));
  recs.forEach(r => { const i = DB.receitas.findIndex(x => x.id === r.id); if (i >= 0) DB.receitas[i] = r; else DB.receitas.push(r); });
  (d.talhoes || []).forEach(t => { if (!DB.talhoes.some(x => norm(x.nome) === norm(t.nome))) DB.talhoes.push({ nome: t.nome, area: +t.area || 0, cultura: t.cultura, fonte: 'pvgest' }); });
  if (d.config && d.config.mao_obra_ha != null) DB.config.custo.barra = (+d.config.mao_obra_ha || 0) + (+d.config.combustivel_ha || 0) + (+d.config.depreciacao_ha || 0) || DB.config.custo.barra;
  saveDB(); $('#impMsg').textContent = `PVGest: ${n} produtos novos, ${recs.length} receitas, ${(d.talhoes || []).length} talhões.`; toast('PVGest importado'); renderIntegracao();
}
function importGefaz360(payload) {
  const d = payload && payload.format === 'gefaz360-backup' ? payload.db : payload;
  if (!d || (!d.defensivos && !d.receitas)) throw new Error('não parece um backup do Gefaz360 (esperado defensivos/receitas)');
  const byId = id => (d.defensivos || []).find(p => p.id === id) || {};
  const n = mesclarCatalogo((d.defensivos || []).map(p => ({ id: 'g360:' + p.id, nome: p.nome, classe: p.classe, unidade: p.unidade, preco: +p.preco || 0, estoque: +p.qtd || 0, carencia: p.carencia, fonte: 'gefaz360' })));
  const recs = (d.receitas || []).map(r => ({ id: 'g360:' + r.id, nome: r.nome, cultura: r.cultura, alvo: r.alvo, volumeHa: +r.volumeHa || 200, fonte: 'gefaz360', itens: (r.itens || []).map(i => { const p = byId(i.prodId); return { nome: p.nome || '?', dose: +i.dose || 0, unidade: (p.unidade || 'L') + '/ha', classe: p.classe, preco: +p.preco || 0, fonte: 'gefaz360' }; }) }));
  recs.forEach(r => { const i = DB.receitas.findIndex(x => x.id === r.id); if (i >= 0) DB.receitas[i] = r; else DB.receitas.push(r); });
  (d.talhoes || []).forEach(t => { if (!DB.talhoes.some(x => norm(x.nome) === norm(t.nome))) DB.talhoes.push({ nome: t.nome, area: +t.area || 0, cultura: t.cultura, fonte: 'gefaz360' }); });
  saveDB(); $('#impMsg').textContent = `Gefaz360: ${n} defensivos novos, ${recs.length} receitas, ${(d.talhoes || []).length} talhões.`; toast('Gefaz360 importado'); renderIntegracao();
}
function importarTexto(txt) { let d; try { d = JSON.parse(txt); } catch { throw new Error('JSON inválido'); } if (d && (d.format === 'gefaz360-backup' || d.defensivos)) importGefaz360(d); else importPVGest(d); }
function exportPVGestFormat(receitas) {
  const vol = num($('#fVolume').value) || 100;
  const produtos = [], pid = {};
  receitas.forEach(r => r.itens.forEach(i => { const k = norm(i.nome); if (!pid[k]) { const d = E.dosePorHa({ dose: i.dose, unidade: i.unidade }, r.volumeHa || vol); pid[k] = 'gc-' + uid().slice(0, 8); produtos.push({ id: pid[k], nome: i.nome, classe: i.classe || 'Outro', unidade: d.base, estoque_atual: 0, estoque_min: 0, preco: +i.preco || 0, validade: '', fabricante: '' }); } }));
  return { version: 1, origem: 'gefaz-calda', produtos, receitas: receitas.map(r => ({ id: 'gc-' + uid().slice(0, 8), nome: r.nome, cultura: r.cultura, volume_ha: r.volumeHa || vol, alvo: r.alvo || '', obs: (r.obs || '') + (r.status ? ` [Gefaz Calda: ${STATUS_LABEL[r.status] || r.status}]` : ''), itens: r.itens.map(i => { const d = E.dosePorHa({ dose: i.dose, unidade: i.unidade }, r.volumeHa || vol); return { produto: pid[norm(i.nome)], dose: +d.qtd.toFixed(4), unidade: d.base + '/ha', nome_livre: i.nome }; }) })) };
}
function enviarParaPVGest() {
  let d; try { d = JSON.parse(localStorage.getItem('pvgest_v1')); } catch { }
  if (!d) return toast('PVGest não está neste navegador/origem. Use “Receita (PVGest/Gefaz360)” e importe manualmente.', 'err');
  if (!confirm('Adicionar esta calda como receita no PVGest deste navegador? Produtos que não existirem serão criados no estoque (quantidade 0).')) return;
  const rec = caldaComoReceita(); const pack = exportPVGestFormat([rec]);
  d.produtos = d.produtos || []; d.receitas = d.receitas || [];
  const map = {};
  pack.produtos.forEach(p => { const ex = d.produtos.find(x => norm(x.nome) === norm(p.nome)); if (ex) map[p.id] = ex.id; else { const np = { ...p, id: uid() }; d.produtos.push(np); map[p.id] = np.id; } });
  pack.receitas.forEach(r => d.receitas.push({ ...r, id: uid(), criado_por: 'gefaz-calda', itens: r.itens.map(i => ({ ...i, produto: map[i.produto] })) }));
  localStorage.setItem('pvgest_v1', JSON.stringify(d)); toast('Receita enviada ao PVGest — recarregue o PVGest para ver');
}
function enviarParaGefaz360() {
  let d; try { d = JSON.parse(localStorage.getItem('pvgest-erp-v1')); } catch { }
  if (!d) return toast('Gefaz360 não está neste navegador/origem. Exporte a receita e use “Importar do PVgest” no Gefaz360.', 'err');
  if (!confirm('Adicionar esta calda como receita no Gefaz360 deste navegador? Defensivos inexistentes serão criados no estoque (quantidade 0).')) return;
  const rec = caldaComoReceita(); const vol = rec.volumeHa || 100;
  d.defensivos = d.defensivos || []; d.receitas = d.receitas || [];
  const itens = rec.itens.map(i => { const dd = E.dosePorHa({ dose: i.dose, unidade: i.unidade }, vol); let p = d.defensivos.find(x => norm(x.nome) === norm(i.nome)); if (!p) { p = { id: uid(), nome: i.nome, classe: i.classe || '—', unidade: dd.base, preco: +i.preco || 0, qtd: 0, min: 0, carencia: 0, reentrada: 0 }; d.defensivos.push(p); } return { prodId: p.id, dose: +dd.qtd.toFixed(4) }; });
  d.receitas.push({ id: uid(), nome: rec.nome + (resultado ? ` [${STATUS_LABEL[resultado.status]}]` : ''), cultura: rec.cultura, alvo: rec.alvo || '', volumeHa: vol, itens });
  localStorage.setItem('pvgest-erp-v1', JSON.stringify(d)); toast('Receita enviada ao Gefaz360 — recarregue o Gefaz360 para ver');
}
function enviarParaCodex() {
  let arr; try { arr = JSON.parse(localStorage.getItem('pvgest-activities')) || []; } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  if (!resultado) return;
  arr.unshift({ icon: resultado.status === 'incompativel' ? 'alert' : 'check', title: `Gefaz Calda: ${resultado.resumo.rotulo} — ${calda.itens.map(i => i.nome).join(' + ')}`, meta: `${resultado.contexto.cultura} · ${resultado.data}` });
  localStorage.setItem('pvgest-activities', JSON.stringify(arr.slice(0, 5))); toast('Atividade registrada na Central PVGest (Codex)');
}
function renderIntegracao() {
  detectarApps();
  $('#nCatalogo').textContent = `${DB.catalogo.length} produtos · ${DB.receitas.length} receitas · ${DB.talhoes.length} talhões`; atualizarTalhoes();
  $('#listaCatalogo').innerHTML = (DB.catalogo.slice(0, 80).map(p => `<div class="row"><div><b>${esc(p.nome)}</b><small>${esc(p.classe || '—')} · ${esc(p.fonte)} · ${p.preco ? BRL(p.preco) + '/' + esc(p.unidade) : 'sem preço'}${p.estoque ? ' · estoque ' + fmt(p.estoque) + ' ' + esc(p.unidade) : ''}</small></div><button class="btn sm" data-addcat="${esc(p.nome)}">+ calda</button></div>`).join('') || '<div class="small muted">Importe o PVGest ou o Gefaz360 para ter estoque e preços aqui.</div>') + (DB.receitas.length ? `<h3>Receitas importadas</h3>${DB.receitas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>${esc(r.cultura || '—')} · ${r.itens.length} itens · ${r.volumeHa} L/ha · ${esc(r.fonte)}</small></div><button class="btn sm" data-rec="${i}">Analisar</button></div>`).join('')}` : '');
  $$('#listaCatalogo [data-addcat]').forEach(b => b.onclick = () => { const p = DB.catalogo.find(x => x.nome === b.dataset.addcat); addItem({ id: uid(), nome: p.nome, classe: p.classe, unidade: (p.unidade || 'L') + '/ha', dose: 0, preco: p.preco, fonte: p.fonte }); navTo('calda'); });
  $$('#listaCatalogo [data-rec]').forEach(b => b.onclick = () => carregarReceita(DB.receitas[+b.dataset.rec]));
  $('#cfgPh').value = DB.config.ph ?? ''; $('#cfgDureza').value = DB.config.dureza ?? ''; $('#cfgBarra').value = DB.config.custo.barra; $('#cfgTurbo').value = DB.config.custo.turbo; $('#cfgDrone').value = DB.config.custo.drone; $('#cfgCostal').value = DB.config.custo.costal; $('#cfgHerbCafe').value = DB.config.custo['herbicida-cafe']; $('#cfgAcidUltimo').checked = !!DB.config.acidificanteUltimo;
  $('#sdkSnippet').textContent = `<script src="${location.origin}${location.pathname.replace(/[^/]*$/, '')}sdk.js"></script>
<script>
  // 1) abrir o Gefaz Calda com a receita do app (deep-link)
  GefazCalda.abrir(GefazCalda.dePVGest(receita, DB.produtos, { cultura: 'Café', volumeHa: 400 }));
  // 2) analisar sem sair do app e mostrar o resumo
  const res = await GefazCalda.analisar(GefazCalda.deGefaz360(receita, db.defensivos, { agua: { ph: 7.5 } }));
  container.innerHTML = GefazCalda.resumoHTML(res);
</script>`;
}

/* ───────── referências ───────── */
const BENCHMARKS = [
  ['Yara TankmixIT / Tankmix', 'Banco de milhares de testes laboratoriais de foliares × defensivos, busca por marca ou ativo, categorias de resultado, pedido de teste novo.', 'Base de testes da fazenda (jar tests registrados reaparecem na próxima análise); busca por marca/ativo; categorias Compatível / com restrições / Incompatível / Não testado.', 'https://www.yara.us/crop-nutrition/tools-and-services/tankmix/'],
  ['Precision Laboratories — Mix Tank', 'Ordem de mistura por formulação, mix sheet por carga/talhão, spray log, clima.', 'Ordem de adição por formulação (Embrapa), ficha de tanque por carga, histórico de análises, checklist climático.', 'https://www.precisionlab.com/news-resources/mix-tank-app/'],
  ['Bayer UK — Tank Mix Database', 'Registro de testes físicos com produtos Bayer; ordem em 15 passos; alerta “ler o rótulo”.', 'Passos de adição e a distinção física × química × legal em cada alerta.', 'https://cropscience.bayer.co.uk/tankmix'],
  ['Koppert / Biobest — Side Effects', 'Efeitos colaterais de químicos sobre biológicos e polinizadores, classes de compatibilidade, offline.', 'Regras biológicas (cúpricos, fungicidas × fungos benéficos, pH 5,5–7,5), matriz de pares.', 'https://www.koppert.com.br/aplicativo-de-compatibilidade-de-produtos/'],
  ['Embrapa Soja — Documentos 437 (2021)', 'Manual técnico: tipos de incompatibilidade, qualidade da água, ordem de adição em 11 passos, teste da jarra em 1 L com repouso de 2 h.', 'Ordem de adição, protocolo do jar test na proporção real, regras de água dura/turva e volume.', 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1132371/1/DOCUMENTOS-437-1.pdf'],
  ['Ask IFAS PI-301 (Univ. Flórida)', 'Incompatibilidade física, química e legal; sequência A.P.P.L.E.S.; jar test 15–30 min.', 'Categorias de alerta e leituras intermediárias do cronômetro.', 'https://ask.ifas.ufl.edu/publication/PI301'],
  ['AGROFIT / MAPA (dados abertos)', 'Registro oficial: marca, ativo, formulação, classe, cultura × alvo, toxicologia.', 'Índice offline com 4.400 produtos ativos; checagem de registro na cultura e alvo (IN 40/2018).', 'https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit'],
  ['FRAC-BR / IRAC-BR / HRAC-BR', 'Códigos de modo de ação e manejo de resistência.', 'Alerta de MoA repetido e sugestão de multissítio.', 'https://www.irac-br.org/modo-de-acao'],
  ['ABNT NBR 13875', 'Método dinâmico de avaliação físico-química; leituras 0/2/6/24 h; água padrão 20 mg/L CaCO₃.', 'Tempos de leitura para laudo formal e lista de sinais a observar.', 'https://www.target.com.br/produtos/normas-tecnicas/33988/nbr13875-agrotoxicos-e-afins-avaliacao-de-compatibilidade-fisico-quimica'],
  ['TeeJet — catálogo e SpraySelect', 'Seleciona a ponta a partir de volume, velocidade e espaçamento; publica vazão e classe de gota pressão a pressão.', 'A mesma seleção, mas com as três marcas que a fazenda compra no mesmo lugar e com o alerta de deriva já cruzado com o alvo da aplicação.', 'https://www.teejet.com/pt-br/-/media/dam/agricultural/brazil/sales-material/catalog/broadcast_nozzles-pt.pdf'],
  ['Magnojet — seletor de pontas / planilha DRS', 'App e planilha que devolvem modelo, pressão de trabalho, velocidade e classe de gota para a aplicação informada.', 'Cruzamento vazão × pressão e tabela cruzada dentro do app, ligados ao volume de calda e à ficha de tanque.', 'https://www.magnojet.com.br/pulverizacao'],
  ['UPL Spray / BASF Agro App / Aegro', 'Calibração, pré-mistura e planejamento; Aegro liga custo por talhão.', 'Custo/ha com custo operacional por equipamento; talhões e preços vindos do PVGest/Gefaz360.', 'https://aegro.com.br/blog/mistura-defensivos-tanque-guia/']
];
function renderReferencias() {
  $('#benchmarks').innerHTML = BENCHMARKS.map(b => `<div class="row"><div><b>${esc(b[0])}</b><small><b>O que faz:</b> ${esc(b[1])}</small><small><b>O que trouxemos:</b> ${esc(b[2])}</small></div><a class="btn sm ghost" href="${b[3]}" target="_blank" rel="noopener">abrir</a></div>`).join('');
  $('#fontes').innerHTML = KB.fontes.map(f => `<div class="row"><div><small>${esc(f.titulo)}</small></div><a class="btn sm ghost" href="${f.url}" target="_blank" rel="noopener">abrir</a></div>`).join('');
  const nA = Object.keys(KB.ativos).length;
  $('#kbResumo').innerHTML = `${nA} ingredientes ativos com classe, grupo químico, código FRAC/IRAC/HRAC, faixa de pH e comportamento · ${KB.regrasPares.length} regras de incompatibilidade entre pares (cada uma com confiança e fonte) · regras de conjunto (número de produtos, formulações, volume, água, MoA, biológicos) · ${KB.comerciais.length} produtos comerciais mapeados · protocolo MIT 5.0 da fazenda (pH alvo por grupo, condicionadores em estoque, equipamentos).`;
}

/* ───────── pontas e regulagem ───────── */
const PT = window.GCPontas;
let regulagem = null;
const TIPO_PONTA = PT.TIPOS;

function lerRegulagem() {
  const modo = $('#pModo').value;
  return {
    modo, alvo: $('#pAlvo').value,
    velocidade: num($('#pVel').value), volumeHa: num($('#pVol').value),
    distancia: num($('#pDist').value), tempos: $('#pTempo').value.trim(),
    espacamento: num($('#pEsp').value), nBicos: num($('#pNb').value),
    larguraFaixa: num($('#pLf').value), bicosPorPassada: num($('#pBf').value), entreLinhas: num($('#pEl').value), protecao: $('#pProt').checked,
    ponta: $('#pPonta').value, iso: $('#pIso').value, angulo: num($('#pAng').value),
    pressao: num($('#pPress').value), fixarPressao: $('#pFixar').checked,
    tanque: num($('#pTq').value), area: num($('#pArea').value),
    temperatura: $('#pTemp').value, umidade: $('#pUr').value, vento: $('#pVento').value, hora: $('#pHora').value
  };
}
function aplicarRegulagem(e) {
  if (!e) return;
  if (e.modo) $('#pModo').value = e.modo;
  const set = (sel, v) => { if (v != null && v !== '') $(sel).value = v; };
  set('#pAlvo', e.alvo); set('#pVel', e.velocidade); set('#pVol', e.volumeHa);
  set('#pDist', e.distancia); $('#pTempo').value = e.tempos || '';
  set('#pEsp', e.espacamento); set('#pNb', e.nBicos);
  set('#pLf', e.larguraFaixa); set('#pBf', e.bicosPorPassada); set('#pEl', e.entreLinhas); $('#pProt').checked = !!e.protecao;
  set('#pTq', e.tanque); set('#pArea', e.area);
  set('#pTemp', e.temperatura); set('#pUr', e.umidade); set('#pVento', e.vento); set('#pHora', e.hora);
  camposPorModo(); atualizarVelocidade();
  if (e.ponta) { const p = PT.PONTA_MAP[e.ponta]; if (p) { $('#pMarca').value = p.marca; preencherModelos(e.ponta); } }
  if (e.iso != null) preencherIso(e.iso); else preencherIso();
  preencherAngulos(e.angulo);
  $('#pFixar').checked = !!e.fixarPressao;
  $('#pPress').value = e.fixarPressao && e.pressao ? e.pressao : '';
  atualizarVazaoAlvo();
}
/* velocidade pelo cronômetro: 3,6 × percurso ÷ tempo → preenche o campo de velocidade da regulagem */
function atualizarVelocidade(dosCampos) {
  const box = $('#pVelCalc'); if (!box) return;
  const m = PT.velocidadeMedida($('#pDist').value, $('#pTempo').value);
  if (m && dosCampos) $('#pVel').value = m.velocidade;
  const vel = num($('#pVel').value), dist = num($('#pDist').value);
  if (m) {
    const dif = Math.abs(vel - m.velocidade) > 0.05;
    box.innerHTML = `<div class="kpis"><div class="kpi"><b>${fmt(m.velocidade, 2)}</b><small>km/h medidos</small></div><div class="kpi"><b>${fmt(m.tempoMedio, 1)} s</b><small>${m.n > 1 ? 'tempo médio de ' + m.n + ' passadas' : 'em ' + fmt(m.distancia, 0) + ' m'}</small></div></div>`
      + `<p class="muted small"><code>${esc(m.formula.formula)}</code> → ${esc(m.formula.calculo.replace(/(\d)\.(\d)/g, '$1,$2'))} = <b>${fmt(m.velocidade, 2)} km/h</b></p>`
      + (m.amplitude != null && m.amplitude > 5 ? `<div class="alert warn">As passadas variam ${fmt(m.amplitude, 1)} % entre a mais lenta e a mais rápida — segure a mesma marcha e rotação e repita a medição.</div>` : '')
      + (dif ? `<div class="alert info">O campo de velocidade está em ${fmt(vel, 2)} km/h, diferente da medida. Digite o tempo de novo para usar a medida.</div>` : '');
  } else {
    box.innerHTML = vel > 0 && dist > 0 ? `<p class="muted small">Para ${fmt(vel, 1)} km/h, o cronômetro deve marcar <b>${fmt(PT.tempoNoPercurso(dist, vel), 1)} s</b> em ${fmt(dist, 0)} m.</p>` : '';
  }
}
function camposPorModo() {
  const faixa = $('#pModo').value === 'faixa';
  $('#camposArea').classList.toggle('hidden', faixa);
  $('#camposFaixa').classList.toggle('hidden', !faixa);
}
function preencherMarcas() {
  const marcas = [...new Set(PT.PONTAS.map(p => p.marca))];
  $('#pMarca').innerHTML = '<option value="">Todas as marcas</option>' + marcas.map(m => `<option>${esc(m)}</option>`).join('');
}
function preencherModelos(sel) {
  const marca = $('#pMarca').value, alvo = $('#pAlvo').value;
  let lista = PT.PONTAS.filter(p => (!marca || p.marca === marca));
  const doAlvo = lista.filter(p => p.usos.indexOf(alvo) >= 0);
  const outras = lista.filter(p => p.usos.indexOf(alvo) < 0);
  const opt = p => `<option value="${p.id}">${esc(p.marca)} · ${esc(p.modelo)}${p.livre ? ' ★' : ''}</option>`;
  $('#pPonta').innerHTML = (doAlvo.length ? `<optgroup label="Indicadas para o alvo">${doAlvo.map(opt).join('')}</optgroup>` : '')
    + (outras.length ? `<optgroup label="Outras">${outras.map(opt).join('')}</optgroup>` : '');
  if (sel && PT.PONTA_MAP[sel] && lista.some(p => p.id === sel)) $('#pPonta').value = sel;
}
function preencherIso(sel) {
  const p = PT.PONTA_MAP[$('#pPonta').value];
  const sizes = p ? PT.tamanhosDaPonta(p) : PT.ISO.map(i => i.id);
  const tab = p ? PT.tabelaDaPonta(p) : null;
  const pRef = p ? PT.pressaoReferencia(p) : 3;
  $('#pIso').innerHTML = sizes.map(s => {
    const i = PT.ISO_MAP[s], q = PT.vazaoDaPonta(p, s, pRef);
    const cor = i ? i.cor : s.charAt(0).toUpperCase() + s.slice(1);
    return `<option value="${esc(s)}">${esc(s)}${i ? ' · ' + cor : ''}${q ? ' · ' + fmt(q, 2) + ' L/min a ' + fmt(pRef, 1) + ' bar' : ' (sem tabela)'}</option>`;
  }).join('');
  if (sel && sizes.indexOf(sel) >= 0) $('#pIso').value = sel;
}
function preencherAngulos(sel) {
  const p = PT.PONTA_MAP[$('#pPonta').value];
  const angs = p ? p.angulos : [110, 80];
  $('#pAng').innerHTML = angs.map(a => `<option>${a}</option>`).join('');
  if (sel && angs.indexOf(+sel) >= 0) $('#pAng').value = sel;
}
function atualizarVazaoAlvo() {
  const e = lerRegulagem();
  const faixaPorBico = e.modo === 'faixa' ? (e.larguraFaixa / Math.max(1, e.bicosPorPassada)) : e.espacamento;
  const q = PT.vazaoNecessaria(e.volumeHa, e.velocidade, faixaPorBico);
  $('#pVazaoAlvo').textContent = q > 0 ? `precisa de ${fmt(q, 3)} L/min por bico (${fmt(faixaPorBico, 2)} m por bico)` : '';
  const a = PT.ALVO_MAP[e.alvo];
  $('#pAlvoNota').textContent = a ? `${a.nome}: gota ${a.gotas.map(g => PT.GOTA_MAP[g].nome.toLowerCase()).join(' a ')}, volume usual ${a.volume[0]}–${a.volume[1]} L/ha.${a.nota ? ' ' + a.nota : ''}` : '';
}
function gotaBadge(g) {
  if (!g) return '';
  return `<span class="gota" style="background:${g.hex}">${esc(g.nome)} · ${esc(g.faixa)}${g.estimado ? ' *' : ''}</span>`;
}
/* cores da escala europeia da Albuz (ATR), que não seguem o código ISO */
const COR_HEX = { branco: '#eceff1', 'lilás': '#b39ddb', marrom: '#6d4c41', amarelo: '#fbc02d', laranja: '#f57c00', vermelho: '#c62828', cinza: '#757575', verde: '#2e7d32', preto: '#212121', azul: '#1565c0', roxo: '#7b1fa2', rosa: '#f48fb1' };
function corBadge(iso) {
  const i = PT.ISO_MAP[iso];
  if (i) return `<span class="iso-cor"><i style="background:${i.hex}"></i>${esc(i.id)} · ${esc(i.cor)}</span>`;
  if (!iso) return '—';
  const hex = COR_HEX[String(iso).toLowerCase()];
  return hex ? `<span class="iso-cor"><i style="background:${hex}"></i>${esc(iso)}</span>` : `<span class="iso-cor">${esc(iso)}</span>`;
}
function calcularRegulagem(silencioso) {
  const e = lerRegulagem();
  if (!(e.velocidade > 0) || !(e.volumeHa > 0)) { if (!silencioso) toast('Informe velocidade e volume de calda', 'err'); return; }
  regulagem = PT.calcular(e);
  regulagem.entrada = e;
  DB.config.pontas = e; saveDB();
  renderRegulagem(); renderTabelaCruzada(); notaRegulagem();
  if (!silencioso) $('#pResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderRegulagem() {
  const r = regulagem, el = $('#pResultado'); if (!r) return;
  const p = r.ponta;
  const sev = { alta: 'bad', media: 'warn', baixa: 'info', info: 'info' };
  el.innerHTML = `
  <div class="card">
    <div class="card-hd"><h2>Regulagem calculada</h2><span class="hint">${r.modo === 'faixa' ? 'faixa dirigida' : 'área total'} · ${p ? esc(p.marca + ' ' + p.modelo) : 'sem ponta selecionada'}</span></div>
    <div class="kpis">
      <div class="kpi"><b>${fmt(r.vazaoPorBico, 3)}</b><small>L/min por bico</small></div>
      <div class="kpi"><b>${r.pressao ? fmt(r.pressao, 2) + ' bar' : '—'}</b><small>${r.pressaoCalculada ? 'pressão necessária' : 'pressão fixada'}</small></div>
      <div class="kpi"><b>${fmt(r.volumeAplicado, 0)}</b><small>L/ha ${r.modo === 'faixa' ? 'na faixa' : 'aplicados'}</small></div>
      ${r.modo === 'faixa' ? `<div class="kpi"><b>${fmt(r.volumeLavoura, 0)}</b><small>L/ha de lavoura</small></div><div class="kpi"><b>${fmt(r.economia, 0)} %</b><small>economia de produto</small></div>` : ''}
      <div class="kpi"><b>${fmt(r.vazaoTotal, 1)}</b><small>L/min no conjunto</small></div>
      ${r.ehCone ? '<div class="kpi"><b>arco</b><small>cone: posição no atomizador</small></div>' : `<div class="kpi"><b>${r.modo === 'faixa' ? r.alturaFaixa : r.altura} cm</b><small>altura da ponta</small></div>`}
      <div class="kpi"><b>${fmt(r.rendimento, 2)}</b><small>ha/h teórico</small></div>
    </div>
    <div class="ponta-resumo">
      ${corBadge(r.iso)} ${gotaBadge(r.gota)}
      ${p ? `<span class="tag">${esc(TIPO_PONTA[p.tipo] || p.tipo)}</span><span class="tag">${r.angulo}°</span><span class="tag">${esc(p.material)}</span><span class="tag">faixa útil ${p.pressao[0]}–${p.pressao[1]} bar</span>` : ''}
      ${r.malha ? `<span class="tag">filtro malha ${r.malha}</span>` : ''}
    </div>
    <div class="row-btns"><button class="btn" id="btnUsarVolume">↪️ Usar ${fmt(r.modo === 'faixa' ? r.volumeLavoura : r.volumeAplicado, 0)} L/ha na calda</button><button class="btn ghost" id="btnPrintReg">🖨️ Ficha de regulagem</button><button class="btn ghost" id="btnExpReg">⬇️ JSON</button></div>
  </div>

  ${r.avisos.length ? `<div class="card"><div class="card-hd"><h2>Conferências</h2><span class="hint">${r.avisos.length} ponto(s)</span></div>${r.avisos.map(a => `<div class="al ${a.nivel === 'info' ? 'info' : a.nivel}"><div class="t"><span>${esc(a.texto)}</span><span class="sev ${a.nivel}">${esc(a.nivel)}</span></div><div class="c">→ ${esc(a.conduta)}</div></div>`).join('')}</div>` : '<div class="card"><div class="al info"><div class="t">Regulagem coerente</div><div class="d">Pressão dentro da faixa da ponta e classe de gota compatível com o alvo. Confirme a campo com a coleta nos bicos.</div></div></div>'}

  <div class="card"><div class="card-hd"><h2>Equações usadas</h2><span class="hint">com os seus números</span></div>
    <table class="tb formulas"><thead><tr><th>O quê</th><th>Equação</th><th>Com os seus números</th><th class="num">Resultado</th></tr></thead>
    <tbody>${r.formulas.map(f => `<tr><td>${esc(f.nome)}</td><td><code>${esc(f.formula)}</code></td><td class="small">${esc(f.calculo)}</td><td class="num"><b>${esc(f.resultado)}</b></td></tr>`).join('')}</tbody></table>
    <p class="small muted">V = volume (L/ha) · v = velocidade (km/h) · e = faixa de cada bico (m) · q = vazão do bico (L/min) · p = pressão (bar). A vazão vem da norma ISO 10625 (vazão nominal a 3 bar) e da lei da raiz quadrada: dobrar a vazão exige 4× a pressão.</p>
  </div>

  <div class="card"><div class="card-hd"><h2>Ficha de campo</h2></div>
    <table class="tb"><tbody>
      <tr><td>Arranjo</td><td class="num">${r.modo === 'faixa' ? `faixa de ${fmt(r.larguraFaixa, 2)} m em entrelinhas de ${fmt(r.entreLinhas, 2)} m · ${r.nBicos} bico(s)` : `${r.nBicos} bicos a ${fmt(r.espacamento, 2)} m · barra de ${fmt(r.larguraTrabalho, 1)} m`}</td></tr>
      <tr><td>Ponta</td><td class="num">${p ? esc(p.marca + ' ' + p.modelo) : '—'} ${esc(r.iso)} (${esc(r.cor)}) · ${r.angulo}°</td></tr>
      <tr><td>Pressão no manômetro</td><td class="num"><b>${r.pressao ? fmt(r.pressao, 2) + ' bar' : '—'}</b></td></tr>
      <tr><td>Velocidade</td><td class="num"><b>${fmt(r.velocidade, 1)} km/h</b> (${fmt(3600 / (r.velocidade * 1000) * 50, 1)} s para 50 m)</td></tr>
      <tr><td>Vazão de referência por bico</td><td class="num">${fmt(r.vazaoPorBico, 3)} L/min = <b>${fmt(r.vazaoPorBico * 1000 / 2, 0)} mL em 30 s</b></td></tr>
      ${r.ficha ? `<tr><td>Por tanque de ${fmt(r.entrada.tanque, 0)} L</td><td class="num">${fmt(r.ficha.haPorTanque, 2)} ha · ${fmt(r.ficha.distancia, 0)} m de percurso · ${fmt(r.ficha.minutos, 0)} min</td></tr>
      ${r.ficha.cargas ? `<tr><td>Para ${fmt(r.ficha.area, 1)} ha</td><td class="num">${r.ficha.cargas} tanque(s)</td></tr>` : ''}` : ''}
    </tbody></table>
    ${p ? `<p class="small muted">Fonte dos dados da ponta: ${esc(p.fonte)}.</p>` : ''}
  </div>`;
  $('#btnUsarVolume').onclick = () => {
    const v = Math.round(r.modo === 'faixa' ? r.volumeLavoura : r.volumeAplicado);
    $('#fVolume').value = v; $('#fVolume').dataset.touched = 1;
    if (r.entrada.tanque) $('#fTanque').value = r.entrada.tanque;
    if (r.entrada.area) $('#fArea').value = r.entrada.area;
    DB.config.volumeHa = v; saveDB();
    navTo('calda'); toast(`Volume de ${v} L/ha aplicado na calda`);
  };
  $('#btnPrintReg').onclick = () => window.print();
  $('#btnExpReg').onclick = () => download(`regulagem-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda', modulo: 'pontas', versao: PT.versao, regulagem: r }, null, 1));
}
function sugerirPontas() {
  const e = lerRegulagem();
  const s = PT.selecionar({ ...e, marca: $('#pMarca').value || null, limite: 10 });
  const el = $('#pSugestoes');
  if (!s.opcoes.length) { el.innerHTML = '<div class="alert warn">Nenhuma combinação de ponta e tamanho atende essa vazão dentro da faixa de pressão dos modelos filtrados. Mude a velocidade, o volume ou a marca.</div>'; return; }
  el.innerHTML = `<h3>Pontas para ${fmt(s.vazaoAlvo, 3)} L/min por bico</h3><div class="lista compact">${s.opcoes.map((o, i) => `
    <div class="row"><div>
      <b>${esc(o.marca)} · ${esc(o.modelo)} ${esc(o.iso)}</b>
      <small>${corBadge(o.iso)} ${gotaBadge(o.gota)} · ${fmt(o.pressao, 2)} bar · ${o.angulo}° · ${esc(TIPO_PONTA[o.tipo] || o.tipo)}${o.confirmar ? ' · <span class="tag noreg">conferir catálogo</span>' : ''}</small>
      <small>${esc(o.nota)}</small>
    </div><div class="acts"><span class="pill ${o.score >= 85 ? 'ok' : o.score >= 65 ? 'warn' : 'info'}">${o.score}</span><button class="btn sm" data-usar="${i}">Usar</button></div></div>`).join('')}</div>
    <p class="small muted">Ordenado por classe de gota adequada ao alvo e por pressão confortável dentro da faixa útil da ponta. * = classe de gota estimada.</p>`;
  $$('#pSugestoes [data-usar]').forEach(b => b.onclick = () => {
    const o = s.opcoes[+b.dataset.usar];
    $('#pMarca').value = o.marca; preencherModelos(o.ponta); preencherIso(o.iso); preencherAngulos(o.angulo);
    $('#pFixar').checked = false; $('#pPress').value = '';
    calcularRegulagem();
  });
}
function renderCalibracao() {
  const e = lerRegulagem();
  const coletas = $('#cColetas').value.split(/[\s,;]+/).map(num).filter(v => v > 0);
  if (!coletas.length) return toast('Informe o volume coletado em pelo menos um bico', 'err');
  const c = PT.calibracao({
    coletas, segundos: num($('#cSeg').value) || 60, pressao: num($('#cPress').value) || e.pressao, iso: e.iso,
    modo: e.modo, espacamento: e.espacamento, larguraFaixa: e.larguraFaixa, bicosPorPassada: e.bicosPorPassada,
    velocidade: e.velocidade, distancia: e.distancia, tempo: (PT.velocidadeMedida(e.distancia, e.tempos) || {}).tempoMedio || 0, volumeHa: e.volumeHa
  });
  if (!c) return;
  ultimaCalibracao = c;
  const cls = { bom: 'ok', aceitavel: 'warn', irregular: 'bad', 'fora-do-alvo': 'bad' }[c.veredito];
  const rotulo = { bom: 'Uniforme e no alvo', aceitavel: 'Aceitável (CV 5–10 %)', irregular: 'Irregular — CV acima de 10 %', 'fora-do-alvo': 'Volume fora do alvo' }[c.veredito];
  $('#cResultado').innerHTML = `
    <div class="kpis"><div class="kpi"><b>${fmt(c.media, 3)}</b><small>L/min média</small></div>
      <div class="kpi"><b>${fmt(c.cv, 1)} %</b><small>CV entre bicos</small></div>
      <div class="kpi"><b>${fmt(c.volumeReal, 0)}</b><small>L/ha reais</small></div>
      ${c.erro != null ? `<div class="kpi"><b>${c.erro > 0 ? '+' : ''}${fmt(c.erro, 1)} %</b><small>desvio do alvo</small></div>` : ''}
      ${c.velocidade ? `<div class="kpi"><b>${fmt(c.velocidade, 2)}</b><small>km/h medidos</small></div>` : ''}</div>
    <div class="alert ${cls === 'ok' ? 'ok' : cls === 'warn' ? 'warn' : 'bad'}"><b>${esc(rotulo)}</b>${c.correcao.length ? '<br>' + c.correcao.map(esc).join('<br>') : ''}</div>
    <table class="tb"><thead><tr><th>Bico</th><th class="num">L/min</th><th class="num">Desvio da média</th><th class="num">Desgaste vs. nominal</th><th>Conduta</th></tr></thead>
    <tbody>${c.bicos.map(b => `<tr><td>${b.n}</td><td class="num">${fmt(b.vazao, 3)}</td><td class="num">${b.desvio > 0 ? '+' : ''}${fmt(b.desvio, 1)} %</td><td class="num">${b.desgaste == null ? '—' : (b.desgaste > 0 ? '+' : '') + fmt(b.desgaste, 1) + ' %'}</td><td>${b.trocar ? '<span class="tag noreg">trocar</span>' : '<span class="tag reg">ok</span>'}</td></tr>`).join('')}</tbody></table>
    <table class="tb formulas"><tbody>${c.formulas.map(f => `<tr><td>${esc(f.nome)}</td><td><code>${esc(f.formula)}</code></td><td class="small">${esc(f.calculo)}</td><td class="num"><b>${esc(f.resultado)}</b></td></tr>`).join('')}</tbody></table>
    <p class="small muted">Critério: bico com vazão 10 % acima da nominal (ou 10 % fora da média do conjunto) está gasto e deve ser trocado. CV acima de 10 % indica bicos entupidos, filtros sujos ou pontas de modelos diferentes na mesma barra.</p>`;
}
function renderCatalogoPontas(q) {
  // busca livre: vários termos em qualquer ordem — marca, modelo, tipo, tamanho, cor, ângulo ou código ("XR 11002")
  const consulta = String(q || '').trim(), exatas = {};
  let lista = PT.PONTAS;
  if (consulta) {
    const ordem = [];
    PT.buscarPontas(consulta, { limite: 2000, nota: true }).forEach(r => { if (!exatas[r.ponta]) { exatas[r.ponta] = []; ordem.push(r.ponta); } if (r.tamanho) exatas[r.ponta].push(r); });
    lista = ordem.map(id => PT.PONTA_MAP[id]).filter(Boolean);
  }
  const acha = (p, s) => (exatas[p.id] || []).some(r => r.tamanho === s);
  $('#nPontas').textContent = `${lista.length} de ${PT.PONTAS.length} famílias`;
  $('#listaPontas').innerHTML = lista.map(p => `<div class="row"><div>
      <b>${esc(p.marca)} · ${esc(p.modelo)}</b>
      <small>${esc(TIPO_PONTA[p.tipo] || p.tipo)} · ${p.angulos.join('°/')}° · ${p.pressao[0]}–${p.pressao[1]} bar · ${esc(p.material)}</small>
      <small>Tamanhos: ${PT.tamanhosDaPonta(p).map(s => acha(p, s) ? `<b>${esc(s)}</b>` : esc(s)).join(', ')}${p.escalaPropria ? ' (escala de cores do fabricante, não ISO)' : ''}${p.vazaoTabela ? ` · <span class="tag reg">tabela de vazão do fabricante, ${p.vazaoTabela.pressoes[0]}–${p.vazaoTabela.pressoes[p.vazaoTabela.pressoes.length - 1]} bar</span>` : ''}</small>
      <small>${esc(p.nota)}</small>
      <small class="muted">Gota: ${p.gotasPorBar ? Object.entries(p.gotasPorBar).map(([b, g]) => `${b} bar → ${PT.GOTA_MAP[g].nome.toLowerCase()}`).join(' · ') : (p.gotasFaixa || []).map(g => PT.GOTA_MAP[g].nome.toLowerCase()).join(' a ') + ' (faixa do catálogo)'} · Fonte: ${esc(p.fonte)}</small>
    </div><div class="acts"><button class="btn sm ghost" data-ponta="${esc(p.id)}"${exatas[p.id] && exatas[p.id][0] ? ` data-tam="${esc(exatas[p.id][0].tamanho)}" data-ang="${exatas[p.id][0].angulo}"` : ''}>Usar${exatas[p.id] && exatas[p.id][0] ? ' ' + esc(exatas[p.id][0].tamanho) : ''}</button></div></div>`).join('') || '<div class="small muted">Nada encontrado. Dá para cadastrar em Ponta → ＋ Minha ponta.</div>';
  $$('#listaPontas [data-ponta]').forEach(b => b.onclick = () => {
    const p = PT.PONTA_MAP[b.dataset.ponta];
    $('#pMarca').value = p.marca; preencherModelos(p.id); preencherIso(b.dataset.tam); preencherAngulos(b.dataset.ang);
    calcularRegulagem(); toast(`${p.modelo}${b.dataset.tam ? ' · ' + b.dataset.tam : ''} selecionada`);
  });
}
function renderRegulagens() {
  $('#listaRegulagens').innerHTML = DB.regulagens.length ? DB.regulagens.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>${esc(r.data)} · ${esc(r.resumo)}</small></div><div class="acts"><button class="btn sm" data-carreg="${i}">Carregar</button><button class="btn sm ghost danger" data-delreg="${i}">✕</button></div></div>`).join('') : '<div class="small muted">Nenhuma regulagem salva.</div>';
  $$('#listaRegulagens [data-carreg]').forEach(b => b.onclick = () => { aplicarRegulagem(DB.regulagens[+b.dataset.carreg].entrada); calcularRegulagem(); toast('Regulagem carregada'); });
  $$('#listaRegulagens [data-delreg]').forEach(b => b.onclick = () => { if (confirm('Excluir esta regulagem?')) { DB.regulagens.splice(+b.dataset.delreg, 1); saveDB(); renderRegulagens(); preencherSelectRegulagem(); } });
}
function salvarRegulagem() {
  if (!regulagem) return toast('Calcule a regulagem primeiro', 'err');
  const r = regulagem, p = r.ponta;
  const padrao = `${p ? p.marca + ' ' + p.modelo + ' ' + r.iso : 'Sem ponta'} — ${fmt(r.volumeAplicado, 0)} L/ha a ${fmt(r.velocidade, 1)} km/h`;
  const nome = prompt('Nome da regulagem', padrao); if (!nome) return;
  DB.regulagens.unshift({
    id: uid(), nome, data: agora(), entrada: r.entrada,
    resumo: `${r.modo === 'faixa' ? 'faixa ' + fmt(r.larguraFaixa, 2) + ' m' : 'barra ' + fmt(r.larguraTrabalho, 1) + ' m'} · ${fmt(r.pressao, 2)} bar · ${fmt(r.vazaoPorBico, 3)} L/min/bico${r.gota ? ' · gota ' + r.gota.nome.toLowerCase() : ''}`
  });
  saveDB(); renderRegulagens(); preencherSelectRegulagem(); toast('Regulagem salva');
}
/* ───────── cruzamento vazão × pressão ───────── */
let ultimaCalibracao = null;
const X_LABEL = { vazao: 'Vazão desejada (L/min)', volume: 'Volume desejado (L/ha)', pressao: 'Pressão desejada (bar)' };
function faixaPorBicoAtual() {
  const e = lerRegulagem();
  return e.modo === 'faixa' ? (e.larguraFaixa / Math.max(1, e.bicosPorPassada)) : e.espacamento;
}
function atualizarLabelCruzar() {
  const m = $('#xModo').value;
  const l = $('#xAlvoLabel'), inp = $('#xAlvo');
  l.childNodes[0].nodeValue = X_LABEL[m];
  inp.step = m === 'volume' ? '1' : '0.01';
}
function cruzarVazaoPressao() {
  const e = lerRegulagem(), m = $('#xModo').value, alvo = num($('#xAlvo').value);
  const entrada = {
    vazaoConhecida: num($('#xQ1').value), pressaoConhecida: num($('#xP1').value),
    velocidade: e.velocidade, faixaPorBico: faixaPorBicoAtual(), ponta: e.ponta, iso: e.iso
  };
  if (m === 'vazao') entrada.vazaoDesejada = alvo;
  else if (m === 'pressao') entrada.pressaoDesejada = alvo;
  else entrada.volumeDesejado = alvo;
  const c = PT.cruzar(entrada);
  if (!c) { $('#xResultado').innerHTML = '<div class="alert warn">Informe a vazão e a pressão conhecidas e o valor que você quer atingir.</div>'; return; }
  $('#xResultado').innerHTML = `
    <div class="kpis">
      <div class="kpi"><b>${fmt(c.p2, 2)} bar</b><small>pressão ${c.alvo === 'pressao' ? 'informada' : 'necessária'}</small></div>
      <div class="kpi"><b>${fmt(c.q2, 3)}</b><small>L/min por bico</small></div>
      <div class="kpi"><b>${c.variacaoVazao > 0 ? '+' : ''}${fmt(c.variacaoVazao, 1)} %</b><small>na vazão</small></div>
      <div class="kpi"><b>${c.variacaoPressao > 0 ? '+' : ''}${fmt(c.variacaoPressao, 1)} %</b><small>na pressão</small></div>
      ${c.volumeDepois != null ? `<div class="kpi"><b>${fmt(c.volumeDepois, 0)}</b><small>L/ha (era ${fmt(c.volumeAntes, 0)})</small></div>` : ''}
      ${c.velocidadeEquivalente ? `<div class="kpi"><b>${fmt(c.velocidadeEquivalente, 2)}</b><small>km/h com a pressão antiga</small></div>` : ''}
    </div>
    ${c.gota ? `<div class="ponta-resumo">${gotaBadge(c.gota)}<span class="tag">na pressão cruzada</span></div>` : ''}
    ${c.avisos.map(a => `<div class="al ${a.nivel}"><div class="t"><span>${esc(a.texto)}</span><span class="sev ${a.nivel}">${esc(a.nivel)}</span></div><div class="c">→ ${esc(a.conduta)}</div></div>`).join('')}
    <table class="tb formulas"><tbody>${c.formulas.map(f => `<tr><td>${esc(f.nome)}</td><td><code>${esc(f.formula)}</code></td><td class="small">${esc(f.calculo)}</td><td class="num"><b>${esc(f.resultado)}</b></td></tr>`).join('')}</tbody></table>
    <div class="row-btns"><button class="btn" id="btnUsarPressao">↪️ Usar ${fmt(c.p2, 2)} bar como pressão de trabalho</button></div>`;
  $('#btnUsarPressao').onclick = () => {
    $('#pPress').value = c.p2; $('#pFixar').checked = true;
    calcularRegulagem(); toast(`Pressão de ${fmt(c.p2, 2)} bar aplicada na regulagem`);
  };
  renderTabelaCruzada();
}
function renderTabelaCruzada() {
  const e = lerRegulagem();
  const t = PT.tabelaCruzada({ ponta: e.ponta, velocidade: e.velocidade, faixaPorBico: faixaPorBicoAtual(), volumeAlvo: e.volumeHa });
  const p = PT.PONTA_MAP[e.ponta];
  if (!t.sizes.length) { $('#xTabela').innerHTML = ''; return; }
  $('#xTabela').innerHTML = `<h3>Tabela cruzada — ${p ? esc(p.marca + ' ' + p.modelo) : 'pontas ISO'}</h3>
    <p class="small muted">L/min por bico e, embaixo, o volume que sai a ${fmt(e.velocidade, 1)} km/h com ${fmt(t.faixaPorBico, 2)} m por bico. Verde = dentro de 5 % do alvo de ${fmt(e.volumeHa, 0)} L/ha; a linha destacada é a ponta em uso.</p>
    <div class="cruzada"><table class="tb"><thead><tr><th>bar</th>${t.sizes.map(s => `<th class="num">${corBadge(s)}</th>`).join('')}</tr></thead>
    <tbody>${t.linhas.map(l => `<tr><th>${fmt(l.bar, 1)}</th>${l.celulas.map(c => `<td class="num ${c.noAlvo ? 'alvo' : ''} ${c.iso === e.iso ? 'sel' : ''}" title="${c.gota ? esc(c.gota.nome) : ''}">${fmt(c.vazao, 2)}${c.volume != null ? `<small>${fmt(c.volume, 0)} L/ha</small>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function preencherCruzarDaPonta() {
  const e = lerRegulagem();
  const q = PT.vazaoNominal(e.iso);
  if (!q) return toast('Selecione uma ponta com tamanho ISO', 'err');
  $('#xQ1').value = q; $('#xP1').value = 3;
  if (!num($('#xAlvo').value)) {                       // sem alvo ainda: mira a vazão que o arranjo pede
    $('#xModo').value = 'vazao'; atualizarLabelCruzar();
    $('#xAlvo').value = PT.vazaoNecessaria(e.volumeHa, e.velocidade, faixaPorBicoAtual());
  }
  toast(`Ponto de referência: ${fmt(q, 2)} L/min a 3 bar (nominal ISO ${e.iso})`);
  cruzarVazaoPressao();
}
function preencherCruzarDaCalibracao() {
  if (!ultimaCalibracao) return toast('Rode a calibração a campo primeiro', 'err');
  $('#xQ1').value = ultimaCalibracao.media;
  $('#xP1').value = num($('#cPress').value) || lerRegulagem().pressao || '';
  toast(`Ponto de referência: média medida de ${fmt(ultimaCalibracao.media, 3)} L/min`);
  cruzarVazaoPressao();
}

/* ───────── condições do ar (Delta T, importado do PVGest) ───────── */
const CLIMA_CLS = { ideal: 'ok', limiar: 'warn', baixo: 'bad', critico: 'bad' };
function renderClima() {
  const e = lerRegulagem(), c = PT.clima(e), el = $('#pClima');
  if (!c) { el.innerHTML = '<p class="small muted">Informe temperatura e umidade para calcular o Delta T e a janela de aplicação.</p>'; return; }
  const cls = CLIMA_CLS[c.faixa] || 'info';
  el.innerHTML = `
    <div class="deltat ${cls}">
      <div class="dt-num"><b>${fmt(c.deltaT, 1)}</b><small>Delta T</small></div>
      <div class="dt-txt"><b>${esc(c.rotulo)}</b><div class="small">${esc(c.conduta)}</div></div>
    </div>
    <div class="dt-escala"><i class="dt-marca" style="left:${Math.min(Math.max(c.deltaT / 15 * 100, 0), 100)}%"></i></div>
    <div class="dt-lbls"><span>0</span><span>2</span><span>8</span><span>10</span><span>15+</span></div>
    <div class="kpis">
      <div class="kpi"><b>${fmt(c.bulboUmido, 1)} °C</b><small>bulbo úmido</small></div>
      <div class="kpi"><b>${fmt(c.pontoOrvalho, 1)} °C</b><small>ponto de orvalho</small></div>
      <div class="kpi"><b>${fmt(c.dpv, 2)} kPa</b><small>déficit de pressão de vapor</small></div>
      ${c.vento != null ? `<div class="kpi"><b>${fmt(c.vento, 1)} km/h</b><small>${esc((c.ventoRotulo || '').replace(/\s*\(.*/, '').toLowerCase())}</small></div>` : ''}
    </div>
    ${c.ventoConduta && c.ventoFaixa !== 'ideal' ? `<div class="alert warn small">${esc(c.ventoConduta)}</div>` : ''}
    <p class="small muted">${esc(c.fonte)}. A janela de 2 a 8 vale para pulverização em geral; produto sistêmico aguenta a borda superior melhor que o de contato.</p>`;
}
function atualizarAreaTanque() {
  const tanque = num($('#pTq').value), volume = num($('#pVol').value), el = $('#pAreaTanque');
  if (!(tanque > 0) || !(volume > 0)) { el.innerHTML = ''; return; }
  const ha = tanque / volume;
  el.innerHTML = `Área por tanque = ${fmt(tanque, 0)} L ÷ ${fmt(volume, 0)} L/ha = <b>${fmt(ha, 2)} ha</b> por carga.
    <button class="btn sm ghost" id="btnUsarAreaTanque">usar como área</button>`;
  $('#btnUsarAreaTanque').onclick = () => {
    $('#pArea').value = Math.round(ha * 100) / 100;
    if (regulagem) calcularRegulagem(true);
    toast(`Área ajustada para uma carga: ${fmt(ha, 2)} ha`);
  };
}

/* ───────── busca livre no inventário de pontas ───────── */
function renderBuscaPonta(q) {
  const box = $('#pBuscaRapidaRes');
  if (String(q).trim().length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const res = PT.buscarPontas(q, { limite: 30 });
  const linha = (r, i) => {
    const det = r.tamanho
      ? `${esc(r.tamanho)}${r.cor && r.cor !== r.tamanho ? ' · ' + esc(r.cor) : ''} · ${r.angulo}° · ${r.vazao ? fmt(r.vazao, 2) + ' L/min a ' + fmt(r.pressaoRef, 1) + ' bar' : 'sem vazão'}`
      : `${r.nTamanhos} tamanho(s) · ${r.angulos.join('/')}° · ${esc(PT.TIPOS[r.tipo] || r.tipo)}`;
    return `<button type="button" class="it" data-pb="${i}"><span><b>${esc(r.marca)} · ${esc(r.modelo)}${r.livre ? ' ★' : ''}</b><small>${det}</small></span><span class="src ${r.livre ? 'kb' : 'cat'}">${r.tamanho ? 'ponta' : 'família'}</span></button>`;
  };
  box.innerHTML = (res.length ? res.map(linha).join('') : '<div class="it"><small>Nenhuma ponta do inventário combina com a busca.</small></div>')
    + `<button type="button" class="it" data-pb-novo><span><b>＋ Cadastrar “${esc(String(q).trim())}” como minha ponta</b><small>não está na lista? informe a vazão que você conhece</small></span><span class="src kb">novo</span></button>`;
  box.classList.remove('hidden');
  box.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => escolherPontaBusca(res[+b.dataset.pb]));
  box.querySelector('[data-pb-novo]').onclick = () => {
    const txt = String(q).trim(); box.classList.add('hidden'); $('#pBuscaRapida').value = '';
    limparFormPontaLivre(); $('#plModelo').value = txt; $('#pontaLivreBox').open = true; $('#plMarca').scrollIntoView({ block: 'center' }); $('#plMarca').focus();
  };
}
function escolherPontaBusca(r) {
  const p = PT.PONTA_MAP[r.ponta]; if (!p) return;
  preencherMarcas(); $('#pMarca').value = p.marca; preencherModelos(p.id); $('#pPonta').onchange();
  if (r.tamanho && [...$('#pIso').options].some(o => o.value === r.tamanho)) $('#pIso').value = r.tamanho;
  if ([...$('#pAng').options].some(o => +o.value === +r.angulo)) $('#pAng').value = r.angulo;
  $('#pIso').onchange();
  $('#pBuscaRapida').value = ''; $('#pBuscaRapidaRes').classList.add('hidden');
  toast(`${p.marca} ${p.modelo}${r.tamanho ? ' · ' + r.tamanho : ''} selecionada`);
}
/* ───────── minhas pontas: cadastrar uma ponta que o catálogo não tem ───────── */
let pontaLivreEditando = null; // id da ponta aberta no formulário
function carregarPontasLivres(semTela) {
  PT.PONTAS.filter(p => p.livre).forEach(p => PT.removerPonta(p.id));
  DB.pontasLivres.forEach(def => { try { PT.registrarPonta(def); } catch (e) { console.warn('ponta cadastrada inválida:', def && def.modelo, e.message); } });
  if (!semTela && $('#pMarca')) {
    const marca = $('#pMarca').value, ponta = $('#pPonta').value;
    preencherMarcas(); if ([...$('#pMarca').options].some(o => o.value === marca)) $('#pMarca').value = marca;
    preencherModelos(ponta); preencherIso(); preencherAngulos();
  }
  renderPontasLivres();
}
function limparFormPontaLivre() {
  pontaLivreEditando = null;
  ['#plMarca', '#plModelo', '#plNota', '#plTam'].forEach(s => { $(s).value = ''; });
  $('#plAng').value = '110'; $('#plPmin').value = 1; $('#plPmax').value = 6; $('#plTipo').value = 'leque'; $('#plGota').value = '';
  $('#btnPlSalvar').textContent = 'Salvar e usar esta ponta';
}
function renderPontasLivres() {
  const el = $('#plLista'); if (!el) return;
  el.innerHTML = DB.pontasLivres.length ? '<div class="sub-hd">Minhas pontas</div>' + DB.pontasLivres.map((d, i) => {
    const p = PT.PONTA_MAP[d.id];
    return `<div class="row"><div><b>${esc(d.marca)} · ${esc(d.modelo)}</b><small>${p ? esc(p.sizes.join(', ')) + ' · ' + p.pressao[0] + '–' + p.pressao[1] + ' bar' : 'dados inválidos — edite'}</small></div><div class="acts"><button type="button" class="btn sm" data-plusar="${i}">Usar</button><button type="button" class="btn sm ghost" data-pled="${i}" aria-label="Editar">✎</button><button type="button" class="btn sm ghost danger" data-pldel="${i}" aria-label="Excluir">✕</button></div></div>`;
  }).join('') : '';
  $$('#plLista [data-plusar]').forEach(b => b.onclick = () => usarPonta(DB.pontasLivres[+b.dataset.plusar].id));
  $$('#plLista [data-pled]').forEach(b => b.onclick = () => editarPontaLivre(DB.pontasLivres[+b.dataset.pled]));
  $$('#plLista [data-pldel]').forEach(b => b.onclick = () => excluirPontaLivre(DB.pontasLivres[+b.dataset.pldel]));
}
function usarPonta(id) {
  const p = PT.PONTA_MAP[id]; if (!p) return toast('Ponta não encontrada — edite e salve de novo', 'err');
  preencherMarcas(); $('#pMarca').value = p.marca; preencherModelos(id); $('#pPonta').onchange();
}
function editarPontaLivre(d) {
  pontaLivreEditando = d.id;
  $('#plMarca').value = d.marca; $('#plModelo').value = d.modelo; $('#plTipo').value = d.tipo || 'leque'; $('#plAng').value = d.angulos || '';
  $('#plPmin').value = d.pressaoMin; $('#plPmax').value = d.pressaoMax; $('#plGota').value = d.gota || ''; $('#plNota').value = d.nota || ''; $('#plTam').value = d.tamanhos || '';
  $('#btnPlSalvar').textContent = 'Salvar alterações e usar';
  $('#pontaLivreBox').open = true; $('#plMarca').scrollIntoView({ block: 'center' });
}
function salvarPontaLivre() {
  const def = { marca: $('#plMarca').value.trim(), modelo: $('#plModelo').value.trim(), tipo: $('#plTipo').value, angulos: $('#plAng').value.trim(), pressaoMin: $('#plPmin').value, pressaoMax: $('#plPmax').value, gota: $('#plGota').value, nota: $('#plNota').value.trim(), tamanhos: $('#plTam').value.trim() };
  let p; try { p = PT.registrarPonta(def); } catch (e) { return toast(e.message, 'err'); }
  def.id = p.id;
  if (pontaLivreEditando && pontaLivreEditando !== p.id) { PT.removerPonta(pontaLivreEditando); DB.pontasLivres = DB.pontasLivres.filter(x => x.id !== pontaLivreEditando); }
  const i = DB.pontasLivres.findIndex(x => x.id === p.id);
  if (i >= 0) DB.pontasLivres[i] = def; else DB.pontasLivres.push(def);
  saveDB(); limparFormPontaLivre(); renderPontasLivres(); usarPonta(p.id);
  toast(`Ponta ${p.marca} ${p.modelo} salva e selecionada`);
}
function excluirPontaLivre(d) {
  if (!confirm(`Excluir a ponta ${d.marca} ${d.modelo}?`)) return;
  PT.removerPonta(d.id); DB.pontasLivres = DB.pontasLivres.filter(x => x.id !== d.id); saveDB();
  if (pontaLivreEditando === d.id) limparFormPontaLivre();
  const marca = $('#pMarca').value; preencherMarcas(); if ([...$('#pMarca').options].some(o => o.value === marca)) $('#pMarca').value = marca;
  preencherModelos(); $('#pPonta').onchange(); renderPontasLivres();
}
function initPontas() {
  carregarPontasLivres(true);
  $('#pAlvo').innerHTML = PT.ALVOS.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  $('#chipsPreset').innerHTML = PT.PRESETS.map(p => `<button type="button" class="chip" data-preset="${esc(p.id)}" title="${esc(p.nota)}">${esc(p.nome)}</button>`).join('');
  preencherMarcas(); preencherModelos(); preencherIso(); preencherAngulos();
  const recalc = () => { atualizarVazaoAlvo(); if (regulagem) calcularRegulagem(true); else renderTabelaCruzada(); };
  $('#pModo').onchange = () => { camposPorModo(); recalc(); };
  $('#pAlvo').onchange = () => { preencherModelos($('#pPonta').value); preencherIso(); preencherAngulos(); recalc(); };
  $('#pMarca').onchange = () => { preencherModelos(); preencherIso(); preencherAngulos(); recalc(); };
  $('#pPonta').onchange = () => { preencherIso(); preencherAngulos(); recalc(); };
  $('#plTipo').innerHTML = Object.entries(PT.TIPOS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#plGota').innerHTML = '<option value="">não sei</option>' + PT.GOTAS.map(g => `<option value="${g.id}">${esc(g.nome)} · ${esc(g.faixa)}</option>`).join('');
  $('#btnPlSalvar').onclick = salvarPontaLivre; $('#btnPlLimpar').onclick = limparFormPontaLivre;
  $('#pBuscaRapida').oninput = e => renderBuscaPonta(e.target.value);
  $('#pBuscaRapida').onkeydown = e => { if (e.key === 'Escape') $('#pBuscaRapidaRes').classList.add('hidden'); else if (e.key === 'Enter') { e.preventDefault(); const b = $('#pBuscaRapidaRes [data-pb]'); if (b) b.click(); } };
  document.addEventListener('click', e => { if (!e.target.closest('#pBuscaRapidaWrap')) $('#pBuscaRapidaRes').classList.add('hidden'); });
  ['#pDist', '#pTempo'].forEach(s => { $(s).oninput = () => { atualizarVelocidade(true); recalc(); }; });
  $('#pVel').addEventListener('input', () => atualizarVelocidade()); atualizarVelocidade();
  ['#pIso', '#pAng', '#pVel', '#pVol', '#pEsp', '#pNb', '#pLf', '#pBf', '#pEl', '#pTq', '#pArea', '#pPress'].forEach(s => { $(s).oninput = recalc; $(s).onchange = recalc; });
  $('#pFixar').onchange = recalc; $('#pProt').onchange = recalc;
  ['#pTemp', '#pUr', '#pVento', '#pHora'].forEach(s => { $(s).oninput = () => { renderClima(); recalc(); }; });
  ['#pTq', '#pVol'].forEach(s => { const antes = $(s).oninput; $(s).oninput = ev => { if (antes) antes(ev); atualizarAreaTanque(); }; });
  $('#btnRegular').onclick = () => calcularRegulagem();
  $('#btnSugerir').onclick = sugerirPontas;
  $('#btnSalvarReg').onclick = salvarRegulagem;
  $('#btnCalibrar').onclick = renderCalibracao;
  $('#xModo').onchange = () => { atualizarLabelCruzar(); if ($('#xAlvo').value) cruzarVazaoPressao(); };
  $('#btnCruzar').onclick = cruzarVazaoPressao;
  $('#btnCruzPonta').onclick = preencherCruzarDaPonta;
  $('#btnCruzCalib').onclick = preencherCruzarDaCalibracao;
  $('#xAlvo').oninput = () => { if (num($('#xQ1').value) > 0 && num($('#xP1').value) > 0) cruzarVazaoPressao(); };
  atualizarLabelCruzar();
  $('#pBusca').oninput = e => renderCatalogoPontas(e.target.value);
  $$('#chipsPreset [data-preset]').forEach(ch => ch.onclick = () => {
    const p = PT.PRESETS.find(x => x.id === ch.dataset.preset);
    aplicarRegulagem({ ...p, tanque: num($('#pTq').value), area: num($('#pArea').value) });
    calcularRegulagem(); toast(p.nome);
  });
  camposPorModo();
  if (DB.config.pontas) aplicarRegulagem(DB.config.pontas);
  atualizarVazaoAlvo(); renderCatalogoPontas(); renderRegulagens(); renderTabelaCruzada(); renderClima(); atualizarAreaTanque();
}

/* ───────── URL / postMessage ───────── */
function decodeMix(s) { try { s = s.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(s + '='.repeat((4 - s.length % 4) % 4))))); } catch { return null; } }
function aplicarMix(mix, analisarJa) {
  if (!mix || !Array.isArray(mix.itens)) return false;
  calda.itens = mix.itens.map(i => ({ id: uid(), nome: i.nome || i.nome_livre || '?', dose: +i.dose || 0, unidade: i.unidade || 'L/ha', classe: i.classe, formulacao: i.formulacao, preco: +i.preco || 0, ativos: i.ativos, ingredientes: i.ingredientes, fonte: mix.origem || 'externo' }));
  aplicarContexto(mix); renderItens();
  if (analisarJa) analisar(true);
  return true;
}
window.addEventListener('message', ev => { const d = ev.data; if (!d || typeof d !== 'object') return; if (d.type === 'gefaz-calda:analisar' && d.mix) { aplicarMix(d.mix, true); navTo('resultado'); try { ev.source.postMessage({ type: 'gefaz-calda:resultado', resultado: resumoExport(), mix: d.mix }, ev.origin); } catch (e) { } } });

/* ───────── init ───────── */
function init() {
  document.addEventListener('input', conferirResultadoAtual);
  document.addEventListener('change', conferirResultadoAtual);
  window.addEventListener('beforeprint', conferirResultadoAtual);
  loadDB();
  $('#fCultura').innerHTML = KB.culturas.map(c => `<option ${c === DB.config.cultura ? 'selected' : ''}>${c}</option>`).join('');
  $('#fEquip').innerHTML = Object.entries(KB.equipamentos).map(([k, e]) => `<option value="${k}" ${k === DB.config.equipamento ? 'selected' : ''}>${e.nome}</option>`).join('');
  $('#fSeveridade').innerHTML = '<option value=""></option>' + KB.severidades.map(s => `<option>${s}</option>`).join('');
  $('#fParte').innerHTML = '<option value=""></option>' + KB.partesAlvo.map(s => `<option>${s}</option>`).join('');
  montarAlvos(); atualizarListasCultura();
  $('#fVolume').value = DB.config.volumeHa; if (DB.config.ph != null) $('#fPh').value = DB.config.ph; if (DB.config.dureza != null) $('#fDureza').value = DB.config.dureza;
  renderChipsRapidos();
  $('#busca').oninput = e => renderBusca(e.target.value);
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) $('#buscaRes').classList.add('hidden'); });
  $('#fCultura').onchange = () => { atualizarAlvos(); atualizarListasCultura(); renderItens(); DB.config.cultura = $('#fCultura').value; saveDB(); };
  $('#fEquip').onchange = () => { const k = $('#fEquip').value; $('#droneAviso').classList.toggle('hidden', k !== 'drone'); $('#cafeAviso').classList.toggle('hidden', k !== 'herbicida-cafe'); const eq = KB.equipamentos[k]; if (eq && !$('#fVolume').dataset.touched) $('#fVolume').value = Math.round((eq.volume[0] + eq.volume[1]) / 2); DB.config.equipamento = k; areaPorTanqueCalda(); saveDB(); };
  $('#fVolume').oninput = () => { $('#fVolume').dataset.touched = 1; areaPorTanqueCalda(); };
  $('#fTanque').oninput = areaPorTanqueCalda; $('#fArea').oninput = areaPorTanqueCalda;
  $('#btnManual').onclick = () => formManual();
  $('#btnReceita').onclick = () => { if (!DB.receitas.length && !DB.caldas.length) return toast('Nenhuma receita importada ou calda salva — veja Integração', 'err'); modal(`<h2>Carregar</h2><div class="lista">${DB.caldas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>calda salva · ${r.itens.length} itens</small></div><button class="btn sm" data-c="${i}">Carregar</button></div>`).join('')}${DB.receitas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>${esc(r.fonte)} · ${esc(r.cultura || '')} · ${r.itens.length} itens</small></div><button class="btn sm" data-r="${i}">Carregar</button></div>`).join('')}</div><div class="row-btns"><button class="btn ghost" id="mCancel">Fechar</button></div>`); $('#mCancel').onclick = closeModal; $$('#modal [data-c]').forEach(b => b.onclick = () => { carregarReceita(DB.caldas[+b.dataset.c]); closeModal(); }); $$('#modal [data-r]').forEach(b => b.onclick = () => { carregarReceita(DB.receitas[+b.dataset.r]); closeModal(); }); };
  $('#btnAnalisar').onclick = () => analisar();
  $('#btnSalvarCalda').onclick = salvarCalda;
  $('#btnLimpar').onclick = () => { if (!calda.itens.length || confirm('Limpar a calda atual?')) { calda = { itens: [], obs: '' }; $('#fObs').value = ''; definirAlvos(null); definirTalhoes([]); renderItens(); } };
  $$('#nav button').forEach(b => b.onclick = () => navTo(b.dataset.tab));
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  // integração
  $('#impPV').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importPVGest(JSON.parse(await f.text())); } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } e.target.value = ''; };
  $('#impG360').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importGefaz360(JSON.parse(await f.text())); } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } e.target.value = ''; };
  $('#btnImpCola').onclick = () => { try { importarTexto($('#impCola').value); $('#impCola').value = ''; } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } };
  $('#btnExpCatalogo').onclick = () => download(`gefaz-calda-export-${hoje()}.json`, JSON.stringify(exportPVGestFormat(DB.caldas.concat(DB.receitas)), null, 1));
  $('#btnLimparCatalogo').onclick = () => { if (confirm('Limpar catálogo, receitas e talhões importados? (talhões cadastrados por você ou com histórico ficam)')) { DB.catalogo = []; DB.receitas = []; DB.talhoes = DB.talhoes.filter(t => t.fonte === 'manual' || (t.aplicacoes || []).length); saveDB(); renderIntegracao(); renderHistorico(); } };
  $('#btnCfg').onclick = () => { DB.config.ph = $('#cfgPh').value === '' ? null : num($('#cfgPh').value); DB.config.dureza = $('#cfgDureza').value === '' ? null : num($('#cfgDureza').value); DB.config.custo = { ...DB.config.custo, barra: num($('#cfgBarra').value), turbo: num($('#cfgTurbo').value), drone: num($('#cfgDrone').value), costal: num($('#cfgCostal').value), 'herbicida-cafe': num($('#cfgHerbCafe').value) }; DB.config.acidificanteUltimo = $('#cfgAcidUltimo').checked; saveDB(); toast('Configuração salva'); };
  $('#btnBackup').onclick = () => download(`gefaz-calda-backup-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda-backup', ...DB }, null, 1));
  $('#impBackup').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.app !== 'gefaz-calda-backup') throw new Error('não é um backup do Gefaz Calda'); if (confirm('Substituir todos os dados do Gefaz Calda por este backup?')) { delete d.app; DB = d; loadDBFrom(d); saveDB(); carregarPontasLivres(); renderIntegracao(); renderHistorico(); if (typeof refrescarTudo === 'function') { refrescarTudo(); renderFicha(); atualizarStatusBackup(); } toast('Backup restaurado'); } } catch (err) { toast('Falha: ' + err.message, 'err'); } e.target.value = ''; };
  window.addEventListener('online', () => { $('#netStatus').textContent = 'online'; }); window.addEventListener('offline', () => { $('#netStatus').textContent = 'offline'; });
  $('#netStatus').textContent = navigator.onLine ? 'online' : 'offline';
  aplicarRastreio(DB.config.rastreio); atualizarTalhoes(); preencherSelectRegulagem();
  $('#fRegulagem').onchange = notaRegulagem;
  $('#fVolume').addEventListener('input', notaRegulagem);
  $('#btnNovoTalhao').onclick = () => abrirFormTalhao(null);
  $('#btnTfSalvar').onclick = salvarFormTalhao;
  $('#btnTfCancelar').onclick = fecharFormTalhao;
  $('#tfNome').onkeydown = $('#tfArea').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); salvarFormTalhao(); } };
  ['#fMaquina', '#fOperador', '#fResponsavel', '#fCrea'].forEach(s => { $(s).onchange = guardarPadroesRastreio; });
  renderItens(); renderHistorico(); renderIntegracao(); renderReferencias(); initPontas(); areaPorTanqueCalda(); notaRegulagem();
  carregarAgrofit().then(() => { renderItens(); });
  const q = new URLSearchParams(location.search);
  const mix = q.get('mix') ? decodeMix(q.get('mix')) : null;
  if (mix && aplicarMix(mix, true)) { navTo('resultado'); history.replaceState(null, '', location.pathname); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (typeof initFazenda === 'function') initFazenda();
}
function loadDBFrom(d) { DB = d; DB.version = DB.version || 1; normalizarDB(); }
window.GefazCaldaApp = { analisar, addItem, aplicarMix, get calda() { return calda; }, get resultado() { return resultado; }, get DB() { return DB; } };
document.addEventListener('DOMContentLoaded', init);
