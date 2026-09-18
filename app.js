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
const hoje = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
const agora = () => new Date().toLocaleString('pt-BR');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const norm = E.norm;

/* ───────── armazenamento ───────── */
let DB;
function defaultDB() {
  return { version: 1, config: { ph: 7.5, dureza: null, cultura: 'Café', equipamento: 'turbo', volumeHa: 400, custo: { barra: 60, turbo: 90, drone: 120, costal: 40, aviao: 110 }, acidificanteUltimo: false, fazenda: 'Fazenda' }, catalogo: [], receitas: [], talhoes: [], caldas: [], historico: [], jarTests: [] };
}
function loadDB() { try { DB = JSON.parse(localStorage.getItem(LS)) || null; } catch { DB = null; } const d = defaultDB(); if (!DB || !DB.version) DB = d; DB.config = { ...d.config, ...(DB.config || {}) }; DB.config.custo = { ...d.config.custo, ...(DB.config.custo || {}) }; ['catalogo', 'receitas', 'talhoes', 'caldas', 'historico', 'jarTests'].forEach(k => { if (!Array.isArray(DB[k])) DB[k] = []; }); }
function saveDB() { try { localStorage.setItem(LS, JSON.stringify(DB)); } catch (e) { toast('Não foi possível salvar (armazenamento cheio?)', 'err'); } }

/* ───────── estado da calda ───────── */
let calda = { itens: [], obs: '' };
let resultado = null;
let AGRO = null; // índice Agrofit
let agroBusca = [];

/* ───────── UI básica ───────── */
let toastT = null;
function toast(msg, cls = '') { const el = $('#toast'); el.textContent = msg; el.className = 'toast ' + cls; clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 3200); }
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
function navTo(tab) { $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab)); $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); window.scrollTo(0, 0); }
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
function atualizarAlvos() {
  if (!AGRO) return;
  const cult = norm($('#fCultura').value);
  const ci = AGRO.culturas.findIndex(c => norm(c) === cult);
  const set = new Set();
  if (ci >= 0) AGRO.produtos.forEach(p => (p.a[ci] || []).forEach(i => set.add(AGRO.alvos[i])));
  $('#dlAlvos').innerHTML = [...set].sort().map(a => `<option value="${esc(a)}">`).join('');
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
  const cat = buscarCatalogo(q), kb = buscarKB(q), agro = buscarAgrofit(q);
  const html = [];
  cat.forEach((r, i) => html.push(`<div class="it" data-src="cat" data-i="${i}"><div><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small></div><span class="src cat">catálogo</span></div>`));
  kb.forEach((r, i) => html.push(`<div class="it" data-src="kb" data-i="${i}"><div><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small></div><span class="src kb">base</span></div>`));
  agro.forEach((r, i) => html.push(`<div class="it" data-src="agro" data-i="${i}"><div><b>${esc(r.p.m.split(';')[0])}</b><small>${esc(r.p.ia.map(x => x[0].split(' (')[0] + (x[2] ? ' ' + x[2] : '')).join(' + '))} · ${esc(r.p.f || '?')} · ${esc(r.p.cl)}</small></div><span class="src agro">${r.reg ? '✔ ' + esc($('#fCultura').value) : 'Agrofit'}</span></div>`));
  if (!html.length) html.push('<div class="it"><small>Nada encontrado. Use “+ Produto manual”.</small></div>');
  box.innerHTML = html.join(''); box.classList.remove('hidden');
  box.querySelectorAll('.it[data-src]').forEach(el => el.onclick = () => {
    const src = el.dataset.src, i = +el.dataset.i;
    if (src === 'agro') addItem(itemDeAgrofit(agro[i].p));
    else if (src === 'kb') addItem({ id: uid(), ...kb[i].item });
    else addItem({ id: uid(), ...cat[i].item });
    $('#busca').value = ''; box.classList.add('hidden');
  });
}

