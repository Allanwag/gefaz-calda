/* ═══════════════════════════════════════════════════════════════════
   Gefaz Calda — sdk.js  (integração para Gefaz360, Gefaz360 Codex e PVGest)
   Inclua <script src="https://…/gefaz-calda/sdk.js"></script> no app cliente.
   Três formas de uso, da mais simples à mais integrada:
     1. GefazCalda.abrir(mix)                → abre o app com a calda pré-carregada (URL ?mix=)
     2. GefazCalda.embed(el, mix, cb)        → iframe embutido; cb recebe o resultado (postMessage)
     3. await GefazCalda.analisar(mix)       → carrega engine+kb do app e analisa localmente (sem UI)
   Formato de mix (v1): { v:1, origem:'pvgest'|'gefaz360'|'codex', cultura, alvo, volumeHa, area, tanque,
     equipamento:'barra'|'turbo'|'drone'|'costal'|'aviao', agua:{ph,dureza,turbidez},
     itens:[{ nome, dose, unidade:'L/ha'|'kg/ha'|'mL/100L'|'g/100L'|…, classe?, formulacao?, preco?, ativos?:[…] }] }
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const scriptEl = document.currentScript;
  const BASE = (root.GEFAZ_CALDA_URL || (scriptEl ? scriptEl.src.replace(/sdk\.js.*$/, '') : './')).replace(/\/?$/, '/');
  const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const normalizar = mix => Object.assign({ v: 1 }, mix, { itens: (mix.itens || []).map(i => ({ nome: i.nome || i.nome_livre || i.produto || '', dose: +i.dose || 0, unidade: i.unidade || 'L/ha', classe: i.classe, formulacao: i.formulacao, preco: i.preco, ativos: i.ativos })) });

  const GefazCalda = {
    base: BASE,
    urlPara(mix) { return BASE + 'index.html?mix=' + enc(normalizar(mix)); },
    abrir(mix, alvo) { const w = root.open(this.urlPara(mix), alvo || 'gefaz-calda'); return w; },
    embed(container, mix, onResultado) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      const iframe = document.createElement('iframe');
      iframe.src = this.urlPara(mix); iframe.style.cssText = 'width:100%;min-height:640px;border:0;border-radius:12px;background:#fff';
      iframe.setAttribute('title', 'Gefaz Calda');
      const origem = new URL(BASE, location.href).origin;
      const handler = ev => { if (ev.origin !== origem || !ev.data || ev.data.type !== 'gefaz-calda:resultado') return; onResultado && onResultado(ev.data.resultado, ev.data.mix); };
      root.addEventListener('message', handler);
      el.innerHTML = ''; el.appendChild(iframe);
      return { iframe, destruir() { root.removeEventListener('message', handler); iframe.remove(); }, enviar(novoMix) { iframe.contentWindow.postMessage({ type: 'gefaz-calda:analisar', mix: normalizar(novoMix) }, origem); } };
    },
    _carregar: null,
    carregarMotor() {
      if (root.GCEngine && root.GC_KB) return Promise.resolve(root.GCEngine);
      if (this._carregar) return this._carregar;
      const load = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = BASE + src; s.onload = ok; s.onerror = () => err(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); });
      this._carregar = load('kb.js').then(() => load('engine.js')).then(() => root.GCEngine);
      return this._carregar;
    },
    async analisar(mix, opts) {
      const E = await this.carregarMotor();
      const m = normalizar(mix);
      return E.analisar(m.itens, Object.assign({ cultura: m.cultura, alvo: m.alvo, volumeHa: m.volumeHa, area: m.area, tanque: m.tanque, equipamento: m.equipamento, agua: m.agua, regraFazenda: m.regraFazenda }, opts || {}));
    },
    // Conversores a partir dos formatos nativos de cada app
    dePVGest(receita, produtos, extra) {
      const byId = id => (produtos || []).find(p => p.id === id) || {};
      return normalizar(Object.assign({ origem: 'pvgest', cultura: receita.cultura, alvo: receita.alvo, volumeHa: receita.volume_ha, itens: (receita.itens || []).map(i => { const p = byId(i.produto); return { nome: p.nome || i.nome_livre, dose: i.dose, unidade: i.unidade, classe: p.classe, preco: p.preco, fabricante: p.fabricante }; }) }, extra || {}));
    },
    deGefaz360(receita, defensivos, extra) {
      const byId = id => (defensivos || []).find(p => p.id === id) || {};
      return normalizar(Object.assign({ origem: 'gefaz360', cultura: receita.cultura, alvo: receita.alvo, volumeHa: receita.volumeHa, itens: (receita.itens || []).map(i => { const p = byId(i.prodId); return { nome: p.nome, dose: i.dose, unidade: (p.unidade || 'L') + '/ha', classe: p.classe, preco: p.preco }; }) }, extra || {}));
    },
    resumoHTML(res) {
      if (!res) return '';
      const cor = { compativel: '#2e7d32', restricoes: '#f9a825', incompativel: '#c62828', testar: '#1565c0', vazio: '#777' }[res.status] || '#777';
      return `<div style="border-left:4px solid ${cor};padding:8px 12px;font:14px system-ui"><b>${res.resumo.rotulo}</b> · confiança ${Math.round(res.confianca * 100)} %<br>${res.alertas.filter(a => a.severidade !== 'info').slice(0, 4).map(a => `• ${a.titulo}`).join('<br>')}</div>`;
    }
  };
  root.GefazCalda = GefazCalda;
})(window);
