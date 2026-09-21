/* ═══════════════════════════════════════════════════════════════════════════
   Gefaz Calda — produtos-ui.js
   Meus produtos: cadastro permanente (janela), busca e atalhos da calda, botão nas
   linhas da calda, cartão de gerenciamento e planilha. Lógica pura em produtos.js.
   ═══════════════════════════════════════════════════════════════════════════ */
const PROD = window.GCProdutos;

const meuProduto = nome => PROD.existente(DB.meusProdutos, nome) || null;
const subDoProduto = p => [p.classe, PROD.resumo(p), p.dose ? `${fmt(p.dose, 3)} ${p.unidade}` : '', p.preco ? `${BRL(p.preco)}/${PROD.unidadeDoPreco(p.unidade)}` : 'sem preço'].filter(Boolean).join(' · ');

/* ───────── busca e atalhos da calda ───────── */
function buscarMeus(q) { return PROD.buscar(DB.meusProdutos, q, { limite: 8 }).map(p => ({ nome: p.nome, sub: subDoProduto(p), produto: p })); }
function adicionarMeu(p) {
  const jaTem = calda.itens.some(x => norm(x.nome) === norm(p.nome));
  addItem(PROD.paraItem(p, uid));
  if (!jaTem) { p.usos = (p.usos || 0) + 1; saveDB(); renderChipsRapidos(); } // os mais usados sobem para os atalhos
}
function chipsMeusProdutos() {
  const top = [...DB.meusProdutos].sort((a, b) => (b.usos || 0) - (a.usos || 0) || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 12);
  return top.map(p => `<button type="button" class="chip chip-meu" data-meu-chip="${esc(p.id)}" title="${esc(subDoProduto(p))}">⭐ ${esc(p.nome)}</button>`).join('');
}
function ligarChipsMeus() {
  $$('#chipsRapidos [data-meu-chip]').forEach(b => b.onclick = () => { const p = DB.meusProdutos.find(x => x.id === b.dataset.meuChip); if (p) adicionarMeu(p); });
}

/* ───────── linha do produto na calda ───────── */
function linhaMeuProduto(it) {
  const meu = meuProduto(it.nome), mp = it.materiaPrima || (meu && meu.materiaPrima) || '', nota = (meu && meu.nota) || '';
  const partes = [mp && `<b>Matéria-prima:</b> ${esc(mp)}`, nota && `<b>Obs.:</b> ${esc(nota)}`].filter(Boolean);
  return partes.length ? `<div class="small muted">${partes.join(' · ')}</div>` : '';
}
function botaoMeuProduto(it) {
  return `<div class="acoes-item">${meuProduto(it.nome)
    ? '<button type="button" class="btn sm ghost" data-meu-atualizar title="Grava classe, formulação, dose, unidade e preço desta linha como o padrão do produto em Meus produtos">💾 Atualizar em Meus produtos</button>'
    : '<button type="button" class="btn sm ghost" data-meu-guardar title="Guarda o produto para as próximas caldas: ele passa a aparecer na busca e nos atalhos">⭐ Guardar em Meus produtos</button>'}</div>`;
}
function ligarMeusProdutos(el) {
  const itemDe = b => calda.itens[+b.closest('.item').dataset.i];
  el.querySelectorAll('[data-meu-guardar]').forEach(b => b.onclick = () => abrirFormProduto({ modo: 'guardar', pre: PROD.deItem(itemDe(b)) }));
  el.querySelectorAll('[data-meu-atualizar]').forEach(b => b.onclick = () => atualizarMeuDaLinha(itemDe(b)));
}
function atualizarMeuDaLinha(it) {
  const meu = meuProduto(it.nome); if (!meu) return;
  const r = PROD.salvar(DB.meusProdutos, { ...meu, classe: it.classe, formulacao: it.formulacao, unidade: it.unidade, dose: it.dose, preco: it.preco }, { id: meu.id });
  if (r.erro) return toast(r.erro, 'err');
  saveDB(); renderMeusProdutos(); renderChipsRapidos(); renderItens();
  toast(`“${meu.nome}” atualizado em Meus produtos`);
}

/* renomear um produto leva junto a ficha da bula e o vínculo com o estoque, que são guardados pelo nome */
function moverFichaDoProduto(de, para) {
  const a = norm(de), b = norm(para); if (a === b) return;
  Object.entries(FICHA_CAMPOS).forEach(([campo, mapa]) => {
    const v = DB[mapa][a];
    if (v !== undefined && DB[mapa][b] === undefined) salvarFichaProduto(para, campo, v);
    salvarFichaProduto(de, campo, '');
  });
  if (DB.mapEstoque[a] !== undefined) { if (DB.mapEstoque[b] === undefined) DB.mapEstoque[b] = DB.mapEstoque[a]; delete DB.mapEstoque[a]; }
}

