/* ═══════════════════════════════════════════════════════════════════
   Gefaz Calda — kb.js  (base de conhecimento agronômica e físico-química)
   Ingredientes ativos: classe, grupo químico, modo de ação (FRAC/IRAC/HRAC),
   faixa de pH de estabilidade, tags de comportamento; produtos comerciais da
   fazenda; regras de incompatibilidade entre pares (com confiança e fonte).
   Fontes principais: Embrapa Doc. 437 (2021); Ask IFAS PI-301; FRAC/IRAC/HRAC-BR;
   Koppert/Biobest Side Effects; bulas; protocolo MIT 5.0 da fazenda (Allan).
   Toda regra carrega confiança [c] — abaixo de 0,7 é indicativo, não veredito.
   ═══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GC_KB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const A = {};
  const F = (sistema, codigo) => ({ sistema, codigo });
  // helper: ativo
  const add = (chave, nome, alias, classe, grupo, moa, ph, tags, extra) => { A[chave] = Object.assign({ nome, alias: [nome, ...alias], classe, grupo, moa, ph, tags }, extra || {}); };

  /* ───────── FUNGICIDAS ───────── */
  add('azoxistrobina', 'Azoxistrobina', ['azoxystrobin'], 'Fungicida', 'Estrobilurina (QoI)', F('FRAC', '11'), [5.0, 7.0], ['estrobilurina', 'fungicida-sintetico', 'sitio-especifico'], { formulacao: 'SC' });
  add('piraclostrobina', 'Piraclostrobina', ['pyraclostrobin'], 'Fungicida', 'Estrobilurina (QoI)', F('FRAC', '11'), [5.0, 7.0], ['estrobilurina', 'fungicida-sintetico', 'sitio-especifico'], { formulacao: 'EC' });
  add('trifloxistrobina', 'Trifloxistrobina', ['trifloxystrobin'], 'Fungicida', 'Estrobilurina (QoI)', F('FRAC', '11'), [5.0, 7.0], ['estrobilurina', 'fungicida-sintetico', 'sitio-especifico']);
  add('picoxistrobina', 'Picoxistrobina', ['picoxystrobin'], 'Fungicida', 'Estrobilurina (QoI)', F('FRAC', '11'), [5.0, 7.0], ['estrobilurina', 'fungicida-sintetico', 'sitio-especifico']);
  add('tebuconazol', 'Tebuconazol', ['tebuconazole'], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico', 'hidrolise-alcalina']);
  add('ciproconazol', 'Ciproconazol', ['cyproconazole'], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico', 'hidrolise-alcalina']);
  add('epoxiconazol', 'Epoxiconazol', ['epoxiconazole'], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico', 'hidrolise-alcalina']);
  add('protioconazol', 'Protioconazol', ['prothioconazole'], 'Fungicida', 'Triazolintiona (DMI)', F('FRAC', '3'), [5.5, 7.0], ['triazol', 'fungicida-sintetico', 'sitio-especifico']);
  add('difenoconazol', 'Difenoconazol', ['difenoconazole'], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico', 'hidrolise-alcalina']);
  add('flutriafol', 'Flutriafol', [], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico']);
  add('propiconazol', 'Propiconazol', ['propiconazole'], 'Fungicida', 'Triazol (DMI)', F('FRAC', '3'), [5.5, 6.5], ['triazol', 'fungicida-sintetico', 'sitio-especifico']);
  add('boscalida', 'Boscalida', ['boscalid'], 'Fungicida', 'Carboxamida (SDHI)', F('FRAC', '7'), [5.0, 7.5], ['sdhi', 'fungicida-sintetico', 'sitio-especifico']);
  add('fluxapiroxade', 'Fluxapiroxade', ['fluxapyroxad'], 'Fungicida', 'Carboxamida (SDHI)', F('FRAC', '7'), [5.0, 7.5], ['sdhi', 'fungicida-sintetico', 'sitio-especifico']);
  add('bixafem', 'Bixafem', ['bixafen'], 'Fungicida', 'Carboxamida (SDHI)', F('FRAC', '7'), [5.0, 7.5], ['sdhi', 'fungicida-sintetico', 'sitio-especifico']);
  add('benzovindiflupir', 'Benzovindiflupir', ['benzovindiflupyr'], 'Fungicida', 'Carboxamida (SDHI)', F('FRAC', '7'), [5.0, 7.5], ['sdhi', 'fungicida-sintetico', 'sitio-especifico']);
  add('tiofanato', 'Tiofanato-metílico', ['tiofanato metilico', 'thiophanate'], 'Fungicida', 'Benzimidazol (MBC)', F('FRAC', '1'), [5.0, 7.0], ['benzimidazol', 'fungicida-sintetico', 'sitio-especifico', 'hidrolise-alcalina']);
  add('carbendazim', 'Carbendazim', [], 'Fungicida', 'Benzimidazol (MBC)', F('FRAC', '1'), [5.0, 7.0], ['benzimidazol', 'fungicida-sintetico', 'sitio-especifico']);
  add('mancozebe', 'Mancozebe', ['mancozeb', 'manzate'], 'Fungicida', 'Ditiocarbamato (multissítio)', F('FRAC', 'M03'), [5.5, 7.0], ['multissitio', 'fungicida-sintetico', 'hidrolise-alcalina', 'hidrolise-acida'], { formulacao: 'WG' });
  add('clorotalonil', 'Clorotalonil', ['chlorothalonil'], 'Fungicida', 'Cloronitrila (multissítio)', F('FRAC', 'M05'), [5.0, 7.5], ['multissitio', 'clorotalonil', 'fungicida-sintetico'], { formulacao: 'SC' });
  add('oxicloreto-cobre', 'Oxicloreto de cobre', ['oxicloreto', 'cobre oxicloreto'], 'Cúprico', 'Inorgânico cúprico (multissítio)', F('FRAC', 'M01'), [6.0, 8.0], ['cuprico', 'multissitio', 'fungicida-sintetico', 'hidrolise-acida'], { formulacao: 'WP' });
  add('hidroxido-cobre', 'Hidróxido de cobre', ['hidroxido de cobre', 'copper hydroxide', 'kocide'], 'Cúprico', 'Inorgânico cúprico (multissítio)', F('FRAC', 'M01'), [6.0, 8.0], ['cuprico', 'multissitio', 'fungicida-sintetico', 'hidrolise-acida', 'alcalino'], { formulacao: 'WG' });
  add('oxido-cuproso', 'Óxido cuproso', ['oxido cuproso', 'cuprous oxide'], 'Cúprico', 'Inorgânico cúprico (multissítio)', F('FRAC', 'M01'), [6.0, 8.0], ['cuprico', 'multissitio', 'fungicida-sintetico', 'hidrolise-acida'], { formulacao: 'WG' });
  add('sulfato-cobre', 'Sulfato de cobre', ['sulfato de cobre', 'calda bordalesa'], 'Cúprico', 'Inorgânico cúprico', F('FRAC', 'M01'), [6.0, 8.0], ['cuprico', 'multissitio', 'sulfato', 'cation-divalente', 'hidrolise-acida']);
  add('enxofre', 'Enxofre', ['sulfur', 'sulphur'], 'Fungicida', 'Inorgânico (multissítio)', F('FRAC', 'M02'), [5.5, 7.5], ['enxofre', 'multissitio', 'fungicida-sintetico'], { formulacao: 'WG' });
  add('captana', 'Captana', ['captan'], 'Fungicida', 'Ftalimida (multissítio)', F('FRAC', 'M04'), [5.0, 6.5], ['captan', 'multissitio', 'fungicida-sintetico', 'hidrolise-alcalina'], { formulacao: 'WP' });
  add('folpete', 'Folpete', ['folpet'], 'Fungicida', 'Ftalimida (multissítio)', F('FRAC', 'M04'), [5.0, 6.5], ['captan', 'multissitio', 'fungicida-sintetico', 'hidrolise-alcalina']);
  add('fluazinam', 'Fluazinam', [], 'Fungicida', 'Fenilpiridinamina', F('FRAC', '29'), [5.0, 7.0], ['fungicida-sintetico']);
  add('metalaxil', 'Metalaxil-M', ['metalaxil', 'metalaxyl', 'mefenoxam'], 'Fungicida', 'Fenilamida', F('FRAC', '4'), [5.0, 7.5], ['fungicida-sintetico', 'sitio-especifico']);
  add('cimoxanil', 'Cimoxanil', ['cymoxanil'], 'Fungicida', 'Cianoacetamida-oxima', F('FRAC', '27'), [5.0, 7.0], ['fungicida-sintetico', 'hidrolise-alcalina']);
  add('fosetil', 'Fosetil-alumínio', ['fosetil', 'fosetyl'], 'Fungicida', 'Fosfonato', F('FRAC', 'P07'), [5.0, 7.0], ['fosetil', 'fosfato', 'acido', 'fungicida-sintetico']);
  add('ciprodinil', 'Ciprodinil', ['cyprodinil'], 'Fungicida', 'Anilinopirimidina', F('FRAC', '9'), [5.0, 7.5], ['fungicida-sintetico', 'sitio-especifico']);
  add('procimidona', 'Procimidona', ['procymidone'], 'Fungicida', 'Dicarboximida', F('FRAC', '2'), [5.0, 7.0], ['fungicida-sintetico', 'sitio-especifico']);

  /* ───────── INSETICIDAS / ACARICIDAS ───────── */
  add('clorpirifos', 'Clorpirifós', ['clorpirifos', 'chlorpyrifos'], 'Inseticida', 'Organofosforado', F('IRAC', '1B'), [5.0, 6.5], ['organofosforado', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('acefato', 'Acefato', ['acephate'], 'Inseticida', 'Organofosforado', F('IRAC', '1B'), [5.0, 6.5], ['organofosforado', 'hidrolise-alcalina'], { formulacao: 'SP' });
  add('profenofos', 'Profenofós', ['profenofos'], 'Inseticida', 'Organofosforado', F('IRAC', '1B'), [5.0, 6.5], ['organofosforado', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('malationa', 'Malationa', ['malation', 'malathion'], 'Inseticida', 'Organofosforado', F('IRAC', '1B'), [5.0, 6.5], ['organofosforado', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('dimetoato', 'Dimetoato', ['dimethoate'], 'Inseticida', 'Organofosforado', F('IRAC', '1B'), [5.0, 6.5], ['organofosforado', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('metomil', 'Metomil', ['methomyl'], 'Inseticida', 'Carbamato', F('IRAC', '1A'), [5.0, 6.5], ['carbamato', 'hidrolise-alcalina'], { formulacao: 'SL' });
  add('tiodicarbe', 'Tiodicarbe', ['thiodicarb'], 'Inseticida', 'Carbamato', F('IRAC', '1A'), [5.0, 6.5], ['carbamato', 'hidrolise-alcalina']);
  add('tiametoxam', 'Tiametoxam', ['thiamethoxam'], 'Inseticida', 'Neonicotinoide', F('IRAC', '4A'), [5.0, 7.5], ['neonicotinoide'], { formulacao: 'WG' });
  add('imidacloprido', 'Imidacloprido', ['imidacloprid'], 'Inseticida', 'Neonicotinoide', F('IRAC', '4A'), [5.0, 7.5], ['neonicotinoide']);
  add('acetamiprido', 'Acetamiprido', ['acetamiprid'], 'Inseticida', 'Neonicotinoide', F('IRAC', '4A'), [5.0, 7.5], ['neonicotinoide']);
  add('lambda-cialotrina', 'Lambda-cialotrina', ['lambda cialotrina', 'lambda-cyhalothrin', 'cialotrina'], 'Inseticida', 'Piretroide', F('IRAC', '3A'), [5.0, 6.5], ['piretroide', 'hidrolise-alcalina']);
  add('deltametrina', 'Deltametrina', ['deltamethrin'], 'Inseticida', 'Piretroide', F('IRAC', '3A'), [5.0, 6.5], ['piretroide', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('bifentrina', 'Bifentrina', ['bifenthrin'], 'Inseticida', 'Piretroide', F('IRAC', '3A'), [5.0, 6.5], ['piretroide', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('cipermetrina', 'Cipermetrina', ['cypermethrin', 'alfa-cipermetrina', 'zeta-cipermetrina', 'beta-cipermetrina'], 'Inseticida', 'Piretroide', F('IRAC', '3A'), [5.0, 6.5], ['piretroide', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('etofenproxi', 'Etofenproxi', ['etofenprox'], 'Inseticida', 'Éter piretroide', F('IRAC', '3A'), [5.0, 7.0], ['piretroide']);
  add('clorantraniliprole', 'Clorantraniliprole', ['chlorantraniliprole'], 'Inseticida', 'Diamida', F('IRAC', '28'), [5.0, 7.5], ['diamida'], { formulacao: 'SC' });
  add('ciantraniliprole', 'Ciantraniliprole', ['cyantraniliprole'], 'Inseticida', 'Diamida', F('IRAC', '28'), [5.0, 7.5], ['diamida']);
  add('flubendiamida', 'Flubendiamida', ['flubendiamide'], 'Inseticida', 'Diamida', F('IRAC', '28'), [5.0, 7.5], ['diamida']);
  add('espinosade', 'Espinosade', ['spinosad'], 'Inseticida', 'Espinosina', F('IRAC', '5'), [5.0, 7.0], ['espinosina', 'hidrolise-alcalina']);
  add('espinetoram', 'Espinetoram', ['spinetoram'], 'Inseticida', 'Espinosina', F('IRAC', '5'), [5.0, 7.0], ['espinosina', 'hidrolise-alcalina']);
  add('abamectina', 'Abamectina', ['abamectin'], 'Acaricida', 'Avermectina', F('IRAC', '6'), [5.0, 7.0], ['abamectina', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('lufenurom', 'Lufenurom', ['lufenuron'], 'Inseticida', 'Benzoilureia', F('IRAC', '15'), [5.0, 7.5], ['benzoilureia'], { formulacao: 'EC' });
  add('teflubenzurom', 'Teflubenzurom', ['teflubenzuron'], 'Inseticida', 'Benzoilureia', F('IRAC', '15'), [5.0, 7.5], ['benzoilureia']);
  add('metoxifenozida', 'Metoxifenozida', ['methoxyfenozide'], 'Inseticida', 'Diacilhidrazina', F('IRAC', '18'), [5.0, 7.5], []);
  add('indoxacarbe', 'Indoxacarbe', ['indoxacarb'], 'Inseticida', 'Oxadiazina', F('IRAC', '22A'), [5.0, 6.5], ['hidrolise-alcalina']);
  add('fipronil', 'Fipronil', [], 'Inseticida', 'Fenilpirazol', F('IRAC', '2B'), [5.0, 7.5], []);
  add('diafentiurom', 'Diafentiurom', ['diafenthiuron'], 'Inseticida', 'Tioureia', F('IRAC', '12A'), [5.0, 7.0], []);
  add('espiromesifeno', 'Espiromesifeno', ['spiromesifen'], 'Acaricida', 'Ácido tetrônico', F('IRAC', '23'), [5.0, 7.5], []);
  add('piriproxifem', 'Piriproxifem', ['pyriproxyfen'], 'Inseticida', 'Análogo de juvenil', F('IRAC', '7C'), [5.0, 7.5], []);
  add('sulfoxaflor', 'Sulfoxaflor', [], 'Inseticida', 'Sulfoximina', F('IRAC', '4C'), [5.0, 7.5], []);
  add('bt', 'Bacillus thuringiensis', ['bacillus thuringiensis', 'b. thuringiensis', 'dipel', 'agree', 'xentari'], 'Bioracional', 'Bactéria entomopatogênica', F('IRAC', '11A'), [5.5, 7.5], ['biologico', 'biologico-bacteria']);
  add('beauveria', 'Beauveria bassiana', ['beauveria', 'boveril'], 'Bioracional', 'Fungo entomopatogênico', F('IRAC', 'UNF'), [5.5, 7.0], ['biologico', 'biologico-fungo']);
  add('metarhizium', 'Metarhizium anisopliae', ['metarhizium', 'metarril'], 'Bioracional', 'Fungo entomopatogênico', F('IRAC', 'UNF'), [5.5, 7.0], ['biologico', 'biologico-fungo']);
  add('baculovirus', 'Baculovírus', ['baculovirus', 'vpn', 'npv'], 'Bioracional', 'Vírus entomopatogênico', F('IRAC', '31'), [5.5, 7.5], ['biologico', 'biologico-virus']);
  add('trichoderma', 'Trichoderma', ['trichoderma'], 'Bioracional', 'Fungo antagonista', F('FRAC', 'BM02'), [5.5, 7.0], ['biologico', 'biologico-fungo']);
  add('bacillus-subtilis', 'Bacillus subtilis / amyloliquefaciens', ['bacillus subtilis', 'bacillus amyloliquefaciens', 'serenade'], 'Bioracional', 'Bactéria antagonista', F('FRAC', 'BM02'), [5.5, 7.5], ['biologico', 'biologico-bacteria']);
  add('bacillus-outros', 'Bacillus spp. (velezensis, pumilus, licheniformis…)', ['bacillus velezensis', 'bacillus pumilus', 'bacillus licheniformis', 'bacillus methylotrophicus', 'bacillus aryabhattai', 'bacillus firmus'], 'Bioracional', 'Bactéria benéfica', F('FRAC', 'BM02'), [5.5, 7.5], ['biologico', 'biologico-bacteria']);
  add('cordyceps', 'Cordyceps / Isaria fumosorosea', ['cordyceps', 'isaria', 'paecilomyces'], 'Bioracional', 'Fungo entomopatogênico', F('IRAC', 'UNF'), [5.5, 7.0], ['biologico', 'biologico-fungo']);
  add('bio-generico', 'Agente biológico (genérico)', [], 'Bioracional', 'Organismo vivo', null, [5.5, 7.5], ['biologico']);
  add('nematoide-bio', 'Nematoides entomopatogênicos', ['heterorhabditis', 'steinernema'], 'Bioracional', 'Nematoide benéfico', null, [5.5, 7.5], ['biologico']);

  /* ───────── HERBICIDAS ───────── */
  add('glifosato', 'Glifosato', ['glyphosate', 'roundup'], 'Herbicida', 'Glicina substituída (EPSPS)', F('HRAC', '9 (G)'), [4.5, 6.0], ['glifosato', 'sensivel-cations', 'sistemico'], { formulacao: 'SL' });
  add('2,4-d', '2,4-D', ['2,4 d', '2.4-d', '2,4-d amina', 'dma 806', 'aminol'], 'Herbicida', 'Ácido fenoxiacético (auxina sintética)', F('HRAC', '4 (O)'), [5.5, 8.0], ['auxina', 'sensivel-cations', 'hidrolise-acida'], { formulacao: 'SL' });
  add('dicamba', 'Dicamba', [], 'Herbicida', 'Ácido benzoico (auxina sintética)', F('HRAC', '4 (O)'), [5.5, 8.0], ['auxina', 'sensivel-cations'], { formulacao: 'SL' });
  add('atrazina', 'Atrazina', ['atrazine'], 'Herbicida', 'Triazina (FSII)', F('HRAC', '5 (C1)'), [5.0, 8.0], ['triazina'], { formulacao: 'SC' });
  add('ametrina', 'Ametrina', ['ametryn'], 'Herbicida', 'Triazina (FSII)', F('HRAC', '5 (C1)'), [5.0, 8.0], ['triazina']);
  add('nicosulfuron', 'Nicosulfurom', ['nicosulfuron', 'sanson'], 'Herbicida', 'Sulfonilureia (ALS)', F('HRAC', '2 (B)'), [6.0, 8.0], ['sulfonilureia', 'hidrolise-acida'], { formulacao: 'OD' });
  add('metsulfurom', 'Metsulfurom-metílico', ['metsulfuron', 'ally'], 'Herbicida', 'Sulfonilureia (ALS)', F('HRAC', '2 (B)'), [6.0, 8.0], ['sulfonilureia', 'hidrolise-acida'], { formulacao: 'WG' });
  add('clorimurom', 'Clorimurom-etílico', ['clorimurom', 'chlorimuron'], 'Herbicida', 'Sulfonilureia (ALS)', F('HRAC', '2 (B)'), [6.0, 8.0], ['sulfonilureia', 'hidrolise-acida'], { formulacao: 'WG' });
  add('imazetapir', 'Imazetapir', ['imazethapyr'], 'Herbicida', 'Imidazolinona (ALS)', F('HRAC', '2 (B)'), [5.0, 8.0], ['imidazolinona'], { formulacao: 'SL' });
  add('cletodim', 'Cletodim', ['clethodim', 'select'], 'Herbicida', 'Ciclohexanodiona (ACCase)', F('HRAC', '1 (A)'), [5.0, 7.0], ['accase', 'sensivel-cations', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('haloxifope', 'Haloxifope-P-metílico', ['haloxifope', 'haloxyfop', 'verdict'], 'Herbicida', 'Ariloxifenoxipropionato (ACCase)', F('HRAC', '1 (A)'), [5.0, 7.0], ['accase', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('fluazifope', 'Fluazifope-P-butílico', ['fluazifope', 'fluazifop', 'fusilade'], 'Herbicida', 'Ariloxifenoxipropionato (ACCase)', F('HRAC', '1 (A)'), [5.0, 7.0], ['accase', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('paraquate', 'Paraquate', ['paraquat', 'gramoxone'], 'Herbicida', 'Bipiridílio (FSI)', F('HRAC', '22 (D)'), [4.5, 7.0], ['dessecante-contato', 'cationico'], { formulacao: 'SL' });
  add('diquate', 'Diquate', ['diquat', 'reglone'], 'Herbicida', 'Bipiridílio (FSI)', F('HRAC', '22 (D)'), [4.5, 7.0], ['dessecante-contato', 'cationico'], { formulacao: 'SL' });
  add('glufosinato', 'Glufosinato de amônio', ['glufosinato', 'glufosinate', 'finale'], 'Herbicida', 'Ácido fosfínico (GS)', F('HRAC', '10 (H)'), [5.0, 7.0], ['sensivel-cations', 'dessecante-contato'], { formulacao: 'SL' });
  add('saflufenacil', 'Saflufenacil', ['heat'], 'Herbicida', 'Pirimidinadiona (PPO)', F('HRAC', '14 (E)'), [5.0, 7.5], ['ppo'], { formulacao: 'WG' });
  add('flumioxazina', 'Flumioxazina', ['flumioxazin'], 'Herbicida', 'N-fenilftalimida (PPO)', F('HRAC', '14 (E)'), [5.0, 7.0], ['ppo', 'hidrolise-alcalina'], { formulacao: 'WG' });
  add('sulfentrazona', 'Sulfentrazona', ['sulfentrazone'], 'Herbicida', 'Triazolinona (PPO)', F('HRAC', '14 (E)'), [5.0, 7.5], ['ppo'], { formulacao: 'SC' });
  add('carfentrazona', 'Carfentrazona-etílica', ['carfentrazona', 'carfentrazone'], 'Herbicida', 'Triazolinona (PPO)', F('HRAC', '14 (E)'), [5.0, 7.0], ['ppo', 'hidrolise-alcalina'], { formulacao: 'EC' });
  add('fomesafem', 'Fomesafem', ['fomesafen'], 'Herbicida', 'Difeniléter (PPO)', F('HRAC', '14 (E)'), [5.0, 8.0], ['ppo'], { formulacao: 'SL' });
  add('lactofem', 'Lactofem', ['lactofen'], 'Herbicida', 'Difeniléter (PPO)', F('HRAC', '14 (E)'), [5.0, 7.0], ['ppo'], { formulacao: 'EC' });
  add('oxifluorfem', 'Oxifluorfem', ['oxifluorfem', 'oxyfluorfen', 'goal'], 'Herbicida', 'Difeniléter (PPO)', F('HRAC', '14 (E)'), [5.0, 7.5], ['ppo'], { formulacao: 'EC' });
  add('s-metolacloro', 'S-metolacloro', ['metolacloro', 'metolachlor', 'dual'], 'Herbicida', 'Cloroacetamida (VLCFA)', F('HRAC', '15 (K3)'), [5.0, 7.5], [], { formulacao: 'EC' });
  add('diurom', 'Diurom', ['diuron'], 'Herbicida', 'Ureia (FSII)', F('HRAC', '7 (C2)'), [5.0, 8.0], [], { formulacao: 'SC' });
  add('tembotriona', 'Tembotriona', ['tembotrione', 'soberan'], 'Herbicida', 'Tricetona (HPPD)', F('HRAC', '27 (F2)'), [5.0, 7.5], ['hppd'], { formulacao: 'SC' });
  add('mesotriona', 'Mesotriona', ['mesotrione', 'callisto'], 'Herbicida', 'Tricetona (HPPD)', F('HRAC', '27 (F2)'), [5.0, 7.5], ['hppd'], { formulacao: 'SC' });
  add('isoxaflutol', 'Isoxaflutol', ['isoxaflutole'], 'Herbicida', 'Isoxazol (HPPD)', F('HRAC', '27 (F2)'), [5.0, 7.5], ['hppd']);
  add('clomazona', 'Clomazona', ['clomazone'], 'Herbicida', 'Isoxazolidinona (DOXP)', F('HRAC', '13 (F4)'), [5.0, 7.5], [], { formulacao: 'EC' });
  add('trifluralina', 'Trifluralina', ['trifluralin'], 'Herbicida', 'Dinitroanilina (microtúbulos)', F('HRAC', '3 (K1)'), [5.0, 7.5], [], { formulacao: 'EC' });
  add('bentazona', 'Bentazona', ['bentazon', 'basagran'], 'Herbicida', 'Benzotiadiazinona (FSII)', F('HRAC', '6 (C3)'), [5.5, 8.0], [], { formulacao: 'SL' });
  add('indaziflam', 'Indaziflam', ['alion'], 'Herbicida', 'Alquilazina (celulose)', F('HRAC', '29 (L)'), [5.0, 7.5], [], { formulacao: 'SC' });
  add('pendimetalina', 'Pendimetalina', ['pendimethalin'], 'Herbicida', 'Dinitroanilina', F('HRAC', '3 (K1)'), [5.0, 7.5], [], { formulacao: 'EC' });

  /* ───────── ADJUVANTES E CONDICIONADORES ───────── */
  add('oleo-mineral', 'Óleo mineral', ['oleo mineral', 'mineral oil', 'nimbus', 'assist', 'iharol', 'joint oil', 'agrÓleo', 'agroleo'], 'Adjuvante', 'Óleo mineral parafínico', null, [5.0, 8.0], ['oleo', 'adjuvante'], { formulacao: 'EC', funcao: 'oleo' });
  add('oleo-vegetal', 'Óleo vegetal / metilado de soja', ['oleo vegetal', 'metilado de soja', 'ester metilico', 'oleo de soja', 'veget oil'], 'Adjuvante', 'Óleo vegetal / éster metilado', null, [5.0, 8.0], ['oleo', 'adjuvante'], { formulacao: 'EC', funcao: 'oleo' });
  add('siliconado', 'Espalhante organossiliconado', ['siliconado', 'organossiliconado', 'silwet', 'break-thru', 'break thru', 'silicone'], 'Adjuvante', 'Trissiloxano', null, [6.0, 8.0], ['surfactante', 'siliconado', 'adjuvante'], { formulacao: 'SL', funcao: 'espalhante' });
  add('espalhante', 'Espalhante adesivo', ['espalhante', 'espalhante adesivo', 'nonil fenol', 'nonilfenol', 'agral', 'haiten', 'extravon'], 'Adjuvante', 'Surfactante não iônico', null, [4.5, 8.5], ['surfactante', 'adjuvante'], { formulacao: 'SL', funcao: 'espalhante' });
  add('acidificante', 'Acidificante / redutor de pH', ['acidificante', 'redutor de ph', 'ph reducer', 'li 700', 'li-700', 'acido citrico', 'ácido cítrico'], 'Adjuvante', 'Condicionador de água (ácido)', null, null, ['acidificante', 'condicionador', 'acido'], { formulacao: 'SL', funcao: 'acidificante' });
  add('sequestrante', 'Sequestrante / quelante de água', ['sequestrante', 'quelante', 'condicionador de agua', 'edta', 'ta 35'], 'Adjuvante', 'Condicionador de água (sequestrante)', null, null, ['sequestrante', 'condicionador'], { formulacao: 'SL', funcao: 'sequestrante' });
  add('ams', 'Sulfato de amônio (AMS)', ['sulfato de amonio', 'sulfato de amônio', 'ammonium sulfate'], 'Adjuvante', 'Condicionador de água (sal)', null, null, ['ams', 'condicionador', 'sulfato'], { formulacao: 'SG', funcao: 'condicionador' });
  add('antiespumante', 'Antiespumante', ['antiespumante', 'anti-espumante', 'antifoam'], 'Adjuvante', 'Silicone antiespumante', null, null, ['antiespumante', 'condicionador'], { formulacao: 'SL', funcao: 'antiespumante' });
  add('redutor-deriva', 'Redutor de deriva', ['redutor de deriva', 'anti-deriva', 'antideriva'], 'Adjuvante', 'Polímero', null, null, ['redutor-deriva', 'condicionador'], { formulacao: 'SL', funcao: 'redutor-deriva' });

  /* ───────── FERTILIZANTES FOLIARES ───────── */
  add('boro', 'Boro (ácido bórico / octaborato)', ['boro', 'acido borico', 'ácido bórico', 'octaborato', 'borax', 'bórax', 'borato de', 'tetraborato'], 'Fertilizante Foliar', 'Borato', null, [5.0, 8.0], ['foliar', 'boro', 'alcalino', 'sal-alto'], { formulacao: 'SP' });
  add('calcio', 'Cálcio (cloreto / nitrato)', ['calcio', 'cálcio', 'cloreto de calcio', 'nitrato de calcio', 'ca foliar'], 'Fertilizante Foliar', 'Sal de cálcio', null, [5.0, 7.5], ['foliar', 'calcio', 'cation-divalente', 'sal-alto'], { formulacao: 'SL' });
  add('magnesio', 'Magnésio (sulfato / nitrato)', ['magnesio', 'magnésio', 'sulfato de magnesio', 'nitrato de magnesio'], 'Fertilizante Foliar', 'Sal de magnésio', null, [5.0, 7.5], ['foliar', 'magnesio', 'cation-divalente', 'sulfato', 'sal-alto'], { formulacao: 'SP' });
  add('zinco', 'Zinco (sulfato / óxido)', ['zinco', 'sulfato de zinco', 'oxido de zinco', 'óxido de zinco', 'zn foliar'], 'Fertilizante Foliar', 'Sal de zinco', null, [5.0, 7.0], ['foliar', 'zinco', 'cation-divalente', 'sulfato', 'sal-alto'], { formulacao: 'SP' });
  add('manganes', 'Manganês (sulfato)', ['manganes', 'manganês', 'sulfato de manganes', 'mn foliar'], 'Fertilizante Foliar', 'Sal de manganês', null, [5.0, 7.0], ['foliar', 'manganes', 'cation-divalente', 'sulfato', 'sal-alto'], { formulacao: 'SP' });
  add('ferro', 'Ferro (sulfato)', ['ferro', 'sulfato de ferro', 'sulfato ferroso'], 'Fertilizante Foliar', 'Sal de ferro', null, [4.5, 6.5], ['foliar', 'cation-divalente', 'sulfato', 'sal-alto'], { formulacao: 'SP' });
  add('cobre-foliar', 'Cobre foliar (sulfato)', ['cobre foliar', 'cu foliar'], 'Fertilizante Foliar', 'Sal de cobre', null, [5.5, 7.5], ['foliar', 'cuprico', 'cation-divalente', 'sulfato'], { formulacao: 'SP' });
  add('molibdenio', 'Molibdênio (molibdato)', ['molibdenio', 'molibdênio', 'molibdato'], 'Fertilizante Foliar', 'Molibdato', null, [5.5, 8.0], ['foliar', 'sal-alto'], { formulacao: 'SL' });
  add('map', 'Fosfato monoamônico (MAP)', ['map purificado', 'fosfato monoamonico', 'fosfato monoamônico', 'map foliar', 'mkp', 'fosfato monopotassico', 'fosfato monopotássico'], 'Fertilizante Foliar', 'Fosfato', null, [4.5, 6.5], ['foliar', 'fosfato', 'acido', 'sal-alto'], { formulacao: 'SP' });
  add('fosfito', 'Fosfito de potássio', ['fosfito', 'phosphite', 'fosfito de potassio', 'fosfito de potássio', 'fosfito de manganes', 'fosfito de cobre'], 'Fertilizante Foliar', 'Fosfito', null, [5.0, 7.0], ['foliar', 'fosfito', 'fosfato', 'acido'], { formulacao: 'SL' });
  add('ureia', 'Ureia', ['ureia', 'uréia', 'urea'], 'Fertilizante Foliar', 'Nitrogênio amídico', null, [5.0, 8.0], ['foliar'], { formulacao: 'SP' });
  add('potassio', 'Potássio (KCl / nitrato / sulfato)', ['cloreto de potassio', 'nitrato de potassio', 'nitrato de potássio', 'sulfato de potassio', 'kcl'], 'Fertilizante Foliar', 'Sal de potássio', null, [5.0, 8.0], ['foliar', 'sal-alto'], { formulacao: 'SP' });
  add('quelato', 'Micronutrientes quelatizados (EDTA/EDDHA)', ['quelato', 'quelatizado', 'quelatado', 'edta', 'eddha', 'chelate'], 'Fertilizante Foliar', 'Quelato', null, [5.0, 7.5], ['foliar', 'quelato'], { formulacao: 'SL' });
  add('aminoacidos', 'Aminoácidos / bioestimulante', ['aminoacido', 'aminoácido', 'bioestimulante', 'algas', 'ascophyllum'], 'Fertilizante Foliar', 'Bioestimulante orgânico', null, [5.0, 7.5], ['foliar'], { formulacao: 'SL' });

  /* ───────── PRODUTOS COMERCIAIS CONHECIDOS (estoque da fazenda + mercado) ───────── */
  const comerciais = [
    { nome: 'Wetcit', alias: ['wetcit'], ativos: ['acidificante', 'espalhante'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'acidificante-espalhante', tags: ['acidificante', 'surfactante', 'condicionador', 'estoque-fazenda'], dose: '50–100 mL/100 L', nota: 'Acidificante + espalhante (extrato de laranja). Reduz pH e tensão superficial.' },
    { nome: 'Kantphos', alias: ['kantphos', 'kant phos'], ativos: ['fosfito', 'acidificante'], classe: 'Fertilizante Foliar', formulacao: 'SL', funcao: 'acidificante', tags: ['acidificante', 'fosfito', 'fosfato', 'acido', 'foliar', 'estoque-fazenda'], dose: '100–200 mL/100 L', nota: 'Fosfito acidificante: corrige pH e nutre. Não misturar com cúpricos nem Ca/Mg/Zn.' },
    { nome: 'Forte SR', alias: ['forte sr'], ativos: ['sequestrante'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'sequestrante', tags: ['sequestrante', 'condicionador', 'estoque-fazenda'], dose: 'conforme bula', nota: 'Quelante/condicionador: sequestra cátions da água dura. Entra primeiro.' },
    { nome: 'Iharol Gold', alias: ['iharol gold', 'iharol'], ativos: ['oleo-mineral'], classe: 'Adjuvante', formulacao: 'EC', funcao: 'oleo', tags: ['oleo', 'surfactante', 'estoque-fazenda'], dose: '50–100 mL/100 L', nota: 'Óleo mineral espalhante adesivo. Não é redutor de pH.' },
    { nome: 'Aureo', alias: ['aureo', 'áureo'], ativos: ['oleo-vegetal'], classe: 'Adjuvante', formulacao: 'EC', funcao: 'oleo', tags: ['oleo', 'estoque-fazenda'], dose: '0,5–1,0 L/100 L', nota: 'Éster metilado de soja: penetrante para herbicidas/sistêmicos. Não ajusta pH.' },
    { nome: 'Sergomil L60', alias: ['sergomil'], ativos: ['siliconado'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'espalhante', tags: ['surfactante', 'siliconado', 'estoque-fazenda'], dose: 'conforme bula', nota: 'Espalhante siliconado: alta cobertura; instável fora de pH 6–8.' },
    { nome: 'Break-Thru', alias: ['break-thru', 'break thru', 'breakthru'], ativos: ['siliconado'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'espalhante', tags: ['surfactante', 'siliconado'] },
    { nome: 'Nimbus', alias: ['nimbus'], ativos: ['oleo-mineral'], classe: 'Adjuvante', formulacao: 'EC', funcao: 'oleo', tags: ['oleo'] },
    { nome: 'Assist', alias: ['assist'], ativos: ['oleo-mineral'], classe: 'Adjuvante', formulacao: 'EC', funcao: 'oleo', tags: ['oleo'] },
    { nome: 'LI 700', alias: ['li 700', 'li-700', 'li700'], ativos: ['acidificante', 'espalhante'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'acidificante', tags: ['acidificante', 'surfactante', 'condicionador'] },
    { nome: 'Silwet', alias: ['silwet'], ativos: ['siliconado'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'espalhante', tags: ['surfactante', 'siliconado'] },
    { nome: 'Agral', alias: ['agral'], ativos: ['espalhante'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'espalhante', tags: ['surfactante'] },
    { nome: 'TA 35', alias: ['ta 35', 'ta-35'], ativos: ['sequestrante'], classe: 'Adjuvante', formulacao: 'SL', funcao: 'sequestrante', tags: ['sequestrante', 'condicionador'] }
  ];

  /* ───────── REGRAS DE PARES ─────────
     a/b: tag, 'classe:X', 'form:XX', '!tag' ou lista (todas). tipo: fisica | quimica | agronomica | biologica | legal
     sev: alta (bloqueia) | media (restrição/jar test) | baixa (atenção) | info. c: confiança 0–1. */
  const regrasPares = [
    { id: 'R01', a: 'glifosato', b: 'cation-divalente', tipo: 'quimica', sev: 'alta', titulo: 'Glifosato × cátion foliar (Ca, Mg, Zn, Mn, Fe, Cu)', detalhe: 'Cátions divalentes quelam o glifosato e formam complexos insolúveis: perda de eficácia e precipitado.', conduta: 'Não misturar. Aplicar o foliar em outra passada; se inevitável, sulfato de amônio/sequestrante antes e jar test.', c: 0.95, fonte: 'Embrapa Doc. 437; Agrolink; literatura glifosato × água dura' },
    { id: 'R02', a: 'glifosato', b: 'cuprico', tipo: 'quimica', sev: 'alta', titulo: 'Glifosato × cúprico', detalhe: 'Cu²⁺ complexa o glifosato; o cúprico também fica menos disponível.', conduta: 'Separar as aplicações.', c: 0.85, fonte: 'Literatura (quelação de glifosato por metais)' },
    { id: 'R03', a: 'cuprico', b: 'fosfato', tipo: 'quimica', sev: 'alta', titulo: 'Cúprico × fosfito / fosfato / fosetil', detalhe: 'Fosfitos e fosfatos acidificam e formam fosfato de cobre insolúvel; pH abaixo de ~6 ainda libera Cu²⁺ livre (fitotoxicidade). Bulas de fosetil-Al e de cúpricos trazem a restrição explícita.', conduta: 'Não misturar; aplicar em passadas separadas.', c: 0.85, fonte: 'Bulas de cúpricos e fosetil-Al; protocolo da fazenda' },
    { id: 'R03b', a: 'cuprico', b: ['acidificante', '!fosfato'], tipo: 'quimica', sev: 'media', titulo: 'Cúprico × acidificante', detalhe: 'Cúpricos pedem pH 6–8: abaixo de 6 o cobre se solubiliza e queima a folha. O acidificante só cabe para trazer água muito alcalina até ~6,5.', conduta: 'Dose mínima do acidificante, medindo o pH; nunca abaixo de 6. Jar test.', c: 0.8, fonte: 'Bulas de cúpricos; protocolo da fazenda' },
    { id: 'R04', a: 'cuprico', b: 'biologico', tipo: 'biologica', sev: 'alta', titulo: 'Cúprico × biológico', detalhe: 'Cobre é biocida de amplo espectro: inativa fungos, bactérias e vírus entomopatogênicos.', conduta: 'Aplicar separado, com intervalo mínimo indicado pelo fabricante do biológico.', c: 0.9, fonte: 'Koppert — compatibilidade (exceção: cobre); Biobest' },
    { id: 'R05', a: 'fungicida-sintetico', b: 'biologico-fungo', tipo: 'biologica', sev: 'alta', titulo: 'Fungicida sintético × fungo benéfico (Beauveria, Metarhizium, Trichoderma)', detalhe: 'O fungicida mata o agente biológico no tanque.', conduta: 'Aplicar em passadas separadas (intervalo conforme bula do biológico).', c: 0.85, fonte: 'Koppert / Biobest Side Effects; protocolo da fazenda' },
    { id: 'R06', a: 'fungicida-sintetico', b: 'biologico-bacteria', tipo: 'biologica', sev: 'media', titulo: 'Fungicida sintético × bactéria benéfica (Bt, Bacillus)', detalhe: 'Compatibilidade varia por produto: alguns fungicidas são tolerados, outros inativam.', conduta: 'Consultar tabela de efeitos colaterais do fabricante; na dúvida, separar.', c: 0.6, fonte: 'Koppert Side Effects' },
    { id: 'R07', a: 'enxofre', b: 'oleo', tipo: 'agronomica', sev: 'alta', titulo: 'Enxofre × óleo', detalhe: 'Combinação clássica de fitotoxicidade (queima); o risco persiste 2–3 semanas entre uma aplicação e outra.', conduta: 'Jamais misturar; respeitar intervalo de 14–21 dias entre enxofre e óleo.', c: 0.95, fonte: 'Agrolink; bulas de enxofre; protocolo da fazenda' },
    { id: 'R08', a: 'enxofre', b: 'form:EC', tipo: 'agronomica', sev: 'media', titulo: 'Enxofre × formulação EC (solvente/óleo)', detalhe: 'Solventes de EC potencializam a queima do enxofre em calor.', conduta: 'Evitar; se necessário, T < 27 °C e jar test.', c: 0.7, fonte: 'Bulas de enxofre' },
    { id: 'R09', a: 'captan', b: 'oleo', tipo: 'agronomica', sev: 'alta', titulo: 'Captana/folpete × óleo', detalhe: 'Fitotoxicidade severa; restrição de bula.', conduta: 'Não misturar; intervalo ≥ 7–10 dias.', c: 0.85, fonte: 'Bulas de captana' },
    { id: 'R10', a: 'captan', b: 'alcalino', tipo: 'quimica', sev: 'alta', titulo: 'Captana/folpete × produto alcalino', detalhe: 'Hidrólise alcalina rápida (meia-vida de minutos em pH 8).', conduta: 'Separar; manter pH 5–6,5.', c: 0.9, fonte: 'Ask IFAS PI-301; protocolo da fazenda' },
    { id: 'R11', a: 'clorotalonil', b: 'oleo', tipo: 'agronomica', sev: 'media', titulo: 'Clorotalonil × óleo', detalhe: 'Bulas restringem mistura com óleos (fitotoxicidade em algumas culturas).', conduta: 'Verificar bula para a cultura; jar test e teste em pequena área.', c: 0.7, fonte: 'Bulas de clorotalonil' },
    { id: 'R12', a: 'organofosforado', b: 'alcalino', tipo: 'quimica', sev: 'alta', titulo: 'Organofosforado × produto alcalino', detalhe: 'Hidrólise alcalina degrada o inseticida antes da aplicação.', conduta: 'Separar; manter pH 5–6,5.', c: 0.9, fonte: 'Ask IFAS PI-301; protocolo da fazenda' },
    { id: 'R13', a: 'organofosforado', b: 'sulfonilureia', cultura: ['milho', 'sorgo'], tipo: 'agronomica', sev: 'alta', titulo: 'Organofosforado × sulfonilureia em milho/sorgo', detalhe: 'O OP inibe a metabolização do herbicida na planta → fitotoxicidade severa (caso clássico nicosulfurom + clorpirifós/terbufós).', conduta: 'Não misturar; intervalo ≥ 7 dias entre as aplicações.', c: 0.9, fonte: 'Aegro (antagonismo documentado); bulas de nicosulfurom' },
    { id: 'R14', a: 'accase', b: 'auxina', tipo: 'agronomica', sev: 'media', titulo: 'Graminicida ACCase × auxina (2,4-D, dicamba)', detalhe: 'Antagonismo: o auxínico reduz o controle de gramíneas pelo ACCase.', conduta: 'Aumentar dose do graminicida conforme bula ou aplicar separado (auxina depois).', c: 0.85, fonte: 'Aegro; literatura HRAC' },
    { id: 'R15', a: 'accase', b: 'glifosato', tipo: 'agronomica', sev: 'baixa', titulo: 'Graminicida ACCase × glifosato', detalhe: 'Redução variável do controle de gramíneas; depende de espécie, dose e adjuvante.', conduta: 'Usar óleo/adjuvante recomendado na bula do graminicida; evitar em infestação alta.', c: 0.6, fonte: 'Literatura HRAC' },
    { id: 'R16', a: 'glifosato', b: 'dessecante-contato', tipo: 'agronomica', sev: 'alta', titulo: 'Glifosato × dessecante de contato (paraquate, diquate)', detalhe: 'O contato queima a folha antes de o sistêmico translocar → rebrota.', conduta: 'Aplicação sequencial: glifosato primeiro, contato 5–7 dias depois.', c: 0.9, fonte: 'Aegro; literatura' },
    { id: 'R17', a: 'glifosato', b: 'auxina', tipo: 'agronomica', sev: 'baixa', titulo: 'Glifosato × 2,4-D/dicamba', detalhe: 'Mistura usual, mas em baixo volume e água dura há antagonismo em gramíneas e risco de precipitação do sal.', conduta: 'Volume ≥ 100 L/ha, água condicionada, 2,4-D adicionado depois do glifosato; jar test.', c: 0.7, fonte: 'Agrolink; Embrapa Doc. 437' },
    { id: 'R18', a: 'glifosato', b: 'triazina', tipo: 'agronomica', sev: 'media', titulo: 'Glifosato × atrazina/ametrina', detalhe: 'Antagonismo documentado sobre gramíneas (a triazina reduz a absorção/translocação).', conduta: 'Preferir sequencial; se misturar, dose plena de glifosato e adjuvante.', c: 0.7, fonte: 'Literatura HRAC-BR' },
    { id: 'R19', a: 'cationico', b: 'surfactante', tipo: 'fisica', sev: 'media', titulo: 'Paraquate/diquate × surfactante', detalhe: 'Herbicidas catiônicos são inativados por surfactantes aniônicos; só não iônicos são seguros.', conduta: 'Usar apenas o adjuvante indicado na bula; jar test.', c: 0.6, fonte: 'Bulas de paraquate' },
    { id: 'R20', a: 'sulfonilureia', b: 'acidificante', tipo: 'quimica', sev: 'media', titulo: 'Sulfonilureia × acidificante', detalhe: 'Sulfonilureias hidrolisam em pH < 5 (ao contrário da maioria dos defensivos). Alvo 6–8.', conduta: 'Não acidificar abaixo de 6; medir após cada adição.', c: 0.8, fonte: 'Literatura (hidrólise ácida de sulfonilureias)' },
    { id: 'R21', a: 'auxina', b: 'acidificante', tipo: 'fisica', sev: 'media', titulo: '2,4-D amina × acidificante', detalhe: 'Em pH < 5 o sal amina precipita como ácido 2,4-D (oleoso).', conduta: 'Manter pH ≥ 5,5; se glifosato exigir pH menor, aplicar separado.', c: 0.75, fonte: 'Bulas de 2,4-D amina' },
    { id: 'R22', a: 'boro', b: 'calcio', tipo: 'fisica', sev: 'alta', titulo: 'Boro × cálcio', detalhe: 'Precipitação de borato de cálcio (insolúvel).', conduta: 'Não misturar em concentrado nem no tanque; aplicar separado.', c: 0.85, fonte: 'Guias de compatibilidade de fertilizantes' },
    { id: 'R23', a: 'fosfato', b: 'cation-divalente', tipo: 'fisica', sev: 'alta', titulo: 'Fosfato/fosfito × cátion (Ca, Mg, Zn, Mn, Fe, Cu)', detalhe: 'Fosfatos de cálcio/zinco/manganês são insolúveis: precipitado imediato e entupimento.', conduta: 'Não misturar (exceto formas quelatizadas, com jar test).', c: 0.9, fonte: 'Protocolo da fazenda (ZnSO₄ × fosfato); guias de fertilizantes' },
    { id: 'R24', a: 'sulfato', b: 'calcio', tipo: 'fisica', sev: 'media', titulo: 'Sulfato × cálcio', detalhe: 'Forma gesso (CaSO₄), pouco solúvel; turva e sedimenta.', conduta: 'Evitar; se necessário, alta diluição e jar test.', c: 0.8, fonte: 'Química básica; guias de fertilizantes' },
    { id: 'R25', a: 'sal-alto', b: 'form:EC', tipo: 'fisica', sev: 'media', titulo: 'Fertilizante salino × emulsionável (EC)', detalhe: 'Eletrólitos em alta concentração quebram a emulsão (salting out): separação de óleo.', conduta: 'Foliar por último, bem diluído; jar test.', c: 0.7, fonte: 'Embrapa Doc. 437 (adjuvantes/foliares: risco pouco conhecido); prática' },
    { id: 'R26', a: 'sal-alto', b: 'form:SC', tipo: 'fisica', sev: 'baixa', titulo: 'Fertilizante salino × suspensão concentrada (SC)', detalhe: 'Sais podem floculares suspensões.', conduta: 'Foliar por último; observar no jar test.', c: 0.6, fonte: 'Prática agronômica' },
    { id: 'R27', a: 'siliconado', b: 'acidificante', tipo: 'quimica', sev: 'media', titulo: 'Organossiliconado × acidificante forte', detalhe: 'Trissiloxanos hidrolisam fora de pH 6–8, perdendo o efeito superespalhante.', conduta: 'Ajustar pH antes, sem passar de 6; adicionar o siliconado por último.', c: 0.7, fonte: 'Fichas técnicas de organossiliconados' },
    { id: 'R28', a: 'oleo', b: 'cuprico', tipo: 'agronomica', sev: 'media', titulo: 'Óleo × cúprico', detalhe: 'Risco de fitotoxicidade (mancha) em café/citros com óleo + cobre em calor.', conduta: 'Evitar em T > 28 °C; verificar bula; teste em área pequena.', c: 0.6, fonte: 'Bulas de cúpricos' },
    { id: 'R29', a: 'fosetil', b: 'foliar', tipo: 'quimica', sev: 'media', titulo: 'Fosetil-Al × fertilizante foliar', detalhe: 'Bula restringe mistura com foliares (sobretudo nitrogenados e cátions).', conduta: 'Separar.', c: 0.7, fonte: 'Bula de fosetil-Al' },
    { id: 'R30', a: 'biologico-fungo', b: ['classe:Inseticida', '!biologico'], tipo: 'biologica', sev: 'baixa', titulo: 'Fungo entomopatogênico × inseticida químico', detalhe: 'Muitos inseticidas são compatíveis, mas alguns reduzem germinação dos conídios.', conduta: 'Verificar tabela do fabricante (classe 1–4 IOBC).', c: 0.6, fonte: 'Koppert / Biobest Side Effects' },
    { id: 'R31', a: 'ams', b: 'calcio', tipo: 'fisica', sev: 'media', titulo: 'Sulfato de amônio × cálcio', detalhe: 'Precipita gesso.', conduta: 'Não usar AMS com foliar de cálcio.', c: 0.85, fonte: 'Química básica' },
    { id: 'R32', a: 'mancozebe', b: 'cuprico', tipo: 'agronomica', sev: 'info', titulo: 'Mancozebe + cúprico', detalhe: 'Associação multissítio tradicional; compatível na faixa pH 6–7.', conduta: 'Não acidificar abaixo de 6.', c: 0.85, fonte: 'Prática; bulas' },
    { id: 'R33', a: 'glifosato', b: 'ams', tipo: 'quimica', sev: 'info', titulo: 'Glifosato + sulfato de amônio', detalhe: 'AMS neutraliza cátions da água dura e melhora absorção do glifosato.', conduta: 'Adicionar o AMS antes do glifosato (passo 3).', c: 0.9, fonte: 'Literatura' },
    { id: 'R34', a: 'hidrolise-alcalina', b: 'alcalino', tipo: 'quimica', sev: 'media', titulo: 'Produto sensível a pH alto × produto alcalinizante', detalhe: 'O componente alcalino (boro octaborato, hidróxido de cobre…) eleva o pH da calda e acelera a hidrólise.', conduta: 'Medir pH após adicionar o alcalino; corrigir antes do sensível ou separar.', c: 0.75, fonte: 'Ask IFAS PI-301' },
    { id: 'R35', a: ['hidrolise-acida', '!cuprico', '!sulfonilureia', '!auxina'], b: 'acido', tipo: 'quimica', sev: 'baixa', titulo: 'Produto sensível a pH baixo × produto acidificante', detalhe: 'Mancozebe e similares degradam abaixo de ~5,5; o acidificante só deve trazer a água até a faixa alvo.', conduta: 'Medir o pH após o acidificante; não passar de 5,5.', c: 0.75, fonte: 'kb.js (faixas por grupo)' },
    { id: 'R36', a: 'biologico', b: 'acidificante', tipo: 'biologica', sev: 'baixa', titulo: 'Biológico × acidificante', detalhe: 'Organismos vivos toleram pH 5,5–7,5; excesso de acidificante inativa.', conduta: 'Ajustar pH antes de adicionar o biológico; alvo ≥ 5,5.', c: 0.7, fonte: 'Koppert (pH 5–8,5 no tanque)' },
    { id: 'R37', a: 'dessecante-contato', b: 'biologico', tipo: 'biologica', sev: 'media', titulo: 'Paraquate/diquate × biológico', detalhe: 'Oxidantes fortes danificam células do agente biológico.', conduta: 'Separar.', c: 0.65, fonte: 'Koppert Side Effects' },
    { id: 'R38', a: 'oleo', b: 'sulfonilureia', cultura: ['milho', 'sorgo'], tipo: 'agronomica', sev: 'baixa', titulo: 'Óleo × sulfonilureia em milho/sorgo', detalhe: 'Óleo mineral é recomendado em bula, mas em estresse hídrico/calor aumenta a fitotoxicidade.', conduta: 'Usar dose mínima de óleo; não aplicar em plantas estressadas.', c: 0.7, fonte: 'Bulas de nicosulfurom' },
    { id: 'R39', a: 'abamectina', b: 'oleo', tipo: 'agronomica', sev: 'info', titulo: 'Abamectina + óleo', detalhe: 'Óleo mineral melhora a penetração translaminar da abamectina.', conduta: 'Dose de óleo conforme bula.', c: 0.8, fonte: 'Bulas de abamectina' },
    { id: 'R40', a: 'triazol', b: 'foliar', tipo: 'quimica', sev: 'baixa', titulo: 'Triazol × fertilizante foliar', detalhe: 'Sais alcalinizantes podem elevar pH acima de 7 e hidrolisar o triazol.', conduta: 'Foliar por último; medir pH final (alvo 5,5–6,5).', c: 0.65, fonte: 'Protocolo da fazenda' }
  ];

  return {
    versao: '1.0.1',
    ativos: A,
    comerciais,
    regrasPares,
    condicionadoresSugeridos: { reduzir: ['Wetcit 50–100 mL/100 L', 'Kantphos 100–200 mL/100 L (se não houver cúprico/cátion na calda)'], sequestrar: ['Forte SR (conforme bula)', 'sulfato de amônio 0,5–2 %'] },
    culturas: ['Café', 'Milho', 'Soja', 'Sorgo', 'Trigo', 'Feijão', 'Algodão', 'Pastagens', 'Cana-de-açúcar', 'Citros', 'Outra'],
    /* doenças, pragas e estádios por cultura — listas de apoio para os campos
       de alvo da calda (não substituem o diagnóstico nem a bula) */
    alvosCultura: {
      'Café': {
        doencas: ['Ferrugem (Hemileia vastatrix)', 'Cercosporiose (Cercospora coffeicola)', 'Phoma / requeima (Phoma tarda)', 'Mancha aureolada (Pseudomonas syringae)', 'Antracnose (Colletotrichum spp.)', 'Rizoctoniose (mal-de-mudas)', 'Nematoides (Meloidogyne spp.)'],
        pragas: ['Broca-do-café (Hypothenemus hampei)', 'Bicho-mineiro (Leucoptera coffeella)', 'Ácaro-vermelho (Oligonychus ilicis)', 'Cochonilha-da-roseta (Planococcus spp.)', 'Cigarra (Quesada gigas)', 'Lagarta-dos-cafezais (Eacles imperialis)', 'Cochonilha-da-raiz (Dysmicoccus)'],
        estadios: ['Repouso / dormência', 'Florada', 'Chumbinho', 'Expansão do fruto', 'Granação', 'Maturação', 'Pós-colheita', 'Formação / mudas']
      },
      'Milho': {
        doencas: ['Mancha-branca (Pantoea / Phaeosphaeria)', 'Cercosporiose (Cercospora zeae-maydis)', 'Helmintosporiose (Exserohilum turcicum)', 'Ferrugem polissora (Puccinia polysora)', 'Ferrugem tropical (Physopella zeae)', 'Antracnose (Colletotrichum graminicola)', 'Enfezamento (molicutes, vetor cigarrinha)'],
        pragas: ['Lagarta-do-cartucho (Spodoptera frugiperda)', 'Cigarrinha-do-milho (Dalbulus maidis)', 'Percevejo barriga-verde (Dichelops spp.)', 'Lagarta-da-espiga (Helicoverpa zea)', 'Broca-da-cana (Diatraea saccharalis)', 'Pulgão-do-milho (Rhopalosiphum maidis)', 'Corós (Phyllophaga spp.)'],
        estadios: ['V2–V4', 'V6–V8', 'V10–V12', 'Pendoamento (VT)', 'Florescimento (R1)', 'Grão leitoso (R3)', 'Grão pastoso (R4)', 'Maturação (R6)']
      },
      'Soja': {
        doencas: ['Ferrugem asiática (Phakopsora pachyrhizi)', 'Mancha-alvo (Corynespora cassiicola)', 'Mofo-branco (Sclerotinia sclerotiorum)', 'Antracnose (Colletotrichum truncatum)', 'Crestamento / DFC (Cercospora kikuchii)', 'Oídio (Erysiphe diffusa)', 'Nematoides (Heterodera / Meloidogyne)'],
        pragas: ['Percevejo-marrom (Euschistus heros)', 'Lagarta-da-soja (Anticarsia gemmatalis)', 'Helicoverpa armigera', 'Falsa-medideira (Chrysodeixis includens)', 'Mosca-branca (Bemisia tabaci)', 'Ácaro-rajado (Tetranychus urticae)', 'Percevejo-barriga-verde (Dichelops)'],
        estadios: ['V3–V4', 'V6–V8', 'Pré-florada (R1)', 'Florescimento pleno (R2)', 'Formação de vagem (R3–R4)', 'Enchimento de grãos (R5)', 'Maturação (R7–R8)']
      },
      'Sorgo': {
        doencas: ['Antracnose (Colletotrichum sublineolum)', 'Ferrugem (Puccinia purpurea)', 'Mancha zonada (Gloeocercospora sorghi)', 'Doença açucarada / ergot (Claviceps africana)', 'Helmintosporiose (Exserohilum turcicum)'],
        pragas: ['Pulgão-do-sorgo (Melanaphis sacchari)', 'Lagarta-do-cartucho (Spodoptera frugiperda)', 'Mosca-do-sorgo (Stenodiplosis sorghicola)', 'Percevejos (Dichelops / Euschistus)', 'Cigarrinha (Dalbulus maidis)'],
        estadios: ['Vegetativo inicial', 'Diferenciação floral', 'Emborrachamento', 'Florescimento', 'Grão leitoso', 'Grão pastoso', 'Maturação']
      },
      'Trigo': {
        doencas: ['Brusone (Pyricularia oryzae)', 'Ferrugem-da-folha (Puccinia triticina)', 'Giberela (Fusarium graminearum)', 'Mancha amarela (Drechslera tritici-repentis)', 'Oídio (Blumeria graminis)', 'Septoriose (Zymoseptoria tritici)'],
        pragas: ['Pulgão-da-espiga (Sitobion avenae)', 'Pulgão-da-folha (Rhopalosiphum padi)', 'Lagarta-do-trigo (Pseudaletia sequax)', 'Percevejo barriga-verde (Dichelops)', 'Corós'],
        estadios: ['Perfilhamento', 'Elongação', 'Emborrachamento', 'Espigamento', 'Florescimento (antese)', 'Grão leitoso', 'Maturação']
      },
      'Feijão': {
        doencas: ['Antracnose (Colletotrichum lindemuthianum)', 'Mofo-branco (Sclerotinia sclerotiorum)', 'Ferrugem (Uromyces appendiculatus)', 'Mancha-angular (Pseudocercospora griseola)', 'Murcha de fusário (Fusarium oxysporum)', 'Crestamento bacteriano (Xanthomonas)'],
        pragas: ['Mosca-branca (Bemisia tabaci)', 'Vaquinha (Diabrotica speciosa)', 'Cigarrinha-verde (Empoasca kraemeri)', 'Lagarta-das-vagens (Helicoverpa)', 'Ácaro-branco (Polyphagotarsonemus latus)', 'Lagarta-elasmo (Elasmopalpus)'],
        estadios: ['V3 (primeira folha trifoliolada)', 'V4 (pré-florada)', 'R5 (botão floral)', 'R6 (florescimento)', 'R7 (formação de vagens)', 'R8 (enchimento de grãos)', 'R9 (maturação)']
      },
      'Algodão': {
        doencas: ['Ramulária (Ramularia areola)', 'Mancha-alvo (Corynespora cassiicola)', 'Ramulose (Colletotrichum gossypii)', 'Mofo-branco (Sclerotinia)', 'Murcha de fusário (Fusarium)', 'Mancha-de-estenfílio (Stemphylium)'],
        pragas: ['Bicudo (Anthonomus grandis)', 'Lagarta-das-maçãs (Helicoverpa armigera)', 'Curuquerê (Alabama argillacea)', 'Mosca-branca (Bemisia tabaci)', 'Ácaro-rajado (Tetranychus urticae)', 'Pulgão (Aphis gossypii)', 'Percevejo-manchador (Dysdercus)'],
        estadios: ['Vegetativo (V4–V6)', 'Aparecimento de botões (B1)', 'Florescimento (F1)', 'Maçã formada', 'Capulho', 'Pré-colheita / desfolha']
      },
      'Pastagens': {
        doencas: ['Helmintosporiose em braquiária', 'Carvão (Ustilago spp.)', 'Antracnose em estilosantes'],
        pragas: ['Cigarrinha-das-pastagens (Deois / Mahanarva)', 'Lagarta-do-capim (Spodoptera frugiperda)', 'Percevejo-castanho (Scaptocoris castanea)', 'Cupins de montículo', 'Formiga cortadeira (Atta / Acromyrmex)'],
        estadios: ['Rebrota', 'Pleno crescimento', 'Pré-pastejo', 'Pós-pastejo', 'Reforma / implantação']
      },
      'Cana-de-açúcar': {
        doencas: ['Ferrugem alaranjada (Puccinia kuehnii)', 'Ferrugem marrom (Puccinia melanocephala)', 'Carvão (Sporisorium scitamineum)', 'Escaldadura (Xanthomonas albilineans)', 'Raquitismo da soqueira (Leifsonia xyli)', 'Mosaico (SCMV)'],
        pragas: ['Broca-da-cana (Diatraea saccharalis)', 'Cigarrinha-da-raiz (Mahanarva fimbriolata)', 'Bicudo-da-cana (Sphenophorus levis)', 'Migdolus (Migdolus fryanus)', 'Cupins subterrâneos', 'Formiga cortadeira'],
        estadios: ['Brotação', 'Perfilhamento', 'Crescimento dos colmos', 'Maturação', 'Soqueira pós-corte']
      },
      'Citros': {
        doencas: ['Greening / HLB (vetor psilídeo)', 'Cancro cítrico (Xanthomonas citri)', 'Pinta preta (Phyllosticta citricarpa)', 'Verrugose (Elsinoe spp.)', 'Gomose (Phytophthora spp.)', 'Leprose (vírus transmitido por ácaro)'],
        pragas: ['Psilídeo (Diaphorina citri)', 'Ácaro da leprose (Brevipalpus yothersi)', 'Ácaro da falsa-ferrugem (Phyllocoptruta oleivora)', 'Mosca-das-frutas (Ceratitis / Anastrepha)', 'Bicho-furão (Gymnandrosoma aurantianum)', 'Larva-minadora (Phyllocnistis citrella)', 'Cochonilhas'],
        estadios: ['Repouso', 'Brotação', 'Florada', 'Chumbinho', 'Fruto em expansão', 'Maturação', 'Pós-colheita']
      }
    },
    severidades: ['Preventivo (sem sintoma)', 'Baixa — focos isolados', 'Média — distribuída no talhão', 'Alta — generalizada', 'Curativa / erradicante'],
    partesAlvo: ['Folha — face superior', 'Folha — face inferior', 'Ponteiro e brotação', 'Flor', 'Fruto', 'Tronco e ramos', 'Solo / palhada', 'Planta daninha em pós-emergência', 'Raiz e colo'],
    classes: ['Herbicida', 'Fungicida', 'Inseticida', 'Acaricida', 'Nematicida', 'Adjuvante', 'Fertilizante Foliar', 'Bioracional', 'Cúprico', 'Outro'],
    formulacoes: { WG: 'Grânulos dispersíveis', WP: 'Pó molhável', SG: 'Granulado solúvel', SP: 'Pó solúvel', SC: 'Suspensão concentrada', CS: 'Suspensão de encapsulado', SE: 'Suspo-emulsão', SL: 'Concentrado solúvel', EC: 'Concentrado emulsionável', EW: 'Emulsão óleo em água', ME: 'Microemulsão', OD: 'Dispersão em óleo', BIO: 'Organismo vivo' },
    unidades: ['L/ha', 'kg/ha', 'mL/ha', 'g/ha', 'mL/100L', 'g/100L', 'L/100L', 'kg/100L'],
    equipamentos: { barra: { nome: 'Pulverizador de barra', volume: [80, 150], custo: 60 }, turbo: { nome: 'Turbo atomizador', volume: [300, 500], custo: 90 }, drone: { nome: 'Drone (informar modelo)', volume: [10, 30], custo: 120 }, costal: { nome: 'Costal', volume: [150, 300], custo: 40 }, 'herbicida-cafe': { nome: 'Barra de herbicida para café (faixa dirigida)', volume: [150, 300], custo: 55 }, aviao: { nome: 'Avião agrícola', volume: [10, 40], custo: 110 } },
    fontes: [
      { id: 'embrapa437', titulo: 'Embrapa Soja — Manual técnico para subsidiar a mistura em tanque de agrotóxicos e afins (Documentos 437, 2021)', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1132371/1/DOCUMENTOS-437-1.pdf' },
      { id: 'in40', titulo: 'MAPA — Instrução Normativa nº 40/2018 (receituário agronômico e mistura em tanque)', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/45173700/do1-2018-10-15-instrucao-normativa-n-40-de-11-de-outubro-de-2018-45173522' },
      { id: 'agrofit', titulo: 'AGROFIT/MAPA — dados abertos de produtos formulados (CC-BY)', url: 'https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit' },
      { id: 'ifas', titulo: 'Ask IFAS PI-301 — Ensuring Pesticide Compatibility in Tank Mixes (A.P.P.L.E.S.)', url: 'https://ask.ifas.ufl.edu/publication/PI301' },
      { id: 'nbr13875', titulo: 'ABNT NBR 13875 — Avaliação de compatibilidade físico-química (técnica dinâmica; leituras 0/2/6/24 h)', url: 'https://www.target.com.br/produtos/normas-tecnicas/33988/nbr13875-agrotoxicos-e-afins-avaliacao-de-compatibilidade-fisico-quimica' },
      { id: 'frac', titulo: 'FRAC-BR / IRAC-BR / HRAC-BR — modos de ação e manejo de resistência', url: 'https://www.irac-br.org/modo-de-acao' },
      { id: 'koppert', titulo: 'Koppert — Side Effects / Compatibilidade de Produtos (biológicos)', url: 'https://www.koppert.com.br/aplicativo-de-compatibilidade-de-produtos/' },
      { id: 'biobest', titulo: 'Biobest — Side Effects manual', url: 'https://apps.apple.com/us/app/biobest-side-effects-app/id6467640637' },
      { id: 'yara', titulo: 'Yara TankmixIT — banco de testes laboratoriais de mistura (foliares × defensivos)', url: 'https://www.yara.us/crop-nutrition/tools-and-services/tankmix/' },
      { id: 'mixtank', titulo: 'Precision Laboratories — Mix Tank app (ordem de mistura, mix sheet, spray log)', url: 'https://www.precisionlab.com/news-resources/mix-tank-app/' },
      { id: 'bayer', titulo: 'Bayer UK — Tank Mix Database (testes físicos; ordem de 15 passos)', url: 'https://cropscience.bayer.co.uk/tankmix' },
      { id: 'aegro', titulo: 'Aegro — Guia de mistura de defensivos em tanque', url: 'https://aegro.com.br/blog/mistura-defensivos-tanque-guia/' },
      { id: 'teejet', titulo: 'TeeJet Technologies — Catálogo de bicos para área total (Brasil): vazão, classe de gota por pressão e altura ideal da barra', url: 'https://www.teejet.com/pt-br/-/media/dam/agricultural/brazil/sales-material/catalog/broadcast_nozzles-pt.pdf' },
      { id: 'iso10625', titulo: 'ISO 10625 — código de cores e vazão nominal das pontas de pulverização (vazão a 3 bar)', url: 'https://www.iso.org/standard/76567.html' },
      { id: 'asabe572', titulo: 'ASABE S572.1 — classificação do tamanho de gotas (fina, média, grossa, ultragrossa)', url: 'https://elibrary.asabe.org/abstract.asp?aid=29187' },
      { id: 'magnojet', titulo: 'Magnojet — linha de pontas de pulverização (AD, ADGA, AD-IA, MUG, MAG)', url: 'https://www.magnojet.com.br/category/pontas-de-pulveriza%C3%A7%C3%A3o' },
      { id: 'albuz', titulo: 'ALBUZ — Nozzle technology catalog 2022 (AXI, ADI, APE, AVI, AVI-UC, CVI, MVI, ATR, ATI, TVI, ATF): vazão, ângulo, classe de gota por pressão e altura de barra', url: 'https://albuz-spray.com/pdf/catalogue-ALBUZ-UK.pdf' },
      { id: 'hypro', titulo: 'Hypro (Pentair) — Selecting the Right Spray Nozzle: tipo de jato, tecnologia, ângulo, faixa de pressão e classe ASABE por modelo (ULD, GuardianAIR, Guardian, LD, 3D, VP, E, DeflecTip)', url: 'https://sprayersupplies.com/content/media/documents/hypro_selecting_the_right_spray_nozzle.pdf' },
      { id: 'deltat', titulo: 'Delta T — janela de pulverização (bulbo úmido por Stull, 2011): faixa ideal de 2 a 8, vento de 3 a 15 km/h. Mesmo critério do PVGest da fazenda', url: 'https://allanwag.github.io/pvgest/' },
      { id: 'hypro-guide', titulo: 'Pentair Hypro — Crop Spraying Guide: tabelas de vazao em L/min por bar, classificacao BCPC/LERAP e faixa de pressao (GuardianAIR, ULD, ULDM, 3D)', url: 'https://cropservices.co.uk/wp-content/uploads/2025/03/Pentair-Hypro-Crop-Spraying-Guide.pdf' },
      { id: 'magnojet-catalogo', titulo: 'Magnojet — Catálogo 2025 (PDF): tabelas de vazão em L/min por pressão, classe de gota e faixa útil de cada ponta', url: 'https://www.magnojet.com.br/pulverizacao' },
      { id: 'jacto-bicos', titulo: 'Jacto — bicos e pontas (JTT, J3D, JDF, ADI, AVI, AXI, ATR)', url: 'https://jacto.com/brasil/products/bicos-e-acessorios' },
      { id: 'ph400', titulo: 'Jacto — Pulverizador de herbicida para café PH-400 (faixa de 1,40 a 3,60 m, bicos flood 130°, ~500 µm, 250 L/ha a 4,5 km/h)', url: 'https://sbcpd.org/uploads/trabalhos/pulverizador-de-herbicida-para-cafe-jacto-ph-400-997.pdf' },
      { id: 'barra-cafe', titulo: 'Planta Daninha — Eficiência de uma barra de pulverização para aplicação de herbicida em lavouras de café em formação (faixa de 0,80 m, ponta de faixa uniforme, proteção contra deriva)', url: 'https://www.scielo.br/j/pd/a/8YrWpbZKMgkwKxrv398Qypm/' },
      { id: 'agrolink', titulo: 'Agrolink — Como realizar a mistura de defensivos em tanques (NBR 13875 × ASTM E1518)', url: 'https://www.agrolink.com.br/agrolinkfito/defensivos-e-adjuvantes/aspectos-gerais/como-realizar-a-mistura-de-defensivos-em-tanques-_485965.html' }
    ]
  };
});
