'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — metas-ui.js
   Aba Metas: tarefas programadas (receita × talhões × data), previsto × realizado,
   meta de conclusão e agenda (.ics). O realizado vem das aplicações registradas
   (que também baixam o estoque) — ver estoque-ui.js.
   ═══════════════════════════════════════════════════════════════════════════ */

let tkSel = [];            // talhões marcados no formulário da tarefa
let tkAreaManual = false;  // a área foi digitada à mão (não some mais com os talhões)
const pad2m = n => String(n).padStart(2, '0');
function mesAtual() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), ult = new Date(y, m + 1, 0).getDate();
  return { de: `${y}-${pad2m(m + 1)}-01`, ate: `${y}-${pad2m(m + 1)}-${pad2m(ult)}` };
}
const pctTxt = v => Math.round((v || 0) * 100) + ' %';

/* ───────── receitas que podem virar tarefa ───────── */
function alvosTexto(o) { return o && typeof o.alvos === 'object' ? textoAlvos(o.alvos, true).join(', ') : (o && o.alvo) || ''; }
function receitasParaTarefa() {
  const l = [];
  if (calda.itens.length) {
    const c = caldaComoReceita();
    l.push({ chave: 'atual', rotulo: '🧪 Calda atual (aba Calda) — ' + c.nome, nome: c.nome, itens: calda.itens.map(i => ({ ...i })), cultura: c.cultura, equipamento: c.equipamento, volumeHa: c.volumeHa, alvos: textoAlvos(alvosSel, true).join(', ') });
  }
  DB.caldas.forEach((c, i) => l.push({ chave: 'c' + i, rotulo: '💾 ' + c.nome, nome: c.nome, itens: (c.itens || []).map(x => ({ ...x })), cultura: c.cultura, equipamento: c.equipamento, volumeHa: c.volumeHa, alvos: alvosTexto(c) }));
  DB.receitas.forEach((r, i) => l.push({ chave: 'r' + i, rotulo: '📋 ' + r.nome + (r.fonte ? ' (' + r.fonte + ')' : ''), nome: r.nome, itens: (r.itens || []).map(x => ({ ...x })), cultura: r.cultura, equipamento: r.equipamento, volumeHa: r.volumeHa, alvos: alvosTexto(r) }));
  return l;
}
const receitaEscolhida = () => receitasParaTarefa().find(r => r.chave === $('#tkReceita').value) || null;

