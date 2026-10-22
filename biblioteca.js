/* Biblioteca de consulta: fatos do AGROFIT e fichas originais; sem prescrição. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.GCBiblioteca = factory(root.GCEngine);
})(typeof window !== 'undefined' ? window : globalThis, function (E) {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const EMBRAPA = 'https://ainfo.cnptia.embrapa.br/digital/bitstream/doc/1166619/1/DOC-274-3-ed.pdf';
  const AGROFIT = 'https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons';
  // Sinais curtos para apoiar a observação. A identificação completa fica na fonte.
  const PERFIS = [
    ['Conyza bonariensis', 'Buva', 30, 'Porte ereto; sementes pequenas dispersadas pelo vento.'],
    ['Digitaria insularis', 'Capim-amargoso', 91, 'Touceiras perenes, rizomas curtos e panículas prateadas.'],
    ['Eleusine indica', 'Capim-pé-de-galinha', 95, 'Touceira com base dos colmos achatada.'],
    ['Commelina benghalensis', 'Trapoeraba', 52, 'Ramos suculentos; produz sementes aéreas e subterrâneas.'],
    ['Bidens pilosa', 'Picão-preto', 32, 'Frutos com aristas; confirmar espécie dentro do gênero.'],
    ['Bidens subalternans', 'Picão-preto', 32, 'Frutos com aristas; comparar com Bidens pilosa.'],
    ['Amaranthus spinosus', 'Caruru-de-espinho', 20, 'Pares de espinhos na inserção das folhas.'],
    ['Alternanthera tenella', 'Apaga-fogo', 15, 'Folhas opostas e ramificação intensa.'],
    ['Acanthospermum australe', 'Carrapicho-rasteiro', 25, 'Crescimento prostrado; frutos com cerdas rígidas.'],
    ['Acanthospermum hispidum', 'Carrapicho-de-carneiro', 26, 'Planta ereta; frutos espinhosos aderem a animais.']
  ].map(([cientifico, nome, pagina, sinais]) => ({ cientifico, nome, pagina, sinais, fonte: EMBRAPA + '#page=' + pagina })).concat([{
    cientifico: 'Cyperus rotundus', nome: 'Tiririca',
    sinais: 'Eixo floral triangular; rizomas com engrossamentos subterrâneos.',
    referencia: 'Embrapa · identificação de Cyperus rotundus',
    fonte: 'https://www.embrapa.br/documents/1355291/12492345/Manual%2Bde%2BIdentifica%C3%A7%C3%A3o%2Bde%2BPlantas%2BInfestantes%2BCultivos%2Bde%2BVer%C3%A3o/2b542acc-89ef-4322-b495-188ca5b40564?version=1.0'
  }]);
  const PERFIL_MAP = Object.fromEntries(PERFIS.map(p => [norm(p.cientifico), p]));
  const ORIENTACOES = [
    'Mapeie as reboleiras e registre a espécie, o estádio e a densidade antes de escolher o manejo.',
    'Combine cobertura do solo, rotação de culturas e controle das plantas que escaparam, reduzindo a produção de sementes.',
    'Avalie o resultado após o manejo. Falha de controle exige investigar identificação, aplicação, estádio e possível resistência.'
  ];
  function identidade(texto) {
    const s = String(texto || '').trim(), m = /\(([^()]*)\)\s*$/.exec(s);
    const cientifico = m ? m[1].trim() : '';
    const popular = (m ? s.slice(0, m.index) : s).replace(/\s*\(\d+\)/g, '').trim();
    return { cientifico, popular: popular === '-' ? '' : popular };
  }
  function montarDaninhas(agro) {
    const map = new Map();
    const categorias = E.classificarAlvos(agro);
    // Somente vínculos explícitos de herbicidas: cultura × alvo × produto.
    // Não se amplia "Todas as culturas" para culturas individuais.
    (agro.produtos || []).forEach((p, pi) => {
      if (!/herbicida/i.test(p.cl || '')) return;
      Object.entries(p.a || {}).forEach(([ci, ids]) => ids.forEach(ai => {
        if (!agro.alvos[ai] || !agro.culturas[ci]) return;
        if (categorias[ai] !== 'daninha') return;
        const ident = identidade(agro.alvos[ai]);
        const id = norm(ident.cientifico || ident.popular);
        if (!id) return;
        if (!map.has(id)) map.set(id, { id, cientifico: ident.cientifico, nomes: [], alvoIds: [], culturas: [], vinculos: [], perfil: PERFIL_MAP[id] || null });
        const d = map.get(id);
        if (ident.popular && !d.nomes.includes(ident.popular)) d.nomes.push(ident.popular);
        if (!d.alvoIds.includes(ai)) d.alvoIds.push(ai);
        if (!d.culturas.includes(+ci)) d.culturas.push(+ci);
        if (!d.vinculos.some(v => v.produto === pi && v.cultura === +ci)) d.vinculos.push({ produto: pi, cultura: +ci });
      }));
    });
    return [...map.values()].map(d => {
      d.nome = d.perfil ? d.perfil.nome : (d.nomes[0] || d.cientifico);
      d.busca = norm([d.nome, d.cientifico, ...d.nomes].join(' '));
      return d;
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function buscarDaninhas(lista, consulta, cultura) {
    const termos = norm(consulta).split(' ').filter(Boolean);
    return lista.filter(d => (cultura == null || d.culturas.includes(+cultura)) && termos.every(t => d.busca.includes(t)));
  }
  function controles(daninha, agro, cultura) {
    const grupos = new Map();
    daninha.vinculos.filter(v => cultura == null || v.cultura === +cultura).forEach(v => {
      const p = agro.produtos[v.produto];
      if (!grupos.has(v.produto)) grupos.set(v.produto, { produto: p, culturas: [] });
      const r = grupos.get(v.produto), c = agro.culturas[v.cultura];
      if (!r.culturas.includes(c)) r.culturas.push(c);
    });
    return [...grupos.values()].sort((a, b) => a.produto.m.localeCompare(b.produto.m, 'pt-BR'));
  }
  function alvoNaCultura(daninha, agro, cultura) {
    const ci = agro.culturas.indexOf(cultura);
    if (ci < 0) return null;
    const ids = new Set();
    daninha.vinculos.filter(v => v.cultura === ci).forEach(v => (agro.produtos[v.produto].a[ci] || []).forEach(i => ids.add(i)));
    const ai = daninha.alvoIds.find(i => ids.has(i));
    return ai == null ? null : agro.alvos[ai];
  }
  function buscarMagnojet(lista, consulta) {
    const termos = norm(consulta).split(' ').filter(Boolean);
    return lista.filter(p => termos.every(t => norm([p.modelo, p.tipo || '', p.pagina || ''].join(' ')).includes(t)));
  }
  return { norm, PERFIS, ORIENTACOES, EMBRAPA, AGROFIT, identidade, montarDaninhas, buscarDaninhas, controles, alvoNaCultura, buscarMagnojet };
});
