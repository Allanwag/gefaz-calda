/* ═══════════════════════════════════════════════════════════════════
   Gefaz Calda — engine.js
   Motor de compatibilidade de mistura de calda (puro: sem DOM, sem estado).
   Funciona no navegador (window.GCEngine) e no Node (module.exports) para testes.
   Entrada: itens da calda + opções (água, cultura, equipamento…).
   Saída:   status global, alertas por tipo, matriz de pares, pH alvo,
            ordem de adição (Embrapa Doc. 437), jar test, custo/ha, ficha de tanque.
   ═══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kb.js'));
  else root.GCEngine = factory(root.GC_KB);
})(typeof self !== 'undefined' ? self : this, function (KB) {
  'use strict';

  const VERSAO = '1.1.1';
  const SEV = { alta: 3, media: 2, baixa: 1, info: 0 };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const uniq = a => [...new Set(a)];
  const fmtn = v => (v == null || v === '' ? '?' : String(Math.round((+v || 0) * 100) / 100).replace('.', ','));
  const round = (v, d = 2) => Math.round((+v || 0) * Math.pow(10, d)) / Math.pow(10, d);

  // ── Formulações: código → passo de adição (Embrapa, Documentos 437, 2021) ──
  const PASSO_FORMULACAO = {
    WP: 4, WS: 4, DP: 4,
    WG: 5, SG: 5, SP: 5, DF: 5, WDG: 5, GR: 5, MG: 5,
    SC: 6, CS: 6, SE: 6, FS: 6, 'CS+SC': 6, CF: 6, ZC: 6,
    SL: 7, LS: 7, AL: 7,
    EC: 8, EW: 8, ME: 8, OD: 8, EO: 8, DC: 8, GL: 8, EG: 8, SO: 8, UL: 8
  };
  const PASSOS = {
    1: { titulo: 'Encher o tanque com 2/3 da água', nota: 'Água limpa; medir pH e dureza antes.' },
    2: { titulo: 'Ligar a agitação (manter até o fim)', nota: '' },
    3: { titulo: 'Condicionadores de água', nota: 'Sequestrantes, acidificantes, tamponantes, antiespumante, redutor de deriva, agente de compatibilidade.' },
    4: { titulo: 'Pós molháveis (WP)', nota: 'Pré-diluir em balde.' },
    5: { titulo: 'Granulados (WG, SG, SP)', nota: 'Pré-mistura conforme bula.' },
    6: { titulo: 'Suspensões concentradas (SC, CS, SE, FS)', nota: '' },
    7: { titulo: 'Concentrados solúveis (SL)', nota: '' },
    8: { titulo: 'Emulsionáveis (EC, EW, ME, OD)', nota: 'Nunca antes dos pós molháveis: forma pasta insolúvel.' },
    9: { titulo: 'Demais adjuvantes', nota: 'Óleos, espalhantes, penetrantes, siliconados.' },
    10: { titulo: 'Fertilizantes foliares', nota: 'Micronutrientes e sais: risco de precipitação com fosfatos/sulfatos.' },
    11: { titulo: 'Completar a água', nota: 'Conferir pH final da calda antes de sair.' }
  };

  // ── Resolução de item: liga o produto ao conhecimento (ativos, tags, pH, MoA) ──
  function resolverAtivos(item) {
    const chaves = new Set();
    (item.ativos || []).forEach(k => { if (KB.ativos[k]) chaves.add(k); });
    const textos = [item.nome, ...(item.ingredientes || [])].map(norm).filter(Boolean);
    // comerciais conhecidos (Wetcit, Kantphos…)
    const com = KB.comerciais.find(c => textos.some(t => c.alias.some(a => t.includes(norm(a)))));
    if (com) com.ativos.forEach(k => chaves.add(k));
    // ingredientes ativos por alias (ordem: alias mais longos primeiro evita 'cobre' capturar 'sulfato de cobre' errado)
    const cand = [];
    Object.entries(KB.ativos).forEach(([k, a]) => a.alias.forEach(al => cand.push([norm(al), k])));
    cand.sort((x, y) => y[0].length - x[0].length);
    textos.forEach(t => cand.forEach(([al, k]) => { if (al && t.includes(al)) chaves.add(k); }));
    return [...chaves].map(k => ({ chave: k, ...KB.ativos[k] })).filter(a => a.nome);
  }

  function resolverItem(raw, i) {
    const item = Object.assign({ id: raw.id || ('it' + i), nome: raw.nome || ('Produto ' + (i + 1)), dose: +raw.dose || 0, unidade: raw.unidade || 'L/ha', preco: +raw.preco || 0 }, raw);
    const ativos = resolverAtivos(item);
    const com = KB.comerciais.find(c => c.alias.some(a => norm(item.nome).includes(norm(a))));
    item.ativosResolvidos = ativos;
    item.tags = uniq([...(item.tags || []), ...ativos.flatMap(a => a.tags || []), ...((com && com.tags) || [])]);
    item.classe = item.classe || (com && com.classe) || (ativos[0] && ativos[0].classe) || 'Outro';
    if (item.classe === 'Fertilizante Foliar' && !item.tags.includes('foliar')) item.tags = [...item.tags, 'foliar']; // foliar cadastrado à mão também segue as regras de foliar (fosetil, triazol…)
    item.formulacao = String(item.formulacao || (com && com.formulacao) || (ativos[0] && ativos[0].formulacao) || '').toUpperCase();
    item.funcao = item.funcao || (com && com.funcao) || (ativos.find(a => a.funcao) || {}).funcao || '';
    item.moa = uniq(ativos.filter(a => a.moa).map(a => a.moa.sistema + ' ' + a.moa.codigo));
    // pH alvo do item = interseção dos ativos; sem ativo → nulo
    const faixas = ativos.filter(a => a.ph).map(a => a.ph);
    item.ph = faixas.length ? [Math.max(...faixas.map(f => f[0])), Math.min(...faixas.map(f => f[1]))] : null;
    item.conhecido = ativos.length > 0;
    item.passo = passoDoItem(item);
    return item;
  }

  function passoDoItem(item) {
    const t = item.tags || [];
    if (t.includes('condicionador') || ['acidificante', 'sequestrante', 'ams', 'antiespumante', 'redutor-deriva', 'tamponante'].some(x => t.includes(x))) return 3;
    if (item.classe === 'Adjuvante' || t.includes('surfactante') || t.includes('oleo') || t.includes('siliconado')) return 9;
    if (item.classe === 'Fertilizante Foliar' || t.includes('foliar')) return 10;
    const p = PASSO_FORMULACAO[item.formulacao];
    if (p) return p;
    if (item.formulacao === 'BIO' || t.includes('biologico')) return 6;
    return 6; // formulação desconhecida: tratar como SC e avisar
  }

  // ── Conversão de dose → unidade-base por ha (L ou kg) ──
  function dosePorHa(item, volumeHa) {
    const u = norm(item.unidade);
    const d = +item.dose || 0;
    const v = +volumeHa || 100;
    if (u === 'l/ha' || u === 'kg/ha') return { qtd: d, base: u.startsWith('l') ? 'L' : 'kg' };
    if (u === 'ml/ha') return { qtd: d / 1000, base: 'L' };
    if (u === 'g/ha') return { qtd: d / 1000, base: 'kg' };
    if (u === 'ml/100l' || u === 'ml/100 l') return { qtd: d / 1000 * v / 100, base: 'L' };
    if (u === 'g/100l' || u === 'g/100 l') return { qtd: d / 1000 * v / 100, base: 'kg' };
    if (u === 'l/100l' || u === 'l/100 l') return { qtd: d * v / 100, base: 'L' };
    if (u === 'kg/100l' || u === 'kg/100 l') return { qtd: d * v / 100, base: 'kg' };
    if (u === '%' || u === '% v/v') return { qtd: d / 100 * v, base: 'L' };
    return { qtd: d, base: u.includes('kg') || u.includes('g') ? 'kg' : 'L' };
  }

  // ── Regras de pares (tags) ──
  function temTag(item, tag) {
    if (tag.startsWith('classe:')) return item.classe === tag.slice(7);
    if (tag.startsWith('form:')) return item.formulacao === tag.slice(5);
    if (tag.startsWith('!')) return !temTag(item, tag.slice(1));
    return (item.tags || []).includes(tag);
  }
  function casa(item, cond) { // cond: string tag ou array (todas obrigatórias)
    return Array.isArray(cond) ? cond.every(c => temTag(item, c)) : temTag(item, cond);
  }

  function regrasDePares(itens, opts, alertas) {
    for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) {
      const A = itens[i], B = itens[j];
      KB.regrasPares.forEach(r => {
        let hit = null;
        if (casa(A, r.a) && casa(B, r.b)) hit = [A, B];
        else if (casa(A, r.b) && casa(B, r.a)) hit = [B, A];
        if (!hit) return;
        if (r.cultura && norm(opts.cultura || '') && !r.cultura.map(norm).includes(norm(opts.cultura))) return;
        if (r.volumeMax && (+opts.volumeHa || 0) > r.volumeMax) return;
        alertas.push({
          tipo: r.tipo, severidade: r.sev, titulo: r.titulo, detalhe: r.detalhe, conduta: r.conduta,
          produtos: [hit[0].id, hit[1].id], nomes: [hit[0].nome, hit[1].nome], confianca: r.c, fonte: r.fonte, regra: r.id
        });
      });
    }
  }

  // Agrupa alertas de pares gerados pela mesma regra (evita 3× "salino × SC")
  function mesclarPorRegra(alertas) {
    const out = [], porRegra = {};
    alertas.forEach(a => {
      if (!a.regra) { out.push(a); return; }
      if (!porRegra[a.regra]) { porRegra[a.regra] = Object.assign({}, a, { pares: [a.produtos.slice()], nomesPares: [a.nomes.slice()] }); out.push(porRegra[a.regra]); return; }
      const b = porRegra[a.regra];
      b.pares.push(a.produtos.slice()); b.nomesPares.push(a.nomes.slice()); b.produtos = uniq(b.produtos.concat(a.produtos));
    });
    out.forEach(a => { if (a.nomesPares) { a.paresTexto = a.nomesPares.map(p => p.join(' × ')).join('; '); a.nomes = a.nomesPares.length === 1 ? a.nomesPares[0] : null; } });
    return out;
  }

  // ── pH ──
  function analisarPH(itens, opts, alertas) {
    const comFaixa = itens.filter(it => it.ph);
    const res = { alvoMin: null, alvoMax: null, faixaVazia: false, aguaPh: opts.agua && opts.agua.ph != null ? +opts.agua.ph : null, precisaCorrigir: false, direcao: null, sugestao: null, itensSensiveis: [] };
    if (!comFaixa.length) return res;
    res.alvoMin = Math.max(...comFaixa.map(i => i.ph[0]));
    res.alvoMax = Math.min(...comFaixa.map(i => i.ph[1]));
    res.itensSensiveis = comFaixa.map(i => ({ id: i.id, nome: i.nome, ph: i.ph }));
    if (res.alvoMin > res.alvoMax) {
      res.faixaVazia = true;
      const baixos = comFaixa.filter(i => i.ph[1] < res.alvoMin), altos = comFaixa.filter(i => i.ph[0] > res.alvoMax);
      alertas.push({ tipo: 'ph', severidade: 'alta', titulo: 'Sem faixa de pH comum', detalhe: `Produtos exigem faixas de pH que não se cruzam: ${baixos.map(i => `${i.nome} (${i.ph.join('–')})`).join(', ')} × ${altos.map(i => `${i.nome} (${i.ph.join('–')})`).join(', ')}.`, conduta: 'Aplicar em passadas separadas ou substituir um dos produtos.', produtos: comFaixa.map(i => i.id), confianca: 0.8, fonte: 'Faixas de estabilidade por grupo químico (kb.js)' });
      return res;
    }
    if (res.alvoMax - res.alvoMin < 0.5) alertas.push({ tipo: 'ph', severidade: 'media', titulo: 'Faixa de pH estreita', detalhe: `A faixa comum é ${res.alvoMin.toFixed(1)}–${res.alvoMax.toFixed(1)}. Erro de ajuste compromete algum produto.`, conduta: 'Ajustar com acidificante em doses pequenas, medindo a cada adição; jar test obrigatório.', produtos: comFaixa.map(i => i.id), confianca: 0.75, fonte: 'kb.js' });
    if (res.aguaPh == null) {
      alertas.push({ tipo: 'agua', severidade: 'baixa', titulo: 'pH da água não informado', detalhe: `Alvo da calda: pH ${res.alvoMin.toFixed(1)}–${res.alvoMax.toFixed(1)}. Sem medir não há como saber se precisa corrigir.`, conduta: 'Medir pH da água da fonte (fita ou pHmetro) antes do preparo.', produtos: [], confianca: 0.9, fonte: 'Embrapa Doc. 437 — qualidade da água' });
    } else if (res.aguaPh > res.alvoMax) {
      res.precisaCorrigir = true; res.direcao = 'reduzir';
      const jaTem = itens.find(i => temTag(i, 'acidificante'));
      const sens = comFaixa.filter(i => i.ph[1] < res.aguaPh).map(i => i.nome);
      res.sugestao = jaTem ? `A calda já contém ${jaTem.nome} (acidificante): medir pH após sua adição e completar se necessário.` : `Adicionar acidificante no passo 3 (ex.: ${KB.condicionadoresSugeridos.reduzir.join(' ou ')}), medindo até atingir ${res.alvoMin.toFixed(1)}–${res.alvoMax.toFixed(1)}.`;
      alertas.push({ tipo: 'ph', severidade: sens.length && !jaTem ? 'media' : 'baixa', titulo: `Água pH ${res.aguaPh} acima do alvo (${res.alvoMin.toFixed(1)}–${res.alvoMax.toFixed(1)})`, detalhe: (sens.length ? `Sensíveis à hidrólise/precipitação em pH alto: ${sens.join(', ')}.` : 'Nenhum produto crítico, mas convém ajustar.') + (jaTem ? ' A calda já prevê acidificante: a correção está planejada, falta confirmar com medição.' : ''), conduta: res.sugestao, produtos: comFaixa.filter(i => i.ph[1] < res.aguaPh).map(i => i.id), confianca: 0.85, fonte: 'kb.js; Embrapa Doc. 437' });
    } else if (res.aguaPh < res.alvoMin) {
      res.precisaCorrigir = true; res.direcao = 'elevar';
      const sens = comFaixa.filter(i => i.ph[0] > res.aguaPh).map(i => i.nome);
      res.sugestao = 'Não acidificar. Usar água de outra fonte ou tamponante alcalino conforme bula; para cúpricos e sulfonilureias, pH baixo é o problema.';
      alertas.push({ tipo: 'ph', severidade: 'media', titulo: `Água pH ${res.aguaPh} abaixo do alvo (${res.alvoMin.toFixed(1)}–${res.alvoMax.toFixed(1)})`, detalhe: `Sensíveis a pH baixo: ${sens.join(', ')}.`, conduta: res.sugestao, produtos: comFaixa.filter(i => i.ph[0] > res.aguaPh).map(i => i.id), confianca: 0.8, fonte: 'kb.js' });
    }
    return res;
  }

  // ── Água: dureza e turbidez ──
  function analisarAgua(itens, opts, alertas) {
    const agua = opts.agua || {};
    const sens = itens.filter(i => temTag(i, 'sensivel-cations'));
    if (agua.dureza == null) {
      if (sens.length) alertas.push({ tipo: 'agua', severidade: 'baixa', titulo: 'Dureza da água não informada', detalhe: `Sensíveis a Ca/Mg/Fe da água: ${sens.map(i => i.nome).join(', ')}.`, conduta: 'Medir dureza (mg/L CaCO₃). Acima de ~150 mg/L usar sequestrante ou sulfato de amônio antes dos produtos.', produtos: sens.map(i => i.id), confianca: 0.85, fonte: 'Embrapa Doc. 437 — incompatibilidade química (água dura)' });
    } else if (+agua.dureza > 150 && sens.length) {
      const temSeq = itens.some(i => temTag(i, 'sequestrante') || temTag(i, 'ams'));
      alertas.push({ tipo: 'agua', severidade: +agua.dureza > 400 ? 'alta' : 'media', titulo: `Água dura (${agua.dureza} mg/L CaCO₃)`, detalhe: `Cátions da água reduzem a eficácia de: ${sens.map(i => i.nome).join(', ')}.`, conduta: temSeq ? 'A calda já contém sequestrante/AMS — adicioná-lo primeiro (passo 3).' : `Adicionar ${KB.condicionadoresSugeridos.sequestrar.join(' ou ')} no passo 3, antes dos produtos.`, produtos: sens.map(i => i.id), confianca: 0.85, fonte: 'Embrapa Doc. 437; literatura glifosato × água dura' });
    }
    if (agua.turbidez === 'turva') {
      const cat = itens.filter(i => temTag(i, 'cationico'));
      alertas.push({ tipo: 'agua', severidade: cat.length ? 'alta' : 'baixa', titulo: 'Água turva (argila / matéria orgânica)', detalhe: cat.length ? `${cat.map(i => i.nome).join(', ')} é adsorvido pela argila e inativado.` : 'Partículas entopem filtros e podem inativar ativos.', conduta: 'Usar água limpa/decantada; filtrar no abastecimento.', produtos: cat.map(i => i.id), confianca: 0.9, fonte: 'Embrapa Doc. 437 — qualidade da água' });
    }
  }

  // ── Regras de conjunto (número de produtos, formulações, volume, MoA, biológicos) ──
  function regrasDeConjunto(itens, opts, alertas) {
    const n = itens.length;
    const vol = +opts.volumeHa || 0;
    if (n >= 4) alertas.push({ tipo: 'fisica', severidade: 'media', titulo: `${n} produtos na mesma calda`, detalhe: 'Com três ou mais produtos a Embrapa recomenda maior diluição e teste prévio; cada produto extra multiplica interações.', conduta: 'Jar test obrigatório na proporção real; considerar dividir em duas aplicações.', produtos: itens.map(i => i.id), confianca: 0.9, fonte: 'Embrapa Doc. 437 — taxa de aplicação' });
    const ecs = itens.filter(i => i.passo === 8);
    if (ecs.length >= 2) alertas.push({ tipo: 'agronomica', severidade: 'media', titulo: `${ecs.length} formulações emulsionáveis/oleosas`, detalhe: `Carga de solvente e óleo somada (${ecs.map(i => i.nome).join(', ')}) eleva risco de fitotoxicidade em calor e estresse hídrico.`, conduta: 'Aplicar com T < 28 °C e UR > 55 %; evitar adjuvante oleoso extra.', produtos: ecs.map(i => i.id), confianca: 0.65, fonte: 'Prática agronômica; bulas de EC' });
    const wp = itens.filter(i => i.passo === 4);
    if (wp.length && ecs.length) alertas.push({ tipo: 'fisica', severidade: 'baixa', titulo: 'Pó molhável + emulsionável: ordem crítica', detalhe: 'EC adicionado antes do WP forma pasta insolúvel no topo do tanque.', conduta: 'Seguir a ordem de adição: WP pré-diluído antes, EC por último entre os defensivos.', produtos: [...wp, ...ecs].map(i => i.id), confianca: 0.95, fonte: 'Embrapa Doc. 437 — incompatibilidade física' });
    const semForm = itens.filter(i => !PASSO_FORMULACAO[i.formulacao] && i.classe !== 'Adjuvante' && i.classe !== 'Fertilizante Foliar' && !temTag(i, 'condicionador'));
    if (semForm.length) alertas.push({ tipo: 'operacional', severidade: 'baixa', titulo: 'Formulação não informada', detalhe: `Sem o tipo de formulação (SC, EC, WG…) a ordem de adição de ${semForm.map(i => i.nome).join(', ')} é estimada.`, conduta: 'Informar a formulação (está no rótulo) para ordem exata.', produtos: semForm.map(i => i.id), confianca: 1, fonte: '—' });
    const desconhecidos = itens.filter(i => !i.conhecido);
    if (desconhecidos.length) alertas.push({ tipo: 'operacional', severidade: 'media', titulo: 'Produto sem ingrediente ativo reconhecido', detalhe: `${desconhecidos.map(i => i.nome).join(', ')}: a base de conhecimento não identificou o ativo; a análise química fica incompleta.`, conduta: 'Selecionar o produto pelo Agrofit ou informar o ingrediente ativo; jar test obrigatório.', produtos: desconhecidos.map(i => i.id), confianca: 1, fonte: '—' });
    // concentração total na calda
    if (vol > 0) {
      const conc = itens.reduce((s, i) => s + dosePorHa(i, vol).qtd, 0) / vol * 100; // % p/v ou v/v aproximado
      if (conc > 3) alertas.push({ tipo: 'fisica', severidade: conc > 6 ? 'alta' : 'media', titulo: `Calda concentrada (~${conc.toFixed(1)} % de produto)`, detalhe: `Volume de ${vol} L/ha com esta soma de doses aproxima os produtos do limite de solubilidade/emulsão.`, conduta: 'Aumentar volume de calda ou dividir a mistura; jar test na concentração real, não em 100 L/ha.', produtos: itens.map(i => i.id), confianca: 0.7, fonte: 'Embrapa Doc. 437 — taxa de aplicação' });
      if (vol < 50 && n >= 2) alertas.push({ tipo: 'operacional', severidade: 'media', titulo: 'Baixo volume (drone/UBV)', detalhe: `Com ${vol} L/ha o erro de diluição se propaga em toda a área e a concentração é ${(100 / Math.max(vol, 1)).toFixed(0)}× maior que a 100 L/ha.`, conduta: 'Confirmar modelo do drone, restrição UBV no rótulo e fazer jar test na proporção real.', produtos: itens.map(i => i.id), confianca: 0.85, fonte: 'Protocolo da fazenda (drone); Embrapa Doc. 437' });
    }
    // MoA repetido
    const porMoa = {};
    itens.forEach(i => i.moa.forEach(m => (porMoa[m] = porMoa[m] || []).push(i)));
    Object.entries(porMoa).forEach(([m, lst]) => {
      const ids = uniq(lst.map(i => i.id));
      if (ids.length >= 2) alertas.push({ tipo: 'resistencia', severidade: 'media', titulo: `Mesmo modo de ação repetido (${m})`, detalhe: `${lst.map(i => i.nome).join(' + ')} atuam no mesmo sítio: não amplia espectro e acelera seleção de resistência.`, conduta: 'Substituir um deles por outro grupo (FRAC/IRAC/HRAC) — de preferência multissítio.', produtos: ids, confianca: 0.9, fonte: 'FRAC-BR / IRAC-BR / HRAC-BR' });
    });
    const fung = itens.filter(i => i.classe === 'Fungicida' && !temTag(i, 'biologico'));
    if (fung.length && !fung.some(i => temTag(i, 'multissitio'))) alertas.push({ tipo: 'resistencia', severidade: 'info', titulo: 'Fungicida sem parceiro multissítio', detalhe: 'Só sítio-específicos na calda (triazol, estrobilurina, SDHI).', conduta: 'Avaliar adicionar multissítio (mancozebe, clorotalonil ou cúprico) conforme registro na cultura — recomendação FRAC-BR.', produtos: fung.map(i => i.id), confianca: 0.8, fonte: 'FRAC-BR' });
    const tri = itens.some(i => temTag(i, 'triazol')), est = itens.some(i => temTag(i, 'estrobilurina'));
    if (tri && est) alertas.push({ tipo: 'agronomica', severidade: 'info', titulo: 'Triazol + estrobilurina', detalhe: 'Associação clássica, complementar (curativo + protetor).', conduta: 'Manter pH 5,5–6,5.', produtos: itens.filter(i => temTag(i, 'triazol') || temTag(i, 'estrobilurina')).map(i => i.id), confianca: 0.9, fonte: 'Protocolo da fazenda' });
    // biológicos — orientação geral
    const bio = itens.filter(i => temTag(i, 'biologico'));
    if (bio.length && n > 1) alertas.push({ tipo: 'biologica', severidade: 'info', titulo: 'Biológico na calda', detalhe: `${bio.map(i => i.nome).join(', ')}: organismo vivo — preparar por último, aplicar em até 4–6 h, sem cloro na água, fim de tarde.`, conduta: 'Consultar tabela de efeitos colaterais do fabricante (Koppert/Biobest) para cada parceiro.', produtos: bio.map(i => i.id), confianca: 0.85, fonte: 'Koppert Side Effects; Biobest Side Effects manual' });
  }


  // ── Alvos: doenças · insetos · ácaros e outras pragas · plantas daninhas ──
  const CATEGORIAS_ALVO = [
    { id: 'doenca', nome: 'Doenças', icone: '🍂', dica: 'fungos, bactérias e vírus' },
    { id: 'inseto', nome: 'Insetos', icone: '🐛', dica: 'lagartas, percevejos, pulgões, cigarrinhas, besouros…' },
    { id: 'praga', nome: 'Ácaros e outras pragas', icone: '🕷️', dica: 'ácaros, nematoides, lesmas e caracóis' },
    { id: 'daninha', nome: 'Plantas daninhas', icone: '🌿', dica: 'folhas largas, gramíneas e ciperáceas' }
  ];
  const ROTULO_CATEGORIA = Object.fromEntries(CATEGORIAS_ALVO.map(c => [c.id, c.nome]));
  const RE_PRAGA = /\b(acaro|acaros|nematoide|nematoides|lesma|lesmas|caracol|caracois|caramujo|molusco|moluscos|tetranychus|brevipalpus|polyphagotarsonemus|steneotarsonemus|oligonychus|mononychellus|panonychus|phyllocoptruta|aculops|eriophyes|meloidogyne|pratylenchus|heterodera|globodera|rotylenchulus|helicotylenchus|tylenchulus|radopholus|xiphinema|aphelenchoides|belonolaimus|nacobbus)\b/;
  const RE_DOENCA = /\b(ferrugem|mancha|oidio|antracnose|mofo|podridao|murcha|requeima|mildio|cercosporiose|helmintosporiose|brusone|giberela|septoriose|carvao|escaldadura|gomose|verrugose|cancro|greening|hlb|leprose|mosaico|crestamento|ramularia|ramulose|rizoctoniose|damping|tombamento|sarna|pinta preta|fusarium|phytophthora|sclerotinia|colletotrichum)\b/;
  const RE_INSETO = /\b(coro|coros|bicho|lagarta|lagartas|percevejo|percevejos|pulgao|pulgoes|cigarrinha|cigarra|broca|mosca|moscas|trips|tripes|besouro|besourinho|gorgulho|caruncho|cochonilha|cupim|cupins|formiga|formigas|larva|vaquinha|curuquere|bicudo|mariposa|traca|psilideo|mosquito|barata|saltao)\b/;
  const RE_DANINHA = /\b(capim|buva|corda-de-viola|trapoeraba|picao|caruru|bredo|guanxuma|leiteiro|amendoim-bravo|mamona|erva|braquiaria|tiririca)\b/;
  /* classe do produto do AGROFIT → categorias de alvo que ele ataca */
  function categoriasDaClasse(cl) {
    const c = norm(cl), out = [];
    if (/herbicida/.test(c)) out.push('daninha');
    if (/fungicida|bactericida/.test(c)) out.push('doenca');
    if (/inseticida|formicida|cupinicida|feromonio|semioquimico|agente biologico/.test(c)) out.push('inseto');
    if (/acaricida|nematicida|moluscicida/.test(c)) out.push('praga');
    return out;
  }
  /* classe do produto na calda → categorias de alvo que ele pode atacar */
  const CLASSE_PARA_CATEGORIAS = { Herbicida: ['daninha'], Fungicida: ['doenca'], 'Cúprico': ['doenca'], Inseticida: ['inseto', 'praga'], Acaricida: ['praga', 'inseto'], Nematicida: ['praga'] };
  function categoriaPorNome(nome) {
    const n = norm(nome);
    if (RE_PRAGA.test(n)) return 'praga';
    if (RE_DOENCA.test(n)) return 'doenca';
    if (RE_DANINHA.test(n)) return 'daninha';
    return null;
  }
  // tira o número de desambiguação do AGROFIT e o "-" de quem só tem nome científico
  const limparAlvo = s => String(s || '').replace(/\s*\(\d+\)/g, '').replace(/^\s*-\s*(?=\()/, '').replace(/^\(([^()]+)\)$/, '$1').replace(/\s+/g, ' ').trim();
  const latimDe = s => { const m = /\(([^()]*)\)\s*$/.exec(String(s || '')); return m ? norm(m[1]) : ''; };
  const baseDe = s => norm(limparAlvo(s).replace(/\s*\([^()]*\)\s*$/, ''));
  const ehSpp = x => /\bspp?\b\.?/.test(x);
  /* categoria de cada alvo do índice: o nome decide quando é inequívoco (ácaro, nematoide);
     herbicida decide daninha; senão vale a maioria das classes dos produtos registrados para ele */
  function classificarAlvos(agro) {
    const votos = agro.alvos.map(() => ({ doenca: 0, inseto: 0, praga: 0, daninha: 0 }));
    agro.produtos.forEach(p => {
      const cats = categoriasDaClasse(p.cl || '');
      if (!cats.length) return;
      Object.values(p.a || {}).forEach(arr => arr.forEach(i => cats.forEach(c => { votos[i][c]++; })));
    });
    return agro.alvos.map((nome, i) => {
      const v = votos[i], porNome = categoriaPorNome(nome);
      const melhor = Object.keys(v).sort((a, b) => v[b] - v[a])[0];
      if (porNome === 'praga') return 'praga';
      if (RE_INSETO.test(norm(nome)) && v.inseto > 0 && v.inseto >= v.daninha) return 'inseto';
      if (v.daninha > 0 && v.daninha >= v.doenca + v.inseto + v.praga) return 'daninha';
      if (porNome) return porNome;
      return v[melhor] > 0 ? melhor : 'inseto';
    });
  }
  /* Nome científico como chave de alvo: "var./pv./f. sp." é só marcação (o MAPA escreve com e sem), e os sinônimos
     abaixo são o mesmo organismo com nome antigo e novo. Variedades diferentes NÃO se juntam (var. sojae ≠ var. meridionalis). */
  const SINONIMOS_LATIM = {
    'colletotrichum truncatum': 'colletotrichum dematium truncata',
    'pseudomonas savastanoi glycinea': 'pseudomonas syringae glycinea',
    'microsphaera diffusa': 'erysiphe diffusa',
    'phomopsis sojae': 'diaporthe phaseolorum sojae'
  };
  const chaveLatim = lat => { const k = lat.replace(/\b(?:var|pv|f\.? ?sp|subsp)\.?\s+/g, '').replace(/\s+/g, ' ').trim(); return SINONIMOS_LATIM[k] || k; };
  /* lista sem repetição (mesmo binômio latino ou mesmo nome) por categoria, para uma cultura:
     as curadas do kb.js primeiro, depois tudo o que o AGROFIT registra para a cultura */
  function alvosDaCultura(agro, catAlvo, cultura, curadas) {
    const out = { doenca: [], inseto: [], praga: [], daninha: [] }, visto = new Map();
    const add = (cat, nome) => {
      const limpo = limparAlvo(nome), lat = latimDe(limpo), chave = lat && !ehSpp(lat) ? chaveLatim(lat) : baseDe(limpo);
      if (!chave) return;
      const k = cat + '|' + chave;
      if (visto.has(k)) { // mesmo alvo com a grafia diferente: fica a que começa com maiúscula (a do AGROFIT vem às vezes em minúscula)
        const i = visto.get(k); if (!/^[A-ZÀ-Ú]/.test(out[cat][i]) && /^[A-ZÀ-Ú]/.test(limpo)) out[cat][i] = limpo;
        return;
      }
      visto.set(k, out[cat].length); out[cat].push(limpo);
    };
    const c = curadas || {};
    (c.doencas || []).forEach(n => add(categoriaPorNome(n) === 'praga' ? 'praga' : 'doenca', n));
    (c.pragas || []).forEach(n => add(categoriaPorNome(n) === 'praga' ? 'praga' : 'inseto', n));
    (c.daninhas || []).forEach(n => add('daninha', n));
    const ci = agro ? agro.culturas.findIndex(x => norm(x) === norm(cultura)) : -1;
    if (ci >= 0) {
      const usados = new Set();
      agro.produtos.forEach(p => (p.a[ci] || []).forEach(i => usados.add(i)));
      [...usados].map(i => ({ nome: agro.alvos[i], cat: catAlvo[i] })).sort((a, b) => limparAlvo(a.nome).localeCompare(limparAlvo(b.nome), 'pt')).forEach(x => add(x.cat, x.nome));
    }
    Object.keys(out).forEach(k => out[k].sort((a, b) => a.localeCompare(b, 'pt')));
    return out;
  }
  /* lista plana [{cat, nome}] dos alvos do contexto; aceita o formato novo (opts.alvos) e o antigo (alvo/doenca/praga) */
  function alvosLista(opts) {
    const o = opts || {}, out = [];
    const quebra = s => String(s || '').split(/;\s*/).map(x => x.trim()).filter(Boolean);
    if (o.alvos && typeof o.alvos === 'object') {
      CATEGORIAS_ALVO.forEach(c => (o.alvos[c.id] || []).forEach(n => { if (String(n).trim()) out.push({ cat: c.id, nome: String(n).trim() }); }));
      return out;
    }
    quebra(o.alvo).forEach(n => out.push({ cat: categoriaPorNome(n) || null, nome: n }));
    quebra(o.doenca).forEach(n => out.push({ cat: 'doenca', nome: n }));
    quebra(o.praga).forEach(n => out.push({ cat: categoriaPorNome(n) === 'praga' ? 'praga' : 'inseto', nome: n }));
    return out;
  }
  /* o alvo escolhido é o alvo da bula? compara o binômio latino, o nome popular e, por último, o texto */
  function alvoCombina(sel, agro) {
    const ls = latimDe(sel), la = latimDe(agro), bs = baseDe(sel), ba = baseDe(agro);
    if (ls && la) {
      const g = x => x.split(' ')[0];
      if (ls === la || (g(ls) === g(la) && (ehSpp(ls) || ehSpp(la)))) return true;
    }
    if (bs && ba && (bs === ba || (bs.length >= 4 && ba.includes(bs)) || (ba.length >= 4 && bs.includes(ba)))) return true;
    const n = norm(agro), a = norm(sel);
    return n.includes(a) || a.includes(n.split(' (')[0]);
  }

  // ── Registro (Agrofit) ──
  function analisarRegistro(itens, opts, alertas) {
    const cultura = opts.cultura ? norm(opts.cultura) : '';
    const alvosSel = alvosLista(opts);
    return itens.map(it => {
      const r = it.registro; // {culturas:[...], alvos:{Cultura:[...]}} preenchido pelo app a partir do Agrofit
      const isAgro = ['Herbicida', 'Fungicida', 'Inseticida', 'Acaricida', 'Nematicida', 'Bioracional', 'Cúprico'].includes(it.classe) || temTag(it, 'biologico');
      if (!r) {
        if (isAgro) alertas.push({ tipo: 'legal', severidade: 'baixa', titulo: `Registro não verificado: ${it.nome}`, detalhe: 'Produto não vinculado ao Agrofit.', conduta: 'Selecionar pelo Agrofit para confirmar registro na cultura e alvo (IN 40/2018: receituário deve seguir a bula).', produtos: [it.id], confianca: 1, fonte: 'MAPA — IN 40/2018' });
        return { id: it.id, nome: it.nome, registrado: null, culturas: [], alvos: [] };
      }
      const cults = (r.culturas || []).map(norm);
      const ok = !cultura || cults.includes(cultura) || cults.includes('todas as culturas');
      const alvos = (r.alvos && (r.alvos[opts.cultura] || [])) || [];
      let alvoOk = null;
      const catsProd = CLASSE_PARA_CATEGORIAS[it.classe];
      // só conta o alvo da categoria que a classe do produto ataca (herbicida × daninha, fungicida × doença…)
      const alvosConf = alvosSel.filter(s => !catsProd || !s.cat || catsProd.includes(s.cat));
      if (ok && cultura && alvosConf.length && alvos.length) alvoOk = alvosConf.some(s => alvos.some(a => alvoCombina(s.nome, a)));
      if (!ok) alertas.push({ tipo: 'legal', severidade: 'alta', titulo: `${it.nome} sem registro para ${opts.cultura}`, detalhe: `Culturas registradas: ${(r.culturas || []).slice(0, 8).join(', ')}${(r.culturas || []).length > 8 ? '…' : ''}.`, conduta: 'Uso fora da bula é infração e responsabilidade do RT. Substituir por produto registrado na cultura.', produtos: [it.id], confianca: 0.95, fonte: 'AGROFIT/MAPA; IN 40/2018' });
      else if (alvoOk === false) alertas.push({ tipo: 'legal', severidade: 'media', titulo: `${it.nome}: alvo "${alvosConf.map(s => s.nome).join('; ')}" não consta na bula para ${opts.cultura}`, detalhe: `Alvos registrados: ${alvos.slice(0, 6).join('; ')}${alvos.length > 6 ? '…' : ''}.`, conduta: 'Conferir nome do alvo ou escolher produto com o alvo registrado.', produtos: [it.id], confianca: 0.8, fonte: 'AGROFIT/MAPA' });
      return { id: it.id, nome: it.nome, registrado: ok, alvoOk, culturas: r.culturas || [], alvos };
    });
  }

  // ── Ordem de adição ──
  function ordemDeAdicao(itens, opts) {
    const regra = opts.regraFazenda || {};
    const passos = {};
    itens.forEach(it => {
      let p = it.passo;
      const notas = [];
      if (regra.acidificanteUltimo && temTag(it, 'acidificante')) { p = 9; notas.push('Regra da fazenda: acidificante por último (diverge da Embrapa, que o coloca no passo 3).'); }
      if (temTag(it, 'acidificante') && temTag(it, 'surfactante') && !regra.acidificanteUltimo) notas.push('Dupla função (acidificante + espalhante): entra no passo 3 se o objetivo é corrigir pH; se a bula mandar por último, mover para o passo 9.');
      if (temTag(it, 'biologico')) notas.push('Biológico: adicionar por último dentro do seu passo e aplicar logo.');
      if (!PASSO_FORMULACAO[it.formulacao] && p >= 4 && p <= 8) notas.push('Formulação não informada — passo estimado.');
      if (it.passo === 4 || it.passo === 5) notas.push('Pré-diluir em balde com água antes de despejar.');
      if (it.materiaPrima) notas.push('Matéria-prima: ' + it.materiaPrima + '.');
      (passos[p] = passos[p] || []).push({ id: it.id, nome: it.nome, formulacao: it.formulacao, notas });
    });
    const seq = [];
    for (let p = 1; p <= 11; p++) seq.push({ passo: p, ...PASSOS[p], itens: passos[p] || [] });
    seq.push({ passo: 12, titulo: 'Medir pH final e fazer inspeção visual', nota: 'Registrar o pH medido; se houver grumos/espuma/separação, não aplicar.', itens: [] });
    return seq;
  }

  // ── Jar test ──
  function jarTest(itens, opts, status) {
    const vol = +opts.volumeHa || 100;
    const proporcao = itens.map(it => {
      const d = dosePorHa(it, vol);
      const porLitro = d.qtd / vol * 1000; // mL ou g por litro de calda
      return { id: it.id, nome: it.nome, porLitro: round(porLitro, 2), unidade: d.base === 'L' ? 'mL/L' : 'g/L', passo: it.passo };
    }).sort((a, b) => a.passo - b.passo);
    const historico = (opts.historicoJar || []).filter(h => h.chave === chaveDoConjunto(itens));
    return {
      obrigatorio: status !== 'compativel',
      volumeReferencia: 1,
      proporcao,
      passos: [
        'Recipiente transparente com tampa, 1 L (volumes menores escondem incompatibilidades).',
        'Colocar 2/3 de água da MESMA fonte usada no tanque; medir pH.',
        'Adicionar condicionadores (acidificante/sequestrante), depois cada produto na ordem de adição, agitando entre adições.',
        'Completar 1 L, tampar e agitar bem.',
        'Ler aos 0, 15 e 30 min; repouso final de 2 h (Embrapa). Para laudo formal: 0, 2, 6 e 24 h (NBR 13875).',
        'Observar: floculação, decantação, separação de fases/óleo, cristais, grumos, pasta, espuma excessiva, mudança de cor, aquecimento.',
        'Se houver incompatibilidade: trocar a ordem e repetir; persistindo, não misturar.'
      ],
      leituras: [0, 15, 30, 120],
      historico
    };
  }
  function chaveDoConjunto(itens) { return itens.map(i => norm(i.nome)).sort().join(' | '); }

  // ── Custo ──
  function custo(itens, opts) {
    const vol = +opts.volumeHa || 100, area = +opts.area || 0;
    const custosOp = Object.assign({ barra: 60, turbo: 90, drone: 120, costal: 40, aviao: 110, 'herbicida-cafe': 55 }, opts.custoOperacional || {});
    const porItem = itens.map(it => {
      const d = dosePorHa(it, vol);
      const preco = +it.preco || 0;
      return { id: it.id, nome: it.nome, dosePorHa: round(d.qtd, 4), base: d.base, preco, custoHa: round(d.qtd * preco, 2), semPreco: !preco };
    });
    const produtosHa = round(porItem.reduce((s, i) => s + i.custoHa, 0), 2);
    const operacionalHa = +custosOp[opts.equipamento || 'barra'] || 0;
    return { porItem, produtosHa, operacionalHa, totalHa: round(produtosHa + operacionalHa, 2), totalArea: round((produtosHa + operacionalHa) * area, 2), area, semPreco: porItem.filter(i => i.semPreco).map(i => i.nome) };
  }

  // ── Ficha de tanque ──
  function fichaTanque(itens, opts) {
    const vol = +opts.volumeHa || 100, area = +opts.area || 0, tanque = +opts.tanque || 0;
    if (!tanque || !area) return null;
    const total = area * vol, cargasCheias = Math.floor(total / tanque), resto = round(total - cargasCheias * tanque, 1);
    const haPorCarga = tanque / vol;
    const linha = (fator) => itens.map(it => { const d = dosePorHa(it, vol); return { id: it.id, nome: it.nome, qtd: round(d.qtd * fator, 3), unidade: d.base, passo: it.passo }; }).sort((a, b) => a.passo - b.passo);
    return { volumeTotal: round(total, 1), tanque, cargasCheias, ultimaCarga: resto, haPorCarga: round(haPorCarga, 2), porCargaCheia: linha(haPorCarga), ultimaCargaItens: resto ? linha(resto / vol) : [], totalPorProduto: linha(area) };
  }

  // ── Checklist pré-saída ──
  function checklist(res, opts) {
    const c = [];
    if (res.ph.alvoMin != null) c.push(`pH da água medido e ajustado para ${res.ph.alvoMin.toFixed(1)}–${res.ph.alvoMax.toFixed(1)} (produto mais sensível: ${res.ph.itensSensiveis.slice().sort((a, b) => a.ph[1] - b.ph[1])[0].nome})`);
    else c.push('pH da água medido');
    c.push('Ordem de adição seguida (condicionador → WP → WG/SG → SC → SL → EC → adjuvantes → foliares)');
    if (res.jarTest.obrigatorio) c.push('Jar test realizado na proporção real e sem precipitado/espuma/separação');
    c.push('Dose por hectare conferida (não só dose/100 L)');
    c.push(`Volume de calda ${opts.volumeHa || '?'} L/ha adequado ao equipamento (${opts.equipamento || 'não informado'})`);
    const alvosCtx = alvosLista(opts);
    if (alvosCtx.length) c.push(`Alvo confirmado no talhão${opts.severidade ? ' (' + opts.severidade + ')' : ''}: ${alvosCtx.map(s => s.nome).join(' + ')} — produto registrado para esse alvo`);
    if (opts.parte) c.push(`Alvo está em "${opts.parte}": ponta, volume e classe de gota escolhidos para atingir essa parte`);
    if (opts.estadio) c.push(`Estádio "${opts.estadio}": carência, fitotoxidez e janela de aplicação conferidas para esse momento da cultura`);
    c.push('Bulas consultadas para restrições de mistura e intervalos de segurança');
    c.push('Condições climáticas: T < 30 °C, UR > 55 %, vento 3–15 km/h (ΔT 2–8)');
    if (opts.equipamento === 'drone') c.push('Modelo do drone confirmado; restrição UBV verificada no rótulo');
    if (res.alertas.some(a => a.tipo === 'legal')) c.push('Receituário agronômico emitido com a mistura e suas incompatibilidades (IN 40/2018)');
    if (res.regulagem) {
      const g = res.regulagem;
      c.push(`Ponta ${g.ponta ? g.ponta.marca + ' ' + g.ponta.modelo + (g.iso ? ' ' + g.iso : '') : 'selecionada'} instalada em todos os bicos, sem mistura de modelos nem de desgastes`);
      c.push(`Pressão ${fmtn(g.pressao)} bar e velocidade ${fmtn(g.velocidade)} km/h conferidas no manômetro e no relógio (volume alvo ${fmtn(g.volumeDosado)} L/ha)`);
      if (g.clima && g.clima.deltaT != null) c.push(`Delta T ${fmtn(g.clima.deltaT)} e vento ${fmtn(g.clima.vento)} km/h medidos no talhão, não na sede`);
    }
    if (res.rastreio) c.push(`Talhão, operador, máquina, lotes e horário anotados no caderno de campo (laudo ${res.rastreio.codigo})`);
    c.push('Custo da aplicação calculado e registrado');
    return c;
  }

  // ── Regulagem anexada ao laudo ──
  // A dose por hectare só vale se a barra entregar o volume de calda para o qual
  // ela foi calculada. A regulagem da aba Pontas entra no laudo e é conferida
  // contra o volume da calda: o desvio entre os dois é erro de dose na lavoura.
  function conferirRegulagem(opts, alertas) {
    const g = opts.regulagem;
    if (!g) {
      alertas.push({ tipo: 'operacional', severidade: 'baixa', titulo: 'Laudo sem regulagem anexada', detalhe: 'A dose por hectare depende do volume de calda que a barra realmente entrega. Sem a regulagem, o laudo registra a receita mas não prova com que ponta, pressão e velocidade ela foi aplicada.', conduta: 'Calcular a regulagem na aba Pontas e anexá-la ao laudo antes de imprimir.', produtos: [], confianca: 1, fonte: 'ISO 10625; ASABE S572.1' });
      return null;
    }
    const vol = +opts.volumeHa || 0;
    const entregue = g.modo === 'faixa' ? +g.volumeLavoura : +g.volumeAplicado;
    const desvio = vol && entregue ? round((entregue - vol) / vol * 100, 1) : null;
    if (desvio != null && Math.abs(desvio) > 5) {
      const grave = Math.abs(desvio) > 15;
      alertas.push({
        tipo: 'operacional', severidade: grave ? 'alta' : 'media',
        titulo: `Regulagem entrega ${round(entregue, 0)} L/ha e as doses foram calculadas para ${vol} L/ha`,
        detalhe: `Desvio de ${desvio > 0 ? '+' : ''}${desvio} %${g.modo === 'faixa' ? ' (L/ha de lavoura, já descontada a fração tratada)' : ''}. O produto por hectare sai ${desvio > 0 ? 'diluído' : 'concentrado'} na mesma proporção: a calda foi montada para um volume e a barra entrega outro.`,
        conduta: desvio > 0 ? 'Baixar a pressão ou acelerar até bater o volume — ou refazer as doses para o volume real.' : 'Subir a pressão ou reduzir a velocidade — ou refazer as doses para o volume real.',
        produtos: [], confianca: 0.95, fonte: 'Calibração — q = (V × v × e) ÷ 600'
      });
    }
    (g.avisos || []).filter(a => a.nivel === 'alta' || a.nivel === 'media').forEach(a => {
      alertas.push({ tipo: 'operacional', severidade: a.nivel, titulo: a.texto, detalhe: 'Ponto levantado pela regulagem anexada a este laudo.', conduta: a.conduta, produtos: [], confianca: 0.9, fonte: 'Regulagem (aba Pontas)' });
    });
    return {
      modo: g.modo, volumeEntregue: entregue == null ? null : round(entregue, 1), volumeDosado: vol, desvio,
      ponta: g.ponta, iso: g.iso, cor: g.cor, angulo: g.angulo, gota: g.gota,
      pressao: g.pressao, pressaoCalculada: g.pressaoCalculada,
      vazaoPorBico: g.vazaoPorBico, vazaoTotal: g.vazaoTotal,
      velocidade: g.velocidade, nBicos: g.nBicos, espacamento: g.espacamento,
      larguraTrabalho: g.larguraTrabalho, larguraFaixa: g.larguraFaixa, entreLinhas: g.entreLinhas,
      fracaoTratada: g.fracaoTratada, economia: g.economia, protecao: g.protecao,
      altura: g.ehCone ? null : (g.modo === 'faixa' ? g.alturaFaixa : g.altura), ehCone: g.ehCone,
      rendimento: g.rendimento, ficha: g.ficha, clima: g.clima, formulas: g.formulas,
      avisos: g.avisos || [], nome: g.nome || null, origem: g.origem || null, calibracao: g.calibracao || null
    };
  }

  // ── Rastreabilidade ──
  // O código de conferência é um hash FNV-1a de 32 bits da versão canônica do
  // laudo. Ele casa o papel impresso com o registro em JSON: mexeu numa dose, num
  // lote, na regulagem ou no talhão, o código muda. Não é assinatura digital —
  // prova que dois registros são o mesmo, não quem os emitiu.
  const CAMPOS_RASTREIO = [
    { chave: 'talhao', rotulo: 'Talhão', exigido: true },
    { chave: 'maquina', rotulo: 'Trator / pulverizador', exigido: true },
    { chave: 'operador', rotulo: 'Operador (aplicador)', exigido: true },
    { chave: 'responsavel', rotulo: 'Responsável técnico', exigido: true },
    { chave: 'crea', rotulo: 'CREA / CFTA do RT', exigido: false },
    { chave: 'receituario', rotulo: 'Receituário agronômico nº', exigido: false },
    { chave: 'inicio', rotulo: 'Início da aplicação', exigido: true },
    { chave: 'termino', rotulo: 'Término da aplicação', exigido: false }
  ];
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function codigoDe(canonico) { return 'GC-' + hash32(String(canonico)).toString(36).toUpperCase().padStart(7, '0'); }

  function rastreio(res, opts) {
    const d = opts.rastreio || {};
    const campos = CAMPOS_RASTREIO.map(c => ({ chave: c.chave, rotulo: c.rotulo, exigido: c.exigido, valor: String(d[c.chave] == null ? '' : d[c.chave]).trim() }));
    const pendencias = campos.filter(c => c.exigido && !c.valor).map(c => c.rotulo);
    const lotes = res.itens.map(i => ({ id: i.id, nome: i.nome, lote: String(i.lote || '').trim() }));
    const semLote = lotes.filter(l => !l.lote).map(l => l.nome);
    const g = res.regulagem, a = opts.agua || {};
    const v = k => (campos.find(c => c.chave === k) || {}).valor || '';
    const linhas = [
      'gefaz-calda/' + VERSAO + (opts.kbVersao ? ' kb/' + opts.kbVersao : ''),
      'data=' + (res.data || ''),
      'fazenda=' + String(d.fazenda || '').trim(),
      'talhao=' + v('talhao'),
      'cultura=' + (opts.cultura || ''),
      'alvo=' + [...alvosLista(opts).map(s => s.nome), opts.severidade, opts.estadio, opts.parte].map(x => String(x || '').trim()).filter(Boolean).join('/'),
      'equipamento=' + (opts.equipamento || '') + ' volume=' + (opts.volumeHa || '') + ' area=' + (opts.area || '') + ' tanque=' + (opts.tanque || ''),
      'agua=' + [a.ph, a.dureza, a.turbidez, a.fonte].map(x => x == null ? '' : String(x).trim()).join('/'),
      'maquina=' + v('maquina') + ' operador=' + v('operador') + ' rt=' + v('responsavel') + '/' + v('crea') + ' receituario=' + v('receituario'),
      'janela=' + v('inicio') + '>' + v('termino'),
      ...res.itens.map(i => 'item=' + norm(i.nome) + '|' + (+i.dose || 0) + '|' + (i.unidade || '') + '|lote:' + String(i.lote || '').trim()).sort(),
      'regulagem=' + (g ? [g.ponta ? g.ponta.id : 'sem-ponta', g.iso || '', g.angulo || '', g.pressao || '', g.vazaoPorBico || '', g.velocidade || '', g.volumeEntregue || '', g.gota ? g.gota.id : ''].join('|') : 'nenhuma'),
      'clima=' + (g && g.clima && g.clima.deltaT != null ? [g.clima.temperatura, g.clima.umidade, g.clima.vento, g.clima.deltaT].join('/') : ''),
      'veredito=' + res.status
    ];
    const canonico = linhas.join('\n');
    if (pendencias.length) res.alertas.push({ tipo: 'operacional', severidade: 'baixa', titulo: 'Rastreabilidade incompleta: ' + pendencias.join(', '), detalhe: 'O caderno de campo, as certificações e a defesa do RT numa autuação pedem quem aplicou, com qual máquina, em qual talhão e quando.', conduta: 'Preencher os campos de rastreabilidade antes de imprimir o laudo.', produtos: [], confianca: 1, fonte: 'IN 40/2018; caderno de campo' });
    if (semLote.length) res.alertas.push({ tipo: 'operacional', severidade: 'baixa', titulo: 'Sem lote registrado: ' + semLote.join(', '), detalhe: 'O lote liga a embalagem ao que foi aplicado — é por ele que se faz recall, se investiga fitotoxidez e se responde a resíduo acima do LMR.', conduta: 'Anotar o lote de cada embalagem aberta no momento da mistura.', produtos: [], confianca: 1, fonte: 'Rastreabilidade de insumos' });
    return { codigo: codigoDe(canonico), canonico, campos, pendencias, completo: !pendencias.length, lotes, semLote, emitido: res.data || null, fazenda: String(d.fazenda || '').trim() };
  }

  // ── Matriz de pares ──
  function matriz(itens, alertas) {
    const pares = [];
    for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) {
      const A = itens[i], B = itens[j];
      const rel = alertas.filter(a => a.pares ? a.pares.some(p => p.includes(A.id) && p.includes(B.id)) : (a.produtos.length === 2 && a.produtos.includes(A.id) && a.produtos.includes(B.id)));
      const pior = rel.reduce((m, a) => Math.max(m, SEV[a.severidade]), -1);
      let status = 'compativel';
      if (pior === 3) status = 'incompativel'; else if (pior === 2) status = 'restricoes'; else if (pior === 1) status = 'atencao';
      else if (!A.conhecido || !B.conhecido) status = 'nao-testado';
      pares.push({ a: A.id, b: B.id, status, alertas: rel.map(a => a.titulo) });
    }
    return pares;
  }

  function statusGlobal(alertas, itens, historico) {
    const bloq = alertas.filter(a => SEV[a.severidade] === 3 && ['fisica', 'quimica', 'biologica', 'legal', 'agronomica', 'ph', 'agua'].includes(a.tipo));
    if (historico && historico.length) {
      // O app armazena os jar tests em ordem decrescente (unshift): o índice 0 é o mais recente.
      const ult = historico[0];
      if (ult.resultado === 'incompativel') return 'incompativel';
    }
    if (bloq.length) return 'incompativel';
    if (alertas.some(a => SEV[a.severidade] >= 2)) return 'restricoes';
    if (itens.some(i => !i.conhecido) || itens.length >= 3) return 'testar';
    return 'compativel';
  }

  function analisar(itensBrutos, opts) {
    opts = opts || {};
    const itens = (itensBrutos || []).map(resolverItem);
    if (!itens.length) return { status: 'vazio', itens, alertas: [], pares: [], ph: {}, ordem: [], jarTest: null, custo: null, tanque: null, checklist: [], registro: [], regulagem: null, rastreio: null, confianca: 0, score: 0 };
    const alertasPares = [];
    regrasDePares(itens, opts, alertasPares);
    const alertas = mesclarPorRegra(alertasPares);
    const ph = analisarPH(itens, opts, alertas);
    analisarAgua(itens, opts, alertas);
    regrasDeConjunto(itens, opts, alertas);
    const registro = analisarRegistro(itens, opts, alertas);
    const regulagem = conferirRegulagem(opts, alertas);
    alertas.sort((a, b) => SEV[b.severidade] - SEV[a.severidade]);
    const historico = (opts.historicoJar || []).filter(h => h.chave === chaveDoConjunto(itens));
    const status = statusGlobal(alertas, itens, historico);
    const res = { status, itens, alertas, ph, registro, regulagem, data: opts.data || null, chave: chaveDoConjunto(itens) };
    res.rastreio = rastreio(res, opts);
    res.pares = matriz(itens, alertas);
    res.ordem = ordemDeAdicao(itens, opts);
    res.jarTest = jarTest(itens, opts, status);
    res.custo = custo(itens, opts);
    res.tanque = fichaTanque(itens, opts);
    res.checklist = checklist(res, opts);
    const relevantes = alertas.filter(a => SEV[a.severidade] >= 2);
    res.confianca = round(relevantes.length ? Math.min(...relevantes.map(a => a.confianca)) : (itens.every(i => i.conhecido) ? 0.85 : 0.5), 2);
    res.score = Math.max(0, 100 - alertas.reduce((s, a) => s + ({ alta: 40, media: 15, baixa: 5, info: 0 })[a.severidade], 0));
    res.resumo = resumo(res);
    return res;
  }

  function resumo(res) {
    const n = { alta: 0, media: 0, baixa: 0, info: 0 };
    res.alertas.forEach(a => n[a.severidade]++);
    const rot = { compativel: 'Compatível', restricoes: 'Compatível com restrições', incompativel: 'Incompatível', testar: 'Não testado — fazer jar test', vazio: '—' };
    return { rotulo: rot[res.status], contagem: n, frase: `${rot[res.status]} · ${n.alta} crítico(s), ${n.media} restrição(ões), ${n.baixa} atenção · confiança ${Math.round(res.confianca * 100)} %` };
  }

  // ── Próxima aplicação permitida ──
  // A data vem do intervalo mínimo entre aplicações que o usuário informa por produto (da bula/receituário):
  // nenhum banco público usado aqui traz esse número, então sem intervalo informado não há data — e não se inventa.
  const SEM_INTERVALO = ['Adjuvante', 'Fertilizante Foliar'];
  const pad2 = n => String(n).padStart(2, '0');
  const isoDia = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  // AAAA-MM-DD puro é dia local (new Date('2026-12-25') seria UTC e recuaria um dia no Brasil)
  const diaDe = v => {
    const m = typeof v === 'string' && v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : (v instanceof Date ? v : new Date(v));
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.round(n));
  function proximaAplicacao({ itens, base, origemBase, talhoes }) {
    const b = diaDe(base); if (!b) return null;
    const linhas = [], semIntervalo = [];
    (itens || []).forEach(i => {
      const dias = +i.intervalo;
      if (dias > 0) linhas.push({ nome: i.nome, intervalo: dias, liberadoEm: isoDia(somaDias(b, dias)) });
      else if (!SEM_INTERVALO.includes(i.classe) && !(i.tags || []).includes('condicionador')) semIntervalo.push(i.nome);
    });
    linhas.sort((x, y) => (x.liberadoEm < y.liberadoEm ? 1 : x.liberadoEm > y.liberadoEm ? -1 : 0));
    // dentro do intervalo de aplicações anteriores do mesmo produto no talhão (só as marcadas como feitas)
    const conflitos = [];
    (talhoes || []).forEach(t => (itens || []).forEach(i => {
      const dias = +i.intervalo; if (!(dias > 0)) return;
      const ult = (t.aplicacoes || []).filter(a => (a.produtos || []).some(p => norm(p) === norm(i.nome)) && diaDe(a.quando))
        .sort((x, y) => diaDe(y.quando) - diaDe(x.quando))[0];
      if (!ult) return;
      const libera = somaDias(diaDe(ult.quando), dias);
      if (libera > b) conflitos.push({ talhao: t.nome, nome: i.nome, intervalo: dias, ultima: isoDia(diaDe(ult.quando)), liberadoEm: isoDia(libera), diasFaltam: Math.round((libera - b) / 864e5) });
    }));
    return { base: isoDia(b), origemBase: origemBase || 'emissao', linhas, liberadoEm: linhas.length ? linhas[0].liberadoEm : null, limitante: linhas.length ? linhas[0].nome : null, semIntervalo, conflitos };
  }

  // ── Colheita liberada (carência = dias entre a última aplicação e a colheita) ──
  // Também vem do que o usuário informa por produto (bula/receituário); 0 é um valor válido (sem carência).
  const temCarencia = c => c !== undefined && c !== null && c !== '' && isFinite(+c) && +c >= 0;
  function colheitaLiberada({ itens, base, origemBase, talhoes }) {
    const b = diaDe(base); if (!b) return null;
    const linhas = [], semCarencia = [];
    (itens || []).forEach(i => {
      if (temCarencia(i.carencia)) linhas.push({ nome: i.nome, carencia: +i.carencia, liberadoEm: isoDia(somaDias(b, +i.carencia)) });
      else if (!SEM_INTERVALO.includes(i.classe) && !(i.tags || []).includes('condicionador')) semCarencia.push(i.nome);
    });
    linhas.sort((x, y) => (x.liberadoEm < y.liberadoEm ? 1 : x.liberadoEm > y.liberadoEm ? -1 : 0));
    // por talhão: vale o que vence por último — esta aplicação ou uma anterior (marcada como feita) com carência maior
    const porTalhao = (talhoes || []).map(t => {
      const cand = linhas.map(l => ({ nome: l.nome, aplicadoEm: isoDia(b), liberadoEm: l.liberadoEm, origem: 'esta' }));
      (t.aplicacoes || []).forEach(a => { const d = diaDe(a.quando); if (!d) return;
        (a.perfis || []).forEach(p => { if (temCarencia(p.carencia)) cand.push({ nome: p.nome, aplicadoEm: isoDia(d), liberadoEm: isoDia(somaDias(d, +p.carencia)), origem: 'anterior' }); }); });
      cand.sort((x, y) => (x.liberadoEm < y.liberadoEm ? 1 : x.liberadoEm > y.liberadoEm ? -1 : 0));
      return cand.length ? { talhao: t.nome, liberadoEm: cand[0].liberadoEm, limitante: cand[0] } : { talhao: t.nome, liberadoEm: null, limitante: null };
    });
    return { base: isoDia(b), origemBase: origemBase || 'emissao', linhas, liberadoEm: linhas.length ? linhas[0].liberadoEm : null, limitante: linhas.length ? linhas[0].nome : null, semCarencia, talhoes: porTalhao };
  }

  // ── Número máximo de aplicações por ciclo ──
  // O máximo é o da bula/receituário, informado por produto. Conta as aplicações já feitas (marcadas) do mesmo
  // produto no talhão, desde o início do ciclo (ou todo o histórico, se o início não foi definido), mais esta.
  function aplicacoesNoCiclo({ itens, base, talhoes }) {
    const b = diaDe(base); if (!b) return null;
    const comMax = [], semLimite = [];
    (itens || []).forEach(i => {
      const max = Math.round(+i.maxAplic);
      if (max > 0) comMax.push({ nome: i.nome, max });
      else if (!SEM_INTERVALO.includes(i.classe) && !(i.tags || []).includes('condicionador')) semLimite.push(i.nome);
    });
    const semTalhao = !(talhoes && talhoes.length);
    const alvos = semTalhao ? [{ nome: '', aplicacoes: [] }] : talhoes;
    const linhas = [];
    alvos.forEach(t => {
      const ini = t.cicloInicio ? diaDe(t.cicloInicio) : null;
      comMax.forEach(i => {
        const feitas = (t.aplicacoes || []).filter(a => (a.produtos || []).some(p => norm(p) === norm(i.nome)) && (() => { const d = diaDe(a.quando); return d && d <= b && (!ini || d >= ini); })()).length;
        const comEsta = feitas + 1;
        linhas.push({ talhao: t.nome, nome: i.nome, max: i.max, feitas, comEsta, restantes: i.max - comEsta, cicloInicio: ini ? isoDia(ini) : null, situacao: comEsta > i.max ? 'excedido' : comEsta === i.max ? 'ultima' : 'ok' });
      });
    });
    return { base: isoDia(b), linhas, semLimite, semTalhao, excedidos: linhas.filter(l => l.situacao === 'excedido'), ultimas: linhas.filter(l => l.situacao === 'ultima') };
  }

  // ── Reentrada na área tratada (horas depois do término da aplicação, da bula/receituário) ──
  const pad = n => String(n).padStart(2, '0');
  const isoMin = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function reentradaLiberada({ itens, base, origemBase }) {
    let b = typeof base === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(base) ? diaDe(base) : (base instanceof Date ? base : new Date(base));
    if (!b || isNaN(b)) return null;
    const linhas = [], semReentrada = [];
    (itens || []).forEach(i => {
      if (temCarencia(i.reentrada)) linhas.push({ nome: i.nome, horas: +i.reentrada, liberadoEm: isoMin(new Date(b.getTime() + (+i.reentrada) * 36e5)) });
      else if (!SEM_INTERVALO.includes(i.classe) && !(i.tags || []).includes('condicionador')) semReentrada.push(i.nome);
    });
    linhas.sort((x, y) => (x.liberadoEm < y.liberadoEm ? 1 : x.liberadoEm > y.liberadoEm ? -1 : 0));
    return { base: isoMin(b), origemBase: origemBase || 'emissao', linhas, liberadoEm: linhas.length ? linhas[0].liberadoEm : null, limitante: linhas.length ? linhas[0].nome : null, semReentrada };
  }

  return { analisar, proximaAplicacao, reentradaLiberada, aplicacoesNoCiclo, colheitaLiberada, resolverItem, resolverAtivos, dosePorHa, chaveDoConjunto, PASSO_FORMULACAO, PASSOS, norm, alvosLista, alvoCombina, categoriaPorNome, classificarAlvos, alvosDaCultura, CATEGORIAS_ALVO, ROTULO_CATEGORIA, versao: VERSAO, CAMPOS_RASTREIO, codigoDe };
});
