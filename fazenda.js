'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — fazenda.js
   Rotina da fazenda em cima do motor: avisos (backup, nova versão), ficha de
   produtos, caderno de campo, estoque, baixa por aplicação e metas.
   Carrega depois do app.js e usa o que ele já tem (DB, $, esc, fmt, toast…).
   ═══════════════════════════════════════════════════════════════════════════ */

const ES = window.GCEstoque; // lógica pura (estoque.js); os outros arquivos da fazenda usam este atalho

/* ───────── avisos no topo da tela ───────── */
function mostrarAviso(id, html, acoes) {
  const box = $('#avisos'); if (!box) return;
  let el = box.querySelector(`[data-aviso="${id}"]`);
  if (!el) { el = document.createElement('div'); el.className = 'aviso'; el.dataset.aviso = id; box.appendChild(el); }
  el.innerHTML = `<span>${html}</span><span class="acts">${(acoes || []).map((a, i) => `<button type="button" class="btn sm${a.primaria ? ' primary' : ' ghost'}" data-i="${i}">${esc(a.txt)}</button>`).join('')}</span>`;
  el.querySelectorAll('button').forEach(b => b.onclick = () => { const a = acoes[+b.dataset.i]; if (a.fecha !== false) tirarAviso(id); a.fn(); });
}
function tirarAviso(id) { const el = document.querySelector(`#avisos [data-aviso="${id}"]`); if (el) el.remove(); }

/* ───────── nova versão do app ───────── */
function vigiarNovaVersao() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const tinhaControle = !!navigator.serviceWorker.controller; // na primeira instalação não há o que atualizar
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (tinhaControle) mostrarAviso('versao', '🔄 <b>Nova versão do app instalada.</b> Atualize para usar as novidades.', [{ txt: 'Atualizar agora', primaria: true, fn: () => location.reload() }, { txt: 'Depois', fn: () => { } }]);
  });
  const procurar = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') procurar(); });
  setInterval(procurar, 60 * 60 * 1000);
}

/* ───────── backup: o histórico agora vale dinheiro e mora só no navegador ───────── */
function temDadosAProteger() {
  return DB.talhoes.some(t => (t.aplicacoes || []).length) || DB.estoque.length || DB.tarefas.length || DB.caldas.length || DB.regulagens.length
    || DB.pontasLivres.length || DB.jarTests.length || ['intervalos', 'carencias', 'maxAplic', 'reentradas'].some(k => Object.keys(DB[k]).length);
}
function diasSemBackup() {
  const u = DB.config.backup.ultimo; if (!u) return null;
  return Math.floor((Date.now() - Date.parse(u)) / 864e5);
}
function exportarBackup() {
  DB.config.backup.ultimo = new Date().toISOString(); DB.config.backup.adiadoAte = null; saveDB();
  download(`gefaz-calda-backup-${hoje()}.json`, JSON.stringify({ app: 'gefaz-calda-backup', ...DB }, null, 1));
  tirarAviso('backup'); atualizarStatusBackup();
  toast('Backup exportado — guarde o arquivo fora do celular/computador (Drive, e-mail)');
}
function verificarBackup() {
  const cfg = DB.config.backup, dias = diasSemBackup();
  atualizarStatusBackup();
  if (!(cfg.lembrarDias > 0) || !temDadosAProteger()) return tirarAviso('backup');
  if (cfg.adiadoAte && Date.now() < Date.parse(cfg.adiadoAte)) return;
  if (dias !== null && dias < cfg.lembrarDias) return tirarAviso('backup');
  mostrarAviso('backup', `💾 <b>${dias === null ? 'Você ainda não fez backup' : `Faz ${dias} dia(s) sem backup`}.</b> Talhões, histórico, estoque e fichas de produto ficam só neste navegador.`,
    [{ txt: 'Fazer backup', primaria: true, fn: exportarBackup }, { txt: 'Depois', fn: () => { DB.config.backup.adiadoAte = new Date(Date.now() + 864e5).toISOString(); saveDB(); } }]);
}
function atualizarStatusBackup() {
  const el = $('#backupStatus'); if (!el) return;
  const d = diasSemBackup();
  el.textContent = d === null ? 'nunca exportado' : d === 0 ? 'exportado hoje' : `último há ${d} dia(s)`;
  el.className = 'hint' + (d === null || d >= (DB.config.backup.lembrarDias || 9999) ? ' danger-txt' : '');
}
async function pedirArmazenamentoPersistente() {
  const el = $('#cfgPersist'); let txt = 'não suportado';
  try {
    if (navigator.storage && navigator.storage.persist) {
      const ja = await navigator.storage.persisted();
      const ok = ja || await navigator.storage.persist();
      txt = ok ? 'protegido contra limpeza automática' : 'o navegador pode apagar se faltar espaço — faça backup';
    }
  } catch { txt = 'indisponível'; }
  if (el) el.value = txt;
}