/* ───────── formulário da tarefa ───────── */
function renderFormTarefa() {
  const sel = $('#tkReceita'), atual = sel.value, lista = receitasParaTarefa();
  sel.innerHTML = '<option value="">— escolha a receita —</option>' + lista.map(r => `<option value="${esc(r.chave)}">${esc(r.rotulo)}</option>`).join('');
  if (lista.some(r => r.chave === atual)) sel.value = atual;
  $('#tkTalhoes').innerHTML = DB.talhoes.length ? DB.talhoes.map((t, i) => {
    const on = tkSel.some(n => norm(n) === norm(t.nome));
    return `<button type="button" class="chip talhao-chip${on ? ' sel' : ''}" aria-pressed="${on}" data-tki="${i}">${on ? '✔ ' : ''}${esc(t.nome)}${t.area ? ' · ' + fmt(t.area, 1) + ' ha' : ''}</button>`;
  }).join('') : '<span class="small muted">Cadastre talhões na aba Calda (＋ Novo talhão) para programar por talhão — ou informe só a área abaixo.</span>';
  $('#tkTalhoes').querySelectorAll('[data-tki]').forEach(b => b.onclick = () => {
    const n = DB.talhoes[+b.dataset.tki].nome, tem = tkSel.some(x => norm(x) === norm(n));
    tkSel = tem ? tkSel.filter(x => norm(x) !== norm(n)) : [...tkSel, n];
    if (!tkAreaManual) $('#tkArea').value = arred4(tkSel.reduce((s, x) => s + ((achaTalhao(x) || {}).area || 0), 0)) || '';
    renderFormTarefa();
  });
  previewTarefa();
}
function previewTarefa() {
  const box = $('#tkPreview'), r = receitaEscolhida();
  if (!r) { box.innerHTML = ''; return; }
  const area = num($('#tkArea').value), vol = num($('#tkVol').value);
  const b = ES.baixaDaReceita({ itens: r.itens, volumeHa: vol, ha: area });
  box.innerHTML = `<div class="small">Previsto: <b>${fmt(area, 2)} ha</b> · <b>${fmt(b.litros, 0)} L</b> de calda (${fmt(vol, 0)} L/ha)</div>` + (area > 0 && vol > 0 ? `<div class="tabela-rolavel"><table class="tb"><thead><tr><th>Produto</th><th class="num">Vai usar</th><th class="num">Em estoque</th><th></th></tr></thead><tbody>${b.linhas.map(l => {
    const c = ES.casarProduto(l.nome, DB.estoque, DB.mapEstoque), e = c.item && c.item.unidade === l.base ? c.item : null;
    return `<tr><td>${esc(l.nome)}</td><td class="num">${fmtQtd(l.qtd, l.base)}</td><td class="num">${e ? fmtQtd(e.qtd, e.unidade) : '<span class="muted">—</span>'}</td><td>${!e ? '<span class="tag">sem item</span>' : e.qtd + 1e-9 >= l.qtd ? '<span class="tag reg">ok</span>' : `<span class="tag noreg">falta ${fmtQtd(l.qtd - e.qtd, l.base)}</span>`}</td></tr>`;
  }).join('')}</tbody></table></div>` : '');
}
function adicionarTarefa() {
  const r = receitaEscolhida(); if (!r) return toast('Escolha a receita', 'err');
  const area = num($('#tkArea').value), vol = num($('#tkVol').value), data = $('#tkData').value;
  if (!(area > 0)) return toast('Informe a área prevista (ou marque talhões que tenham área)', 'err');
  if (!(vol > 0)) return toast('Informe o volume de calda por hectare', 'err');
  if (!data) return toast('Informe a data prevista', 'err');
  const nomes = tkSel.slice(), titulo = $('#tkTitulo').value.trim() || `${r.nome}${nomes.length ? ' — ' + nomes.join(', ') : ''}`;
  DB.tarefas.push({ id: uid(), titulo, receitaNome: r.nome, itens: r.itens, cultura: r.cultura, equipamento: r.equipamento, volumeHa: vol, alvos: r.alvos, talhoes: nomes,
    haPrev: area, litrosPrev: Math.round(area * vol), dataPrev: data, chave: chaveDeItens(r.cultura, vol, r.itens), criadaEm: new Date().toISOString(), concluida: false, status: 'aberta' });
  saveDB(); tkSel = []; tkAreaManual = false; $('#tkTitulo').value = ''; $('#tkArea').value = ''; $('#tkReceita').value = '';
  renderFormTarefa(); renderMetas(); renderNecessidade(); toast('Tarefa programada');
}

