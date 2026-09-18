/* ═══════════════════════════════════════════════════════════════════
   Gefaz Calda — pontas.js  (catálogo de pontas + motor de regulagem)
   Catálogo por família (TeeJet, Magnojet, Jacto/Albuz) com tipo de jato,
   ângulo, faixa de pressão e classe de gota; vazão pela norma ISO 10625
   (vazão nominal a 3 bar) e lei da raiz quadrada da pressão.
   Modos: área total (barra) e faixa/dirigida (herbicida no café).
   Fontes: catálogo TeeJet Brasil (broadcast_nozzles-pt.pdf), páginas de
   produto Magnojet e Jacto, ASABE S572.1 (classes de gota), Jacto PH-400
   (SBCPD) para o pulverizador de herbicida do café.
   Motor puro: sem DOM, testável com node --test.
   ═══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GCPontas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const round = (v, d = 2) => { const f = Math.pow(10, d); return Math.round((+v || 0) * f) / f; };
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  /* ───────── ISO 10625: tamanho → cor e vazão nominal a 3 bar (L/min) ───────── */
  const ISO = [
    { id: '01', vazao: 0.39, cor: 'Laranja', hex: '#f57c00', malha: 100 },
    { id: '015', vazao: 0.59, cor: 'Verde', hex: '#2e7d32', malha: 100 },
    { id: '02', vazao: 0.79, cor: 'Amarelo', hex: '#fbc02d', malha: 80 },
    { id: '025', vazao: 0.99, cor: 'Lilás', hex: '#9575cd', malha: 80 },
    { id: '03', vazao: 1.18, cor: 'Azul', hex: '#1565c0', malha: 80 },
    { id: '04', vazao: 1.58, cor: 'Vermelho', hex: '#c62828', malha: 50 },
    { id: '05', vazao: 1.98, cor: 'Marrom', hex: '#6d4c41', malha: 50 },
    { id: '06', vazao: 2.37, cor: 'Cinza', hex: '#757575', malha: 50 },
    { id: '08', vazao: 3.16, cor: 'Branco', hex: '#cfd8dc', malha: 50 },
    { id: '10', vazao: 3.95, cor: 'Azul-claro', hex: '#4fc3f7', malha: 50 },
    { id: '15', vazao: 5.92, cor: 'Verde-claro', hex: '#aed581', malha: 50 },
    { id: '20', vazao: 7.90, cor: 'Preto', hex: '#212121', malha: 50 }
  ];
  const ISO_MAP = {}; ISO.forEach(i => ISO_MAP[i.id] = i);

  /* ───────── Classes de gota (ASABE S572.1) ───────── */
  const GOTAS = [
    { id: 'MF', nome: 'Muito fina', sigla: 'VF', faixa: '61–105 µm', grau: 1, hex: '#ce93d8' },
    { id: 'F', nome: 'Fina', sigla: 'F', faixa: '106–235 µm', grau: 2, hex: '#90caf9' },
    { id: 'M', nome: 'Média', sigla: 'M', faixa: '236–340 µm', grau: 3, hex: '#a5d6a7' },
    { id: 'G', nome: 'Grossa', sigla: 'C', faixa: '341–403 µm', grau: 4, hex: '#ffe082' },
    { id: 'MG', nome: 'Muito grossa', sigla: 'VC', faixa: '404–502 µm', grau: 5, hex: '#ffcc80' },
    { id: 'EG', nome: 'Extremamente grossa', sigla: 'XC', faixa: '503–665 µm', grau: 6, hex: '#ffab91' },
    { id: 'UG', nome: 'Ultragrossa', sigla: 'UC', faixa: '> 665 µm', grau: 7, hex: '#bcaaa4' }
  ];
  const GOTA_MAP = {}; GOTAS.forEach(g => GOTA_MAP[g.id] = g);

  /* ───────── Alvo da aplicação → classe de gota e volume usuais ───────── */
  const ALVOS = [
    { id: 'herbicida-sistemico', nome: 'Herbicida sistêmico (glifosato, 2,4-D)', gotas: ['G', 'MG', 'EG'], volume: [80, 150], nota: 'Translocação dispensa cobertura fina; o risco é a deriva.' },
    { id: 'herbicida-contato', nome: 'Herbicida de contato (paraquate, glufosinato)', gotas: ['M', 'G'], volume: [150, 250], nota: 'Precisa cobrir a folha — gota média e volume maior.' },
    { id: 'pre-emergente', nome: 'Pré-emergente (alvo é o solo)', gotas: ['MG', 'EG', 'UG'], volume: [150, 250], nota: 'Alvo é o solo: gota grossa, sem perda por deriva.' },
    { id: 'dessecacao', nome: 'Dessecação', gotas: ['M', 'G', 'MG'], volume: [100, 200] },
    { id: 'herbicida-cafe', nome: 'Herbicida em faixa no café (dirigida)', gotas: ['MG', 'EG', 'UG'], volume: [150, 300], nota: 'Deriva sobre a saia do café = fitotoxidez. Gota grossa + proteção física (chapéu de Napoleão / saia protetora).' },
    { id: 'fungicida', nome: 'Fungicida', gotas: ['F', 'M'], volume: [100, 250], nota: 'Cobertura manda: gota fina a média, volume alto.' },
    { id: 'inseticida', nome: 'Inseticida / acaricida', gotas: ['F', 'M'], volume: [100, 250] },
    { id: 'foliar', nome: 'Fertilizante foliar / bioestimulante', gotas: ['M', 'G'], volume: [100, 300] }
  ];
  const ALVO_MAP = {}; ALVOS.forEach(a => ALVO_MAP[a.id] = a);

  /* ───────── Tipos de jato ───────── */
  const TIPOS = {
    'leque': 'Jato plano (leque)',
    'leque-pre-orificio': 'Leque com pré-orifício (antideriva)',
    'leque-defletor': 'Leque defletor (turbo)',
    'leque-inducao': 'Leque com indução de ar',
    'leque-duplo': 'Leque duplo (dois jatos)',
    'faixa-uniforme': 'Leque de faixa uniforme (aplicação em faixa)',
    'flood': 'Defletor de grande ângulo (flood)',
    'cone-vazio': 'Cone vazio',
    'cone-cheio': 'Cone cheio'
  };

  /* ───────── Catálogo de pontas ─────────
     gotasPorBar: classe lida no catálogo do fabricante para a ponta 02
       (tamanhos maiores → uma classe mais grossa; menores → mais fina).
     gotasFaixa: fabricante publica só a faixa de classes — o motor interpola
       da mais grossa (pressão mínima) à mais fina (pressão máxima) e marca
       o resultado como estimado.                                            */
  const PONTAS = [
    /* ── TeeJet ── */
    {
      id: 'tj-xr', marca: 'TeeJet', modelo: 'XR TeeJet (XR110 / XR80)', tipo: 'leque', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 4], material: 'Polímero (VP) ou inox (VS)',
      gotasPorBar: { 1: 'M', 1.5: 'F', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Faixa ampliada: mantém o padrão de 1 a 4 bar. Cobertura boa, deriva alta — evite em dia de vento.',
      fonte: 'Catálogo TeeJet Brasil — Bicos para área total'
    },
    {
      id: 'tj-xrc', marca: 'TeeJet', modelo: 'XRC TeeJet (cerâmica)', tipo: 'leque', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 4], material: 'Cerâmica',
      gotasPorBar: { 1: 'M', 1.5: 'F', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato'],
      nota: 'Mesmo padrão do XR com orifício cerâmico — vida útil muito maior em calda abrasiva (WG/WP).',
      fonte: 'Catálogo TeeJet Brasil'
    },
    {
      id: 'tj-tt', marca: 'TeeJet', modelo: 'TT TeeJet (Turbo TeeJet)', tipo: 'leque-defletor', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 6], material: 'Polímero (VP)',
      gotasPorBar: { 1: 'MG', 2: 'G', 3: 'M', 4: 'M', 5: 'F', 6: 'F' },
      usos: ['herbicida-sistemico', 'herbicida-contato', 'dessecacao', 'foliar'],
      nota: 'Jato defletor de grande ângulo e bordas suaves: bom para sistêmico e de contato, deriva controlada abaixo de 3 bar.',
      fonte: 'Catálogo TeeJet Brasil — Turbo TeeJet'
    },
    {
      id: 'tj-aixr', marca: 'TeeJet', modelo: 'AIXR TeeJet', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 6], material: 'Polímero (VP)',
      gotasPorBar: { 1: 'EG', 2: 'MG', 3: 'G', 4: 'G', 5: 'G', 6: 'M' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao', 'herbicida-cafe', 'foliar'],
      nota: 'Indução de ar que trabalha desde 1 bar — a mais versátil para herbicida com janela de vento apertada.',
      fonte: 'Catálogo TeeJet Brasil — Jato plano XR com indução de ar'
    },
    {
      id: 'tj-ai', marca: 'TeeJet', modelo: 'AI TeeJet (AI110 / AI80)', tipo: 'leque-inducao', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2, 8], material: 'Inox (VS)',
      gotasPorBar: { 2: 'UG', 3: 'EG', 4: 'EG', 5: 'MG', 6: 'MG', 7: 'G', 8: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Gota muito grossa com pré-orifício — deriva mínima. Não usar com filtro de ponta 4193A com válvula de retenção.',
      fonte: 'Catálogo TeeJet Brasil — Jato plano com indução de ar'
    },
    {
      id: 'tj-aic', marca: 'TeeJet', modelo: 'AIC TeeJet (cerâmica)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2, 8], material: 'Cerâmica',
      gotasPorBar: { 2: 'UG', 3: 'EG', 4: 'EG', 5: 'MG', 6: 'MG', 7: 'G', 8: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe'],
      nota: 'AI com orifício cerâmico: mesma gota, vida útil maior.',
      fonte: 'Catálogo TeeJet Brasil'
    },
    {
      id: 'tj-tti', marca: 'TeeJet', modelo: 'TTI TeeJet (Turbo TeeJet Indução)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 7], material: 'Polímero (VP)',
      gotasPorBar: { 1: 'UG', 2: 'UG', 3: 'UG', 4: 'UG', 5: 'EG', 6: 'EG', 7: 'EG' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe'],
      nota: 'Gota ultragrossa em toda a faixa: é a ponta de menor deriva do catálogo — indicada para 2,4-D, dicamba e aplicação dirigida no café.',
      fonte: 'Catálogo TeeJet Brasil — TTI'
    },
    {
      id: 'tj-dg', marca: 'TeeJet', modelo: 'DG TeeJet (DriftGuard)', tipo: 'leque-pre-orificio', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 5], material: 'Polímero (VP)',
      gotasPorBar: { 2: 'M', 2.5: 'M', 3: 'M', 4: 'M', 5: 'M' },
      usos: ['herbicida-contato', 'fungicida', 'dessecacao', 'foliar'],
      nota: 'Pré-orifício: gota média estável — meio-termo entre cobertura e deriva.',
      fonte: 'Catálogo TeeJet Brasil — DG'
    },
    {
      id: 'tj-ttj60', marca: 'TeeJet', modelo: 'TTJ60 (Turbo TeeJet Duplo)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['02', '025', '03', '04', '05'], pressao: [1.5, 6], material: 'Polímero (VP)',
      gotasPorBar: { 1.5: 'G', 2: 'G', 3: 'G', 4: 'M', 5: 'M', 6: 'M' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Dois jatos (para frente e para trás): penetra no dossel e cobre espiga/haste — fungicida e inseticida.',
      fonte: 'Catálogo TeeJet Brasil — TTJ60'
    },
    {
      id: 'tj-aittj60', marca: 'TeeJet', modelo: 'AITTJ60 (duplo com indução de ar)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['02', '025', '03', '04', '05'], pressao: [1.5, 6], material: 'Polímero (VP)',
      gotasPorBar: { 1.5: 'EG', 2: 'MG', 3: 'MG', 4: 'G', 5: 'G', 6: 'G' },
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'foliar'],
      nota: 'Duplo com indução de ar: penetração do duplo com a deriva controlada da indução.',
      fonte: 'Catálogo TeeJet Brasil — AITTJ60'
    },
    {
      id: 'tj-ai3070', marca: 'TeeJet', modelo: 'AI3070 (duplo assimétrico 30°/70°)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04'], pressao: [1.5, 6], material: 'Polímero (VP)',
      gotasPorBar: { 1.5: 'EG', 2: 'MG', 3: 'G', 4: 'G', 5: 'M', 6: 'M' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Jatos de 30° e 70° com indução de ar — deposição nos dois lados do alvo vertical.',
      fonte: 'Catálogo TeeJet Brasil — AI3070'
    },
    {
      id: 'tj-even', marca: 'TeeJet', modelo: 'TP…E (jato plano de faixa uniforme)', tipo: 'faixa-uniforme', angulos: [80, 95],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [1, 4], material: 'Latão / inox / polímero',
      gotasPorBar: { 1: 'M', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['herbicida-cafe', 'herbicida-contato', 'pre-emergente'],
      nota: 'Deposição uniforme de borda a borda (não foi feita para sobrepor): é a ponta da aplicação em FAIXA — linha de plantio, canteiro, faixa do café. Largura da faixa = ângulo × altura.',
      fonte: 'TeeJet — Even Flat Spray (aplicação em faixa)'
    },
    {
      id: 'tj-tf', marca: 'TeeJet', modelo: 'TF (Flood / leque defletor)', tipo: 'flood', angulos: [130, 145],
      sizes: ['02', '025', '03', '04', '05', '06', '08', '10'], pressao: [0.7, 3], material: 'Inox / polímero',
      gotasFaixa: ['UG', 'EG', 'MG'],
      usos: ['herbicida-cafe', 'pre-emergente', 'herbicida-sistemico'],
      nota: 'Grande ângulo a baixa pressão e gota muito grossa — é o tipo montado nas barras de herbicida de café (padrão do Jacto PH-400, ~500 µm a 1 bar).',
      fonte: 'Catálogo TeeJet + Jacto PH-400 (SBCPD)'
    },
    {
      id: 'tj-tx', marca: 'TeeJet', modelo: 'TX ConeJet (cone vazio)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['01', '015', '02', '03', '04', '05'], pressao: [3, 20], material: 'Cerâmica / inox',
      gotasFaixa: ['M', 'F', 'MF'],
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio de alta pressão — turbo atomizador e aplicação em café/citros, onde a cobertura vale mais que a deriva.',
      fonte: 'Catálogo TeeJet Brasil — ConeJet'
    },
    /* ── Magnojet ── */
    {
      id: 'mj-ad', marca: 'Magnojet', modelo: 'AD (leque antideriva)', tipo: 'leque-pre-orificio', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [1.0, 4.1], material: 'Cerâmica 99 % alumina',
      gotasFaixa: ['G', 'M', 'F'],
      usos: ['herbicida-sistemico', 'herbicida-contato', 'fungicida', 'dessecacao'],
      nota: 'Gotas de ~300–400 µm. Sistêmicos e de contato; cerâmica de alta alumina segura a vazão por muito mais horas.',
      fonte: 'Magnojet / DRS Pulverizadores — ficha da ponta AD'
    },
    {
      id: 'mj-adga', marca: 'Magnojet', modelo: 'ADGA (antideriva de grande ângulo)', tipo: 'leque-defletor', angulos: [120],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1.0, 4.1], material: 'Cerâmica',
      gotasFaixa: ['M', 'F'],
      usos: ['herbicida-contato', 'fungicida', 'foliar'],
      nota: '120°: permite barra mais baixa (ou bicos mais espaçados) mantendo a sobreposição.',
      fonte: 'Magnojet — ficha da ponta ADGA'
    },
    {
      id: 'mj-ad-ia', marca: 'Magnojet', modelo: 'AD-IA (indução de ar)', tipo: 'leque-inducao', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2.1, 7.6], material: 'Cerâmica',
      gotasFaixa: ['UG', 'EG', 'MG', 'G'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Venturi: gota grossa a ultragrossa. Indicada pelo fabricante para herbicida pré e pós-emergente sistêmico.',
      fonte: 'Magnojet / DRS Pulverizadores — ficha da ponta AD-IA'
    },
    {
      id: 'mj-ad-ia-d', marca: 'Magnojet', modelo: 'AD-IA/D (indução de ar, jato duplo)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2.1, 7.6], material: 'Cerâmica',
      gotasFaixa: ['EG', 'MG', 'G'],
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico'],
      nota: 'Dois jatos com indução de ar — penetração com deriva controlada.',
      fonte: 'Magnojet — linha AD-IA/D'
    },
    {
      id: 'mj-mug', marca: 'Magnojet', modelo: 'MUG (FastCap, indução de ar)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2.1, 7.6], material: 'Polímero + cerâmica',
      gotasFaixa: ['EG', 'MG', 'G'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao'],
      nota: 'Linha FastCap (troca rápida) com indução de ar.',
      fonte: 'Magnojet — linha MUG'
    },
    {
      id: 'mj-bd', marca: 'Magnojet', modelo: 'BD (leque com pré-orifício)', tipo: 'leque-pre-orificio', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1.0, 4.1], material: 'Cerâmica',
      gotasFaixa: ['G', 'M'],
      usos: ['herbicida-contato', 'herbicida-sistemico', 'fungicida'],
      nota: 'Pré-orifício reduz a fração de gotas finas sem mudar o padrão do leque.',
      fonte: 'Magnojet — linha BD'
    },
    {
      id: 'mj-mag', marca: 'Magnojet', modelo: 'MAG (cone vazio)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['01', '02', '03', '04', '05', '06'], pressao: [3, 20], material: 'Cerâmica',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio para turbo atomizador e pulverização de alta pressão (café, citros).',
      fonte: 'Magnojet — linha MAG'
    },
    /* ── Jacto (linha própria e Albuz) ── */
    {
      id: 'jc-jtt', marca: 'Jacto', modelo: 'JTT (leque de faixa ampliada)', tipo: 'leque', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [1.0, 6.2], material: 'Polímero',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Passagem interna maior: entope menos e aguenta calda corrosiva. 15 a 90 psi.',
      fonte: 'jacto.com — Jacto JTT'
    },
    {
      id: 'jc-j3d', marca: 'Jacto', modelo: 'J3D (leque duplo)', tipo: 'leque-duplo', angulos: [100],
      sizes: ['015', '02', '025', '03', '04'], pressao: [1.0, 6.2], material: 'Polímero',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Jatos para frente e para trás — penetração em dossel fechado. 15 a 90 psi.',
      fonte: 'jacto.com — Jacto J3D'
    },
    {
      id: 'jc-jdf', marca: 'Jacto', modelo: 'JDF (defletor de faixa uniforme)', tipo: 'faixa-uniforme', angulos: [105, 140],
      sizes: ['02', '025', '03', '04', '05', '06'], pressao: [1.0, 3.1], material: 'Polímero',
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['herbicida-cafe', 'herbicida-contato', 'pre-emergente'],
      nota: 'Defletor de grande ângulo e faixa uniforme, 15 a 45 psi — barra de herbicida, pulverizador costal e pendular.',
      fonte: 'jacto.com — Jacto JDF'
    },
    {
      id: 'jc-adi', marca: 'Albuz', modelo: 'ADI (leque antideriva com pré-orifício)', tipo: 'leque-pre-orificio', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 4], material: 'Cerâmica rosa Albuz',
      gotasPorBar: { 2: 'M', 2.5: 'M', 3: 'M', 3.5: 'F', 4: 'F' },
      usos: ['herbicida-sistemico', 'herbicida-contato', 'dessecacao', 'fungicida'],
      nota: 'Corta pela metade as gotas abaixo de 100 µm sem mudar o padrão do leque; trabalha a partir de 2 bar, barra a 50–60 cm. Distribuída no Brasil pela Jacto (30–75 psi). Atenção: o catálogo europeu publica a ADI na escala de cores Albuz (amarelo = 0,49 L/min a 2 bar), não na ISO — confira a marcação da sua ponta.',
      fonte: 'Catálogo Albuz 2022 (p. 11) + jacto.com'
    },
    {
      id: 'jc-avi', marca: 'Albuz', modelo: 'AVI 110° (indução de ar)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [3, 5], material: 'Cerâmica rosa Albuz (duplo orifício)',
      gotasPorBar: { 3: 'MG', 4: 'G', 5: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao', 'herbicida-cafe'],
      nota: 'Venturi com dupla entrada de ar: gota grande cheia de bolhas que arrebenta na folha. Homologada 75 % antideriva, barra a 50–60 cm, pressão recomendada 3 bar. No Brasil vem pela Jacto (45–105 psi).',
      fonte: 'Catálogo Albuz 2022 (p. 16) + jacto.com'
    },
    {
      id: 'jc-axi', marca: 'Albuz', modelo: 'AXI 80°/110° (leque de faixa ampliada)', tipo: 'leque', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1.5, 4], material: 'Cerâmica em corpo plástico',
      gotasPorBar: { 1.5: 'F', 2: 'F', 2.5: 'F', 3: 'F', 4: 'F' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Aguenta 1,5 a 4 bar sem perder o padrão — é a ponta dos pulverizadores com controle automático de vazão. A 1,5 bar engrossa a gota (volume baixo, menos deriva); acima de 2,5 bar afina para cobrir melhor. VMD de ~150 µm no meio da faixa.',
      fonte: 'Catálogo Albuz 2022 (p. 12)'
    },
    {
      id: 'jc-atr', marca: 'Albuz', modelo: 'ATR 60°/80° (cone vazio)', tipo: 'cone-vazio', angulos: [80, 60],
      sizes: ['branco', 'lilás', 'marrom', 'amarelo', 'laranja', 'vermelho', 'cinza', 'verde', 'preto', 'azul'], escalaPropria: true,
      pressao: [5, 20], material: 'Cerâmica Albuz',
      gotasPorBar: { 5: 'F', 7: 'F', 10: 'F', 15: 'MF', 20: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio de 5 a 20 bar com escala de cores PRÓPRIA (branco → azul), não ISO: o app não calcula a vazão dela — pegue o par cor × pressão na tabela da Albuz/Jacto. É a ponta do turbo atomizador em café e citros; gota fina a muito fina, cobertura máxima.',
      fonte: 'Catálogo Albuz 2022 (p. 5 e 22)'
    },
    {
      id: 'jc-airmix', marca: 'Jacto', modelo: 'AIRMIX (indução de ar)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1.5, 6], material: 'Polímero/cerâmica',
      gotasFaixa: ['EG', 'MG', 'G'], confirmar: true,
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao'],
      nota: 'Indução de ar da linha Jacto — confirme faixa de pressão e classe de gota no catálogo antes de fechar a regulagem.',
      fonte: 'jacto.com — linha de bicos'
    },
    /* ── Albuz (linha completa do catálogo 2022; no Brasil vem pela Jacto) ── */
    {
      id: 'alb-axi-twin', marca: 'Albuz', modelo: 'AXI TWIN 120° (leque duplo)', tipo: 'leque-duplo', angulos: [120],
      sizes: ['015', '02', '025', '03', '04'], pressao: [1.5, 5], material: 'Cerâmica em corpo plástico',
      gotasPorBar: { 1.5: 'M', 2: 'F', 2.5: 'F', 3: 'MF', 3.5: 'MF', 4: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar', 'herbicida-contato'],
      nota: 'Dois jatos de 120° separados por 70°: penetra folhagem densa e cobre os dois lados do alvo. Gota fina — é ponta de produto de contato, não de herbicida em dia de vento.',
      fonte: 'Catálogo Albuz 2022 (p. 13)'
    },
    {
      id: 'alb-cvi', marca: 'Albuz', modelo: 'CVI 110° (indução de ar, corpo curto)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06'], pressao: [1.5, 5], material: 'Cerâmica rosa Albuz',
      gotasPorBar: { 1.5: 'MG', 2: 'MG', 2.5: 'MG', 3: 'G', 4: 'G', 5: 'G' },
      usos: ['herbicida-sistemico', 'herbicida-contato', 'pre-emergente', 'dessecacao', 'herbicida-cafe'],
      nota: 'Venturi de 22 mm que trabalha desde 1,5 bar — mesma capa das ISO (AXI). Gota de ~450 µm que arrebenta na folha: deriva baixa sem perder impacto. Pressão recomendada 2 bar, barra a 50–60 cm.',
      fonte: 'Catálogo Albuz 2022 (p. 14)'
    },
    {
      id: 'alb-cvi-twin', marca: 'Albuz', modelo: 'CVI TWIN (indução de ar, jato duplo)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04'], pressao: [1.5, 5], material: 'Cerâmica de duplo orifício',
      gotasFaixa: ['MG', 'G'],
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'foliar'],
      nota: 'Dois leques de 110° inclinados a 65°, com indução de ar: penetração do duplo e deriva do venturi. Filtro malha 80 nos tamanhos 015 e 02.',
      fonte: 'Catálogo Albuz 2022 (p. 15)'
    },
    {
      id: 'alb-avi-twin', marca: 'Albuz', modelo: 'AVI TWIN (indução de ar, jato duplo)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [3, 5], material: 'Cerâmica de duplo orifício',
      gotasFaixa: ['EG', 'MG', 'G'],
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'foliar'],
      nota: 'Dois leques de 110° inclinados a 65° com gota grande cheia de ar — cobertura nos dois lados da planta com deriva mínima.',
      fonte: 'Catálogo Albuz 2022 (p. 17)'
    },
    {
      id: 'alb-avi-uc', marca: 'Albuz', modelo: 'AVI-UC 110° (gota ultragrossa)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 5], material: 'Cerâmica Albuz',
      gotasFaixa: ['UG', 'EG'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Homologada 90 % antideriva: é a AVI levada ao extremo, gota ultragrossa em toda a faixa. Pressão recomendada 3 bar, barra a 50–60 cm. Para 2,4-D, dicamba e aplicação dirigida perto de cultura sensível.',
      fonte: 'Catálogo Albuz 2022 (p. 18)'
    },
    {
      id: 'alb-mvi', marca: 'Albuz', modelo: 'MVI (indução de ar, grande ângulo)', tipo: 'leque-inducao', angulos: [130, 140, 150, 160],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08', '10'], pressao: [1.5, 3], material: 'Cerâmica Albuz',
      gotasPorBar: { 1.5: 'UG', 2: 'UG', 3: 'UG' },
      usos: ['herbicida-cafe', 'pre-emergente', 'herbicida-sistemico', 'foliar'],
      nota: 'Grande ângulo que abre com a pressão (130° a 160°) e gota ultragrossa de 1,5 a 3 bar: faixa larga com a ponta baixa, sem deriva. Vale para fertilizante líquido e é a escolha natural da barra de herbicida sob a saia do café. A tabela de vazão do fabricante vai até 4 bar.',
      fonte: 'Catálogo Albuz 2022 (p. 5 e 31)'
    },
    {
      id: 'alb-ape', marca: 'Albuz', modelo: 'APE 80°/110° (leque padrão)', tipo: 'leque', angulos: [110, 80],
      sizes: ['branco', 'lilás', 'marrom', 'amarelo', 'laranja', 'vermelho', 'cinza', 'verde', 'preto', 'azul'], escalaPropria: true,
      pressao: [2, 4], material: 'Cerâmica rosa Albuz',
      gotasPorBar: { 2: 'F', 2.5: 'F', 3: 'F', 3.5: 'F', 4: 'MF' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Leque padrão da Albuz para todo tipo de tratamento, de 2 a 4 bar. Usa a escala de cores EUROPEIA da Albuz (amarelo = 0,49 L/min a 2 bar), não a ISO — o app não calcula a vazão dela; pegue o par cor × pressão na tabela do fabricante.',
      fonte: 'Catálogo Albuz 2022 (p. 10)'
    },
    {
      id: 'alb-ati', marca: 'Albuz', modelo: 'ATI 60°/80° (cone vazio ISO)', tipo: 'cone-vazio', angulos: [80, 60],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [5, 20], material: 'Cerâmica Albuz',
      gotasPorBar: { 5: 'F', 7: 'F', 10: 'F', 15: 'MF', 20: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'É a ATR com código ISO: mesmo cone vazio de alta pressão, mas com tamanho e cor da norma — dá para calcular a vazão aqui. Turbo atomizador em café e citros.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    {
      id: 'alb-tvi', marca: 'Albuz', modelo: 'TVI 80° (cone vazio com indução de ar)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [5, 15], material: 'Cerâmica Albuz',
      gotasPorBar: { 5: 'UG', 7: 'UG', 10: 'EG', 15: 'MG' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio com venturi: a cobertura do cone do turbo atomizador com gota grossa a ultragrossa — corta a deriva do pomar e do cafezal, onde o cone comum joga névoa para fora da rua.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    {
      id: 'alb-atf', marca: 'Albuz', modelo: 'ATF 80° (cone cheio)', tipo: 'cone-cheio', angulos: [80],
      sizes: ['015', '02', '025', '03', '04'], pressao: [3, 15], material: 'Cerâmica Albuz',
      gotasPorBar: { 3: 'F', 5: 'F', 10: 'MF', 15: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone cheio: jato preenchido, deposição concentrada — tratamento localizado e alvos densos. Gota fina a muito fina, só com vento fraco.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    /* ── Hypro (Pentair) ── */
    {
      id: 'hy-uld', marca: 'Hypro', modelo: 'ULD Ultra Lo-Drift', tipo: 'leque-inducao', angulos: [120],
      sizes: ['015', '02', '025', '03', '04', '05', '06'], pressao: [1, 8], material: 'Poliacetal',
      gotasFaixa: ['UG', 'EG', 'MG'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'A ponta de menor deriva da linha Hypro: gota grande cheia de ar, 120° de abertura e faixa de 1 a 8 bar. Indicada pelo fabricante para daninhas — sistêmico, pré-emergente e dessecação.',
      fonte: 'Hypro — Selecting the Right Spray Nozzle (guia de seleção)'
    },
    {
      id: 'hy-ga', marca: 'Hypro', modelo: 'GuardianAIR', tipo: 'leque-inducao', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05', '06'], pressao: [1, 8], material: 'Poliacetal',
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'dessecacao', 'foliar'],
      nota: 'Indução de ar que mantém o ângulo do leque de 1 a 8 bar: cobertura de fungicida e inseticida com deriva controlada. Existe em 80° e 110°.',
      fonte: 'Hypro — guia de seleção e ficha GuardianAIR'
    },
    {
      id: 'hy-gat', marca: 'Hypro', modelo: 'GuardianAIR Twin', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 8], material: 'Poliacetal',
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['fungicida', 'inseticida', 'foliar', 'herbicida-sistemico'],
      nota: 'Dois jatos com indução de ar num corpo só: deposição na frente e atrás do alvo, para espiga, haste e dossel fechado.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-grd', marca: 'Hypro', modelo: 'Guardian (pré-orifício)', tipo: 'leque-pre-orificio', angulos: [120],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 8], material: 'Poliacetal',
      gotasFaixa: ['G', 'M'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: '120° com pré-orifício: gota média a grossa numa faixa de pressão larga. Meio-termo entre cobertura e deriva quando não dá para usar indução de ar.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-ld', marca: 'Hypro', modelo: 'LD Lo-Drift', tipo: 'leque-pre-orificio', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 5], material: 'Poliacetal',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'A antideriva original da Hypro: pré-orifício que corta boa parte das gotas finas de um leque comum, mantendo cobertura.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-3d', marca: 'Hypro', modelo: '3D (leque inclinado)', tipo: 'leque', angulos: [100],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [0.7, 6], material: 'Poliacetal',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'foliar', 'herbicida-contato'],
      nota: 'Jato inclinado de 100° para montar alternado na barra (um para a frente, outro para trás) — cobre os dois lados sem ponta dupla. Homologada para PWM (bico pulsado).',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-vp', marca: 'Hypro', modelo: 'VP FanTip (pressão variável)', tipo: 'leque', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06'], pressao: [1, 5], material: 'Poliacetal',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Leque de uso geral com orifício elíptico, estável de 1 a 5 bar — a ponta padrão de barra quando a deriva não é o problema do dia.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-even', marca: 'Hypro', modelo: 'E FanTip (faixa uniforme)', tipo: 'faixa-uniforme', angulos: [80],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [2, 4], material: 'Poliacetal',
      gotasFaixa: ['M', 'F'],
      usos: ['herbicida-cafe', 'herbicida-contato', 'pre-emergente'],
      nota: 'Deposição uniforme de borda a borda para aplicação em FAIXA (linha de plantio, canteiro, faixa do café) — não sobrepõe. Também existe na versão costal (1 a 3 bar).',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-dt', marca: 'Hypro', modelo: 'DeflecTip (defletor / flood)', tipo: 'flood', angulos: [160, 130, 80], confirmar: true,
      sizes: ['02', '03', '04', '05', '06', '08', '10'], pressao: [1, 4], material: 'Poliacetal',
      gotasFaixa: ['UG', 'EG', 'MG'],
      usos: ['herbicida-cafe', 'pre-emergente', 'herbicida-sistemico', 'foliar'],
      nota: 'Defletor de 80° a 160° a baixa pressão (1 a 4 bar), gota grossa: daninhas e fertilizante líquido, e é o tipo das barras de herbicida em faixa. A Hypro numera os tamanhos pela vazão em gpm — confira a equivalência com o código ISO antes de fechar a regulagem.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-hcx', marca: 'Hypro', modelo: 'HCX HollowTip (cone vazio)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [3, 10], material: 'Poliacetal',
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio em poliacetal, de 3 a 10 bar: cobertura para pulverização assistida por ar e aplicação dirigida (café, citros, hortaliças).',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-xt', marca: 'Hypro', modelo: 'XT Boom X Tender (sem barra)', tipo: 'flood', angulos: [105], confirmar: true,
      sizes: ['04', '05', '06', '08', '10'], pressao: [2, 5], material: 'Inox ou poliacetal',
      gotasFaixa: ['EG', 'MG', 'G'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao'],
      nota: 'Ponta boomless: cobre uma faixa larga sem barra, para pastagem, beira de cerca e área acidentada. Tamanho pela vazão do fabricante — confira a equivalência ISO.',
      fonte: 'Hypro — guia de seleção'
    },
    /* ── genérica ── */
    {
      id: 'iso-generica', marca: 'Genérica (ISO)', modelo: 'Qualquer ponta ISO 10625', tipo: 'leque', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 6], material: '—',
      gotasFaixa: ['G', 'M', 'F'], confirmar: true,
      usos: ['herbicida-sistemico', 'herbicida-contato', 'fungicida', 'inseticida', 'foliar', 'pre-emergente', 'dessecacao', 'herbicida-cafe'],
      nota: 'Cálculo pela norma: a vazão depende do tamanho ISO e da pressão, não da marca. A classe de gota, sim, depende do modelo — confirme no catálogo.',
      fonte: 'ISO 10625'
    }
  ];
  const PONTA_MAP = {}; PONTAS.forEach(p => PONTA_MAP[p.id] = p);

  /* ───────── Presets de barra de herbicida para café ─────────
     Fontes: Jacto PH-400 (faixa de 1,40 a 3,60 m, 4 bicos flood 130°, ~500 µm,
     1 kgf/cm², 250 L/ha a 4,5 km/h); Fundação Procafé / Planta Daninha
     (faixa de 0,80 m — 0,40 m de cada lado da planta — com ponta de faixa
     uniforme 80-EF-015 e proteção física contra deriva).                  */
  const PRESETS = [
    {
      id: 'cafe-linha-2lados', nome: 'Café — faixa na linha (dois lados da saia)',
      modo: 'faixa', entreLinhas: 3.5, larguraFaixa: 1.6, bicosPorPassada: 2, velocidade: 4.5, protecao: true,
      volumeHa: 200, alvo: 'herbicida-cafe', ponta: 'tj-aixr', iso: '04', angulo: 110,
      nota: 'Duas faixas de 0,80 m (uma de cada lado da linha), bicos protegidos por chapéu de Napoleão. O trator anda na rua e trata só a faixa da saia.'
    },
    {
      id: 'cafe-formacao', nome: 'Café em formação — faixa de 0,80 m',
      modo: 'faixa', entreLinhas: 3.5, larguraFaixa: 0.8, bicosPorPassada: 2, velocidade: 4.0, protecao: true,
      volumeHa: 200, alvo: 'herbicida-cafe', ponta: 'tj-even', iso: '015', angulo: 80,
      nota: '0,40 m de cada lado da muda, ponta de faixa uniforme e barra com proteção — arranjo dos ensaios de café em formação (controle > 98 % sem fitotoxidez).'
    },
    {
      id: 'cafe-rua', nome: 'Café — rua (entrelinha), sem atingir a saia',
      modo: 'faixa', entreLinhas: 3.5, larguraFaixa: 2.0, bicosPorPassada: 2, velocidade: 5.0, protecao: true,
      volumeHa: 150, alvo: 'herbicida-cafe', ponta: 'tj-aixr', iso: '04', angulo: 110,
      nota: 'Faixa central da rua; a saia fica de fora. Gota grossa e barra baixa para não subir deriva na folha do café.'
    },
    {
      id: 'cafe-ph400', nome: 'Café — barra tipo PH-400 (sob a saia, área total)',
      modo: 'faixa', entreLinhas: 3.5, larguraFaixa: 3.5, bicosPorPassada: 4, velocidade: 4.5, protecao: true,
      volumeHa: 250, alvo: 'herbicida-cafe', ponta: 'tj-tf', iso: '06', angulo: 130,
      nota: 'Arranjo do Jacto PH-400: 4 bicos flood de 130°, faixa regulável de 1,40 a 3,60 m, ~1 bar, gota de ~500 µm, 250 L/ha a 4,5 km/h — asas protegidas que levantam a saia do cafeeiro.'
    },
    {
      id: 'barra-soja', nome: 'Barra — área total 50 cm entre bicos',
      modo: 'area', espacamento: 0.5, nBicos: 40, velocidade: 8, volumeHa: 100,
      alvo: 'herbicida-sistemico', ponta: 'tj-aixr', iso: '02', angulo: 110,
      nota: 'Configuração clássica de barra: bicos a 50 cm, altura de 50 cm, 110°.'
    },
    {
      id: 'cafe-turbo', nome: 'Café — turbo atomizador (fungicida/inseticida)',
      modo: 'area', espacamento: 3.5, nBicos: 12, velocidade: 3.5, volumeHa: 400,
      alvo: 'fungicida', ponta: 'jc-atr', iso: '', angulo: 80,
      nota: 'No turbo o "espaçamento" é a distância entre linhas: cada passada trata uma rua. Cone vazio, alta pressão, cobertura na folha.'
    }
  ];

  /* ───────── vazão × pressão (ISO 10625 e lei da raiz quadrada) ───────── */
  function vazaoNominal(iso) { const i = ISO_MAP[String(iso)]; return i ? i.vazao : 0; }
  function vazaoPonta(iso, bar) { const q = vazaoNominal(iso); return (!q || !(bar > 0)) ? 0 : round(q * Math.sqrt(bar / 3), 3); }
  function pressaoPara(iso, q) { const qn = vazaoNominal(iso); return (!qn || !(q > 0)) ? 0 : round(3 * Math.pow(q / qn, 2), 2); }
  function novaVazao(q1, p1, p2) { return (!(p1 > 0) || !(p2 > 0)) ? 0 : round(q1 * Math.sqrt(p2 / p1), 3); }
  function novaPressao(p1, q1, q2) { return (!(q1 > 0)) ? 0 : round(p1 * Math.pow(q2 / q1, 2), 2); }

  /* ───────── equações de regulagem ───────── */
  const vazaoNecessaria = (volumeHa, velocidade, faixaPorBico) => round((volumeHa * velocidade * faixaPorBico) / 600, 3);
  const volumeAplicado = (q, velocidade, faixaPorBico) => (!(velocidade > 0) || !(faixaPorBico > 0)) ? 0 : round((600 * q) / (velocidade * faixaPorBico), 1);
  const velocidadeAlvo = (q, volumeHa, faixaPorBico) => (!(volumeHa > 0) || !(faixaPorBico > 0)) ? 0 : round((600 * q) / (volumeHa * faixaPorBico), 2);
  const velocidadeCampo = (distancia, segundos) => !(segundos > 0) ? 0 : round(3.6 * distancia / segundos, 2);

  /* altura da barra: sobreposição dupla no alvo, por ângulo do leque
     (110° a 50 cm de espaçamento → 50 cm de altura; 80° → 75 cm — catálogo TeeJet) */
  const FATOR_ALTURA = [[80, 1.5], [95, 1.2], [100, 1.15], [110, 1.0], [120, 0.9], [130, 0.75], [145, 0.6]];
  function fatorAltura(angulo) {
    const a = +angulo || 110, t = FATOR_ALTURA;
    if (a <= t[0][0]) return t[0][1];
    if (a >= t[t.length - 1][0]) return t[t.length - 1][1];
    for (let i = 1; i < t.length; i++) if (a <= t[i][0]) { const [a0, f0] = t[i - 1], [a1, f1] = t[i]; return f0 + (f1 - f0) * (a - a0) / (a1 - a0); }
    return 1;
  }
  const alturaBarra = (angulo, espacamento) => round((+espacamento || 0) * fatorAltura(angulo) * 100, 0); // cm
  /* largura teórica do jato a uma altura (faixa uniforme / flood): L = 2·h·tg(α/2) */
  const larguraJato = (angulo, alturaCm) => round(2 * (alturaCm / 100) * Math.tan((+angulo || 110) * Math.PI / 360), 2);
  const alturaParaFaixa = (angulo, larguraM) => round(100 * (larguraM / 2) / Math.tan((+angulo || 110) * Math.PI / 360), 0);

  /* ───────── classe de gota ───────── */
  const ORDEM_ISO = ['01', '015', '02', '025', '03', '04', '05', '06', '08', '10', '15', '20'];
  function classeGota(ponta, bar, iso) {
    const p = typeof ponta === 'string' ? PONTA_MAP[ponta] : ponta;
    if (!p || !(bar > 0)) return null;
    let base = null, estimado = false;
    if (p.gotasPorBar) {
      const chaves = Object.keys(p.gotasPorBar).map(Number).sort((a, b) => a - b);
      let k = chaves[0];
      chaves.forEach(c => { if (c <= bar + 1e-9) k = c; });
      if (bar < chaves[0]) { k = chaves[0]; estimado = true; }
      if (bar > chaves[chaves.length - 1]) { k = chaves[chaves.length - 1]; estimado = true; }
      base = p.gotasPorBar[k];
    } else if (p.gotasFaixa && p.gotasFaixa.length) {
      estimado = true;
      const [pmin, pmax] = p.pressao, n = p.gotasFaixa.length;
      const t = pmax > pmin ? Math.min(Math.max((bar - pmin) / (pmax - pmin), 0), 1) : 0;
      base = p.gotasFaixa[Math.min(n - 1, Math.floor(t * n))];
    }
    if (!base) return null;
    // tamanhos maiores produzem gota mais grossa; os menores, mais fina
    let grau = GOTA_MAP[base].grau;
    if (iso && !p.escalaPropria) {
      const i = ORDEM_ISO.indexOf(String(iso));
      if (i >= 0) { if (i >= ORDEM_ISO.indexOf('04')) grau += 1; else if (i <= ORDEM_ISO.indexOf('01')) grau -= 1; }
    }
    grau = Math.min(7, Math.max(1, grau));
    const g = GOTAS.find(x => x.grau === grau);
    return { id: g.id, nome: g.nome, faixa: g.faixa, grau, hex: g.hex, estimado, base };
  }

  /* ───────── regulagem completa ───────── */
  function calcular(e) {
    e = e || {};
    const modo = e.modo === 'faixa' ? 'faixa' : 'area';
    const volumeHa = num(e.volumeHa), velocidade = num(e.velocidade);
    const ponta = PONTA_MAP[e.ponta] || null, iso = e.iso || '';
    const angulo = +e.angulo || (ponta && ponta.angulos[0]) || 110;
    const avisos = [], formulas = [];
    const F = (nome, formula, calculo, resultado) => formulas.push({ nome, formula, calculo, resultado });

    let espacamento, faixaPorBico, nBicos, larguraTrabalho, larguraFaixa = 0, entreLinhas = 0, fracaoTratada = 1;
    if (modo === 'faixa') {
      larguraFaixa = num(e.larguraFaixa);
      entreLinhas = num(e.entreLinhas) || larguraFaixa;
      nBicos = Math.max(1, Math.round(num(e.bicosPorPassada) || 1));
      faixaPorBico = larguraFaixa / nBicos;
      espacamento = faixaPorBico;
      larguraTrabalho = entreLinhas;
      fracaoTratada = entreLinhas > 0 ? Math.min(larguraFaixa / entreLinhas, 1) : 1;
    } else {
      espacamento = num(e.espacamento) || 0.5;
      faixaPorBico = espacamento;
      nBicos = Math.max(1, Math.round(num(e.nBicos) || 1));
      larguraTrabalho = round(nBicos * espacamento, 2);
    }

    // vazão necessária por bico para o volume alvo
    const qNecessaria = vazaoNecessaria(volumeHa, velocidade, faixaPorBico);
    F('Vazão por bico', 'q = (V × v × e) ÷ 600',
      `q = (${volumeHa} L/ha × ${velocidade} km/h × ${round(faixaPorBico, 3)} m) ÷ 600`, `${round(qNecessaria, 3)} L/min`);

    // pressão para essa vazão com a ponta escolhida (ou vazão real na pressão informada)
    let pressao = num(e.pressao), qReal = qNecessaria, pressaoCalculada = null, gota = null, vazaoNom = 0;
    if (iso && ISO_MAP[iso]) {
      vazaoNom = vazaoNominal(iso);
      if (e.fixarPressao && pressao > 0) {
        qReal = vazaoPonta(iso, pressao);
        F('Vazão da ponta na pressão', 'q = q₃bar × √(p ÷ 3)',
          `q = ${vazaoNom} × √(${pressao} ÷ 3)`, `${qReal} L/min`);
      } else {
        pressaoCalculada = pressaoPara(iso, qNecessaria);
        pressao = pressaoCalculada;
        F('Pressão necessária', 'p = 3 × (q ÷ q₃bar)²',
          `p = 3 × (${round(qNecessaria, 3)} ÷ ${vazaoNom})²`, `${pressaoCalculada} bar`);
      }
      gota = classeGota(ponta, pressao, iso);
    }

    const volumeReal = volumeAplicado(qReal, velocidade, faixaPorBico);
    if (e.fixarPressao) F('Volume aplicado', 'V = (600 × q) ÷ (v × e)',
      `V = (600 × ${qReal}) ÷ (${velocidade} × ${round(faixaPorBico, 3)})`, `${volumeReal} L/ha`);

    const vazaoTotal = round(qReal * nBicos, 2);
    F('Vazão total do conjunto', 'Q = q × nº de bicos', `Q = ${qReal} × ${nBicos}`, `${vazaoTotal} L/min`);

    // faixa: volume por hectare de lavoura e economia
    let volumeLavoura = volumeReal, economia = 0;
    if (modo === 'faixa') {
      volumeLavoura = round(volumeReal * fracaoTratada, 1);
      economia = round((1 - fracaoTratada) * 100, 1);
      F('Volume por hectare de lavoura', 'V_lavoura = V_faixa × (largura da faixa ÷ entrelinhas)',
        `V = ${volumeReal} × (${larguraFaixa} ÷ ${entreLinhas})`, `${volumeLavoura} L/ha de lavoura`);
      F('Área tratada', 'fração = largura da faixa ÷ entrelinhas',
        `${larguraFaixa} ÷ ${entreLinhas}`, `${round(fracaoTratada * 100, 1)} % da área (economia de ${economia} % de produto)`);
    }

    // rendimento e tanque
    const rendimento = round(velocidade * larguraTrabalho / 10, 2); // ha/h
    F('Rendimento teórico', 'ha/h = v × largura de trabalho ÷ 10',
      `${velocidade} × ${larguraTrabalho} ÷ 10`, `${rendimento} ha/h`);
    const tanque = num(e.tanque), area = num(e.area);
    let ficha = null;
    if (tanque > 0 && volumeLavoura > 0) {
      const haPorTanque = round(tanque / volumeLavoura, 2);
      const distancia = larguraTrabalho > 0 ? round(haPorTanque * 10000 / larguraTrabalho, 0) : 0;
      const minutos = vazaoTotal > 0 ? round(tanque / vazaoTotal, 0) : 0;
      const cargas = area > 0 ? Math.ceil(area / haPorTanque) : 0;
      ficha = { haPorTanque, distancia, minutos, cargas, area };
      F('Área por tanque', 'A = capacidade do tanque ÷ volume por hectare',
        `A = ${tanque} ÷ ${volumeLavoura}`, `${haPorTanque} ha (≈ ${distancia} m de percurso, ${minutos} min de pulverização)`);
    }

    // altura da barra
    const altura = alturaBarra(angulo, espacamento);
    if (modo === 'area') F('Altura da barra', 'h ≈ espaçamento × fator do ângulo (110° → 1,0 · 80° → 1,5)',
      `h ≈ ${round(espacamento, 2)} m × ${round(fatorAltura(angulo), 2)}`, `${altura} cm acima do alvo`);
    else F('Altura da barra para a faixa', 'h = (largura da faixa por bico ÷ 2) ÷ tg(ângulo ÷ 2)',
      `h = (${round(faixaPorBico, 2)} ÷ 2) ÷ tg(${angulo}° ÷ 2)`, `${alturaParaFaixa(angulo, faixaPorBico)} cm acima do alvo`);

    /* ── avisos ── */
    if (ponta && pressao > 0) {
      const [pmin, pmax] = ponta.pressao;
      if (pressao < pmin) avisos.push({ nivel: 'alta', texto: `Pressão calculada (${pressao} bar) abaixo do mínimo da ${ponta.modelo} (${pmin} bar): o leque não fecha e a distribuição fica irregular.`, conduta: `Use uma ponta menor, aumente a velocidade ou reduza o volume — ou troque por um modelo que trabalhe a partir de ${pmin} bar.` });
      else if (pressao > pmax) avisos.push({ nivel: 'alta', texto: `Pressão calculada (${pressao} bar) acima do máximo da ${ponta.modelo} (${pmax} bar): gota fina demais, deriva e desgaste.`, conduta: 'Use uma ponta maior (ISO seguinte), reduza a velocidade ou aumente o número de bicos.' });
      else if (pressao > pmin && pressao < pmin * 1.3) avisos.push({ nivel: 'baixa', texto: `Pressão no limite inferior da ponta (${pressao} bar, mínimo ${pmin} bar).`, conduta: 'Confira o padrão do leque com o pulverizador parado antes de sair.' });
    }
    const protecao = !!e.protecao;
    const alvo = ALVO_MAP[e.alvo];
    if (alvo && gota) {
      const ideais = alvo.gotas.map(g => GOTA_MAP[g].grau);
      const min = Math.min.apply(null, ideais), max = Math.max.apply(null, ideais);
      if (gota.grau < min) avisos.push({ nivel: 'media', texto: `Gota ${gota.nome.toLowerCase()} (${gota.faixa}) é mais fina que o recomendado para ${alvo.nome.toLowerCase()} (${alvo.gotas.map(g => GOTA_MAP[g].nome.toLowerCase()).join(', ')}).`, conduta: 'Reduza a pressão, use ponta maior com indução de ar, ou aplique em janela de vento fraco (3–10 km/h) e umidade acima de 55 %.' });
      else if (gota.grau > max) avisos.push({ nivel: 'baixa', texto: `Gota ${gota.nome.toLowerCase()} pode faltar cobertura para ${alvo.nome.toLowerCase()}.`, conduta: 'Aumente o volume de calda ou use ponta com classe de gota mais fina; produtos de contato exigem cobertura.' });
      if (volumeHa && alvo.volume && (volumeHa < alvo.volume[0] || volumeHa > alvo.volume[1]))
        avisos.push({ nivel: 'baixa', texto: `Volume de ${volumeHa} L/ha fora do usual para ${alvo.nome.toLowerCase()} (${alvo.volume[0]}–${alvo.volume[1]} L/ha).`, conduta: 'Confirme na bula do produto e no arranjo do equipamento.' });
    }
    if (modo === 'faixa' && e.alvo === 'herbicida-cafe') {
      if (gota && gota.grau < GOTA_MAP['MG'].grau) avisos.push(protecao
        ? { nivel: 'media', texto: 'Gota abaixo de "muito grossa" no café: aqui quem segura a deriva é só a proteção física dos bicos — é o arranjo dos ensaios de café em formação (ponta de faixa uniforme + chapéu de Napoleão).', conduta: 'Confira as capas e a saia protetora antes de cada rua, trabalhe com vento abaixo de 10 km/h e, se der, suba para ponta de indução de ar.' }
        : { nivel: 'alta', texto: 'Herbicida em faixa no café com gota abaixo de "muito grossa" e sem proteção física: risco direto de deriva na saia e fitotoxidez (glifosato e glufosinato queimam folha e ponteiro).', conduta: 'Suba para ponta de indução de ar (AIXR, AI, TTI, AD-IA, AVI) ou defletor de grande ângulo em baixa pressão, e instale o chapéu de Napoleão / saia protetora.' });
      avisos.push({ nivel: 'info', texto: 'A dose da bula é por hectare TRATADO. Em faixa, o produto por hectare de lavoura cai na mesma proporção da área tratada.', conduta: `Com ${round(fracaoTratada * 100, 1)} % de área tratada, 1 ha de lavoura consome ${round(fracaoTratada, 2)} × a dose de bula.` });
    }
    if (velocidade > 8 && (gota ? gota.grau <= 3 : true)) avisos.push({ nivel: 'media', texto: `Velocidade de ${velocidade} km/h com gota fina/média aumenta deriva e desuniformidade (barra balança).`, conduta: 'Abaixo de 8 km/h em barra convencional; acima disso, gota grossa e barra estabilizada.' });
    if (modo === 'faixa') {
      const hf = alturaParaFaixa(angulo, faixaPorBico);
      const hMin = (ponta && (ponta.tipo === 'flood' || ponta.tipo === 'faixa-uniforme')) ? 15 : 25;
      if (hf < hMin) avisos.push({ nivel: 'media', texto: `Para fazer ${round(faixaPorBico, 2)} m de faixa por bico com ${angulo}°, a ponta teria de ficar a ${hf} cm do alvo — baixo demais (mínimo prático desta ponta: ${hMin} cm).`, conduta: 'Use ponta de ângulo menor (80°, faixa uniforme), reduza o número de bicos por faixa ou aceite faixa maior por bico.' });
      else if (hf > 80) avisos.push({ nivel: 'baixa', texto: `A faixa pedida exige a ponta a ${hf} cm do alvo — nessa altura o vento pega a nuvem.`, conduta: 'Use ponta de ângulo maior (flood 130°) ou mais bicos por faixa.' });
    }
    if (modo === 'area' && espacamento > 0.55) avisos.push({ nivel: 'baixa', texto: `Espaçamento de ${round(espacamento, 2)} m entre bicos exige barra mais alta para sobrepor.`, conduta: `Altura recomendada ≈ ${altura} cm; considere ponta de 120° para reduzir a altura.` });
    if (ponta && ponta.confirmar) avisos.push({ nivel: 'info', texto: `Os dados de ${ponta.modelo} ainda não foram conferidos no catálogo do fabricante.`, conduta: 'Confirme pressão e classe de gota antes de fechar a regulagem.' });
    if (gota && gota.estimado) avisos.push({ nivel: 'info', texto: 'Classe de gota estimada a partir da faixa publicada pelo fabricante (o catálogo não traz a classe pressão a pressão).', conduta: 'Para decisão de deriva, confirme na tabela do fabricante.' });

    return {
      modo, volumeHa, velocidade, espacamento: round(espacamento, 3), faixaPorBico: round(faixaPorBico, 3), nBicos,
      larguraTrabalho, larguraFaixa, entreLinhas, fracaoTratada: round(fracaoTratada, 3), economia,
      ponta: ponta ? { id: ponta.id, marca: ponta.marca, modelo: ponta.modelo, tipo: ponta.tipo, material: ponta.material, pressao: ponta.pressao, fonte: ponta.fonte } : null,
      iso, cor: ISO_MAP[iso] ? ISO_MAP[iso].cor : '', hex: ISO_MAP[iso] ? ISO_MAP[iso].hex : '', malha: ISO_MAP[iso] ? ISO_MAP[iso].malha : null,
      vazaoNominal: vazaoNom, vazaoNecessaria: qNecessaria, vazaoPorBico: qReal, vazaoTotal,
      pressao: round(pressao, 2), pressaoCalculada, volumeAplicado: volumeReal, volumeLavoura,
      angulo, protecao, altura, alturaFaixa: alturaParaFaixa(angulo, faixaPorBico), gota, rendimento, ficha, alvo: e.alvo || null,
      avisos, formulas, versao: '1.0.0'
    };
  }

  /* ───────── seleção de ponta ───────── */
  function selecionar(e) {
    e = e || {};
    const modo = e.modo === 'faixa' ? 'faixa' : 'area';
    const faixaPorBico = modo === 'faixa'
      ? (num(e.larguraFaixa) / Math.max(1, Math.round(num(e.bicosPorPassada) || 1)))
      : (num(e.espacamento) || 0.5);
    const q = vazaoNecessaria(num(e.volumeHa), num(e.velocidade), faixaPorBico);
    if (!(q > 0)) return { vazaoAlvo: 0, opcoes: [] };
    const alvo = ALVO_MAP[e.alvo], ideais = alvo ? alvo.gotas.map(g => GOTA_MAP[g].grau) : [];
    const opcoes = [];
    PONTAS.forEach(p => {
      if (e.marca && p.marca !== e.marca) return;
      if (e.tipo && p.tipo !== e.tipo) return;
      if (e.alvo && p.usos.indexOf(e.alvo) < 0 && p.id !== 'iso-generica') return;
      if (p.escalaPropria) return; // vazão fora da escala ISO: não dá para calcular aqui
      p.sizes.forEach(iso => {
        if (!ISO_MAP[iso]) return;
        const pressao = pressaoPara(iso, q);
        if (pressao < p.pressao[0] || pressao > p.pressao[1]) return;
        const gota = classeGota(p, pressao, iso);
        let score = 40;
        if (gota && ideais.length) {
          const min = Math.min.apply(null, ideais), max = Math.max.apply(null, ideais);
          if (gota.grau >= min && gota.grau <= max) score += 40;
          else score += Math.max(0, 25 - 12 * Math.min(Math.abs(gota.grau - min), Math.abs(gota.grau - max)));
        }
        // pressão confortável: perto do meio da faixa útil da ponta
        const meio = (p.pressao[0] + p.pressao[1]) / 2, span = (p.pressao[1] - p.pressao[0]) / 2 || 1;
        score += Math.round(20 * (1 - Math.min(Math.abs(pressao - meio) / span, 1)));
        if (pressao >= 1.5 && pressao <= 4) score += 8;
        if (gota && gota.estimado) score -= 4;
        if (p.confirmar) score -= 8;
        opcoes.push({
          ponta: p.id, marca: p.marca, modelo: p.modelo, tipo: p.tipo, iso, cor: ISO_MAP[iso].cor, hex: ISO_MAP[iso].hex,
          malha: ISO_MAP[iso].malha, pressao, vazao: round(q, 3), vazaoNominal: ISO_MAP[iso].vazao,
          angulo: p.angulos[0], gota, score, nota: p.nota, fonte: p.fonte, confirmar: !!p.confirmar
        });
      });
    });
    opcoes.sort((a, b) => b.score - a.score || a.pressao - b.pressao);
    return { vazaoAlvo: q, faixaPorBico: round(faixaPorBico, 3), opcoes: opcoes.slice(0, e.limite || 12) };
  }

  /* ───────── calibração a campo (coleta) ───────── */
  function calibracao(e) {
    e = e || {};
    const segundos = num(e.segundos) || 60;
    const coletas = (e.coletas || []).map(num).filter(v => v > 0);
    if (!coletas.length) return null;
    const vazoes = coletas.map(ml => round(ml * 60 / (1000 * segundos), 3)); // mL em t s → L/min
    const media = round(vazoes.reduce((s, v) => s + v, 0) / vazoes.length, 3);
    const dp = Math.sqrt(vazoes.reduce((s, v) => s + Math.pow(v - media, 2), 0) / vazoes.length);
    const cv = round(media > 0 ? 100 * dp / media : 0, 1);
    const nominal = e.iso ? vazaoPonta(e.iso, num(e.pressao)) : 0;
    const bicos = vazoes.map((v, i) => {
      const desvio = round(media > 0 ? 100 * (v - media) / media : 0, 1);
      const desgaste = nominal > 0 ? round(100 * (v - nominal) / nominal, 1) : null;
      return { n: i + 1, vazao: v, desvio, desgaste, trocar: Math.abs(desvio) > 10 || (desgaste != null && desgaste > 10) };
    });
    const faixaPorBico = e.modo === 'faixa'
      ? (num(e.larguraFaixa) / Math.max(1, Math.round(num(e.bicosPorPassada) || 1)))
      : (num(e.espacamento) || 0.5);
    const velocidade = num(e.velocidade) || (num(e.distancia) && num(e.tempo) ? velocidadeCampo(num(e.distancia), num(e.tempo)) : 0);
    const volumeReal = volumeAplicado(media, velocidade, faixaPorBico);
    const alvoVolume = num(e.volumeHa);
    const erro = alvoVolume > 0 ? round(100 * (volumeReal - alvoVolume) / alvoVolume, 1) : null;
    const correcao = [];
    if (erro != null && Math.abs(erro) > 5) {
      const pAtual = num(e.pressao);
      if (pAtual > 0) correcao.push(`Pressão: de ${pAtual} bar para ${novaPressao(pAtual, media, vazaoNecessaria(alvoVolume, velocidade, faixaPorBico))} bar.`);
      if (velocidade > 0) correcao.push(`Ou velocidade: de ${velocidade} km/h para ${velocidadeAlvo(media, alvoVolume, faixaPorBico)} km/h.`);
    }
    return {
      segundos, vazoes, media, cv, nominal, bicos, velocidade, faixaPorBico: round(faixaPorBico, 3),
      volumeReal, alvoVolume, erro, correcao,
      veredito: cv > 10 ? 'irregular' : (erro != null && Math.abs(erro) > 10 ? 'fora-do-alvo' : (cv > 5 ? 'aceitavel' : 'bom')),
      formulas: [
        { nome: 'Vazão medida', formula: 'q = (mL coletados × 60) ÷ (1000 × tempo em s)', calculo: `q = (${coletas[0]} × 60) ÷ (1000 × ${segundos})`, resultado: `${vazoes[0]} L/min` },
        { nome: 'Volume real', formula: 'V = (600 × q) ÷ (v × e)', calculo: `V = (600 × ${media}) ÷ (${velocidade} × ${round(faixaPorBico, 3)})`, resultado: `${volumeReal} L/ha` },
        { nome: 'Coeficiente de variação', formula: 'CV = desvio-padrão ÷ média × 100', calculo: `CV = ${round(dp, 3)} ÷ ${media} × 100`, resultado: `${cv} %` }
      ]
    };
  }

  /* ───────── cruzamento vazão × pressão ─────────
     A vazão de uma ponta varia com a raiz quadrada da pressão:
       q₂ = q₁ × √(p₂ ÷ p₁)      e      p₂ = p₁ × (q₂ ÷ q₁)²
     Com um par conhecido (vazão medida numa pressão medida) dá para achar a
     pressão de qualquer vazão desejada — inclusive em ponta sem tabela ISO,
     gasta ou de escala própria (ATR, cone vazio).                          */
  function cruzar(e) {
    e = e || {};
    const q1 = num(e.vazaoConhecida), p1 = num(e.pressaoConhecida);
    if (!(q1 > 0) || !(p1 > 0)) return null;
    const velocidade = num(e.velocidade), faixaPorBico = num(e.faixaPorBico);
    const out = { q1: round(q1, 3), p1: round(p1, 2), formulas: [], avisos: [] };
    const qd = num(e.vazaoDesejada), pd = num(e.pressaoDesejada), vd = num(e.volumeDesejado);

    if (vd > 0 && velocidade > 0 && faixaPorBico > 0) {
      out.alvo = 'volume';
      out.q2 = vazaoNecessaria(vd, velocidade, faixaPorBico);
      out.p2 = novaPressao(p1, q1, out.q2);
      out.formulas.push({ nome: 'Vazão para o volume desejado', formula: 'q₂ = (V × v × e) ÷ 600', calculo: `q₂ = (${vd} × ${velocidade} × ${round(faixaPorBico, 3)}) ÷ 600`, resultado: `${out.q2} L/min` });
      out.formulas.push({ nome: 'Pressão que dá essa vazão', formula: 'p₂ = p₁ × (q₂ ÷ q₁)²', calculo: `p₂ = ${round(p1, 2)} × (${out.q2} ÷ ${round(q1, 3)})²`, resultado: `${out.p2} bar` });
    } else if (qd > 0) {
      out.alvo = 'vazao';
      out.q2 = round(qd, 3);
      out.p2 = novaPressao(p1, q1, qd);
      out.formulas.push({ nome: 'Pressão para a vazão desejada', formula: 'p₂ = p₁ × (q₂ ÷ q₁)²', calculo: `p₂ = ${round(p1, 2)} × (${round(qd, 3)} ÷ ${round(q1, 3)})²`, resultado: `${out.p2} bar` });
    } else if (pd > 0) {
      out.alvo = 'pressao';
      out.p2 = round(pd, 2);
      out.q2 = novaVazao(q1, p1, pd);
      out.formulas.push({ nome: 'Vazão na pressão desejada', formula: 'q₂ = q₁ × √(p₂ ÷ p₁)', calculo: `q₂ = ${round(q1, 3)} × √(${round(pd, 2)} ÷ ${round(p1, 2)})`, resultado: `${out.q2} L/min` });
    } else return null;

    out.variacaoVazao = round(100 * (out.q2 - q1) / q1, 1);
    out.variacaoPressao = round(100 * (out.p2 - p1) / p1, 1);
    if (velocidade > 0 && faixaPorBico > 0) {
      out.volumeAntes = volumeAplicado(q1, velocidade, faixaPorBico);
      out.volumeDepois = volumeAplicado(out.q2, velocidade, faixaPorBico);
      out.velocidadeEquivalente = velocidadeAlvo(q1, out.volumeDepois, faixaPorBico);
      out.formulas.push({ nome: 'Volume antes × depois', formula: 'V = (600 × q) ÷ (v × e)', calculo: `${out.volumeAntes} L/ha → (600 × ${out.q2}) ÷ (${velocidade} × ${round(faixaPorBico, 3)})`, resultado: `${out.volumeDepois} L/ha` });
      out.formulas.push({ nome: 'Mesmo efeito só com a velocidade', formula: 'v₂ = (600 × q₁) ÷ (V₂ × e)', calculo: `v₂ = (600 × ${round(q1, 3)}) ÷ (${out.volumeDepois} × ${round(faixaPorBico, 3)})`, resultado: `${out.velocidadeEquivalente} km/h (sem mexer na pressão)` });
    }
    const ponta = PONTA_MAP[e.ponta];
    if (ponta) {
      const [pmin, pmax] = ponta.pressao;
      if (out.p2 < pmin) out.avisos.push({ nivel: 'alta', texto: `${out.p2} bar fica abaixo do mínimo da ${ponta.modelo} (${pmin} bar) — o leque não forma.`, conduta: 'Troque por uma ponta de vazão menor e volte a cruzar.' });
      else if (out.p2 > pmax) out.avisos.push({ nivel: 'alta', texto: `${out.p2} bar passa do máximo da ${ponta.modelo} (${pmax} bar) — gota fina e desgaste acelerado.`, conduta: 'Troque por uma ponta de vazão maior e volte a cruzar.' });
      const g = classeGota(ponta, out.p2, e.iso);
      if (g) out.gota = g;
    }
    if (Math.abs(out.variacaoVazao) > 40) out.avisos.push({ nivel: 'media', texto: `Mudança de ${out.variacaoVazao > 0 ? '+' : ''}${out.variacaoVazao} % na vazão exige ${out.variacaoPressao > 0 ? '+' : ''}${out.variacaoPressao} % de pressão — é muito para corrigir só no manômetro.`, conduta: 'Mude o tamanho da ponta (ou a velocidade): a pressão só corrige bem ajustes de até ±20 %.' });
    return out;
  }

  /* tabela cruzada pressão × tamanho, como a do catálogo, com o volume que
     cada célula entrega na velocidade e no espaçamento em uso */
  function tabelaCruzada(e) {
    e = e || {};
    const ponta = PONTA_MAP[e.ponta];
    const sizes = (e.sizes || (ponta && !ponta.escalaPropria ? ponta.sizes : null) || ['015', '02', '025', '03', '04', '05']).filter(s => ISO_MAP[s]);
    const faixa = ponta ? ponta.pressao : [1, 6];
    const pressoes = e.pressoes || [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8].filter(p => p >= faixa[0] - 1e-9 && p <= faixa[1] + 1e-9);
    const velocidade = num(e.velocidade), faixaPorBico = num(e.faixaPorBico), alvo = num(e.volumeAlvo);
    const linhas = pressoes.map(bar => ({
      bar,
      celulas: sizes.map(iso => {
        const vazao = vazaoPonta(iso, bar);
        const volume = (velocidade > 0 && faixaPorBico > 0) ? volumeAplicado(vazao, velocidade, faixaPorBico) : null;
        const gota = ponta ? classeGota(ponta, bar, iso) : null;
        return { iso, vazao, volume, gota, noAlvo: alvo > 0 && volume != null && Math.abs(volume - alvo) / alvo <= 0.05 };
      })
    }));
    return { sizes, pressoes, linhas, velocidade, faixaPorBico: round(faixaPorBico, 3), volumeAlvo: alvo, ponta: ponta ? ponta.id : null };
  }

  /* ───────── API ───────── */
  return {
    versao: '1.0.0',
    ISO, ISO_MAP, GOTAS, GOTA_MAP, ALVOS, ALVO_MAP, TIPOS, PONTAS, PONTA_MAP, PRESETS,
    vazaoNominal, vazaoPonta, pressaoPara, novaVazao, novaPressao,
    vazaoNecessaria, volumeAplicado, velocidadeAlvo, velocidadeCampo,
    alturaBarra, alturaParaFaixa, larguraJato, fatorAltura, classeGota,
    calcular, selecionar, calibracao, cruzar, tabelaCruzada
  };
});