/* ───────── arquivos de texto (CSV do Excel costuma vir em Windows-1252, não em UTF-8) ───────── */
async function lerTextoArquivo(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t;
}

/* ───────── ficha de produtos: intervalo, carência, máximo de aplicações e reentrada ───────── */
const nomeDaFicha = k => DB.fichaNomes[k] || k;
function produtosDaFicha() {
  const ks = new Set(Object.keys(DB.fichaNomes)); Object.values(FICHA_CAMPOS).forEach(m => Object.keys(DB[m]).forEach(k => ks.add(k)));
  return [...ks].map(k => ({ chave: k, nome: nomeDaFicha(k), intervalo: DB.intervalos[k], carencia: DB.carencias[k], maxAplic: DB.maxAplic[k], reentrada: DB.reentradas[k] }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
/* nomes de produto que o app já viu (ficha, estoque, catálogo, receitas, calda atual): a planilha-modelo já vem com eles */
function nomesConhecidos() {
  const m = new Map(), add = n => { const t = String(n || '').trim(); if (t && !m.has(norm(t))) m.set(norm(t), t); };
  Object.values(DB.fichaNomes).forEach(add);
  DB.estoque.forEach(e => add(e.nome));
  DB.catalogo.forEach(p => add(p.nome));
  [...DB.caldas, ...DB.receitas].forEach(c => (c.itens || []).forEach(i => add(i.nome)));
  calda.itens.forEach(i => add(i.nome));
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function planilhaDaFicha() {
  const linhas = nomesConhecidos().map(nome => { const k = norm(nome); return { nome, intervalo: DB.intervalos[k], carencia: DB.carencias[k], maxAplic: DB.maxAplic[k], reentrada: DB.reentradas[k] }; });
  return GCEstoque.fichaParaCSV(linhas);
}
function aplicarFichaNaCalda() {
  calda.itens.forEach(it => Object.entries(FICHA_CAMPOS).forEach(([campo, mapa]) => {
    const v = DB[mapa][norm(it.nome)];
    if (v !== undefined) it[campo] = v;
  }));
  renderItens();
}
function importarFicha(texto) {
  const f = GCEstoque.fichaDeTabela(GCEstoque.parseCSV(texto));
  const msg = $('#fichaMsg');
  if (f.erros.length && !f.itens.length) { msg.innerHTML = `<span class="danger-txt">${esc(f.erros[0])}</span>`; return; }
  let n = 0;
  f.itens.forEach(it => { Object.keys(FICHA_CAMPOS).forEach(c => { if (it[c] !== undefined) { salvarFichaProduto(it.nome, c, it[c]); n++; } }); });
  aplicarFichaNaCalda(); renderFicha();
  msg.innerHTML = `${f.itens.length} produto(s) lidos, ${n} valor(es) gravados.` + (f.erros.length ? ` <span class="danger-txt">${f.erros.length} linha(s) com problema: ${esc(f.erros.slice(0, 3).join(' · '))}${f.erros.length > 3 ? '…' : ''}</span>` : '');
  toast('Ficha de produtos importada');
}
function renderFicha() {
  const tb = $('#fichaTabela'); if (!tb) return;
  const filtro = norm($('#fichaFiltro').value || ''), lista = produtosDaFicha().filter(p => !filtro || norm(p.nome).includes(filtro));
  $('#fichaResumo').textContent = `${produtosDaFicha().length} produto(s) com ficha`;
  const inp = (p, c, ph) => `<td class="num"><input type="number" min="0" step="1" data-fk="${esc(p.chave)}" data-fc="${c}" value="${p[c] === undefined ? '' : p[c]}" placeholder="${ph}" aria-label="${esc(p.nome)} — ${c}"></td>`;
  tb.innerHTML = lista.length
    ? `<thead><tr><th>Produto</th><th class="num">Intervalo (d)</th><th class="num">Carência (d)</th><th class="num">Máx./ciclo</th><th class="num">Reentrada (h)</th><th></th></tr></thead><tbody>${lista.slice(0, 300).map(p => `<tr><td>${esc(p.nome)}</td>${inp(p, 'intervalo', '—')}${inp(p, 'carencia', '—')}${inp(p, 'maxAplic', '—')}${inp(p, 'reentrada', '—')}<td><button type="button" class="btn sm ghost danger" data-fdel="${esc(p.chave)}" aria-label="Remover ${esc(p.nome)} da ficha">✕</button></td></tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="muted">Nenhum produto com ficha ainda. Baixe a planilha, preencha e importe — ou preencha direto na calda.</td></tr></tbody>';
  tb.querySelectorAll('[data-fk]').forEach(i => i.onchange = () => { salvarFichaProduto(nomeDaFicha(i.dataset.fk), i.dataset.fc, i.value); aplicarFichaNaCalda(); $('#fichaResumo').textContent = `${produtosDaFicha().length} produto(s) com ficha`; });
  tb.querySelectorAll('[data-fdel]').forEach(b => b.onclick = () => {
    const nome = nomeDaFicha(b.dataset.fdel);
    if (!confirm(`Tirar ${nome} da ficha (apaga intervalo, carência, máximo e reentrada)?`)) return;
    Object.keys(FICHA_CAMPOS).forEach(c => salvarFichaProduto(nome, c, ''));
    renderFicha();
  });
}
function initFicha() {
  $('#btnFichaModelo').onclick = () => download(`ficha-de-produtos-${hoje()}.csv`, '﻿' + planilhaDaFicha(), 'text/csv;charset=utf-8');
  $('#impFicha').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importarFicha(await lerTextoArquivo(f)); } catch (err) { toast('Falha: ' + err.message, 'err'); } e.target.value = ''; };
  $('#fichaFiltro').oninput = renderFicha;
  const novo = () => { const n = $('#fichaNovo').value.trim(); if (!n) return; if (DB.fichaNomes[norm(n)]) return toast('Esse produto já está na ficha', 'err'); DB.fichaNomes[norm(n)] = n; saveDB(); $('#fichaNovo').value = ''; renderFicha(); };
  $('#btnFichaNovo').onclick = novo; $('#fichaNovo').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); novo(); } };
  renderFicha();
}