/* ───────── itens ───────── */
function addItem(it) {
  if (calda.itens.some(x => norm(x.nome) === norm(it.nome))) { toast('Produto já está na calda'); return; }
  const cat = DB.catalogo.find(p => norm(p.nome) === norm(it.nome));
  if (cat && !it.preco) it.preco = cat.preco || 0;
  calda.itens.push(it); renderItens(); toast(`${it.nome} adicionado`);
}
function renderItens() {
  const el = $('#itens'); $('#nItens').textContent = `${calda.itens.length} produto(s)`;
  const cult = $('#fCultura').value;
  el.innerHTML = calda.itens.map((it, i) => {
    const ativos = E.resolverAtivos(it);
    const reg = it.registro ? (it.registro.culturas.some(c => norm(c) === norm(cult) || norm(c) === 'todas as culturas') ? `<span class="tag reg">registro ✔ ${esc(cult)}</span>` : `<span class="tag noreg">sem registro em ${esc(cult)}</span>`) : '';
    return `<div class="item" data-i="${i}">
      <div><div class="nm">${esc(it.nome)}</div><div class="meta">${it.fonte ? `<span class="tag">${esc(it.fonte)}</span>` : ''}${ativos.map(a => `<span class="tag ${a.tags && a.tags.includes('biologico') ? 'bio' : ''}">${esc(a.nome)}${a.moa ? ' · ' + esc(a.moa.sistema + ' ' + a.moa.codigo) : ''}</span>`).join('')}${!ativos.length ? '<span class="tag noreg">ativo não identificado</span>' : ''}${reg}${it.concentracao ? `<span class="tag">${esc(it.concentracao)}</span>` : ''}</div></div>
      <button class="x" data-del="${i}" title="Remover">✕</button>
      <div class="ctl">
        <label>Dose<input type="number" step="any" min="0" data-f="dose" value="${it.dose || ''}"></label>
        <label>Unidade<select data-f="unidade">${KB.unidades.map(u => `<option ${u === it.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label>Formulação<select data-f="formulacao"><option value="">?</option>${Object.keys(KB.formulacoes).map(f => `<option ${f === it.formulacao ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label>Classe<select data-f="classe">${KB.classes.map(c => `<option ${c === it.classe ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Preço R$/${it.unidade && it.unidade.includes('kg') || it.unidade === 'g/ha' || it.unidade === 'g/100L' ? 'kg' : 'L'}<input type="number" step="any" min="0" data-f="preco" value="${it.preco || ''}"></label>
      </div></div>`;
  }).join('');
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { calda.itens.splice(+b.dataset.del, 1); renderItens(); });
  el.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { const it = calda.itens[+inp.closest('.item').dataset.i]; const f = inp.dataset.f; it[f] = f === 'dose' || f === 'preco' ? num(inp.value) : inp.value; if (f === 'unidade') renderItens(); });
}
function formManual(pre) {
  pre = pre || {};
  modal(`<h2>Produto manual</h2><p class="small muted">Informe o nome comercial e, se souber, o ingrediente ativo: a base reconhece o ativo pelo nome (ex.: “Glifosato”, “Tebuconazol”, “Sulfato de zinco”).</p>
    <label>Nome<input id="mNome" value="${esc(pre.nome || '')}"></label>
    <label>Ingrediente(s) ativo(s)<input id="mIa" placeholder="ex.: azoxistrobina + ciproconazol" value="${esc(pre.ia || '')}"></label>
    <div class="grid2"><label>Classe<select id="mClasse">${KB.classes.map(c => `<option ${c === pre.classe ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>Formulação<select id="mForm"><option value="">?</option>${Object.keys(KB.formulacoes).map(f => `<option>${f}</option>`).join('')}</select></label>
    <label>Dose<input id="mDose" type="number" step="any" value="${pre.dose || ''}"></label>
    <label>Unidade<select id="mUn">${KB.unidades.map(u => `<option ${u === pre.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label>Preço (R$/L ou kg)<input id="mPreco" type="number" step="any" value="${pre.preco || ''}"></label></div>
    <div class="row-btns"><button class="btn primary" id="mOk">Adicionar</button><button class="btn ghost" id="mCancel">Cancelar</button></div>`);
  $('#mCancel').onclick = closeModal;
  $('#mOk').onclick = () => { const nome = $('#mNome').value.trim(); if (!nome) return toast('Informe o nome', 'err'); addItem({ id: uid(), nome, ingredientes: $('#mIa').value ? [$('#mIa').value] : [], classe: $('#mClasse').value, formulacao: $('#mForm').value, dose: num($('#mDose').value), unidade: $('#mUn').value, preco: num($('#mPreco').value), fonte: 'manual' }); closeModal(); };
}

/* ───────── contexto ───────── */
function lerContexto() {
  return {
    cultura: $('#fCultura').value, alvo: $('#fAlvo').value.trim(), equipamento: $('#fEquip').value,
    volumeHa: num($('#fVolume').value), area: num($('#fArea').value), tanque: num($('#fTanque').value),
    agua: { ph: $('#fPh').value === '' ? null : num($('#fPh').value), dureza: $('#fDureza').value === '' ? null : num($('#fDureza').value), turbidez: $('#fTurbidez').value, fonte: $('#fFonte').value },
    obs: $('#fObs').value
  };
}
function aplicarContexto(c) {
  if (!c) return;
  if (c.cultura) $('#fCultura').value = KB.culturas.includes(c.cultura) ? c.cultura : (KB.culturas.find(x => norm(x) === norm(c.cultura)) || 'Outra');
  if (c.alvo != null) $('#fAlvo').value = c.alvo;
  if (c.equipamento) $('#fEquip').value = c.equipamento;
  if (c.volumeHa) $('#fVolume').value = c.volumeHa;
  if (c.area != null) $('#fArea').value = c.area;
  if (c.tanque != null) $('#fTanque').value = c.tanque;
  if (c.agua) { $('#fPh').value = c.agua.ph ?? ''; $('#fDureza').value = c.agua.dureza ?? ''; $('#fTurbidez').value = c.agua.turbidez || 'limpa'; $('#fFonte').value = c.agua.fonte || ''; }
  if (c.obs != null) $('#fObs').value = c.obs;
  $('#droneAviso').classList.toggle('hidden', $('#fEquip').value !== 'drone');
  atualizarAlvos();
}

/* ───────── análise ───────── */
function analisar(silencioso) {
  const ctx = lerContexto();
  if (!calda.itens.length) { toast('Adicione ao menos um produto', 'err'); return null; }
  const semDose = calda.itens.filter(i => !i.dose);
  if (semDose.length && !silencioso) toast(`Sem dose: ${semDose.map(i => i.nome).join(', ')} — custo e jar test ficam incompletos`);
  const opts = { ...ctx, regraFazenda: { acidificanteUltimo: !!DB.config.acidificanteUltimo }, custoOperacional: DB.config.custo, historicoJar: DB.jarTests };
  resultado = E.analisar(calda.itens, opts);
  resultado.contexto = ctx; resultado.data = agora();
  DB.historico.unshift({ id: uid(), data: resultado.data, status: resultado.status, resumo: resultado.resumo.frase, itens: calda.itens.map(i => i.nome), calda: JSON.parse(JSON.stringify({ itens: calda.itens, ...ctx })) });
  DB.historico = DB.historico.slice(0, 60); saveDB();
  renderResultado(); renderJar(); renderHistorico();
  if (window.parent !== window) { try { window.parent.postMessage({ type: 'gefaz-calda:resultado', resultado: resumoExport(), mix: { itens: calda.itens, ...ctx } }, '*'); } catch (e) { } }
  if (!silencioso) navTo('resultado');
  return resultado;
}
function resumoExport() { if (!resultado) return null; const r = resultado; return { status: r.status, resumo: r.resumo, score: r.score, confianca: r.confianca, alertas: r.alertas, ph: r.ph, ordem: r.ordem.filter(p => p.itens.length || p.passo <= 2 || p.passo >= 11), custo: r.custo, tanque: r.tanque, checklist: r.checklist, registro: r.registro, jarTest: r.jarTest, data: r.data, contexto: r.contexto, versao: E.versao }; }

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
  <div class="print-only"><h1>Laudo de compatibilidade de calda — ${esc(DB.config.fazenda)}</h1><p>${esc(r.data)} · Gefaz Calda ${E.versao} · KB ${KB.versao}${AGRO ? ' · Agrofit ' + esc(AGRO.gerado) : ''}</p></div>
  <div class="status ${r.status}"><div><h2>${esc(r.resumo.rotulo)}</h2><div class="sub">${esc(ctx.cultura)}${ctx.alvo ? ' · ' + esc(ctx.alvo) : ''} · ${esc((KB.equipamentos[ctx.equipamento] || {}).nome || ctx.equipamento)} · ${ctx.volumeHa} L/ha · ${r.itens.length} produtos</div><div class="sub">${esc(r.resumo.frase)}</div></div><div class="score" title="Índice de risco (100 = sem alertas)">${r.score}</div></div>
  <div class="card"><div class="kpis">
    <div class="kpi"><b>${r.resumo.contagem.alta}</b><small>críticos</small></div><div class="kpi"><b>${r.resumo.contagem.media}</b><small>restrições</small></div><div class="kpi"><b>${Math.round(r.confianca * 100)} %</b><small>confiança</small></div>
    <div class="kpi"><b>${BRL(r.custo.totalHa)}</b><small>custo total/ha</small></div><div class="kpi"><b>${r.jarTest.obrigatorio ? 'Sim' : 'Recomendado'}</b><small>jar test</small></div></div>
    <div class="row-btns"><button class="btn primary" id="btnPrint">🖨️ Laudo (PDF/impressão)</button><button class="btn" id="btnJar">🫙 Jar test</button><button class="btn ghost" id="btnExpLaudo">⬇️ JSON do laudo</button><button class="btn ghost" id="btnExpReceita">⬇️ Receita (PVGest/Gefaz360)</button><button class="btn ghost" id="btnEnvPV">📤 PVGest (este navegador)</button><button class="btn ghost" id="btnEnvG360">📤 Gefaz360 (este navegador)</button><button class="btn ghost" id="btnEnvCodex">📤 Codex (atividade)</button></div></div>
  ${ordemTipos.filter(t => porTipo[t]).map(t => `<div class="card"><div class="card-hd"><h2>${esc(TIPO_LABEL[t])}</h2><span class="hint">${porTipo[t].length} alerta(s)</span></div>${porTipo[t].map(a => `<div class="al ${a.severidade}"><div class="t"><span>${esc(a.titulo)}</span><span><span class="sev ${a.severidade}">${a.severidade}</span> <span class="conf">C ${a.confianca.toFixed(2)}</span></span></div><div class="d">${esc(a.detalhe)}${a.paresTexto ? ` <i>(${esc(a.paresTexto)})</i>` : a.nomes ? ` <i>(${esc(a.nomes.join(' × '))})</i>` : ''}</div><div class="c">→ ${esc(a.conduta)}</div><div class="f">Fonte: ${esc(a.fonte)}${a.regra ? ' · ' + a.regra : ''}</div></div>`).join('')}</div>`).join('')}
  ${!alertasVis.length ? '<div class="card"><div class="al info"><div class="t">Nenhum alerta gerado</div><div class="d">Todos os produtos foram reconhecidos e não há regra de incompatibilidade registrada entre eles. Isso não substitui o jar test.</div></div></div>' : ''}
  <div class="card"><div class="card-hd"><h2>pH da calda</h2></div>${phBar}<div class="small muted" style="margin-top:6px">${r.ph.itensSensiveis.map(i => `${esc(i.nome)}: ${i.ph[0]}–${i.ph[1]}`).join(' · ')}</div></div>
  <div class="card"><div class="card-hd"><h2>Matriz de pares</h2><span class="hint">como no Koppert / Yara: cada par tem um veredito</span></div><div class="matrix">${matrizHTML(r)}</div><div class="legend"><span><i style="background:#c8e6c9"></i>compatível</span><span><i style="background:#bbdefb"></i>atenção</span><span><i style="background:#ffe082"></i>restrições</span><span><i style="background:#ef9a9a"></i>incompatível</span><span><i style="background:#eee"></i>não testado</span></div></div>
  <div class="card"><div class="card-hd"><h2>Ordem de adição</h2><span class="hint">Embrapa Doc. 437 (formulação)${DB.config.acidificanteUltimo ? ' · regra da fazenda ativa' : ''}</span></div><ol class="steps">${r.ordem.map(p => `<li><div class="n ${p.itens.length ? 'has' : ''}">${p.passo}</div><div><div class="ti">${esc(p.titulo)}</div>${p.nota ? `<div class="no">${esc(p.nota)}</div>` : ''}${p.itens.length ? `<div class="pr">${p.itens.map(i => `<span>${esc(i.nome)}${i.formulacao ? ' <b>' + esc(i.formulacao) + '</b>' : ''}${i.notas.length ? '<small>' + i.notas.map(esc).join(' ') + '</small>' : ''}</span>`).join('')}</div>` : ''}</div></li>`).join('')}</ol></div>
  <div class="card"><div class="card-hd"><h2>Custo por hectare</h2><span class="hint">produto + operação (${esc((KB.equipamentos[ctx.equipamento] || {}).nome || '')})</span></div><table class="tb"><thead><tr><th>Produto</th><th class="num">Dose/ha</th><th class="num">Preço</th><th class="num">R$/ha</th></tr></thead><tbody>${r.custo.porItem.map(i => `<tr><td>${esc(i.nome)}</td><td class="num">${fmt(i.dosePorHa, 3)} ${i.base}</td><td class="num">${i.semPreco ? '<span class="tag noreg">sem preço</span>' : BRL(i.preco) + '/' + i.base}</td><td class="num">${BRL(i.custoHa)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Produtos</td><td class="num">${BRL(r.custo.produtosHa)}</td></tr><tr><td colspan="3">Operação (${esc(ctx.equipamento)})</td><td class="num">${BRL(r.custo.operacionalHa)}</td></tr><tr><td colspan="3">Total/ha</td><td class="num">${BRL(r.custo.totalHa)}</td></tr><tr><td colspan="3">Total para ${fmt(ctx.area, 1)} ha</td><td class="num">${BRL(r.custo.totalArea)}</td></tr></tfoot></table>${r.custo.semPreco.length ? `<div class="small muted">Sem preço: ${esc(r.custo.semPreco.join(', '))} — importe o estoque do PVGest/Gefaz360 ou informe no item.</div>` : ''}</div>
  ${r.tanque ? `<div class="card"><div class="card-hd"><h2>Ficha de tanque</h2><span class="hint">${r.tanque.tanque} L · ${fmt(r.tanque.haPorCarga, 2)} ha por carga</span></div><div class="kpis"><div class="kpi"><b>${fmt(r.tanque.volumeTotal)}</b><small>L de calda</small></div><div class="kpi"><b>${r.tanque.cargasCheias}</b><small>cargas cheias</small></div><div class="kpi"><b>${fmt(r.tanque.ultimaCarga)}</b><small>L na última carga</small></div></div><table class="tb"><thead><tr><th>Produto (ordem)</th><th class="num">Por carga cheia</th><th class="num">Última carga</th><th class="num">Total</th></tr></thead><tbody>${r.tanque.porCargaCheia.map((i, k) => `<tr><td>${k + 1}. ${esc(i.nome)}</td><td class="num">${fmt(i.qtd, 3)} ${i.unidade}</td><td class="num">${r.tanque.ultimaCargaItens[k] ? fmt(r.tanque.ultimaCargaItens[k].qtd, 3) + ' ' + i.unidade : '—'}</td><td class="num">${fmt(r.tanque.totalPorProduto[k].qtd, 2)} ${i.unidade}</td></tr>`).join('')}</tbody></table></div>` : ''}
  <div class="card"><div class="card-hd"><h2>Registro MAPA (Agrofit)</h2></div><table class="tb"><thead><tr><th>Produto</th><th>${esc(ctx.cultura)}</th><th>Alvo</th></tr></thead><tbody>${r.registro.map(g => `<tr><td>${esc(g.nome)}</td><td>${g.registrado === null ? '<span class="tag">não verificado</span>' : g.registrado ? '<span class="tag reg">registrado</span>' : '<span class="tag noreg">sem registro</span>'}</td><td>${g.alvoOk === null ? (g.alvos.length ? `<small>${esc(g.alvos.slice(0, 4).join('; '))}${g.alvos.length > 4 ? '…' : ''}</small>` : '—') : g.alvoOk ? '<span class="tag reg">alvo na bula</span>' : '<span class="tag noreg">alvo não consta</span>'}</td></tr>`).join('')}</tbody></table></div>
  <div class="card"><div class="card-hd"><h2>Checklist pré-saída</h2></div><ul class="check-list">${r.checklist.map(c => `<li><input type="checkbox"><span>${esc(c)}</span></li>`).join('')}</ul></div>
  ${ctx.obs ? `<div class="card"><div class="card-hd"><h2>Observações</h2></div><p>${esc(ctx.obs)}</p></div>` : ''}
  <div class="card small muted">Apoio à decisão técnica. Não substitui bula, receituário agronômico (IN 40/2018) nem o jar test. Confiança abaixo de 0,70 é indicativa.</div>`;
  $('#btnPrint').onclick = () => window.print();
  $('#btnJar').onclick = () => navTo('jar');
  $('#btnExpLaudo').onclick = () => download(`laudo-calda-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda', versao: E.versao, calda: { itens: calda.itens, ...ctx }, resultado: resumoExport() }, null, 1));
  $('#btnExpReceita').onclick = () => download(`receita-gefaz-calda-${hoje()}.json`, JSON.stringify(exportPVGestFormat([caldaComoReceita()]), null, 1));
  $('#btnEnvPV').onclick = enviarParaPVGest; $('#btnEnvG360').onclick = enviarParaGefaz360; $('#btnEnvCodex').onclick = enviarParaCodex;
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
    const obs = $$('.jarObs:checked').map(c => c.value);
    const resSel = $('#jarRes').value;
    if (resSel !== 'incompativel' && obs.some(o => /Grumos|Separação|Cristais|Floculação/.test(o))) { if (!confirm('Você marcou sinais de incompatibilidade mas classificou como compatível. Registrar mesmo assim?')) return; }
    DB.jarTests.unshift({ id: uid(), chave: r.chave, data: agora(), itens: r.itens.map(i => i.nome), cultura: r.contexto.cultura, volumeHa: r.contexto.volumeHa, ph: $('#jarPh').value, observacoes: obs, resultado: resSel, obs: $('#jarObsTxt').value });
    saveDB(); toast('Jar test registrado — entra na base da fazenda'); renderHistorico(); analisar(true); navTo('resultado');
  };
}

/* ───────── histórico e caldas ───────── */
function caldaComoReceita() { const ctx = lerContexto(); return { id: uid(), nome: `Calda ${ctx.cultura}${ctx.alvo ? ' — ' + ctx.alvo : ''} ${hoje()}`, cultura: ctx.cultura, alvo: ctx.alvo, volumeHa: ctx.volumeHa, itens: calda.itens.map(i => ({ nome: i.nome, dose: i.dose, unidade: i.unidade, classe: i.classe, formulacao: i.formulacao, preco: i.preco, ativos: i.ativos, ingredientes: i.ingredientes, registro: i.registro, tags: i.tags, fonte: i.fonte })), agua: ctx.agua, equipamento: ctx.equipamento, area: ctx.area, tanque: ctx.tanque, obs: ctx.obs, fonte: 'gefaz-calda', status: resultado ? resultado.status : null }; }
function salvarCalda() { if (!calda.itens.length) return toast('Nada para salvar', 'err'); const nome = prompt('Nome da calda', caldaComoReceita().nome); if (!nome) return; const c = caldaComoReceita(); c.nome = nome; DB.caldas.unshift(c); saveDB(); toast('Calda salva'); renderHistorico(); }
function carregarReceita(rec) { calda.itens = rec.itens.map(i => ({ id: uid(), ...i, dose: +i.dose || 0, unidade: i.unidade || 'L/ha' })); aplicarContexto({ cultura: rec.cultura, alvo: rec.alvo, volumeHa: rec.volumeHa, area: rec.area, tanque: rec.tanque, equipamento: rec.equipamento, agua: rec.agua, obs: rec.obs }); renderItens(); navTo('calda'); toast(`Receita “${rec.nome}” carregada`); }
function renderHistorico() {
  const badge = s => `<span class="pill ${{ compativel: 'ok', restricoes: 'warn', incompativel: 'bad', testar: 'info' }[s] || 'muted'}">${esc(STATUS_LABEL[s] || s || '—')}</span>`;
  $('#listaCaldas').innerHTML = DB.caldas.length ? DB.caldas.map((c, i) => `<div class="row"><div><b>${esc(c.nome)}</b><small>${esc(c.cultura)} · ${c.itens.length} produtos · ${c.volumeHa} L/ha ${c.status ? badge(c.status) : ''}</small></div><div class="acts"><button class="btn sm" data-load="${i}">Carregar</button><button class="btn sm ghost danger" data-delc="${i}">✕</button></div></div>`).join('') : '<div class="small muted">Nenhuma calda salva.</div>';
  $$('#listaCaldas [data-load]').forEach(b => b.onclick = () => carregarReceita(DB.caldas[+b.dataset.load]));
  $$('#listaCaldas [data-delc]').forEach(b => b.onclick = () => { if (confirm('Excluir esta calda?')) { DB.caldas.splice(+b.dataset.delc, 1); saveDB(); renderHistorico(); } });
  $('#listaHistorico').innerHTML = DB.historico.length ? DB.historico.slice(0, 30).map((h, i) => `<div class="row"><div><b>${esc(h.itens.join(' + '))}</b><small>${esc(h.data)} · ${esc(h.resumo)}</small></div><div class="acts">${badge(h.status)}<button class="btn sm" data-re="${i}">Reabrir</button></div></div>`).join('') : '<div class="small muted">Nenhuma análise ainda.</div>';
  $$('#listaHistorico [data-re]').forEach(b => b.onclick = () => { const h = DB.historico[+b.dataset.re]; calda.itens = h.calda.itens.map(i => ({ ...i, id: uid() })); aplicarContexto(h.calda); renderItens(); analisar(); });
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
  $('#nCatalogo').textContent = `${DB.catalogo.length} produtos · ${DB.receitas.length} receitas · ${DB.talhoes.length} talhões`;
  $('#listaCatalogo').innerHTML = (DB.catalogo.slice(0, 80).map(p => `<div class="row"><div><b>${esc(p.nome)}</b><small>${esc(p.classe || '—')} · ${esc(p.fonte)} · ${p.preco ? BRL(p.preco) + '/' + esc(p.unidade) : 'sem preço'}${p.estoque ? ' · estoque ' + fmt(p.estoque) + ' ' + esc(p.unidade) : ''}</small></div><button class="btn sm" data-addcat="${esc(p.nome)}">+ calda</button></div>`).join('') || '<div class="small muted">Importe o PVGest ou o Gefaz360 para ter estoque e preços aqui.</div>') + (DB.receitas.length ? `<h3>Receitas importadas</h3>${DB.receitas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>${esc(r.cultura || '—')} · ${r.itens.length} itens · ${r.volumeHa} L/ha · ${esc(r.fonte)}</small></div><button class="btn sm" data-rec="${i}">Analisar</button></div>`).join('')}` : '');
  $$('#listaCatalogo [data-addcat]').forEach(b => b.onclick = () => { const p = DB.catalogo.find(x => x.nome === b.dataset.addcat); addItem({ id: uid(), nome: p.nome, classe: p.classe, unidade: (p.unidade || 'L') + '/ha', dose: 0, preco: p.preco, fonte: p.fonte }); navTo('calda'); });
  $$('#listaCatalogo [data-rec]').forEach(b => b.onclick = () => carregarReceita(DB.receitas[+b.dataset.rec]));
  $('#cfgPh').value = DB.config.ph ?? ''; $('#cfgDureza').value = DB.config.dureza ?? ''; $('#cfgBarra').value = DB.config.custo.barra; $('#cfgTurbo').value = DB.config.custo.turbo; $('#cfgDrone').value = DB.config.custo.drone; $('#cfgCostal').value = DB.config.custo.costal; $('#cfgAcidUltimo').checked = !!DB.config.acidificanteUltimo;
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
  ['UPL Spray / BASF Agro App / Aegro', 'Calibração, pré-mistura e planejamento; Aegro liga custo por talhão.', 'Custo/ha com custo operacional por equipamento; talhões e preços vindos do PVGest/Gefaz360.', 'https://aegro.com.br/blog/mistura-defensivos-tanque-guia/']
];
function renderReferencias() {
  $('#benchmarks').innerHTML = BENCHMARKS.map(b => `<div class="row"><div><b>${esc(b[0])}</b><small><b>O que faz:</b> ${esc(b[1])}</small><small><b>O que trouxemos:</b> ${esc(b[2])}</small></div><a class="btn sm ghost" href="${b[3]}" target="_blank" rel="noopener">abrir</a></div>`).join('');
  $('#fontes').innerHTML = KB.fontes.map(f => `<div class="row"><div><small>${esc(f.titulo)}</small></div><a class="btn sm ghost" href="${f.url}" target="_blank" rel="noopener">abrir</a></div>`).join('');
  const nA = Object.keys(KB.ativos).length;
  $('#kbResumo').innerHTML = `${nA} ingredientes ativos com classe, grupo químico, código FRAC/IRAC/HRAC, faixa de pH e comportamento · ${KB.regrasPares.length} regras de incompatibilidade entre pares (cada uma com confiança e fonte) · regras de conjunto (número de produtos, formulações, volume, água, MoA, biológicos) · ${KB.comerciais.length} produtos comerciais mapeados · protocolo MIT 5.0 da fazenda (pH alvo por grupo, condicionadores em estoque, equipamentos).`;
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
  loadDB();
  $('#fCultura').innerHTML = KB.culturas.map(c => `<option ${c === DB.config.cultura ? 'selected' : ''}>${c}</option>`).join('');
  $('#fEquip').innerHTML = Object.entries(KB.equipamentos).map(([k, e]) => `<option value="${k}" ${k === DB.config.equipamento ? 'selected' : ''}>${e.nome}</option>`).join('');
  $('#fVolume').value = DB.config.volumeHa; if (DB.config.ph != null) $('#fPh').value = DB.config.ph; if (DB.config.dureza != null) $('#fDureza').value = DB.config.dureza;
  $('#chipsRapidos').innerHTML = KB.comerciais.filter(c => c.tags && c.tags.includes('estoque-fazenda')).map(c => `<span class="chip" data-chip="${esc(c.nome)}">+ ${esc(c.nome)}</span>`).join('');
  $$('[data-chip]').forEach(ch => ch.onclick = () => { const c = KB.comerciais.find(x => x.nome === ch.dataset.chip); addItem({ id: uid(), nome: c.nome, classe: c.classe, formulacao: c.formulacao, unidade: 'mL/100L', dose: 0, fonte: 'fazenda' }); });
  $('#busca').oninput = e => renderBusca(e.target.value);
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) $('#buscaRes').classList.add('hidden'); });
  $('#fCultura').onchange = () => { atualizarAlvos(); renderItens(); DB.config.cultura = $('#fCultura').value; saveDB(); };
  $('#fEquip').onchange = () => { const k = $('#fEquip').value; $('#droneAviso').classList.toggle('hidden', k !== 'drone'); const eq = KB.equipamentos[k]; if (eq && !$('#fVolume').dataset.touched) $('#fVolume').value = Math.round((eq.volume[0] + eq.volume[1]) / 2); DB.config.equipamento = k; saveDB(); };
  $('#fVolume').oninput = () => { $('#fVolume').dataset.touched = 1; };
  $('#btnManual').onclick = () => formManual();
  $('#btnReceita').onclick = () => { if (!DB.receitas.length && !DB.caldas.length) return toast('Nenhuma receita importada ou calda salva — veja Integração', 'err'); modal(`<h2>Carregar</h2><div class="lista">${DB.caldas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>calda salva · ${r.itens.length} itens</small></div><button class="btn sm" data-c="${i}">Carregar</button></div>`).join('')}${DB.receitas.map((r, i) => `<div class="row"><div><b>${esc(r.nome)}</b><small>${esc(r.fonte)} · ${esc(r.cultura || '')} · ${r.itens.length} itens</small></div><button class="btn sm" data-r="${i}">Carregar</button></div>`).join('')}</div><div class="row-btns"><button class="btn ghost" id="mCancel">Fechar</button></div>`); $('#mCancel').onclick = closeModal; $$('#modal [data-c]').forEach(b => b.onclick = () => { carregarReceita(DB.caldas[+b.dataset.c]); closeModal(); }); $$('#modal [data-r]').forEach(b => b.onclick = () => { carregarReceita(DB.receitas[+b.dataset.r]); closeModal(); }); };
  $('#btnAnalisar').onclick = () => analisar();
  $('#btnSalvarCalda').onclick = salvarCalda;
  $('#btnLimpar').onclick = () => { if (!calda.itens.length || confirm('Limpar a calda atual?')) { calda = { itens: [], obs: '' }; $('#fObs').value = ''; $('#fAlvo').value = ''; renderItens(); } };
  $$('#nav button').forEach(b => b.onclick = () => navTo(b.dataset.tab));
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  // integração
  $('#impPV').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importPVGest(JSON.parse(await f.text())); } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } e.target.value = ''; };
  $('#impG360').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importGefaz360(JSON.parse(await f.text())); } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } e.target.value = ''; };
  $('#btnImpCola').onclick = () => { try { importarTexto($('#impCola').value); $('#impCola').value = ''; } catch (err) { toast('Falha: ' + err.message, 'err'); $('#impMsg').textContent = 'Falha: ' + err.message; } };
  $('#btnExpCatalogo').onclick = () => download(`gefaz-calda-export-${hoje()}.json`, JSON.stringify(exportPVGestFormat(DB.caldas.concat(DB.receitas)), null, 1));
  $('#btnLimparCatalogo').onclick = () => { if (confirm('Limpar catálogo, receitas e talhões importados?')) { DB.catalogo = []; DB.receitas = []; DB.talhoes = []; saveDB(); renderIntegracao(); } };
  $('#btnCfg').onclick = () => { DB.config.ph = $('#cfgPh').value === '' ? null : num($('#cfgPh').value); DB.config.dureza = $('#cfgDureza').value === '' ? null : num($('#cfgDureza').value); DB.config.custo = { ...DB.config.custo, barra: num($('#cfgBarra').value), turbo: num($('#cfgTurbo').value), drone: num($('#cfgDrone').value), costal: num($('#cfgCostal').value) }; DB.config.acidificanteUltimo = $('#cfgAcidUltimo').checked; saveDB(); toast('Configuração salva'); };
  $('#btnBackup').onclick = () => download(`gefaz-calda-backup-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda-backup', ...DB }, null, 1));
  $('#impBackup').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.app !== 'gefaz-calda-backup') throw new Error('não é um backup do Gefaz Calda'); if (confirm('Substituir todos os dados do Gefaz Calda por este backup?')) { delete d.app; DB = d; loadDBFrom(d); saveDB(); renderIntegracao(); renderHistorico(); toast('Backup restaurado'); } } catch (err) { toast('Falha: ' + err.message, 'err'); } e.target.value = ''; };
  window.addEventListener('online', () => { $('#netStatus').textContent = 'online'; }); window.addEventListener('offline', () => { $('#netStatus').textContent = 'offline'; });
  $('#netStatus').textContent = navigator.onLine ? 'online' : 'offline';
  renderItens(); renderHistorico(); renderIntegracao(); renderReferencias();
  carregarAgrofit().then(() => { renderItens(); });
  const q = new URLSearchParams(location.search);
  const mix = q.get('mix') ? decodeMix(q.get('mix')) : null;
  if (mix && aplicarMix(mix, true)) { navTo('resultado'); history.replaceState(null, '', location.pathname); }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
function loadDBFrom(d) { DB = d; const base = defaultDB(); DB.version = DB.version || 1; DB.config = { ...base.config, ...(DB.config || {}) }; ['catalogo', 'receitas', 'talhoes', 'caldas', 'historico', 'jarTests'].forEach(k => { if (!Array.isArray(DB[k])) DB[k] = []; }); }
window.GefazCaldaApp = { analisar, addItem, aplicarMix, get calda() { return calda; }, get resultado() { return resultado; }, get DB() { return DB; } };
document.addEventListener('DOMContentLoaded', init);
