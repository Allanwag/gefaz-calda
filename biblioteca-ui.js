'use strict';
/* Consulta sem alterar doses, estoque ou receitas. */
(() => {
  const B = window.GCBiblioteca;
  let base = null, daninhas = [], selecionada = null, limite = 24, limiteProdutos = 15, magnojet = null;
  const culturaFiltro = () => $('#dCultura').value === '' ? null : +$('#dCultura').value;
  const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texto)} ↗</a>`;
  function atualizar(agro) {
    base = agro;
    if (!base) { $('#dStatus').textContent = 'Base AGROFIT indisponível. Reabra o app com conexão para carregar a consulta.'; return; }
    daninhas = B.montarDaninhas(base);
    $('#dCultura').innerHTML = '<option value="">Todas as culturas da base</option>' + base.alvosPara.map(c => `<option value="${base.culturas.indexOf(c)}">${esc(c)}</option>`).join('');
    const ci = base.culturas.indexOf($('#fCultura').value);
    if (ci >= 0) $('#dCultura').value = String(ci);
    $('#dStatus').textContent = `${daninhas.length} fichas de consulta · AGROFIT/MAPA, CC-BY · base de ${base.gerado}. Vínculos de alvos disponíveis para: ${base.alvosPara.join(', ')}. Consulte o registro atual antes do uso.`;
    renderDaninhas();
  }
  function renderDaninhas() {
    if (!base) return;
    const lista = B.buscarDaninhas(daninhas, $('#dBusca').value, culturaFiltro());
    $('#dContagem').textContent = `${lista.length} de ${daninhas.length} fichas · ${daninhas.filter(d => d.perfil).length} com sinais de identificação`;
    $('#dLista').innerHTML = lista.slice(0, limite).map(d => `<div class="row"><div><b>${esc(d.nome)}</b><small><i>${esc(d.cientifico || 'Nome científico ausente na fonte')}</i></small><small>${esc(d.nomes.filter(n => B.norm(n) !== B.norm(d.nome)).join(' · '))}</small></div><button class="btn sm" data-daninha="${esc(d.id)}">Consultar</button></div>`).join('') || '<p class="small muted">Nenhum registro neste filtro. Tente o nome científico ou outra cultura.</p>';
    $('#dMais').hidden = lista.length <= limite;
    $$('#dLista [data-daninha]').forEach(b => b.onclick = () => {
      selecionada = daninhas.find(d => d.id === b.dataset.daninha); limiteProdutos = 15;
      $('#dProdutoBusca').value = ''; renderFicha(); $('#dFicha').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
  function renderFicha() {
    if (!selecionada || !base) return;
    const d = selecionada, ci = culturaFiltro(), culturaAtual = $('#fCultura').value;
    $('#dFicha').hidden = false;
    $('#dFichaNome').textContent = d.nome;
    $('#dIdentidade').innerHTML = `<p><i>${esc(d.cientifico)}</i></p><p class="small muted">Nomes na fonte: ${esc(d.nomes.join(' · '))}. Grafia e nomenclatura preservadas do AGROFIT; nomes populares podem designar outras espécies.</p>`;
    $('#dSinais').innerHTML = d.perfil ? `<p>${esc(d.perfil.sinais)}</p><p class="small">${link(d.perfil.fonte, d.perfil.referencia || 'Embrapa Soja, 2024 · p. ' + d.perfil.pagina + ' · identificação e fotos na fonte')}</p>` : `<p class="small muted">Esta ficha contém identificação nominal e vínculos de registro. A descrição botânica e as fotos ainda não estão incorporadas.</p><p class="small">${link(B.EMBRAPA, 'Consultar manual público da Embrapa · espécies de soja')} · ${link(B.AGROFIT, 'Consultar identificação no AGROFIT')}</p>`;
    $('#dManejo').innerHTML = '<ol>' + B.ORIENTACOES.map(t => `<li>${esc(t)}</li>`).join('') + '</ol>';
    $('#dCulturaFicha').textContent = ci == null ? 'Relações nas culturas da base' : 'Relações para ' + base.culturas[ci];
    const alvo = B.alvoNaCultura(d, base, culturaAtual);
    $('#dUsarAlvo').disabled = !alvo;
    $('#dUsarNota').textContent = alvo ? `Adicionar somente o alvo à calda de ${culturaAtual}; produtos e doses são definidos na análise.` : `Sem vínculo explícito para ${culturaAtual} nesta base. Altere a cultura na aba Calda se necessário.`;
    $('#dUsarAlvo').onclick = () => {
      const nome = B.alvoNaCultura(d, base, $('#fCultura').value);
      if (!nome) return;
      adicionarAlvo('daninha', nome, true); if (resultado) invalidarResultado();
      navTo('calda'); toast(d.nome + ' adicionada aos alvos');
    };
    renderControles();
  }
  function renderControles() {
    if (!selecionada || !base) return;
    const q = B.norm($('#dProdutoBusca').value);
    const lista = B.controles(selecionada, base, culturaFiltro()).filter(r => B.norm(r.produto.m + ' ' + r.produto.ia.map(x => x[0]).join(' ')).includes(q));
    $('#dNProdutos').textContent = `${lista.length} produtos no filtro · dados de ${base.gerado}`;
    $('#dControles').innerHTML = lista.slice(0, limiteProdutos).map(({ produto: p, culturas }) => `<div class="row"><div><b>${esc(p.m)}</b><small>Registro MAPA ${esc(p.r)} · ${esc(p.f)}</small><small>Ingredientes: ${esc(p.ia.map(i => i[0]).join(' + '))}</small><small>Cultura × alvo na fonte: ${esc(culturas.join(', '))}</small></div></div>`).join('') || '<p class="small muted">Nenhum vínculo encontrado no filtro. Isso não comprova ausência de registro atual.</p>';
    $('#dMaisProdutos').hidden = lista.length <= limiteProdutos;
  }
  function renderMagnojet() {
    if (!magnojet) return;
    const lista = B.buscarMagnojet(magnojet.modelos, $('#mjBusca').value);
    $('#mjContagem').textContent = `${lista.length} de ${magnojet.modelos.length} entradas do índice · conferido em ${magnojet.conferido}`;
    $('#mjLista').innerHTML = lista.map(p => {
      const pronta = p.calculador && window.GCPontas.PONTA_MAP[p.calculador];
      return `<div class="row"><div><b>${esc(p.modelo)}</b><small>${esc(p.tipo)} · p. ${p.pagina}</small><small>${pronta ? 'Disponível no calculador; confira a tabela da edição consultada.' : 'Consulta ao catálogo. Tabela ainda não incorporada ao calculador.'}</small><small>${link(magnojet.url + '#page=' + p.pagina, 'Ficha e tabela oficial')}</small></div>${pronta ? `<button class="btn sm" data-mj="${esc(p.calculador)}">Usar</button>` : ''}</div>`;
    }).join('') || '<p class="small muted">Nenhum modelo encontrado.</p>';
    $$('#mjLista [data-mj]').forEach(b => b.onclick = () => {
      const p = window.GCPontas.PONTA_MAP[b.dataset.mj];
      $('#pMarca').value = p.marca; preencherModelos(p.id); preencherIso(); preencherAngulos(); calcularRegulagem();
      $('#pPonta').scrollIntoView({ block: 'center', behavior: 'smooth' }); toast(p.modelo + ' selecionada');
    });
  }
  async function carregarMagnojet() {
    $('#mjContagem').textContent = 'Carregando índice…';
    try {
      const r = await fetch('data/magnojet.json'); if (!r.ok) throw new Error(r.status);
      magnojet = await r.json(); renderMagnojet();
    } catch (_) {
      $('#mjContagem').textContent = 'Índice indisponível. Acesse o catálogo oficial com conexão ou tente novamente.';
    }
  }
  function initBiblioteca() {
    $('#dBusca').oninput = () => { limite = 24; selecionada = null; $('#dFicha').hidden = true; renderDaninhas(); };
    $('#dCultura').onchange = () => { limite = 24; limiteProdutos = 15; renderDaninhas(); renderFicha(); };
    $('#dMais').onclick = () => { limite += 24; renderDaninhas(); };
    $('#dFecharFicha').onclick = () => { $('#dFicha').hidden = true; selecionada = null; $('#dBusca').focus(); };
    $('#dProdutoBusca').oninput = () => { limiteProdutos = 15; renderControles(); };
    $('#dMaisProdutos').onclick = () => { limiteProdutos += 15; renderControles(); };
    $('#mjBusca').oninput = renderMagnojet;
    $('#mjRecarregar').onclick = carregarMagnojet;
    $('#dRecarregar').onclick = carregarAgrofit;
    $('#nav [data-tab="daninhas"]').addEventListener('click', renderFicha);
    carregarMagnojet(); if (AGRO) atualizar(AGRO);
  }
  window.GCBibliotecaUI = { atualizar };
  document.addEventListener('DOMContentLoaded', initBiblioteca);
})();