/* ───────── janela de cadastro ─────────
   modo 'nova'   → vem de “+ Produto manual” ou da busca: entra na calda e, marcado, fica guardado
   modo 'guardar' → guarda sem mexer na calda (botão da linha ou “Novo produto” do cartão)
   modo 'editar' → altera um produto já guardado */
function abrirFormProduto({ modo = 'nova', id = null, pre = {} } = {}) {
  const base = PROD.limpar({ classe: 'Fertilizante Foliar', ...pre });
  const est = { classe: base.classe, ativos: new Set(base.ativos), unTocado: modo === 'editar' || !!pre.unidade };
  const originais = base.ativos.filter(k => !PROD.componentes(base.classe).some(c => c.chave === k)); // ativos que a janela não mostra (ex.: biológico) seguem junto
  const nomeAntigo = base.nome;
  const titulo = { nova: 'Cadastrar produto', guardar: 'Guardar em Meus produtos', editar: 'Editar produto' }[modo];
  const rotuloOk = { nova: 'Adicionar à calda', guardar: 'Guardar', editar: 'Salvar' }[modo];
  const opcoes = (lista, sel, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') + lista.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  modal(`<h2>${titulo}</h2>
    <p class="small muted">Cadastre uma vez: o produto fica guardado neste aparelho (e no backup), volta na busca e nos atalhos da calda com classe, composição, dose e preço. Vale para fertilizantes foliares, adjuvantes e qualquer produto que a base não traz.</p>
    <label>Nome<input id="prNome" value="${esc(base.nome)}" autocomplete="off"></label>
    <div class="grid2">
      <label>Classe<select id="prClasse">${opcoes(KB.classes, est.classe)}</select></label>
      <label>Formulação<select id="prForm"><option value="">? (a base assume)</option>${Object.keys(KB.formulacoes).map(f => `<option ${f === base.formulacao ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <label>Dose padrão<input id="prDose" type="number" step="any" min="0" value="${base.dose || ''}"></label>
      <label>Unidade<select id="prUn">${opcoes(KB.unidades, base.unidade)}</select></label>
      <label>Preço (R$/L ou kg)<input id="prPreco" type="number" step="any" min="0" value="${base.preco || ''}"></label>
    </div>
    <div id="prComp"></div>
    <label>Matéria-prima <small class="muted">(quando o rótulo informar)</small><input id="prMP" value="${esc(base.materiaPrima)}" placeholder="ex.: ácido bórico, sulfato de zinco, molibdato de sódio" autocomplete="off"></label>
    <p class="small muted" id="prRec"></p>
    <label>Composição / ingrediente(s) ativo(s)<input id="prIa" value="${esc(base.ingredientes)}" placeholder="foliar: N 10% · B 1% · Zn 2% — defensivo: azoxistrobina + ciproconazol" autocomplete="off"></label>
    <label>Observação<input id="prNota" value="${esc(base.nota)}" placeholder="ex.: não misturar com cúpricos" autocomplete="off"></label>
    ${modo === 'nova' ? '<label class="check"><input type="checkbox" id="prGuardar" checked> Guardar em Meus produtos (não precisa cadastrar de novo)</label>' : ''}
    <div class="row-btns"><button class="btn primary" id="prOk">${rotuloOk}</button><button class="btn ghost" id="prCancel">Cancelar</button></div>`);

  const chavesDaClasse = () => new Set(PROD.componentes(est.classe).map(c => c.chave));
  function desenharComposicao() {
    const comps = PROD.componentes(est.classe), foliar = est.classe === 'Fertilizante Foliar';
    $('#prComp').innerHTML = comps.length ? `<div class="comp-box"><b class="small">${foliar ? 'Nutrientes' : 'Função do produto'}</b>
      <div class="comp-grid">${comps.map(c => `<label class="check"><input type="checkbox" data-comp="${esc(c.chave)}" ${est.ativos.has(c.chave) ? 'checked' : ''}> ${esc(c.rotulo)}</label>`).join('')}</div>
      <p class="small muted">${foliar ? 'Marque o que a embalagem garante: é por aqui que o app aplica as regras de mistura (ex.: cálcio × glifosato, fosfato × cátions). Sem nenhum marcado, o laudo trata o produto como “ativo não reconhecido” e exige jar test.' : 'Marque a função: o app usa isso na ordem de adição e nas regras de pH.'}</p></div>` : '';
    $$('#prComp [data-comp]').forEach(cb => cb.onchange = () => { if (cb.checked) est.ativos.add(cb.dataset.comp); else est.ativos.delete(cb.dataset.comp); });
  }
  desenharComposicao();
  $('#prClasse').onchange = () => {
    est.classe = $('#prClasse').value;
    if (!est.unTocado) $('#prUn').value = PROD.unidadePadrao(est.classe);
    desenharComposicao(); reconhecerMateriaPrima(false);
  };
  $('#prUn').onchange = () => { est.unTocado = true; };
  // a matéria-prima costuma ser o que o rótulo lista (ácido bórico, sulfato de zinco…): a base reconhece e marca os nutrientes
  function reconhecerMateriaPrima(avisar) {
    const achou = PROD.reconhecer($('#prMP').value, est.classe), novos = achou.filter(k => !est.ativos.has(k));
    achou.forEach(k => est.ativos.add(k));
    if (novos.length) desenharComposicao();
    const nomes = achou.map(PROD.nomeCurto).join(', ');
    $('#prRec').textContent = !$('#prMP').value.trim() || !PROD.componentes(est.classe).length ? ''
      : achou.length ? `Reconhecido na matéria-prima: ${nomes}${novos.length ? ' — marcado acima.' : '.'}`
      : avisar ? 'Nenhum nutriente da base reconhecido nesse texto — marque à mão acima se quiser que o app aplique as regras de mistura.' : '';
  }
  $('#prMP').onchange = () => reconhecerMateriaPrima(true);
  if (modo !== 'editar' && !est.ativos.size) reconhecerMateriaPrima(false); // ao abrir só sugere para produto sem nutriente; quem desmarcou algo de propósito não é contrariado

  const dados = () => ({
    nome: $('#prNome').value, classe: est.classe, formulacao: $('#prForm').value, dose: num($('#prDose').value), unidade: $('#prUn').value, preco: num($('#prPreco').value),
    ativos: [...[...est.ativos].filter(k => chavesDaClasse().has(k)), ...originais], ingredientes: $('#prIa').value, materiaPrima: $('#prMP').value, nota: $('#prNota').value
  });
  $('#prCancel').onclick = closeModal;
  $('#prOk').onclick = () => {
    const d = dados();
    if (!d.nome.trim()) return toast('Informe o nome', 'err');
    if (modo === 'nova' && !$('#prGuardar').checked) { // só desta calda
      closeModal(); const it = PROD.paraItem(PROD.limpar(d), uid); it.fonte = 'manual'; addItem(it); return;
    }
    const r = PROD.salvar(DB.meusProdutos, d, { id: modo === 'editar' ? id : null, novoId: uid });
    if (r.erro) return toast(r.erro, 'err');
    if (modo === 'editar') moverFichaDoProduto(nomeAntigo, r.produto.nome);
    saveDB(); closeModal(); renderMeusProdutos(); renderChipsRapidos(); renderItens();
    if (modo === 'nova') adicionarMeu(r.produto); else toast(`“${r.produto.nome}” ${r.criado ? 'guardado em' : 'atualizado em'} Meus produtos`);
  };
  (base.nome ? $('#prDose') : $('#prNome')).focus();
}

/* ───────── cartão de gerenciamento (aba Integração) ───────── */
function renderMeusProdutos() {
  const tb = $('#meusTabela'); if (!tb) return;
  const filtro = norm(($('#meusFiltro') || {}).value || '');
  const todos = [...DB.meusProdutos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const lista = todos.filter(p => !filtro || PROD.textoBusca(p).includes(filtro));
  $('#meusResumo').textContent = `${todos.length} produto(s)`;
  const n = $('#nMeus'); if (n) n.textContent = todos.length ? `(${todos.length})` : '';
  tb.innerHTML = lista.length
    ? `<thead><tr><th>Produto</th><th>Composição</th><th class="num">Dose padrão</th><th class="num">Preço</th><th></th></tr></thead><tbody>${lista.slice(0, 300).map(p => {
      const semNutriente = p.classe === 'Fertilizante Foliar' && !(p.ativos || []).length;
      return `<tr><td><b>${esc(p.nome)}</b><br><small class="muted">${esc(p.classe)}${p.formulacao ? ' · ' + esc(p.formulacao) : ''}</small>${p.nota ? `<br><small class="muted">${esc(p.nota)}</small>` : ''}</td>
        <td>${esc(PROD.resumo(p)) || '<small class="muted">—</small>'}${p.materiaPrima ? `<br><small class="muted">Matéria-prima: ${esc(p.materiaPrima)}</small>` : ''}${semNutriente ? '<br><small class="danger-txt">sem nutriente marcado — o laudo exige jar test</small>' : ''}</td>
        <td class="num">${p.dose ? esc(fmt(p.dose, 3) + ' ' + p.unidade) : '—'}</td><td class="num">${p.preco ? esc(BRL(p.preco)) + '/' + PROD.unidadeDoPreco(p.unidade) : '—'}</td>
        <td class="acts"><button type="button" class="btn sm" data-meu-add="${esc(p.id)}" title="Adicionar à calda">＋ calda</button><button type="button" class="btn sm ghost" data-meu-edit="${esc(p.id)}" aria-label="Editar ${esc(p.nome)}">✎</button><button type="button" class="btn sm ghost danger" data-meu-del="${esc(p.id)}" aria-label="Apagar ${esc(p.nome)}">✕</button></td></tr>`;
    }).join('')}</tbody>`
    : `<tbody><tr><td class="muted">${todos.length ? 'Nada com esse filtro.' : 'Nenhum produto guardado ainda. Use “＋ Novo produto” aqui, ou “+ Produto manual” na aba Calda (com “Guardar em Meus produtos” marcado).'}</td></tr></tbody>`;
  const doId = b => DB.meusProdutos.find(p => p.id === b);
  tb.querySelectorAll('[data-meu-add]').forEach(b => b.onclick = () => { const p = doId(b.dataset.meuAdd); if (p) { adicionarMeu(p); navTo('calda'); } });
  tb.querySelectorAll('[data-meu-edit]').forEach(b => b.onclick = () => { const p = doId(b.dataset.meuEdit); if (p) abrirFormProduto({ modo: 'editar', id: p.id, pre: p }); });
  tb.querySelectorAll('[data-meu-del]').forEach(b => b.onclick = () => {
    const p = doId(b.dataset.meuDel); if (!p) return;
    if (!confirm(`Apagar “${p.nome}” de Meus produtos? As caldas e receitas já salvas continuam como estão.`)) return;
    PROD.remover(DB.meusProdutos, p.id); saveDB(); renderMeusProdutos(); renderChipsRapidos(); renderItens();
  });
}
function importarMeusProdutos(texto) {
  const msg = $('#meusMsg'), r = PROD.produtosDeTabela(GCEstoque.parseCSV(texto), { classePadrao: 'Fertilizante Foliar', lista: DB.meusProdutos });
  if (!r.itens.length) { msg.innerHTML = `<span class="danger-txt">${esc(r.erros[0] || 'Nenhum produto encontrado na planilha.')}</span>`; return; }
  const res = PROD.importar(DB.meusProdutos, r.itens, { novoId: uid }), avisos = [...r.erros, ...res.erros];
  saveDB(); renderMeusProdutos(); renderChipsRapidos(); renderItens();
  msg.innerHTML = `${res.novos} produto(s) novo(s), ${res.atualizados} atualizado(s).${r.colunas.classe < 0 && res.novos ? ' Sem coluna de classe: os novos entraram como Fertilizante Foliar.' : ''}`
    + (avisos.length ? ` <span class="danger-txt">${avisos.length} aviso(s): ${esc(avisos.slice(0, 3).join(' · '))}${avisos.length > 3 ? '…' : ''}</span>` : '');
  toast('Meus produtos importados');
}
function initProdutosUI() {
  $('#btnMeuNovo').onclick = () => abrirFormProduto({ modo: 'guardar' });
  $('#btnMeus').onclick = () => { navTo('integracao'); const c = $('#cardMeus'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); };
  $('#meusFiltro').oninput = renderMeusProdutos;
  $('#btnMeusCSV').onclick = () => download(`meus-produtos-${hoje()}.csv`, '﻿' + PROD.paraCSV(DB.meusProdutos), 'text/csv;charset=utf-8');
  $('#impMeus').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importarMeusProdutos(await lerTextoArquivo(f)); } catch (err) { toast('Falha: ' + err.message, 'err'); } e.target.value = ''; };
  renderMeusProdutos(); renderChipsRapidos();
}