/* ───────── caderno de campo por talhão (auditoria, certificação, receituário) ───────── */
let cadernoNomes = null; // null = todos os talhões
function itemDePerfil(p) { return { nome: p.nome, classe: p.defensivo === false ? 'Adjuvante' : 'Outro', intervalo: p.intervalo, carencia: p.carencia, reentrada: p.reentrada }; }
/* datas que cada registro libera, calculadas dos perfis guardados no momento da aplicação */
function liberacoesDoRegistro(a) {
  const itens = (a.perfis || []).map(itemDePerfil), base = a.quando; if (!itens.length || !base) return {};
  const p = E.proximaAplicacao({ itens, base }), c = E.colheitaLiberada({ itens, base }), r = E.reentradaLiberada({ itens, base });
  return { proxima: p && p.liberadoEm, colheita: c && c.liberadoEm, reentrada: r && r.liberadoEm };
}
function linhasDoCaderno(nomes, soFeitas) {
  const alvo = (nomes && nomes.length) ? DB.talhoes.filter(t => nomes.some(n => norm(n) === norm(t.nome))) : DB.talhoes;
  const linhas = [];
  alvo.forEach(t => (t.aplicacoes || []).forEach(a => {
    if (soFeitas && !a.aplicada) return;
    linhas.push({ t, a, lib: liberacoesDoRegistro(a) });
  }));
  return linhas.sort((x, y) => String(x.a.quando).localeCompare(String(y.a.quando)) || x.t.nome.localeCompare(y.t.nome, 'pt-BR', { numeric: true }));
}
const doseTexto = i => `${fmt(i.dose, 3)} ${i.unidade || ''}${i.lote ? ' (lote ' + i.lote + ')' : ''}`.trim();
const quandoTexto = q => { const s = String(q || ''); return s.length >= 16 && s[10] === 'T' && !s.endsWith('Z') ? dataHoraBR(s) : dataBR(s.slice(0, 10)); };
function nomeEquip(k) { return (KB.equipamentos[k] || {}).nome || k || ''; }
function cadernoParaCSV(linhas) {
  const cab = ['Data', 'Talhão', 'Cultura', 'Situação', 'Área (ha)', 'Produtos (dose/ha, lote)', 'Alvos', 'Volume de calda (L/ha)', 'Litros pulverizados', 'Equipamento', 'Máquina', 'Operador', 'Receituário', 'Responsável técnico', 'CREA/CFTA', 'Reentrada liberada', 'Próxima aplicação permitida', 'Colheita liberada', 'Custo (R$)', 'Código do laudo'];
  const rows = linhas.map(({ t, a, lib }) => {
    const r = a.rast || {}, itens = a.itens || (a.produtos || []).map(n => ({ nome: n, dose: 0, unidade: '' }));
    return [quandoTexto(a.quando), t.nome, a.cultura || t.cultura || '', a.aplicada ? 'aplicada' : 'só análise', GCEstoque.numCSV(a.area), itens.map(i => i.nome + (i.dose ? ' ' + doseTexto(i) : '')).join(' + '), a.alvos || '', GCEstoque.numCSV(a.volumeHa), GCEstoque.numCSV(a.litros),
      nomeEquip(a.equip), r.maquina || '', r.operador || '', r.receituario || '', r.responsavel || '', r.crea || '', lib.reentrada ? dataHoraBR(lib.reentrada) : '', lib.proxima ? dataBR(lib.proxima) : '', lib.colheita ? dataBR(lib.colheita) : '', GCEstoque.numCSV(a.custo), a.codigo || ''];
  });
  return GCEstoque.toCSV([cab, ...rows]);
}
function renderCaderno() {
  const soFeitas = $('#cadSoFeitas').checked, linhas = linhasDoCaderno(cadernoNomes, soFeitas);
  const nomes = cadernoNomes && cadernoNomes.length ? cadernoNomes.join(', ') : 'todos os talhões';
  $('#cadTitulo').textContent = `Caderno de campo — ${nomes}`;
  $('#cadFazenda').textContent = `${DB.config.fazenda || 'Fazenda'} · emitido em ${agora()} · Gefaz Calda ${E.versao}`;
  const custo = linhas.filter(l => l.a.aplicada).reduce((s, l) => s + (l.a.custo || 0), 0);
  $('#cadResumo').textContent = `${linhas.length} registro(s)${custo ? ' · custo de defensivos das aplicações feitas: ' + BRL(custo) : ''}`;
  $('#cadTabela').innerHTML = linhas.length ? `<thead><tr><th>Data</th><th>Talhão</th><th>Produtos (dose/ha · lote)</th><th>Alvos</th><th class="num">ha</th><th>Quem · com quê</th><th>Situação</th><th>Liberações</th><th class="num">Custo</th></tr></thead><tbody>${linhas.map(({ t, a, lib }) => {
    const r = a.rast || {}, itens = a.itens || (a.produtos || []).map(n => ({ nome: n, dose: 0, unidade: '' }));
    return `<tr><td>${esc(quandoTexto(a.quando))}</td><td>${esc(t.nome)}<br><small>${esc(a.cultura || t.cultura || '')}</small></td>
      <td>${itens.map(i => `${esc(i.nome)}${i.dose ? ' <small>' + esc(doseTexto(i)) + '</small>' : ''}`).join('<br>')}</td><td>${esc(a.alvos || '—')}</td><td class="num">${a.area ? fmt(a.area, 2) : '—'}</td>
      <td>${esc([r.operador, r.maquina, nomeEquip(a.equip)].filter(Boolean).join(' · ') || '—')}${r.receituario ? '<br><small>receituário ' + esc(r.receituario) + '</small>' : ''}${r.responsavel ? '<br><small>RT ' + esc(r.responsavel) + (r.crea ? ' — ' + esc(r.crea) : '') + '</small>' : ''}</td>
      <td>${a.aplicada ? '<span class="tag reg">aplicada</span>' : '<span class="tag">só análise</span>'}${a.litros ? '<br><small>' + fmt(a.litros, 0) + ' L de calda</small>' : ''}</td>
      <td><small>${lib.reentrada ? 'reentrada ' + esc(dataHoraBR(lib.reentrada)) + '<br>' : ''}${lib.proxima ? 'próx. aplicação ' + esc(dataBR(lib.proxima)) + '<br>' : ''}${lib.colheita ? 'colheita ' + esc(dataBR(lib.colheita)) : ''}${!lib.reentrada && !lib.proxima && !lib.colheita ? '—' : ''}</small></td>
      <td class="num">${a.custo != null ? BRL(a.custo) : '—'}</td></tr>`;
  }).join('')}</tbody>` : '<tbody><tr><td class="muted">Nenhum registro. As aplicações entram aqui quando você marca o talhão e analisa a calda (marque “aplicada” em Histórico → Talhões, ou informe o término).</td></tr></tbody>';
}
function abrirCaderno(nomes) { cadernoNomes = nomes; renderCaderno(); navTo('caderno'); }
function imprimirCaderno() {
  const st = document.createElement('style'); st.id = 'paginaPaisagem'; st.media = 'print'; st.textContent = '@page{size:A4 landscape;margin:10mm}';
  document.head.appendChild(st); document.body.classList.add('print-caderno'); window.print();
}
function initCaderno() {
  $('#cadSoFeitas').onchange = renderCaderno;
  $('#btnCadImprimir').onclick = imprimirCaderno;
  $('#btnCadCSV').onclick = () => download(`caderno-de-campo-${hoje()}.csv`, '﻿' + cadernoParaCSV(linhasDoCaderno(cadernoNomes, $('#cadSoFeitas').checked)), 'text/csv;charset=utf-8');
  $('#btnCadVoltar').onclick = () => navTo('historico');
  $('#btnCadernoTodos').onclick = () => abrirCaderno(null);
  window.addEventListener('afterprint', () => { document.body.classList.remove('print-caderno'); const st = $('#paginaPaisagem'); if (st) st.remove(); });
}

/* ───────── start ───────── */
function initFazenda() {
  initFicha(); initCaderno();
  initEstoqueUI(); initMetasUI();
  vigiarNovaVersao();
  window.addEventListener('afterprint', () => document.body.classList.remove('print-resumido'));
  $('#btnBackup').onclick = exportarBackup;
  const b2 = $('#btnBackup2'); if (b2) b2.onclick = exportarBackup;
  const dias = $('#cfgBackupDias');
  if (dias) { dias.value = DB.config.backup.lembrarDias; dias.onchange = () => { DB.config.backup.lembrarDias = Math.max(0, Math.round(num(dias.value))); saveDB(); verificarBackup(); }; }
  pedirArmazenamentoPersistente();
  verificarBackup();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verificarBackup(); });
}
