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

  /* ───────── Tabelas de vazão publicadas (L/min) ─────────
     Pontas cujo tamanho NÃO segue a vazão nominal ISO — ou que o fabricante
     publica até pressões muito acima dos 3 bar da norma — trazem a própria
     tabela. O motor interpola em √p entre as linhas (exato nos pontos da
     tabela) e extrapola pela lei da raiz quadrada fora dela.
     Fonte: Catálogo Albuz 2022, páginas 20 a 25.                            */
  const TAB_ATR = {  // escala de cores europeia da Albuz (80° e 60°)
    fonte: 'Catálogo Albuz 2022, p. 20 (80°) e p. 21 (60°)',
    pressoes: [5, 7, 10, 12, 15, 20, 25],
    valores: {
      'branco': [0.27, 0.32, 0.38, 0.41, 0.46, 0.52, 0.58],
      'lilás': [0.36, 0.42, 0.50, 0.55, 0.61, 0.70, 0.77],
      'marrom': [0.48, 0.56, 0.67, 0.73, 0.81, 0.93, 1.04],
      'amarelo': [0.73, 0.86, 1.03, 1.12, 1.25, 1.44, 1.61],
      'laranja': [0.99, 1.17, 1.39, 1.51, 1.69, 1.94, 2.16],
      'vermelho': [1.38, 1.62, 1.92, 2.09, 2.33, 2.67, 2.97],
      'cinza': [1.50, 1.76, 2.08, 2.26, 2.51, 2.88, 3.20],
      'verde': [1.78, 2.09, 2.47, 2.69, 2.99, 3.42, 3.80],
      'preto': [2.00, 2.35, 2.78, 3.03, 3.36, 3.85, 4.28],
      'azul': [2.45, 2.87, 3.40, 3.71, 4.12, 4.72, 5.25],
      'roxo': [3.05, 3.57, 4.23, 4.61, 5.12, 5.87, 6.52]
    },
    so80: ['branco', 'roxo']   // o 60° não tem esses dois
  };
  const TAB_ATI = {  // código ISO, mas com vazão publicada de 5 a 25 bar
    fonte: 'Catálogo Albuz 2022, p. 22',
    pressoes: [5, 7, 10, 12, 15, 20, 25],
    valores: {
      '0050': [0.26, 0.31, 0.37, 0.40, 0.45, 0.52, 0.58],
      '0075': [0.39, 0.46, 0.55, 0.60, 0.67, 0.77, 0.87],
      '01': [0.52, 0.61, 0.73, 0.80, 0.89, 1.03, 1.15],
      '015': [0.77, 0.92, 1.10, 1.20, 1.34, 1.55, 1.73],
      '02': [1.03, 1.22, 1.46, 1.60, 1.79, 2.07, 2.31],
      '025': [1.29, 1.53, 1.83, 2.00, 2.24, 2.58, 2.89],
      '03': [1.55, 1.83, 2.19, 2.40, 2.68, 3.10, 3.46],
      '035': [1.81, 2.14, 2.56, 2.80, 3.13, 3.61, 4.04],
      '04': [2.07, 2.44, 2.92, 3.20, 3.58, 4.13, 4.62],
      '05': [2.58, 3.06, 3.65, 4.00, 4.47, 5.16, 5.77]
    }
  };
  const TAB_TVI = {  // cone vazio com indução de ar; os três LP saem de 3 bar
    fonte: 'Catálogo Albuz 2022, p. 25',
    pressoes: [5, 7, 10, 12, 15, 20, 25],
    valores: {
      '0050': [0.26, 0.31, 0.37, 0.40, 0.45, 0.52, 0.58],
      '0075': [0.39, 0.46, 0.55, 0.60, 0.67, 0.77, 0.87],
      '01': [0.52, 0.61, 0.73, 0.80, 0.89, 1.03, 1.15],
      '015': [0.77, 0.92, 1.10, 1.20, 1.34, 1.55, 1.73],
      '02': [1.03, 1.22, 1.46, 1.60, 1.79, 2.07, 2.31],
      '025': [1.29, 1.53, 1.83, 2.00, 2.24, 2.58, 2.89],
      '03': [1.55, 1.83, 2.19, 2.40, 2.68, 3.10, 3.46],
      '04': [2.07, 2.44, 2.92, 3.20, 3.58, 4.13, 4.62]
    }
  };
  const TAB_ATF = {  // cone cheio, publicada a partir de 3 bar
    fonte: 'Catálogo Albuz 2022, p. 24',
    pressoes: [3, 5, 7, 10, 12, 15, 20],
    valores: {
      '015': [0.60, 0.77, 0.92, 1.10, 1.20, 1.34, 1.55],
      '02': [0.80, 1.03, 1.22, 1.46, 1.60, 1.79, 2.07],
      '025': [1.00, 1.29, 1.53, 1.83, 2.00, 2.24, 2.58],
      '03': [1.20, 1.55, 1.83, 2.19, 2.40, 2.68, 3.10],
      '04': [1.60, 2.07, 2.44, 2.92, 3.20, 3.58, 4.13],
      '05': [2.00, 2.58, 3.06, 3.65, 4.00, 4.47, 5.16]
    }
  };

  const TAB_JC_AIRMIX = {   // Jacto AIRMIX: código ISO, 20 a 80 PSI
    fonte: 'Folheto Jacto AIRMIX (930000238, 03/2014)',
    pressoes: [1.38, 2.07, 2.76, 3.45, 4.14, 4.83, 5.52],
    valores: {
      '01': [0.27, 0.33, 0.38, 0.43, 0.47, 0.51, 0.54],
      '015': [0.41, 0.50, 0.57, 0.64, 0.70, 0.76, 0.81],
      '02': [0.54, 0.66, 0.77, 0.86, 0.94, 1.02, 1.09],
      '025': [0.68, 0.83, 0.96, 1.07, 1.17, 1.27, 1.36],
      '03': [0.81, 1.00, 1.15, 1.29, 1.41, 1.52, 1.63],
      '04': [1.09, 1.33, 1.53, 1.71, 1.88, 2.03, 2.17],
      '05': [1.36, 1.66, 1.92, 2.14, 2.35, 2.54, 2.71],
      '06': [1.63, 1.99, 2.30, 2.57, 2.82, 3.05, 3.26]
    }
  };

  /* ───────── Pontas de numeração própria (não ISO) ─────────
     Flood, cone e boomless são numerados pela vazão em gpm a 10 psi ou por
     disco e núcleo. Sem a tabela do fabricante não dá para calcular nada —
     com ela, entram na regulagem como qualquer outra.                      */
  const TAB_TJ_TF = {   // TurboFloodJet: TF-2 = 0,2 gpm a 10 psi
    fonte: 'Catálogo TeeJet Brasil (cat51a-pt, p. 47)',
    pressoes: [1, 1.5, 2, 2.5, 3],
    valores: {
      'TF-2': [0.91, 1.11, 1.29, 1.44, 1.58],
      'TF-2.5': [1.14, 1.40, 1.61, 1.80, 1.97],
      'TF-3': [1.37, 1.68, 1.94, 2.17, 2.37],
      'TF-4': [1.82, 2.23, 2.57, 2.88, 3.15],
      'TF-5': [2.28, 2.79, 3.22, 3.60, 3.95],
      'TF-7.5': [3.42, 4.19, 4.84, 5.41, 5.92],
      'TF-10': [4.56, 5.58, 6.45, 7.21, 7.90]
    }
  };
  const TAB_TJ_TX = {   // ConeJet: numeração por disco e núcleo
    fonte: 'Catálogo TeeJet Brasil (cat51a-pt, p. 81)',
    pressoes: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
    valores: {
      'TX-1': [0.055, 0.065, 0.074, 0.081, 0.087, 0.098, 0.108, 0.116, 0.127, 0.143],
      'TX-2': [0.110, 0.131, 0.148, 0.164, 0.177, 0.201, 0.221, 0.240, 0.264, 0.299],
      'TX-3': [0.164, 0.196, 0.223, 0.245, 0.266, 0.301, 0.332, 0.359, 0.396, 0.449],
      'TX-4': [0.218, 0.262, 0.299, 0.331, 0.360, 0.410, 0.454, 0.493, 0.546, 0.623],
      'TX-6': [0.327, 0.393, 0.448, 0.496, 0.539, 0.615, 0.681, 0.740, 0.819, 0.934],
      'TX-8': [0.433, 0.525, 0.603, 0.671, 0.732, 0.840, 0.934, 1.02, 1.13, 1.30],
      'TX-10': [0.541, 0.657, 0.753, 0.838, 0.915, 1.05, 1.17, 1.27, 1.42, 1.63],
      'TX-12': [0.649, 0.788, 0.904, 1.01, 1.10, 1.26, 1.40, 1.53, 1.70, 1.95],
      'TX-18': [0.968, 1.18, 1.37, 1.53, 1.67, 1.93, 2.15, 2.35, 2.63, 3.03],
      'TX-26': [1.40, 1.71, 1.97, 2.20, 2.41, 2.78, 3.11, 3.40, 3.80, 4.38]
    }
  };
  const TAB_ALB_APE = { // escala de cores europeia da Albuz
    fonte: 'Catálogo Albuz 2022 (p. 10)',
    pressoes: [2, 2.5, 3, 3.5, 4],
    valores: {
      'amarelo': [0.49, 0.55, 0.61, 0.65, 0.70],
      'laranja': [0.69, 0.77, 0.85, 0.92, 0.98],
      'vermelho': [0.99, 1.11, 1.21, 1.31, 1.40],
      'verde': [1.40, 1.57, 1.71, 1.85, 1.98],
      'turquesa': [1.69, 1.89, 2.07, 2.24, 2.39],
      'azul': [1.98, 2.21, 2.42, 2.62, 2.80],
      'cinza': [2.79, 3.11, 3.41, 3.69, 3.94],
      'preto': [3.95, 4.41, 4.83, 5.22, 5.58],
      'marfim': [5.61, 6.28, 6.88, 7.43, 7.94],
      'branco': [7.82, 8.85, 9.70, 10.48, 11.20]
    }
  };
  const TAB_HY_DT = {   // DeflecTip: mesma escala do flood da TeeJet
    fonte: 'Hypro — Crop Spraying Pocket Guide (p. 26)',
    pressoes: [1, 2, 3],
    valores: {
      'DT0.5': [0.23, 0.33, 0.40],
      'DT0.75': [0.35, 0.49, 0.59],
      'DT1.0': [0.46, 0.65, 0.80],
      'DT1.5': [0.68, 0.97, 1.17],
      'DT2.0': [0.91, 1.29, 1.58],
      'DT2.5': [1.14, 1.61, 1.98],
      'DT3.0': [1.37, 1.93, 2.37]
    },
    /* largura de faixa a 50 cm de altura e ângulo de cada tamanho */
    faixa: { 'DT0.5': 0.8, 'DT0.75': 1.1, 'DT1.0': 1.3, 'DT1.5': 1.3, 'DT2.0': 1.3, 'DT2.5': 1.4, 'DT3.0': 1.4 },
    angulo: { 'DT0.5': 80, 'DT0.75': 95, 'DT1.0': 105, 'DT1.5': 105, 'DT2.0': 105, 'DT2.5': 110, 'DT3.0': 110 }
  };
  const TAB_HY_XT = {   // Boom X Tender: boomless, faixa de 3,9 a 4,9 m
    fonte: 'Hypro — Crop Spraying Pocket Guide (p. 28)',
    pressoes: [2, 3, 4],
    valores: {
      'XT010': [3.2, 3.9, 4.6],
      'XT020': [6.4, 7.9, 9.1],
      'XT024': [7.7, 9.5, 10.9]
    },
    faixa: { 'XT010': 3.9, 'XT020': 4.8, 'XT024': 4.9 }
  };

  /* TeeJet — catálogo Brasil "Bicos para área total". A vazão é a mesma em
     todas as famílias de jato plano da marca (muda a gota, não a vazão), por
     isso uma tabela só serve para todas elas. Note que a TeeJet publica a
     nominal de 3 bar em 0,79 L/min para a 02, enquanto Hypro, Magnojet e
     Albuz publicam 0,80 — ~1 % de diferença entre catálogos.               */
  const TAB_TJ = {
    fonte: 'Catálogo TeeJet Brasil — Bicos para área total (p. 7 a 18)',
    pressoes: [1, 2, 3, 4, 5, 6],
    valores: {
      '01': [0.23, 0.32, 0.39, 0.45, 0.50, 0.55],
      '015': [0.34, 0.48, 0.59, 0.68, 0.76, 0.83],
      '02': [0.46, 0.65, 0.79, 0.91, 1.02, 1.12],
      '025': [0.57, 0.81, 0.99, 1.14, 1.28, 1.40],
      '03': [0.68, 0.96, 1.18, 1.36, 1.52, 1.67],
      '04': [0.91, 1.29, 1.58, 1.82, 2.04, 2.23],
      '05': [1.14, 1.61, 1.97, 2.27, 2.54, 2.79],
      '06': [1.37, 1.94, 2.37, 2.74, 3.06, 3.35],
      '08': [1.82, 2.58, 3.16, 3.65, 4.08, 4.47]
    }
  };
  /* Hypro (Pentair) — Crop Spraying Guide. Também vale para toda a linha de
     jato plano da marca; os valores de 1 bar vêm das tabelas GuardianAIR e 3D
     e os de 06/08 das tabelas Ultra Lo-Drift.                              */
  const TAB_HYPRO = {
    fonte: 'Pentair Hypro — Crop Spraying Guide (GuardianAIR, ULD e 3D)',
    pressoes: [1, 2, 3, 4, 5],
    valores: {
      '015': [0.346, 0.490, 0.600, 0.693, 0.775],
      '02': [0.462, 0.653, 0.800, 0.924, 1.033],
      '025': [0.577, 0.816, 1.000, 1.155, 1.291],
      '03': [0.693, 0.980, 1.200, 1.386, 1.550],
      '035': [0.808, 1.143, 1.400, 1.616, 1.807],
      '04': [0.924, 1.306, 1.600, 1.848, 2.066],
      '05': [1.155, 1.633, 2.000, 2.309, 2.582],
      '06': [1.386, 1.960, 2.400, 2.771, 3.098],
      '08': [1.848, 2.613, 3.200, 3.695, 4.131]
    }
  };

  /* Magnojet — catálogo 2025 (magnojet.com.br). As pressões são as do
     catálogo em bar (15 a 150 PSI, conforme a linha). Os valores batem com a
     ISO 10625 dentro de ~1 % nas pontas de jato plano; o cone MAG tem escala
     própria (MAG1 a MAG6) e só existe em tabela.                            */
  const TAB_MJ_AD = {          // jato plano antideriva, 15–60 PSI
    fonte: 'Catálogo Magnojet 2025, p. 25 (AD)',
    pressoes: [1.03, 1.38, 2.07, 2.76, 3.45, 4.14],
    valores: {
      '01': [0.23, 0.27, 0.33, 0.38, 0.43, 0.47],
      '015': [0.35, 0.41, 0.50, 0.58, 0.64, 0.70],
      '02': [0.47, 0.54, 0.66, 0.77, 0.86, 0.94],
      '025': [0.59, 0.68, 0.83, 0.96, 1.07, 1.17],
      '03': [0.70, 0.81, 1.00, 1.15, 1.29, 1.41],
      '04': [0.94, 1.08, 1.33, 1.53, 1.72, 1.88],
      '05': [1.17, 1.36, 1.66, 1.92, 2.14, 2.35]
    }
  };
  const TAB_MJ_ADIA = {        // jato plano com indução de ar, 30–110 PSI
    fonte: 'Catálogo Magnojet 2025, p. 29 (AD-IA)',
    pressoes: [2.07, 2.76, 3.45, 4.14, 4.83, 5.52, 6.21, 6.89, 7.58],
    valores: {
      '015': [0.50, 0.58, 0.64, 0.70, 0.76, 0.81, 0.86, 0.91, 0.95],
      '02': [0.66, 0.77, 0.86, 0.94, 1.01, 1.08, 1.15, 1.21, 1.27],
      '025': [0.83, 0.96, 1.07, 1.17, 1.27, 1.36, 1.44, 1.52, 1.59],
      '03': [1.00, 1.15, 1.29, 1.41, 1.52, 1.63, 1.73, 1.82, 1.91],
      '04': [1.33, 1.53, 1.72, 1.88, 2.03, 2.17, 2.30, 2.43, 2.54],
      '05': [1.66, 1.92, 2.14, 2.35, 2.54, 2.71, 2.88, 3.03, 3.18],
      '06': [1.99, 2.30, 2.57, 2.82, 3.04, 3.25, 3.45, 3.64, 3.82],
      '08': [2.66, 3.07, 3.43, 3.76, 4.06, 4.34, 4.60, 4.85, 5.09]
    }
  };
  const TAB_MJ_MUG = {         // Magno Ultra Grossa, jato plano, 30–100 PSI
    fonte: 'Catálogo Magnojet 2025, p. 16 (MUG)',
    pressoes: [2.07, 2.76, 3.45, 4.14, 4.83, 5.52, 6.21, 6.89],
    valores: {
      '015': [0.50, 0.58, 0.64, 0.70, 0.76, 0.81, 0.86, 0.91],
      '02': [0.66, 0.77, 0.86, 0.94, 1.01, 1.08, 1.15, 1.21],
      '025': [0.83, 0.96, 1.07, 1.17, 1.27, 1.36, 1.44, 1.52],
      '03': [1.00, 1.15, 1.29, 1.41, 1.52, 1.63, 1.73, 1.82],
      '035': [1.16, 1.34, 1.50, 1.64, 1.78, 1.90, 2.01, 2.12],
      '04': [1.33, 1.53, 1.72, 1.88, 2.03, 2.17, 2.30, 2.43],
      '05': [1.66, 1.92, 2.14, 2.35, 2.54, 2.71, 2.88, 3.03]
    }
  };
  const TAB_MJ_MUGCV = {       // Magno Ultra Grossa cone vazio, 30–80 PSI
    fonte: 'Catálogo Magnojet 2025, p. 18 (MUG-CV)',
    pressoes: [2.07, 2.76, 3.45, 4.14, 4.83, 5.52],
    valores: {
      '015': [0.50, 0.58, 0.64, 0.70, 0.76, 0.81],
      '02': [0.66, 0.77, 0.86, 0.94, 1.01, 1.08],
      '025': [0.83, 0.96, 1.07, 1.17, 1.27, 1.36],
      '03': [1.00, 1.15, 1.29, 1.41, 1.52, 1.63],
      '035': [1.16, 1.34, 1.50, 1.64, 1.78, 1.90],
      '04': [1.33, 1.53, 1.72, 1.88, 2.03, 2.17]
    }
  };
  const TAB_MJ_MAG = {         // cone vazio cerâmico, escala própria, 60–150 PSI
    fonte: 'Catálogo Magnojet 2025, p. 54 (MAG)',
    pressoes: [4.14, 4.83, 5.52, 6.21, 6.89, 7.58, 8.27, 8.96, 9.65, 10.34],
    valores: {
      'MAG1': [0.32, 0.34, 0.36, 0.38, 0.41, 0.42, 0.44, 0.46, 0.48, 0.50],
      'MAG1.5': [0.43, 0.45, 0.48, 0.52, 0.54, 0.56, 0.58, 0.60, 0.62, 0.66],
      'MAG2': [0.64, 0.68, 0.72, 0.76, 0.80, 0.84, 0.88, 0.92, 0.94, 1.00],
      'MAG3': [0.88, 0.94, 1.00, 1.06, 1.12, 1.18, 1.24, 1.28, 1.33, 1.34],
      'MAG4': [1.25, 1.34, 1.42, 1.51, 1.60, 1.68, 1.76, 1.85, 1.92, 2.00],
      'MAG5': [1.60, 1.72, 1.84, 1.93, 2.00, 2.12, 2.20, 2.28, 2.38, 2.44],
      'MAG6': [2.10, 2.24, 2.40, 2.54, 2.66, 2.80, 2.94, 3.06, 3.16, 3.24]
    }
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
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 4], material: 'Polímero (VP) ou inox (VS)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'M', 1.5: 'F', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Faixa ampliada: mantém o padrão de 1 a 4 bar. Cobertura boa, deriva alta — evite em dia de vento.',
      fonte: 'Catálogo TeeJet Brasil — Bicos para área total'
    },
    {
      id: 'tj-xrc', marca: 'TeeJet', modelo: 'XRC TeeJet (cerâmica)', tipo: 'leque', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 4], material: 'Cerâmica', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'M', 1.5: 'F', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato'],
      nota: 'Mesmo padrão do XR com orifício cerâmico — vida útil muito maior em calda abrasiva (WG/WP).',
      fonte: 'Catálogo TeeJet Brasil'
    },
    {
      id: 'tj-tt', marca: 'TeeJet', modelo: 'TT TeeJet (Turbo TeeJet)', tipo: 'leque-defletor', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 6], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'MG', 2: 'G', 3: 'M', 4: 'M', 5: 'F', 6: 'F' },
      usos: ['herbicida-sistemico', 'herbicida-contato', 'dessecacao', 'foliar'],
      nota: 'Jato defletor de grande ângulo e bordas suaves: bom para sistêmico e de contato, deriva controlada abaixo de 3 bar.',
      fonte: 'Catálogo TeeJet Brasil — Turbo TeeJet'
    },
    {
      id: 'tj-aixr', marca: 'TeeJet', modelo: 'AIXR TeeJet', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 6], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'EG', 2: 'MG', 3: 'G', 4: 'G', 5: 'G', 6: 'M' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao', 'herbicida-cafe', 'foliar'],
      nota: 'Indução de ar que trabalha desde 1 bar — a mais versátil para herbicida com janela de vento apertada.',
      fonte: 'Catálogo TeeJet Brasil — Jato plano XR com indução de ar'
    },
    {
      id: 'tj-ai', marca: 'TeeJet', modelo: 'AI TeeJet (AI110 / AI80)', tipo: 'leque-inducao', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2, 8], material: 'Inox (VS)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 2: 'UG', 3: 'EG', 4: 'EG', 5: 'MG', 6: 'MG', 7: 'G', 8: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Gota muito grossa com pré-orifício — deriva mínima. Não usar com filtro de ponta 4193A com válvula de retenção.',
      fonte: 'Catálogo TeeJet Brasil — Jato plano com indução de ar'
    },
    {
      id: 'tj-aic', marca: 'TeeJet', modelo: 'AIC TeeJet (cerâmica)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2, 8], material: 'Cerâmica', vazaoTabela: TAB_TJ,
      gotasPorBar: { 2: 'UG', 3: 'EG', 4: 'EG', 5: 'MG', 6: 'MG', 7: 'G', 8: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe'],
      nota: 'AI com orifício cerâmico: mesma gota, vida útil maior.',
      fonte: 'Catálogo TeeJet Brasil'
    },
    {
      id: 'tj-tti', marca: 'TeeJet', modelo: 'TTI TeeJet (Turbo TeeJet Indução)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 7], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'UG', 2: 'UG', 3: 'UG', 4: 'UG', 5: 'EG', 6: 'EG', 7: 'EG' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe'],
      nota: 'Gota ultragrossa em toda a faixa: é a ponta de menor deriva do catálogo — indicada para 2,4-D, dicamba e aplicação dirigida no café.',
      fonte: 'Catálogo TeeJet Brasil — TTI'
    },
    {
      id: 'tj-dg', marca: 'TeeJet', modelo: 'DG TeeJet (DriftGuard)', tipo: 'leque-pre-orificio', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 5], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 2: 'M', 2.5: 'M', 3: 'M', 4: 'M', 5: 'M' },
      usos: ['herbicida-contato', 'fungicida', 'dessecacao', 'foliar'],
      nota: 'Pré-orifício: gota média estável — meio-termo entre cobertura e deriva.',
      fonte: 'Catálogo TeeJet Brasil — DG'
    },
    {
      id: 'tj-ttj60', marca: 'TeeJet', modelo: 'TTJ60 (Turbo TeeJet Duplo)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['02', '025', '03', '04', '05'], pressao: [1.5, 6], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1.5: 'G', 2: 'G', 3: 'G', 4: 'M', 5: 'M', 6: 'M' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Dois jatos (para frente e para trás): penetra no dossel e cobre espiga/haste — fungicida e inseticida.',
      fonte: 'Catálogo TeeJet Brasil — TTJ60'
    },
    {
      id: 'tj-aittj60', marca: 'TeeJet', modelo: 'AITTJ60 (duplo com indução de ar)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['02', '025', '03', '04', '05'], pressao: [1.5, 6], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1.5: 'EG', 2: 'MG', 3: 'MG', 4: 'G', 5: 'G', 6: 'G' },
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'foliar'],
      nota: 'Duplo com indução de ar: penetração do duplo com a deriva controlada da indução.',
      fonte: 'Catálogo TeeJet Brasil — AITTJ60'
    },
    {
      id: 'tj-ai3070', marca: 'TeeJet', modelo: 'AI3070 (duplo assimétrico 30°/70°)', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04'], pressao: [1.5, 6], material: 'Polímero (VP)', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1.5: 'EG', 2: 'MG', 3: 'G', 4: 'G', 5: 'M', 6: 'M' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Jatos de 30° e 70° com indução de ar — deposição nos dois lados do alvo vertical.',
      fonte: 'Catálogo TeeJet Brasil — AI3070'
    },
    {
      id: 'tj-even', marca: 'TeeJet', modelo: 'TP…E (jato plano de faixa uniforme)', tipo: 'faixa-uniforme', angulos: [80, 95],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [1, 4], material: 'Latão / inox / polímero', vazaoTabela: TAB_TJ,
      gotasPorBar: { 1: 'M', 2: 'F', 3: 'F', 4: 'F' },
      usos: ['herbicida-cafe', 'herbicida-contato', 'pre-emergente'],
      nota: 'Deposição uniforme de borda a borda (não foi feita para sobrepor): é a ponta da aplicação em FAIXA — linha de plantio, canteiro, faixa do café. Largura da faixa = ângulo × altura.',
      fonte: 'TeeJet — Even Flat Spray (aplicação em faixa)'
    },
    {
      id: 'tj-tf', marca: 'TeeJet', modelo: 'TF TurboFloodJet (defletor de grande ângulo)', tipo: 'flood', angulos: [130, 145],
      sizes: ['TF-2', 'TF-2.5', 'TF-3', 'TF-4', 'TF-5', 'TF-7.5', 'TF-10'], escalaPropria: true, vazaoTabela: TAB_TJ_TF,
      pressao: [1, 3], material: 'Inox (VS) ou polímero (VP)',
      gotasPorBar: { 1: 'UG', 1.5: 'UG', 2: 'EG', 2.5: 'MG', 3: 'MG' },
      usos: ['herbicida-cafe', 'pre-emergente', 'herbicida-sistemico', 'foliar'],
      nota: 'Câmara de turbulência com pré-orifício: gota ultragrossa a 1–1,5 bar e deriva mínima. É o tipo montado nas barras de herbicida de café (o Jacto PH-400 usa flood de 130° com ~500 µm a 1 bar). A numeração é por vazão: TF-2 = 0,2 gpm a 10 psi, o que dá 1,58 L/min a 3 bar — não confunda com o tamanho ISO 02.',
      fonte: 'Catálogo TeeJet Brasil (p. 47 e 199) + Jacto PH-400 (SBCPD)'
    },
    {
      id: 'tj-tx', marca: 'TeeJet', modelo: 'TX ConeJet (cone vazio)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['TX-1', 'TX-2', 'TX-3', 'TX-4', 'TX-6', 'TX-8', 'TX-10', 'TX-12', 'TX-18', 'TX-26'], escalaPropria: true, vazaoTabela: TAB_TJ_TX,
      pressao: [2, 20], material: 'Cerâmica (VK), inox (VS) ou latão',
      gotasPorBar: { 2: 'MF', 5: 'MF', 10: 'MF', 20: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio de 2 a 20 bar para turbo atomizador em café e citros: gota muito fina em toda a faixa, cobertura máxima e deriva alta. A numeração é por disco e núcleo (TX-6, TX-10…), não pelo código ISO — a TX-6 dá 0,54 L/min a 3 bar, nada a ver com a 06 da norma.',
      fonte: 'Catálogo TeeJet Brasil (p. 81)'
    },
    /* ── Magnojet ── */
    {
      id: 'mj-ad', marca: 'Magnojet', modelo: 'AD (leque antideriva com pré-orifício)', tipo: 'leque-pre-orificio', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05'], pressao: [1.03, 4.14], material: 'Cerâmica 99 % alumina', vazaoTabela: TAB_MJ_AD,
      gotasPorBar: { 1.03: 'M', 1.38: 'M', 2.07: 'M', 2.76: 'M', 3.45: 'M', 4.14: 'M' },
      usos: ['herbicida-sistemico', 'herbicida-contato', 'fungicida', 'dessecacao', 'foliar'],
      nota: 'Pré-orifício equilibra a pressão interna e o orifício cerâmico segura o padrão do leque: gotas de ~300–400 µm de 15 a 60 PSI. Compatível com PWM (bico pulsado). Herbicida de contato e sistêmico em pós, inseticida, fungicida e foliar.',
      fonte: 'Catálogo Magnojet 2025 (p. 25) + DRS Pulverizadores'
    },
    {
      id: 'mj-mug-cv', marca: 'Magnojet', modelo: 'MUG-CV — cone vazio ultragrosso (indução de ar)', tipo: 'cone-vazio', angulos: [90],
      sizes: ['015', '02', '025', '03', '035', '04'], pressao: [2.07, 5.52], material: 'Cerâmica', vazaoTabela: TAB_MJ_MUGCV,
      gotasPorBar: { 2.07: 'UG', 2.76: 'UG', 3.45: 'UG', 4.14: 'UG', 4.83: 'UG', 5.52: 'UG' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Cone vazio de 90° com venturi e pré-orifício, 30 a 80 PSI: gota ultragrossa em toda a faixa, coisa rara num cone. Recomendada pelo fabricante para 2,4-D, glifosato e sistêmicos perto de cultura sensível — e é a opção de cone para a barra dirigida do café.',
      fonte: 'Catálogo Magnojet 2025 (p. 18)'
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
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [2.07, 7.58], material: 'Cerâmica', vazaoTabela: TAB_MJ_ADIA,
      gotasPorBar: { 2.07: 'UG', 2.76: 'EG', 3.45: 'EG', 4.14: 'EG', 4.83: 'MG', 5.52: 'MG', 6.21: 'MG', 6.89: 'MG', 7.58: 'G' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Venturi com pré-orifício, 30 a 110 PSI: ultragrossa a 2 bar, vai afinando até grossa a 7,6 bar. Indicada pelo fabricante para herbicida sistêmico em pré e pós, e para aplicação perto de cultura sensível ou bordadura. Também em 80°.',
      fonte: 'Catálogo Magnojet 2025 (p. 29)'
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
      id: 'mj-mug', marca: 'Magnojet', modelo: 'MUG — Magno Ultra Grossa (indução de ar)', tipo: 'leque-inducao', angulos: [110],
      sizes: ['015', '02', '025', '03', '035', '04', '05'], pressao: [2.07, 6.89], material: 'Cerâmica', vazaoTabela: TAB_MJ_MUG,
      gotasPorBar: { 2.07: 'UG', 2.76: 'UG', 3.45: 'UG', 4.14: 'UG', 4.83: 'UG', 5.52: 'UG', 6.21: 'UG', 6.89: 'UG' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao', 'herbicida-cafe'],
      nota: 'Ultragrossa em toda a faixa (30 a 100 PSI), com jato inclinado 30° — dá para montar tudo para a frente ou alternado na barra. Índice de risco de deriva de 1 %, homologada para dicamba no Brasil e nos EUA; feita para 2,4-D e glifosato perto de cultura sensível.',
      fonte: 'Catálogo Magnojet 2025 (p. 16)'
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
      id: 'mj-mag', marca: 'Magnojet', modelo: 'MAG (cone vazio cerâmico)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['MAG1', 'MAG1.5', 'MAG2', 'MAG3', 'MAG4', 'MAG5', 'MAG6'], escalaPropria: true, vazaoTabela: TAB_MJ_MAG,
      pressao: [4.14, 10.34], material: 'Cerâmica',
      gotasFaixa: ['F', 'MF'],
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio de 60 a 150 PSI para turbo atomizador e alta pressão (café, citros). A numeração é PRÓPRIA (MAG1 a MAG6), não ISO — a vazão sai da tabela do catálogo. Gota muito fina a fina: cobertura máxima, deriva alta.',
      fonte: 'Catálogo Magnojet 2025 (p. 54)'
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
      sizes: ['branco', 'lilás', 'marrom', 'amarelo', 'laranja', 'vermelho', 'cinza', 'verde', 'preto', 'azul', 'roxo'], escalaPropria: true, vazaoTabela: TAB_ATR,
      pressao: [5, 25], material: 'Cerâmica rosa Albuz',
      gotasPorBar: { 5: 'F', 7: 'F', 10: 'F', 15: 'MF', 20: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio de 5 a 20 bar com escala de cores PRÓPRIA (branco → azul), não ISO: o app não calcula a vazão dela — pegue o par cor × pressão na tabela da Albuz/Jacto. É a ponta do turbo atomizador em café e citros; gota fina a muito fina, cobertura máxima.',
      fonte: 'Catálogo Albuz 2022 (p. 5 e 22)'
    },
    {
      id: 'jc-airmix', marca: 'Jacto', modelo: 'AIRMIX (leque de baixa deriva)', tipo: 'leque-pre-orificio', angulos: [110],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06'], pressao: [1.38, 5.52], material: 'Plástico de alta resistência ao desgaste', vazaoTabela: TAB_JC_AIRMIX,
      gotasPorBar: { 1.38: 'G', 2.07: 'G', 2.76: 'M', 3.45: 'M', 4.14: 'M', 4.83: 'F', 5.52: 'F' },
      gotasPorTamanho: {   // matriz do folheto: classe por tamanho E por pressão
        '01': { 1.38: 'G', 2.07: 'M', 2.76: 'M', 3.45: 'F', 4.14: 'F', 4.83: 'F', 5.52: 'F' },
        '015': { 1.38: 'G', 2.07: 'M', 2.76: 'M', 3.45: 'F', 4.14: 'F', 4.83: 'F', 5.52: 'F' },
        '02': { 1.38: 'G', 2.07: 'G', 2.76: 'M', 3.45: 'M', 4.14: 'M', 4.83: 'F', 5.52: 'F' },
        '025': { 1.38: 'G', 2.07: 'G', 2.76: 'G', 3.45: 'M', 4.14: 'M', 4.83: 'M', 5.52: 'M' },
        '03': { 1.38: 'MG', 2.07: 'MG', 2.76: 'G', 3.45: 'G', 4.14: 'M', 4.83: 'M', 5.52: 'M' },
        '04': { 1.38: 'MG', 2.07: 'MG', 2.76: 'G', 3.45: 'G', 4.14: 'M', 4.83: 'M', 5.52: 'M' },
        '05': { 1.38: 'MG', 2.07: 'MG', 2.76: 'MG', 3.45: 'G', 4.14: 'G', 4.83: 'M', 5.52: 'M' },
        '06': { 1.38: 'MG', 2.07: 'MG', 2.76: 'MG', 3.45: 'G', 4.14: 'G', 4.83: 'G', 5.52: 'G' }
      },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-contato', 'dessecacao', 'fungicida', 'inseticida'],
      nota: 'Jato plano padrão de 110° com gota grande, de 20 a 80 PSI, codificado pela cor da ISO. O folheto classifica como EXCELENTE para herbicida incorporado, pré-emergente e sistêmico em pós, e BOM para produto de contato (a gota é grande demais para cobertura fina). Barra entre 0,40 m (mínimo) e 0,80 m; 0,35 m dá duplo recobrimento e 0,70 m dá triplo, a 0,5 m entre bicos. Os tamanhos 03 e acima saem com gota muito grossa até 3 bar.',
      fonte: 'Folheto Jacto AIRMIX (930000238) + jacto.com'
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
      sizes: ['amarelo', 'laranja', 'vermelho', 'verde', 'turquesa', 'azul', 'cinza', 'preto', 'marfim', 'branco'], escalaPropria: true, vazaoTabela: TAB_ALB_APE,
      pressao: [2, 4], material: 'Cerâmica rosa Albuz',
      gotasPorBar: { 2: 'F', 2.5: 'F', 3: 'F', 3.5: 'F', 4: 'MF' },
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Leque padrão da Albuz para todo tipo de tratamento, de 2 a 4 bar, barra a 50–60 cm (110°) ou 80–90 cm (80°). Usa a escala de cores EUROPEIA da Albuz — o amarelo dá 0,49 L/min a 2 bar, enquanto o amarelo ISO (02) daria 0,65. Os tamanhos grandes (cinza para cima) já saem com gota grossa.',
      fonte: 'Catálogo Albuz 2022 (p. 10)'
    },
    {
      id: 'alb-ati', marca: 'Albuz', modelo: 'ATI 60°/80° (cone vazio ISO)', tipo: 'cone-vazio', angulos: [80, 60],
      sizes: ['0050', '0075', '01', '015', '02', '025', '03', '035', '04', '05'], pressao: [5, 25], material: 'Cerâmica rosa Albuz', vazaoTabela: TAB_ATI,
      gotasPorBar: { 5: 'F', 7: 'F', 10: 'F', 15: 'MF', 20: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'É a ATR com código ISO: mesmo cone vazio de alta pressão, mas com tamanho e cor da norma — dá para calcular a vazão aqui. Turbo atomizador em café e citros.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    {
      id: 'alb-tvi', marca: 'Albuz', modelo: 'TVI 80° (cone vazio com indução de ar)', tipo: 'cone-vazio', angulos: [80],
      sizes: ['0050', '0075', '01', '015', '02', '025', '03', '04'], pressao: [3, 20], material: 'Cerâmica rosa Albuz (3 peças)', vazaoTabela: TAB_TVI,
      gotasPorBar: { 5: 'UG', 7: 'UG', 10: 'EG', 15: 'MG' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone vazio com venturi: a cobertura do cone do turbo atomizador com gota grossa a ultragrossa — corta a deriva do pomar e do cafezal, onde o cone comum joga névoa para fora da rua.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    {
      id: 'alb-atf', marca: 'Albuz', modelo: 'ATF 80° (cone cheio)', tipo: 'cone-cheio', angulos: [80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [3, 20], material: 'Cerâmica rosa Albuz', vazaoTabela: TAB_ATF,
      gotasPorBar: { 3: 'F', 5: 'F', 10: 'MF', 15: 'MF' },
      usos: ['fungicida', 'inseticida', 'foliar'],
      nota: 'Cone cheio: jato preenchido, deposição concentrada — tratamento localizado e alvos densos. Gota fina a muito fina, só com vento fraco.',
      fonte: 'Catálogo Albuz 2022 (p. 5)'
    },
    /* ── Hypro (Pentair) ── */
    {
      id: 'hy-uld', marca: 'Hypro', modelo: 'ULD Ultra Lo-Drift', tipo: 'leque-inducao', angulos: [120],
      sizes: ['015', '02', '025', '03', '04', '05', '06', '08'], pressao: [1, 8], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['UG', 'EG', 'MG'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Gota grossa cheia de ar e pluma fechada: até 90 % de redução de deriva (4 estrelas no LERAP inglês), 120° de 1 a 8 bar. Para sistêmico, pré-emergente e dessecação em alvo grande — não para produto de contato em alvo pequeno.',
      fonte: 'Pentair Hypro — Crop Spraying Guide (p. 10)'
    },
    {
      id: 'hy-uldm', marca: 'Hypro', modelo: 'ULDM Ultra Lo-Drift MAX', tipo: 'leque-inducao', angulos: [130],
      sizes: ['02', '025', '03', '04', '05', '06', '08'], pressao: [2, 5], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasPorBar: { 2: 'UG', 3: 'UG', 4: 'UG', 5: 'UG' },
      usos: ['herbicida-sistemico', 'pre-emergente', 'herbicida-cafe', 'dessecacao'],
      nota: 'Ultragrossa em toda a faixa (2 a 5 bar) e 95 % de redução de deriva: é a ponta de quando não pode haver deriva nenhuma — 2,4-D e dirigida ao lado de café. O ângulo de 130° pede barra mais baixa. Não usar em alvo pequeno nem com produto de contato.',
      fonte: 'Pentair Hypro — Crop Spraying Guide (p. 11)'
    },
    {
      id: 'hy-ga', marca: 'Hypro', modelo: 'GuardianAIR', tipo: 'leque-inducao', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05', '06'], pressao: [1, 8], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['fungicida', 'inseticida', 'herbicida-sistemico', 'dessecacao', 'foliar'],
      nota: 'Indução de ar que mantém o ângulo do leque de 1 a 8 bar: cobertura de fungicida e inseticida com deriva controlada. Existe em 80° e 110°.',
      fonte: 'Hypro — guia de seleção e ficha GuardianAIR'
    },
    {
      id: 'hy-gat', marca: 'Hypro', modelo: 'GuardianAIR Twin', tipo: 'leque-duplo', angulos: [110],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [2, 8], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['fungicida', 'inseticida', 'foliar', 'herbicida-sistemico'],
      nota: 'Dois jatos com indução de ar num corpo só: deposição na frente e atrás do alvo, para espiga, haste e dossel fechado.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-grd', marca: 'Hypro', modelo: 'Guardian (pré-orifício)', tipo: 'leque-pre-orificio', angulos: [120],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 8], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['G', 'M'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: '120° com pré-orifício: gota média a grossa numa faixa de pressão larga. Meio-termo entre cobertura e deriva quando não dá para usar indução de ar.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-ld', marca: 'Hypro', modelo: 'LD Lo-Drift', tipo: 'leque-pre-orificio', angulos: [110, 80],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [1, 5], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'A antideriva original da Hypro: pré-orifício que corta boa parte das gotas finas de um leque comum, mantendo cobertura.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-3d', marca: 'Hypro', modelo: '3D (leque inclinado)', tipo: 'leque', angulos: [100],
      sizes: ['015', '02', '025', '03', '04', '05'], pressao: [0.7, 6], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'foliar', 'herbicida-contato'],
      nota: 'Jato inclinado de 100° para montar alternado na barra (um para a frente, outro para trás) — cobre os dois lados sem ponta dupla. Homologada para PWM (bico pulsado).',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-vp', marca: 'Hypro', modelo: 'VP FanTip (pressão variável)', tipo: 'leque', angulos: [110, 80],
      sizes: ['01', '015', '02', '025', '03', '04', '05', '06'], pressao: [1, 5], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['M', 'F'],
      usos: ['fungicida', 'inseticida', 'herbicida-contato', 'foliar'],
      nota: 'Leque de uso geral com orifício elíptico, estável de 1 a 5 bar — a ponta padrão de barra quando a deriva não é o problema do dia.',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-even', marca: 'Hypro', modelo: 'E FanTip (faixa uniforme)', tipo: 'faixa-uniforme', angulos: [80],
      sizes: ['01', '015', '02', '025', '03', '04'], pressao: [2, 4], material: 'Poliacetal', vazaoTabela: TAB_HYPRO,
      gotasFaixa: ['M', 'F'],
      usos: ['herbicida-cafe', 'herbicida-contato', 'pre-emergente'],
      nota: 'Deposição uniforme de borda a borda para aplicação em FAIXA (linha de plantio, canteiro, faixa do café) — não sobrepõe. Também existe na versão costal (1 a 3 bar).',
      fonte: 'Hypro — guia de seleção'
    },
    {
      id: 'hy-dt', marca: 'Hypro', modelo: 'DeflecTip (defletor / flood)', tipo: 'flood', angulos: [80, 95, 105, 110],
      sizes: ['DT0.5', 'DT0.75', 'DT1.0', 'DT1.5', 'DT2.0', 'DT2.5', 'DT3.0'], escalaPropria: true, vazaoTabela: TAB_HY_DT,
      pressao: [1, 3], material: 'Poliacetal',
      gotasFaixa: ['MG', 'G', 'M'],
      usos: ['herbicida-cafe', 'pre-emergente', 'herbicida-sistemico', 'foliar'],
      nota: 'Defletor de faixa uniforme e muito resistente a entupimento, de 1 a 3 bar — herbicida de solo, fertilizante líquido e aplicação em faixa, inclusive em costal. Cada tamanho tem o seu ângulo e a sua faixa a 50 cm de altura: DT0.5 faz 0,8 m a 80°, a DT1.0 faz 1,3 m a 105° e a DT3.0 faz 1,4 m a 110°. Mesma escala do flood da TeeJet (DT2.0 = TF-2).',
      fonte: 'Hypro — Crop Spraying Pocket Guide (p. 26)'
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
      id: 'hy-xt', marca: 'Hypro', modelo: 'XT Boom X Tender (sem barra)', tipo: 'flood', angulos: [105],
      sizes: ['XT010', 'XT020', 'XT024'], escalaPropria: true, vazaoTabela: TAB_HY_XT,
      pressao: [2, 4], material: 'Inox ou poliacetal (FastCap)',
      gotasFaixa: ['EG', 'MG', 'G'],
      usos: ['herbicida-sistemico', 'pre-emergente', 'dessecacao'],
      nota: 'Boomless: joga um leque grosso e uniforme de até 4,9 m sem barra, para pastagem, beira de cerca, carreador e área com obstáculo. A 3 bar e 1,2 m de altura a XT010 faz 3,9 m de faixa, a XT020 faz 4,8 m e a XT024 faz 4,9 m — a largura muda ±18° com o ângulo do bico. A numeração XT010/XT020/XT024 é própria da Hypro, não é código ISO. Existem tamanhos maiores (XT043 em diante) que não estão nesta tabela.',
      fonte: 'Hypro — Crop Spraying Pocket Guide (p. 28)'
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
      volumeHa: 250, alvo: 'herbicida-cafe', ponta: 'tj-tf', iso: 'TF-2.5', angulo: 130,
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
      modo: 'faixa', entreLinhas: 3.5, larguraFaixa: 3.5, bicosPorPassada: 12, velocidade: 3.5, volumeHa: 400,
      alvo: 'fungicida', ponta: 'jc-atr', iso: 'marrom', angulo: 80,
      nota: 'No turbo a passada trata uma rua inteira: a vazão da rua é dividida pelos bicos do arco (6 por lado, no exemplo). Cone vazio de alta pressão, gota fina, cobertura na folha.'
    }
  ];

  /* ───────── vazão × pressão (ISO 10625 e lei da raiz quadrada) ───────── */
  function vazaoNominal(iso) { const i = ISO_MAP[String(iso)]; return i ? i.vazao : 0; }
  function vazaoPonta(iso, bar) { const q = vazaoNominal(iso); return (!q || !(bar > 0)) ? 0 : round(q * Math.sqrt(bar / 3), 3); }
  function pressaoPara(iso, q) { const qn = vazaoNominal(iso); return (!qn || !(q > 0)) ? 0 : round(3 * Math.pow(q / qn, 2), 2); }

  /* ── pontas com tabela própria (cones Albuz): interpola em √p entre as
        linhas publicadas e extrapola pela raiz quadrada fora da tabela ── */
  function tabelaDaPonta(ponta, tamanho) {
    const p = typeof ponta === 'string' ? PONTA_MAP[ponta] : ponta;
    if (!p || !p.vazaoTabela) return null;
    if (tamanho == null) return p.vazaoTabela;
    return p.vazaoTabela.valores[String(tamanho)] ? p.vazaoTabela : null;
  }
  function pressaoReferencia(ponta) {
    const p = typeof ponta === 'string' ? PONTA_MAP[ponta] : ponta;
    if (!p) return 3;
    return Math.min(Math.max(3, p.pressao[0]), p.pressao[1]);
  }
  function tamanhosDaPonta(ponta) {
    const p = typeof ponta === 'string' ? PONTA_MAP[ponta] : ponta;
    if (!p) return [];
    if (!p.vazaoTabela) return p.sizes;
    // a tabela da marca costuma cobrir mais tamanhos do que a família oferece
    const chaves = Object.keys(p.vazaoTabela.valores);
    return (p.sizes && p.sizes.length) ? p.sizes.filter(s => chaves.indexOf(String(s)) >= 0) : chaves;
  }
  function vazaoDaPonta(ponta, tamanho, bar) {
    const t = tabelaDaPonta(ponta, tamanho);
    if (!t) return vazaoPonta(tamanho, bar);
    if (!(bar > 0)) return 0;
    const ps = t.pressoes, v = t.valores[String(tamanho)], n = ps.length;
    if (bar <= ps[0]) return round(v[0] * Math.sqrt(bar / ps[0]), 3);
    if (bar >= ps[n - 1]) return round(v[n - 1] * Math.sqrt(bar / ps[n - 1]), 3);
    for (let i = 1; i < n; i++) {
      if (bar <= ps[i]) {
        const x0 = Math.sqrt(ps[i - 1]), x1 = Math.sqrt(ps[i]), x = Math.sqrt(bar);
        return round(v[i - 1] + (v[i] - v[i - 1]) * (x - x0) / (x1 - x0), 3);
      }
    }
    return 0;
  }
  function pressaoDaPonta(ponta, tamanho, q) {
    const t = tabelaDaPonta(ponta, tamanho);
    if (!t) return pressaoPara(tamanho, q);
    if (!(q > 0)) return 0;
    const ps = t.pressoes, v = t.valores[String(tamanho)], n = ps.length;
    if (q <= v[0]) return round(ps[0] * Math.pow(q / v[0], 2), 2);
    if (q >= v[n - 1]) return round(ps[n - 1] * Math.pow(q / v[n - 1], 2), 2);
    for (let i = 1; i < n; i++) {
      if (q <= v[i]) {
        const x0 = Math.sqrt(ps[i - 1]), x1 = Math.sqrt(ps[i]);
        const x = x0 + (x1 - x0) * (q - v[i - 1]) / (v[i] - v[i - 1]);
        return round(x * x, 2);
      }
    }
    return 0;
  }
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
    let base = null, estimado = false, porTamanho = false;
    // matriz do fabricante (classe por tamanho E por pressão): não leva ajuste de tamanho
    const mapa = (p.gotasPorTamanho && iso && p.gotasPorTamanho[String(iso)]) || p.gotasPorBar;
    if (p.gotasPorTamanho && iso && p.gotasPorTamanho[String(iso)]) porTamanho = true;
    if (mapa) {
      const chaves = Object.keys(mapa).map(Number).sort((a, b) => a - b);
      let k = chaves[0];
      chaves.forEach(c => { if (c <= bar + 1e-9) k = c; });
      if (bar < chaves[0]) { k = chaves[0]; estimado = true; }
      if (bar > chaves[chaves.length - 1]) { k = chaves[chaves.length - 1]; estimado = true; }
      base = mapa[k];
    } else if (p.gotasFaixa && p.gotasFaixa.length) {
      estimado = true;
      const [pmin, pmax] = p.pressao, n = p.gotasFaixa.length;
      const t = pmax > pmin ? Math.min(Math.max((bar - pmin) / (pmax - pmin), 0), 1) : 0;
      base = p.gotasFaixa[Math.min(n - 1, Math.floor(t * n))];
    }
    if (!base) return null;
    // tamanhos maiores produzem gota mais grossa; os menores, mais fina
    // (só quando a classe veio da linha de referência — a matriz por tamanho já é exata)
    let grau = GOTA_MAP[base].grau;
    if (iso && !p.escalaPropria && !porTamanho) {
      const i = ORDEM_ISO.indexOf(String(iso));
      if (i >= 0) { if (i >= ORDEM_ISO.indexOf('04')) grau += 1; else if (i <= ORDEM_ISO.indexOf('01')) grau -= 1; }
    }
    grau = Math.min(7, Math.max(1, grau));
    const g = GOTAS.find(x => x.grau === grau);
    return { id: g.id, nome: g.nome, faixa: g.faixa, grau, hex: g.hex, estimado, base };
  }

  /* ───────── Condições de aplicação (Delta T) ─────────
     Portado do PVGest (app.js, aba Delta T) para o mesmo critério valer nos
     dois apps da fazenda: bulbo úmido por Stull (2011), ponto de orvalho por
     Magnus, DPV, e as quatro faixas de Delta T mais a escala de vento.      */
  function bulboUmido(t, ur) {
    return t * Math.atan(0.151977 * Math.pow(ur + 8.313659, 0.5)) + Math.atan(t + ur)
      - Math.atan(ur - 1.676331) + 0.00391838 * Math.pow(ur, 1.5) * Math.atan(0.023101 * ur) - 4.686035;
  }
  function pontoOrvalho(t, ur) {
    const a = 17.27, b = 237.7, al = ((a * t) / (b + t)) + Math.log(ur / 100);
    return (b * al) / (a - al);
  }
  function dpv(t, ur) {                       // déficit de pressão de vapor (kPa)
    const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
    return es - es * (ur / 100);
  }
  const FAIXAS_DT = [
    { max: 2, id: 'baixo', rotulo: 'Delta T abaixo de 2 — umidade alta demais', nivel: 'alta', conduta: 'Não pulverize: risco de inversão térmica e de a nuvem descer para fora do alvo. Espere o ar secar.' },
    { max: 8, id: 'ideal', rotulo: 'Janela ideal (Delta T 2–8)', nivel: 'ok', conduta: 'Boa evaporação, deriva mínima e cobertura uniforme. Pode aplicar.' },
    { max: 10, id: 'limiar', rotulo: 'Delta T no limiar (8–10)', nivel: 'media', conduta: 'Evaporação alta: use gota mais grossa, aumente o volume e prefira o começo da manhã ou o fim da tarde.' },
    { max: Infinity, id: 'critico', rotulo: 'Delta T acima de 10 — crítico', nivel: 'alta', conduta: 'Suspenda: a gota evapora antes de chegar ao alvo e o produto vira deriva.' }
  ];
  const FAIXAS_VENTO = [
    { max: 3, id: 'calmo', rotulo: 'Vento calmo (< 3 km/h)', nivel: 'media', conduta: 'Risco de inversão térmica — a nuvem fica suspensa e caminha para onde não se quer. Confira fumaça ou poeira antes de sair.' },
    { max: 15, id: 'ideal', rotulo: 'Vento ideal (3–15 km/h)', nivel: 'ok', conduta: 'Boa dispersão com deriva mínima.' },
    { max: 20, id: 'limite', rotulo: 'Vento no limite (15–20 km/h)', nivel: 'media', conduta: 'Risco moderado: gota grossa, barra baixa e atenção à direção em relação à cultura sensível.' },
    { max: Infinity, id: 'excessivo', rotulo: 'Vento excessivo (> 20 km/h)', nivel: 'alta', conduta: 'Suspenda a aplicação.' }
  ];
  const faixaDe = (tab, v) => tab.find(f => v < f.max) || tab[tab.length - 1];

  function clima(e) {
    e = e || {};
    const t = num(e.temperatura), ur = num(e.umidade), vento = num(e.vento);
    if (!(t > 0) || !(ur > 0)) return null;
    const bu = bulboUmido(t, ur), dt = t - bu;
    const fDT = faixaDe(FAIXAS_DT, dt), fV = e.vento === '' || e.vento == null ? null : faixaDe(FAIXAS_VENTO, vento);
    const avisos = [];
    if (fDT.nivel !== 'ok') avisos.push({ nivel: fDT.nivel, texto: `${fDT.rotulo}: ${round(t, 1)} °C e ${round(ur, 0)} % de umidade dão Delta T de ${round(dt, 1)}.`, conduta: fDT.conduta });
    if (fV && fV.nivel !== 'ok') avisos.push({ nivel: fV.nivel, texto: `${fV.rotulo} — medido ${round(vento, 1)} km/h.`, conduta: fV.conduta });
    return {
      temperatura: round(t, 1), umidade: round(ur, 0), vento: e.vento === '' || e.vento == null ? null : round(vento, 1),
      deltaT: round(dt, 1), bulboUmido: round(bu, 1), pontoOrvalho: round(pontoOrvalho(t, ur), 1), dpv: round(dpv(t, ur), 2),
      faixa: fDT.id, rotulo: fDT.rotulo, conduta: fDT.conduta, nivel: fDT.nivel,
      ventoFaixa: fV ? fV.id : null, ventoRotulo: fV ? fV.rotulo : null, ventoConduta: fV ? fV.conduta : null,
      pode: fDT.nivel !== 'alta' && (!fV || fV.nivel !== 'alta'),
      avisos, fonte: 'Delta T do PVGest (bulbo úmido por Stull, 2011)'
    };
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
    const tabela = tabelaDaPonta(ponta, iso);
    if (iso && (ISO_MAP[iso] || tabela)) {
      const pRef = tabela ? pressaoReferencia(ponta) : 3;
      vazaoNom = tabela ? vazaoDaPonta(ponta, iso, pRef) : vazaoNominal(iso);
      if (e.fixarPressao && pressao > 0) {
        qReal = vazaoDaPonta(ponta, iso, pressao);
        F('Vazão da ponta na pressão', tabela ? 'tabela do fabricante, interpolada em √p' : 'q = q₃bar × √(p ÷ 3)',
          tabela ? `${ponta.modelo} ${iso} a ${pressao} bar (tabela de ${tabela.pressoes[0]} a ${tabela.pressoes[tabela.pressoes.length - 1]} bar)` : `q = ${vazaoNom} × √(${pressao} ÷ 3)`,
          `${qReal} L/min`);
      } else {
        pressaoCalculada = pressaoDaPonta(ponta, iso, qNecessaria);
        pressao = pressaoCalculada;
        F('Pressão necessária', tabela ? 'inversão da tabela do fabricante (q ∝ √p entre as linhas)' : 'p = 3 × (q ÷ q₃bar)²',
          tabela ? `${round(qNecessaria, 3)} L/min na tabela da ${ponta.modelo} ${iso} (${vazaoNom} L/min a ${pRef} bar)` : `p = 3 × (${round(qNecessaria, 3)} ÷ ${vazaoNom})²`,
          `${pressaoCalculada} bar`);
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
    const ehCone = !!(ponta && (ponta.tipo === 'cone-vazio' || ponta.tipo === 'cone-cheio'));
    const altura = alturaBarra(angulo, espacamento);
    if (ehCone) F('Posição no arco', 'cone em atomizador: quem leva a gota é o ar, não a altura',
      'distribua a vazão por altura da planta (mais vazão no terço médio do cafeeiro)', 'sem altura de barra a calcular');
    else if (modo === 'area') F('Altura da barra', 'h ≈ espaçamento × fator do ângulo (110° → 1,0 · 80° → 1,5)',
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
      if (volumeHa && alvo.volume && !ehCone && (volumeHa < alvo.volume[0] || volumeHa > alvo.volume[1]))
        avisos.push({ nivel: 'baixa', texto: `Volume de ${volumeHa} L/ha fora do usual para ${alvo.nome.toLowerCase()} (${alvo.volume[0]}–${alvo.volume[1]} L/ha).`, conduta: 'Confirme na bula do produto e no arranjo do equipamento.' });
      else if (volumeHa && ehCone && volumeHa > 800)
        avisos.push({ nivel: 'baixa', texto: `Volume de ${volumeHa} L/ha é alto mesmo para turbo atomizador (usual 300–600 L/ha no café adulto).`, conduta: 'Confira a vazão do conjunto e a velocidade — volume demais escorre da folha e leva produto para o solo.' });
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
      const hMin = ehCone ? 0 : (ponta && (ponta.tipo === 'flood' || ponta.tipo === 'faixa-uniforme')) ? 15 : 25;
      if (hf < hMin) avisos.push({ nivel: 'media', texto: `Para fazer ${round(faixaPorBico, 2)} m de faixa por bico com ${angulo}°, a ponta teria de ficar a ${hf} cm do alvo — baixo demais (mínimo prático desta ponta: ${hMin} cm).`, conduta: 'Use ponta de ângulo menor (80°, faixa uniforme), reduza o número de bicos por faixa ou aceite faixa maior por bico.' });
      else if (hf > 80) avisos.push({ nivel: 'baixa', texto: `A faixa pedida exige a ponta a ${hf} cm do alvo — nessa altura o vento pega a nuvem.`, conduta: 'Use ponta de ângulo maior (flood 130°) ou mais bicos por faixa.' });
    }
    if (modo === 'area' && !ehCone && espacamento > 0.55) avisos.push({ nivel: 'baixa', texto: `Espaçamento de ${round(espacamento, 2)} m entre bicos exige barra mais alta para sobrepor.`, conduta: `Altura recomendada ≈ ${altura} cm; considere ponta de 120° para reduzir a altura.` });
    if (ponta && ponta.confirmar) avisos.push({ nivel: 'info', texto: `Os dados de ${ponta.modelo} ainda não foram conferidos no catálogo do fabricante.`, conduta: 'Confirme pressão e classe de gota antes de fechar a regulagem.' });
    if (gota && gota.estimado) avisos.push({ nivel: 'info', texto: 'Classe de gota estimada a partir da faixa publicada pelo fabricante (o catálogo não traz a classe pressão a pressão).', conduta: 'Para decisão de deriva, confirme na tabela do fabricante.' });

    /* ── condição do ar: Delta T e vento (mesmo critério do PVGest) ── */
    const cond = clima(e);
    if (cond) {
      cond.avisos.forEach(a => avisos.push(a));
      // gota fina ou média com ar seco: a gota evapora no caminho e vira deriva
      if (gota && gota.grau <= GOTA_MAP['M'].grau && cond.deltaT > 8)
        avisos.push({ nivel: 'alta', texto: `Gota ${gota.nome.toLowerCase()} com Delta T de ${cond.deltaT}: parte da calda evapora antes de tocar o alvo e o resto caminha com o vento.`, conduta: 'Suba para gota grossa ou acima (ponta maior, menos pressão, indução de ar) ou espere a janela — Delta T entre 2 e 8.' });
      // aplicação dirigida no café com vento em cima da cultura sensível
      if (modo === 'faixa' && e.alvo === 'herbicida-cafe' && cond.vento != null && cond.vento > 15)
        avisos.push({ nivel: 'alta', texto: `Herbicida dirigido no café com vento de ${cond.vento} km/h: a proteção física não segura deriva nessa faixa de vento.`, conduta: 'Espere cair para menos de 15 km/h. Na dúvida, aplique no começo da manhã.' });
    }

    return {
      clima: cond,
      modo, volumeHa, velocidade, espacamento: round(espacamento, 3), faixaPorBico: round(faixaPorBico, 3), nBicos,
      larguraTrabalho, larguraFaixa, entreLinhas, fracaoTratada: round(fracaoTratada, 3), economia,
      ponta: ponta ? { id: ponta.id, marca: ponta.marca, modelo: ponta.modelo, tipo: ponta.tipo, material: ponta.material, pressao: ponta.pressao, fonte: ponta.fonte } : null,
      iso, cor: ISO_MAP[iso] ? ISO_MAP[iso].cor : '', hex: ISO_MAP[iso] ? ISO_MAP[iso].hex : '', malha: ISO_MAP[iso] ? ISO_MAP[iso].malha : null,
      vazaoNominal: vazaoNom, vazaoNecessaria: qNecessaria, vazaoPorBico: qReal, vazaoTotal,
      pressao: round(pressao, 2), pressaoCalculada, volumeAplicado: volumeReal, volumeLavoura,
      angulo, protecao, ehCone, altura, alturaFaixa: alturaParaFaixa(angulo, faixaPorBico), gota, rendimento, ficha, alvo: e.alvo || null,
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
      if (p.escalaPropria && !p.vazaoTabela) return; // sem escala ISO e sem tabela: não dá para calcular
      tamanhosDaPonta(p).forEach(iso => {
        if (!ISO_MAP[iso] && !tabelaDaPonta(p, iso)) return;
        const pressao = pressaoDaPonta(p, iso, q);
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
        const i = ISO_MAP[iso], tab = tabelaDaPonta(p, iso);
        opcoes.push({
          ponta: p.id, marca: p.marca, modelo: p.modelo, tipo: p.tipo, iso,
          cor: i ? i.cor : iso, hex: i ? i.hex : null, malha: i ? i.malha : null,
          pressao, vazao: round(q, 3), vazaoNominal: tab ? tab.valores[iso][0] : (i ? i.vazao : 0),
          tabela: !!tab, angulo: p.angulos[0], gota, score, nota: p.nota, fonte: p.fonte, confirmar: !!p.confirmar
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
    const tab = tabelaDaPonta(ponta);
    const sizes = (e.sizes || (ponta && (tab || !ponta.escalaPropria) ? tamanhosDaPonta(ponta) : null) || ['015', '02', '025', '03', '04', '05'])
      .filter(s => ISO_MAP[s] || tabelaDaPonta(ponta, s));
    const faixa = ponta ? ponta.pressao : [1, 6];
    const escala = tab ? tab.pressoes : [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];
    const pressoes = e.pressoes || escala.filter(p => p >= faixa[0] - 1e-9 && p <= faixa[1] + 1e-9);
    const velocidade = num(e.velocidade), faixaPorBico = num(e.faixaPorBico), alvo = num(e.volumeAlvo);
    const linhas = pressoes.map(bar => ({
      bar,
      celulas: sizes.map(iso => {
        const vazao = vazaoDaPonta(ponta, iso, bar);
        const volume = (velocidade > 0 && faixaPorBico > 0) ? volumeAplicado(vazao, velocidade, faixaPorBico) : null;
        const gota = ponta ? classeGota(ponta, bar, iso) : null;
        return { iso, vazao, volume, gota, noAlvo: alvo > 0 && volume != null && Math.abs(volume - alvo) / alvo <= 0.05 };
      })
    }));
    return { sizes, pressoes, linhas, velocidade, faixaPorBico: round(faixaPorBico, 3), volumeAlvo: alvo, ponta: ponta ? ponta.id : null, tabela: tab ? tab.fonte : null };
  }

  /* ───────── API ───────── */
  return {
    versao: '1.0.0',
    ISO, ISO_MAP, GOTAS, GOTA_MAP, ALVOS, ALVO_MAP, TIPOS, PONTAS, PONTA_MAP, PRESETS,
    vazaoNominal, vazaoPonta, pressaoPara, novaVazao, novaPressao,
    tabelaDaPonta, tamanhosDaPonta, vazaoDaPonta, pressaoDaPonta, pressaoReferencia,
    vazaoNecessaria, volumeAplicado, velocidadeAlvo, velocidadeCampo,
    alturaBarra, alturaParaFaixa, larguraJato, fatorAltura, classeGota,
    calcular, selecionar, calibracao, cruzar, tabelaCruzada,
    clima, bulboUmido, pontoOrvalho, dpv, FAIXAS_DT, FAIXAS_VENTO
  };
});