/* ───────── painel da meta e lista de tarefas ───────── */
const SIT = { atrasada: ['atrasada', 'noreg'], parcial: ['em andamento', 'amar'], aberta: ['a fazer', ''], concluida: ['concluída', 'reg'], cancelada: ['cancelada', ''] };
function barra(pct, meta) {
  return `<div class="barra"><i style="width:${Math.min(100, Math.max(0, pct * 100)).toFixed(1)}%"></i>${meta != null ? `<span class="marca" style="left:${Math.min(100, meta)}%" title="Meta ${meta} %"></span>` : ''}</div>`;
}
function painelMeta(p) {
  if (!p.n) return '<div class="small muted">Nenhuma tarefa programada neste período. Programe abaixo: cada tarefa vira previsto, e cada aplicação registrada vira realizado.</div>';
  const estado = p.atingiuMeta ? '<span class="tag reg">meta atingida</span>' : (p.atrasadas || !p.noRitmo) ? '<span class="tag noreg">abaixo do esperado</span>' : '<span class="tag amar">no ritmo</span>';
  return `<div class="meta-topo"><b class="grande">${pctTxt(p.pctTarefas)}</b> <span>das tarefas concluídas (${p.concluidas} de ${p.n}) · meta ${p.metaPct} % ${estado}</span></div>
    ${barra(p.pctTarefas, p.metaPct)}
    <div class="small muted">${p.atingiuMeta ? 'A meta do período foi cumprida.' : `Faltam <b>${p.faltamParaMeta}</b> tarefa(s) concluída(s) para bater a meta.`} Já deviam estar prontas até hoje: ${p.esperadas} · prontas: ${p.concluidas}.</div>
    <div class="kpis">
      <div class="kpi"><b>${fmt(p.haReal, 1)} / ${fmt(p.haPrev, 1)}</b><small>hectares realizados / previstos (${pctTxt(p.pctHa)})</small></div>
      <div class="kpi"><b>${fmt(p.litrosReal, 0)} / ${fmt(p.litrosPrev, 0)}</b><small>litros de calda realizados / previstos (${pctTxt(p.pctLitros)})</small></div>
      <div class="kpi"><b class="${p.atrasadas ? 'danger-txt' : ''}">${p.atrasadas}</b><small>atrasada(s)</small></div>
      <div class="kpi"><b>${p.parciais}</b><small>em andamento</small></div>
    </div>
    <div class="small">Hectares ${barra(p.pctHa)}Litros de calda ${barra(Math.min(1, p.pctLitros))}</div>`;
}
function renderMetas() {
  if (!$('#tab-metas')) return;
  const cfg = DB.config.meta, mes = mesAtual();
  if (!cfg.de) cfg.de = mes.de; if (!cfg.ate) cfg.ate = mes.ate;
  $('#metaDe').value = cfg.de; $('#metaAte').value = cfg.ate; $('#metaPct').value = cfg.pct;
  const hj = hoje(), p = ES.progresso({ tarefas: DB.tarefas, realizacoes: DB.realizacoes, de: cfg.de, ate: cfg.ate, hoje: hj, metaPct: cfg.pct });
  $('#metaHint').textContent = `${dataBR(cfg.de)} a ${dataBR(cfg.ate)}`;
  $('#metaPainel').innerHTML = painelMeta(p);
  // lista: tudo o que não está cancelado/concluído fora do período também aparece (nada some por causa do filtro de datas)
  const todos = ES.progresso({ tarefas: DB.tarefas, realizacoes: DB.realizacoes, hoje: hj, metaPct: cfg.pct });
  const mostrarTudo = $('#tkMostrarTudo').checked, noPeriodo = new Set(p.tarefas.map(t => t.id));
  const ordem = { atrasada: 0, parcial: 1, aberta: 2, concluida: 3, cancelada: 4 };
  const lista = DB.tarefas.map(t => ({ t, r: todos.porTarefa[t.id] || { ha: 0, litros: 0, pct: 0, situacao: t.status === 'cancelada' ? 'cancelada' : 'aberta' } }))
    .filter(x => mostrarTudo || (x.r.situacao !== 'cancelada' && (x.r.situacao !== 'concluida' || noPeriodo.has(x.t.id))))
    .sort((a, b) => ordem[a.r.situacao] - ordem[b.r.situacao] || String(a.t.dataPrev).localeCompare(String(b.t.dataPrev)));
  $('#tkLista').innerHTML = lista.length ? lista.map(({ t, r }) => {
    const [rot, cls] = SIT[r.situacao];
    const acoes = r.situacao === 'cancelada' ? `<button type="button" class="btn sm ghost" data-tka="reativar" data-id="${esc(t.id)}">Reativar</button><button type="button" class="btn sm ghost danger" data-tka="excluir" data-id="${esc(t.id)}">Excluir</button>`
      : r.situacao === 'concluida' ? `${t.concluida ? `<button type="button" class="btn sm ghost" data-tka="reabrir" data-id="${esc(t.id)}">Reabrir</button>` : ''}<button type="button" class="btn sm ghost danger" data-tka="excluir" data-id="${esc(t.id)}">Excluir</button>`
      : `<button type="button" class="btn sm primary" data-tka="realizar" data-id="${esc(t.id)}">✅ Registrar realizado</button><button type="button" class="btn sm ghost" data-tka="concluir" data-id="${esc(t.id)}">Concluir</button><button type="button" class="btn sm ghost" data-tka="data" data-id="${esc(t.id)}">📅 Reagendar</button><button type="button" class="btn sm ghost danger" data-tka="cancelar" data-id="${esc(t.id)}">✕ Cancelar</button>`;
    return `<div class="tarefa ${r.situacao}"><div class="tarefa-topo"><b>${esc(t.titulo)}</b><span class="tag ${cls}">${rot}</span></div>
      <small>${dataBR(t.dataPrev)}${t.talhoes && t.talhoes.length ? ' · ' + esc(t.talhoes.join(', ')) : ''}${noPeriodo.has(t.id) ? '' : ' · fora do período da meta'}</small>
      ${barra(r.pct)}<small>Previsto <b>${fmt(t.haPrev, 1)} ha · ${fmt(t.litrosPrev, 0)} L</b> — Realizado <b>${fmt(r.ha, 1)} ha · ${fmt(r.litros, 0)} L</b> (${pctTxt(r.pct)})</small>
      <div class="acts">${acoes}</div></div>`;
  }).join('') : '<div class="small muted">Nenhuma tarefa ainda.</div>';
  $('#tkLista').querySelectorAll('[data-tka]').forEach(b => b.onclick = () => acaoTarefa(b.dataset.tka, b.dataset.id));
  const reais = DB.realizacoes.slice(0, 30);
  $('#realLista').innerHTML = reais.length ? reais.map(r => {
    const t = r.tarefaId ? DB.tarefas.find(x => x.id === r.tarefaId) : null;
    return `<div class="row"><div><b>${dataBR(r.data)} · ${esc(r.receitaNome || 'aplicação')}</b><small>${fmt(r.litros, 0)} L de calda · ${fmt(r.ha, 2)} ha${r.talhoes && r.talhoes.length ? ' · ' + esc(r.talhoes.map(x => x.nome).join(', ')) : ''}${t ? ' · tarefa: ' + esc(t.titulo) : ''} · ${r.itens.filter(l => l.movId).length} produto(s) baixado(s)</small></div>
      <div class="acts">${r.estornada ? '<span class="tag">desfeita</span>' : `<button type="button" class="btn sm ghost" data-rundo="${esc(r.id)}">↩ Desfazer</button>`}</div></div>`;
  }).join('') : '<div class="small muted">Nenhuma aplicação registrada. Use “✅ Registrar realizado” numa tarefa ou o botão da aba Calda.</div>';
  $('#realLista').querySelectorAll('[data-rundo]').forEach(b => b.onclick = () => estornarRealizacao(b.dataset.rundo));
}
function acaoTarefa(acao, id) {
  const t = DB.tarefas.find(x => x.id === id); if (!t) return;
  if (acao === 'realizar') {
    const p = progressoGeral(), r = p.porTarefa[t.id] || { ha: 0, litros: 0 };
    abrirBaixa({ itens: t.itens.map(i => ({ ...i })), volumeHa: t.volumeHa, cultura: t.cultura, equipamento: t.equipamento, talhoes: t.talhoes || [], tarefaId: t.id, receitaNome: t.titulo,
      litros: Math.max(0, t.litrosPrev - r.litros), data: hoje(), alvos: t.alvos || '', rast: {} });
    return;
  }
  if (acao === 'concluir') { if (!confirm(`Marcar “${t.titulo}” como concluída, mesmo sem ter registrado tudo o que estava previsto?`)) return; t.concluida = true; }
  else if (acao === 'reabrir') t.concluida = false;
  else if (acao === 'cancelar') { if (!confirm(`Cancelar “${t.titulo}”? Ela deixa de contar na meta.`)) return; t.status = 'cancelada'; }
  else if (acao === 'reativar') t.status = 'aberta';
  else if (acao === 'data') {
    const v = prompt('Nova data prevista (AAAA-MM-DD)', t.dataPrev); if (v === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return toast('Use o formato AAAA-MM-DD, por exemplo 2026-09-25', 'err');
    t.dataPrev = v.trim();
  } else if (acao === 'excluir') {
    if (!confirm(`Excluir “${t.titulo}”? As aplicações já registradas continuam no histórico e no estoque.`)) return;
    DB.tarefas = DB.tarefas.filter(x => x.id !== id); DB.realizacoes.forEach(r => { if (r.tarefaId === id) r.tarefaId = null; });
  }
  saveDB(); renderMetas(); renderNecessidade();
}

/* ───────── agenda (.ics): tarefas, próxima aplicação, reentrada e colheita ───────── */
function eventosDaAgenda() {
  const hj = hoje(), ev = [], p = progressoGeral();
  p.tarefas.forEach(t => {
    if (p.porTarefa[t.id].situacao === 'concluida' || t.concluida || !t.dataPrev || t.dataPrev < hj) return;
    ev.push({ uid: 'tarefa-' + t.id, dia: t.dataPrev, titulo: `Aplicar: ${t.titulo}`, descricao: `${fmt(t.haPrev, 1)} ha · ${fmt(t.litrosPrev, 0)} L de calda · ${t.itens.map(i => i.nome).join(' + ')}` });
  });
  DB.talhoes.forEach(t => {
    const maior = (a, b) => (!a || (b && b > a) ? b : a);
    let colh = null, prox = null, ree = null;
    (t.aplicacoes || []).filter(a => a.aplicada).forEach(a => { const l = liberacoesDoRegistro(a); colh = maior(colh, l.colheita); prox = maior(prox, l.proxima); ree = maior(ree, l.reentrada && l.reentrada.slice(0, 10)); });
    if (ree && ree >= hj) ev.push({ uid: `ree-${t.nome}-${ree}`, dia: ree, titulo: `Reentrada liberada — ${t.nome}`, descricao: 'Reentrada na área tratada, conforme a bula/receituário.' });
    if (prox && prox >= hj) ev.push({ uid: `prox-${t.nome}-${prox}`, dia: prox, titulo: `Próxima aplicação permitida — ${t.nome}`, descricao: 'Intervalo mínimo entre aplicações informado por produto.' });
    if (colh && colh >= hj) ev.push({ uid: `colh-${t.nome}-${colh}`, dia: colh, titulo: `Colheita liberada — ${t.nome}`, descricao: 'Carência dos produtos aplicados cumprida (bula/receituário).' });
  });
  return ev;
}
function baixarAgenda(eventos, nomeArq) {
  if (!eventos.length) return toast('Nada a agendar: sem tarefas futuras nem datas liberadas pela frente', 'err');
  download(nomeArq, ES.icsAgenda(eventos, { nome: `${DB.config.fazenda || 'Fazenda'} — Gefaz Calda` }), 'text/calendar;charset=utf-8');
  toast(`Agenda exportada: ${eventos.length} evento(s) — abra o arquivo .ics no calendário do celular ou do computador`);
}
function exportarAgendaDoLaudo() {
  const r = resultado; if (!r) return;
  const nomes = splitTalhoes(r.contexto.rastreio.talhao).join(', '), suf = nomes ? ' — ' + nomes : '', ev = [];
  const c = r.reentrada, p = r.proximaAplicacao, h = r.colheitaLiberada;
  if (c && c.liberadoEm) ev.push({ dia: c.liberadoEm.slice(0, 10), titulo: 'Reentrada liberada' + suf, descricao: `Reentrada a partir de ${dataHoraBR(c.liberadoEm)} (limitante: ${c.limitante}).` });
  if (p && p.liberadoEm) ev.push({ dia: p.liberadoEm, titulo: 'Próxima aplicação permitida' + suf, descricao: `Limitante: ${p.limitante}.` });
  if (h && h.liberadoEm) ev.push({ dia: h.liberadoEm, titulo: 'Colheita liberada' + suf, descricao: `Limitante: ${h.limitante}.` });
  ev.forEach((e, i) => { e.uid = `laudo-${r.rastreio ? r.rastreio.codigo : 'x'}-${i}`; });
  baixarAgenda(ev, `agenda-laudo-${hoje()}.ics`);
}

function initMetasUI() {
  const salvarCfg = () => { DB.config.meta = { pct: Math.min(100, Math.max(1, Math.round(num($('#metaPct').value)) || 100)), de: $('#metaDe').value, ate: $('#metaAte').value }; saveDB(); renderMetas(); };
  ['#metaDe', '#metaAte', '#metaPct'].forEach(s => { $(s).onchange = salvarCfg; });
  $('#tkMostrarTudo').onchange = renderMetas;
  $('#tkData').value = hoje();
  $('#tkReceita').onchange = () => { const r = receitaEscolhida(); if (r && r.volumeHa) $('#tkVol').value = r.volumeHa; previewTarefa(); };
  $('#tkArea').oninput = () => { tkAreaManual = $('#tkArea').value !== ''; previewTarefa(); };
  $('#tkVol').oninput = previewTarefa;
  $('#btnTkAdd').onclick = adicionarTarefa;
  $('#btnAgendaMetas').onclick = () => baixarAgenda(eventosDaAgenda(), `agenda-gefaz-calda-${hoje()}.ics`);
  $('#nav [data-tab="metas"]').addEventListener('click', () => { renderFormTarefa(); renderMetas(); });
  $('#nav [data-tab="estoque"]').addEventListener('click', () => { renderEstoque(); renderNecessidade(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderMetas(); });
  renderFormTarefa(); renderMetas();
}
