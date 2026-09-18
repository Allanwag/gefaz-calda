/* Testes do motor de pontas e regulagem (node --test tests/pontas.test.cjs) */
const test = require('node:test');
const assert = require('node:assert');
const P = require('../pontas.js');

const perto = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (tolerância ${tol})`);

test('vazão segue a ISO 10625 e a lei da raiz quadrada', () => {
  perto(P.vazaoPonta('02', 3), 0.79, 0.005);
  perto(P.vazaoPonta('03', 3), 1.18, 0.005);
  perto(P.vazaoPonta('04', 3), 1.58, 0.005);
  // catálogo TeeJet: TT11002 a 1, 2, 4 e 6 bar
  perto(P.vazaoPonta('02', 1), 0.46, 0.005);
  perto(P.vazaoPonta('02', 2), 0.65, 0.01);   // catálogo arredonda 0,645 → 0,65
  perto(P.vazaoPonta('02', 4), 0.91, 0.005);
  perto(P.vazaoPonta('02', 6), 1.12, 0.005);
  // quadruplicar a pressão dobra a vazão
  perto(P.vazaoPonta('03', 8), 2 * P.vazaoPonta('03', 2), 0.005);
});

test('pressão é a inversa da vazão', () => {
  perto(P.pressaoPara('02', P.vazaoPonta('02', 2.5)), 2.5, 0.01);
  perto(P.novaPressao(2, 0.65, 1.3), 8, 0.01);
});

test('equações de regulagem fecham nos dois sentidos', () => {
  const q = P.vazaoNecessaria(100, 8, 0.5);          // (100 × 8 × 0,5) ÷ 600
  perto(q, 0.667, 0.002);
  perto(P.volumeAplicado(q, 8, 0.5), 100, 0.5);
  perto(P.velocidadeAlvo(q, 100, 0.5), 8, 0.05);
  perto(P.velocidadeCampo(50, 22.5), 8, 0.02);
});

test('altura da barra: 110° a 50 cm → 50 cm; 80° → 75 cm', () => {
  assert.equal(P.alturaBarra(110, 0.5), 50);
  assert.equal(P.alturaBarra(80, 0.5), 75);
  assert.ok(P.alturaBarra(120, 0.5) < 50);
});

test('classe de gota vem do catálogo e engrossa com o tamanho', () => {
  assert.equal(P.classeGota('tj-tt', 1, '02').id, 'MG');
  assert.equal(P.classeGota('tj-tt', 3, '02').id, 'M');
  assert.equal(P.classeGota('tj-tti', 3, '02').id, 'UG');
  assert.equal(P.classeGota('tj-aixr', 3, '02').id, 'G');
  const g02 = P.classeGota('tj-aixr', 3, '02'), g04 = P.classeGota('tj-aixr', 3, '04');
  assert.ok(g04.grau > g02.grau, 'ponta maior deve dar gota mais grossa');
});

test('regulagem em área total calcula pressão, gota e ficha de tanque', () => {
  const r = P.calcular({ modo: 'area', volumeHa: 100, velocidade: 8, espacamento: 0.5, nBicos: 40, ponta: 'tj-aixr', iso: '02', alvo: 'herbicida-sistemico', tanque: 2000, area: 50 });
  perto(r.vazaoNecessaria, 0.667, 0.002);
  perto(r.pressao, 2.14, 0.05);
  assert.equal(r.gota.id, 'MG');
  assert.equal(r.larguraTrabalho, 20);
  perto(r.ficha.haPorTanque, 20, 0.1);
  assert.equal(r.ficha.cargas, 3);
  assert.ok(r.formulas.length >= 4);
  assert.ok(r.avisos.every(a => a.nivel !== 'alta'), 'arranjo clássico não deve gerar alerta alto');
});

test('pressão fixa devolve o volume que realmente sai', () => {
  const r = P.calcular({ modo: 'area', volumeHa: 100, velocidade: 8, espacamento: 0.5, nBicos: 40, ponta: 'tj-aixr', iso: '02', pressao: 3, fixarPressao: true });
  perto(r.vazaoPorBico, 0.79, 0.005);
  perto(r.volumeAplicado, 118.5, 1);
});

test('faixa dirigida no café: volume na faixa × volume na lavoura', () => {
  const r = P.calcular({ modo: 'faixa', volumeHa: 200, velocidade: 4.5, larguraFaixa: 1.6, bicosPorPassada: 4, entreLinhas: 3.5, ponta: 'tj-aixr', iso: '02', alvo: 'herbicida-cafe', tanque: 600 });
  perto(r.faixaPorBico, 0.4, 0.001);
  perto(r.vazaoNecessaria, 0.6, 0.005);
  perto(r.volumeAplicado, 200, 1);              // L/ha de faixa
  perto(r.volumeLavoura, 91.4, 1);              // 200 × 1,6/3,5
  perto(r.economia, 54.3, 0.5);
  assert.ok(r.ficha.haPorTanque > 6 && r.ficha.haPorTanque < 7);
  assert.ok(r.avisos.some(a => /hectare TRATADO/.test(a.texto)), 'deve lembrar que a dose da bula é por hectare tratado');
});

test('herbicida no café com gota fina gera alerta alto de deriva', () => {
  const r = P.calcular({ modo: 'faixa', volumeHa: 200, velocidade: 4.5, larguraFaixa: 1.6, bicosPorPassada: 4, entreLinhas: 3.5, ponta: 'tj-xr', iso: '02', alvo: 'herbicida-cafe' });
  assert.ok(r.avisos.some(a => a.nivel === 'alta' && /deriva|fitotox/i.test(a.texto)), 'XR (gota fina) no café deve ser barrado');
});

test('pressão fora da faixa útil da ponta é alertada', () => {
  const r = P.calcular({ modo: 'area', volumeHa: 400, velocidade: 8, espacamento: 0.5, nBicos: 40, ponta: 'tj-xr', iso: '015' });
  assert.ok(r.pressao > 4);
  assert.ok(r.avisos.some(a => a.nivel === 'alta' && /acima do máximo/.test(a.texto)));
});

test('seleção só devolve pontas dentro da faixa de pressão e ordenadas', () => {
  const s = P.selecionar({ modo: 'faixa', larguraFaixa: 1.6, bicosPorPassada: 4, entreLinhas: 3.5, volumeHa: 200, velocidade: 4.5, alvo: 'herbicida-cafe' });
  assert.ok(s.opcoes.length > 0);
  s.opcoes.forEach(o => {
    const p = P.PONTA_MAP[o.ponta];
    assert.ok(o.pressao >= p.pressao[0] && o.pressao <= p.pressao[1], `${o.modelo} ${o.iso} fora da faixa`);
    assert.ok(p.usos.includes('herbicida-cafe') || p.id === 'iso-generica');
  });
  for (let i = 1; i < s.opcoes.length; i++) assert.ok(s.opcoes[i - 1].score >= s.opcoes[i].score);
  assert.ok(s.opcoes.slice(0, 5).every(o => o.gota.grau >= P.GOTA_MAP['G'].grau), 'as melhores devem ser de gota grossa para cima');
});

test('calibração calcula CV, desgaste e a correção', () => {
  const c = P.calibracao({ coletas: [820, 790, 900, 810], segundos: 60, espacamento: 0.5, velocidade: 8, volumeHa: 100, iso: '02', pressao: 2.5 });
  perto(c.media, 0.83, 0.005);
  assert.ok(c.cv > 0 && c.cv < 10);
  perto(c.volumeReal, 124.5, 1);
  assert.equal(c.veredito, 'fora-do-alvo');
  assert.ok(c.bicos.find(b => b.n === 3).trocar, 'bico com vazão 8 % acima da média e 25 % acima da nominal deve sair');
  assert.ok(c.correcao.length >= 1);
});

test('calibração uniforme e no alvo passa', () => {
  const c = P.calibracao({ coletas: [667, 665, 670, 668], segundos: 60, espacamento: 0.5, velocidade: 8, volumeHa: 100 });
  assert.equal(c.veredito, 'bom');
  assert.ok(c.bicos.every(b => !b.trocar));
  perto(c.volumeReal, 100, 1);
});

test('presets de café produzem regulagem utilizável', () => {
  P.PRESETS.filter(p => p.iso).forEach(pre => {
    const r = P.calcular({ ...pre, tanque: 600, area: 10 });
    const ponta = P.PONTA_MAP[pre.ponta];
    assert.ok(r.pressao >= ponta.pressao[0] && r.pressao <= ponta.pressao[1], `${pre.nome}: pressão ${r.pressao} fora de ${ponta.pressao.join('–')} bar`);
    assert.ok(r.vazaoPorBico > 0 && r.volumeAplicado > 0);
  });
});

test('catálogo é consistente', () => {
  const usos = P.ALVOS.map(a => a.id), classes = P.GOTAS.map(g => g.id);
  P.PONTAS.forEach(p => {
    assert.ok(p.id && p.marca && p.modelo && p.fonte, `ponta incompleta: ${p.id}`);
    assert.ok(p.pressao[0] > 0 && p.pressao[1] > p.pressao[0], `faixa de pressão inválida em ${p.id}`);
    assert.ok(p.angulos.length && p.sizes.length, `ângulos/tamanhos faltando em ${p.id}`);
    p.usos.forEach(u => assert.ok(usos.includes(u), `uso desconhecido "${u}" em ${p.id}`));
    if (!p.escalaPropria) p.sizes.forEach(s => assert.ok(P.ISO_MAP[s] || P.tabelaDaPonta(p, s), `tamanho sem ISO e sem tabela "${s}" em ${p.id}`));
    if (p.vazaoTabela) {
      assert.ok(p.vazaoTabela.fonte, `tabela de vazão sem fonte em ${p.id}`);
      Object.entries(p.vazaoTabela.valores).forEach(([s, v]) => {
        assert.equal(v.length, p.vazaoTabela.pressoes.length, `linha ${s} de ${p.id} com tamanho diferente das pressões`);
        for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1], `vazão não cresce com a pressão em ${p.id} ${s}`);
      });
    }
    Object.values(p.gotasPorBar || {}).forEach(g => assert.ok(classes.includes(g), `classe inválida em ${p.id}`));
    (p.gotasFaixa || []).forEach(g => assert.ok(classes.includes(g), `classe inválida em ${p.id}`));
    assert.ok(p.gotasPorBar || p.gotasFaixa, `${p.id} sem informação de gota`);
  });
});

test('cruzamento vazão × pressão acha a pressão de uma vazão desejada', () => {
  const c = P.cruzar({ vazaoConhecida: 0.85, pressaoConhecida: 2, vazaoDesejada: 0.70, velocidade: 8, faixaPorBico: 0.5 });
  perto(c.p2, 1.36, 0.02);                       // 2 × (0,70 ÷ 0,85)²
  perto(c.q2, 0.70, 0.001);
  perto(c.volumeAntes, 127.5, 0.5);
  perto(c.volumeDepois, 105, 0.5);
  perto(c.velocidadeEquivalente, 9.71, 0.05);    // mesmo volume só mexendo na velocidade
  assert.ok(c.variacaoPressao < 0 && c.variacaoVazao < 0);
});

test('cruzamento acha a vazão numa pressão desejada e fecha o círculo', () => {
  const c = P.cruzar({ vazaoConhecida: 0.79, pressaoConhecida: 3, pressaoDesejada: 6 });
  perto(c.q2, 1.117, 0.005);                     // √2 × 0,79
  const volta = P.cruzar({ vazaoConhecida: c.q2, pressaoConhecida: c.p2, vazaoDesejada: 0.79 });
  perto(volta.p2, 3, 0.02);
});

test('cruzamento por volume usa velocidade e faixa do arranjo', () => {
  const c = P.cruzar({ vazaoConhecida: 0.79, pressaoConhecida: 3, volumeDesejado: 120, velocidade: 6, faixaPorBico: 0.5, ponta: 'tj-aixr', iso: '02' });
  perto(c.q2, 0.6, 0.005);                       // (120 × 6 × 0,5) ÷ 600
  perto(c.p2, 1.73, 0.02);
  assert.equal(c.alvo, 'volume');
  assert.ok(c.gota, 'deve classificar a gota na pressão cruzada');
});

test('cruzamento alerta quando a pressão sai da faixa da ponta', () => {
  const c = P.cruzar({ vazaoConhecida: 0.79, pressaoConhecida: 3, vazaoDesejada: 1.6, ponta: 'tj-aixr', iso: '02' });
  assert.ok(c.p2 > 6);
  assert.ok(c.avisos.some(a => a.nivel === 'alta' && /máximo/.test(a.texto)));
  assert.ok(c.avisos.some(a => /±20 %|pressão só corrige/.test(a.conduta + a.texto)));
});

test('tabela cruzada respeita a faixa da ponta e marca o alvo', () => {
  const t = P.tabelaCruzada({ ponta: 'tj-aixr', velocidade: 8, faixaPorBico: 0.5, volumeAlvo: 100 });
  const ponta = P.PONTA_MAP['tj-aixr'];
  t.pressoes.forEach(b => assert.ok(b >= ponta.pressao[0] && b <= ponta.pressao[1]));
  const alvo = t.linhas.flatMap(l => l.celulas.filter(c => c.noAlvo));
  assert.ok(alvo.length, 'deve existir ao menos uma combinação dentro de 5 % do alvo');
  alvo.forEach(c => perto(c.volume, 100, 5));
  const c2 = t.linhas.find(l => l.bar === 2).celulas.find(c => c.iso === '02');
  perto(c2.vazao, 0.645, 0.005);
  perto(c2.volume, 96.8, 0.5);
});

test('proteção física rebaixa o alerta de deriva no café (e a ausência dela mantém alta)', () => {
  const base = { modo: 'faixa', volumeHa: 200, velocidade: 4, larguraFaixa: 0.8, bicosPorPassada: 2, entreLinhas: 3.5, ponta: 'tj-even', iso: '015', angulo: 80, alvo: 'herbicida-cafe' };
  const sem = P.calcular(base);
  const com = P.calcular({ ...base, protecao: true });
  assert.ok(sem.avisos.some(a => a.nivel === 'alta' && /sem proteção física/.test(a.texto)));
  assert.ok(!com.avisos.some(a => a.nivel === 'alta'));
  assert.ok(com.avisos.some(a => a.nivel === 'media' && /proteção física/.test(a.texto)));
  assert.equal(com.protecao, true);
});

test('presets de faixa não saem com alerta alto', () => {
  P.PRESETS.filter(p => p.modo === 'faixa').forEach(pre => {
    const r = P.calcular({ ...pre, tanque: 600 });
    assert.ok(!r.avisos.some(a => a.nivel === 'alta'), `${pre.nome}: ${r.avisos.filter(a => a.nivel === 'alta').map(a => a.texto).join(' / ')}`);
  });
});

test('vazões conferem com as tabelas dos catálogos Albuz', () => {
  // Albuz 2022: AXI 01 a 1,5 bar = 0,28 · AXI 08 a 3 bar = 3,20 · CVI 02 a 2 bar = 0,66
  perto(P.vazaoPonta('01', 1.5), 0.28, 0.01);
  perto(P.vazaoPonta('08', 3), 3.20, 0.05);
  perto(P.vazaoPonta('02', 2), 0.66, 0.02);
  perto(P.vazaoPonta('03', 3), 1.20, 0.03);          // AVI 03 a 3 bar
  perto(P.vazaoPonta('04', 3), 1.60, 0.03);          // MVI 04 a 3 bar
});

test('classes de gota das pontas Albuz vêm do catálogo', () => {
  assert.equal(P.classeGota('jc-axi', 2, '02').id, 'F');        // AXI: fina em toda a faixa
  assert.equal(P.classeGota('jc-adi', 2, '02').id, 'M');        // ADI: média até 3 bar
  assert.equal(P.classeGota('jc-adi', 4, '02').id, 'F');        // e afina a 4 bar
  assert.equal(P.classeGota('alb-cvi', 2, '02').id, 'MG');      // CVI: muito grossa a 2 bar
  assert.equal(P.classeGota('alb-cvi', 4, '02').id, 'G');
  assert.equal(P.classeGota('jc-avi', 3, '02').id, 'MG');       // AVI: 3 bar muito grossa
  assert.equal(P.classeGota('alb-tvi', 10, '02').id, 'EG');     // TVI: cone com indução de ar
  assert.equal(P.classeGota('alb-mvi', 2, '02').id, 'UG');      // MVI: ultragrossa
});

test('Albuz e Hypro entraram no catálogo com dados utilizáveis', () => {
  const albuz = P.PONTAS.filter(p => p.marca === 'Albuz');
  const hypro = P.PONTAS.filter(p => p.marca === 'Hypro');
  assert.ok(albuz.length >= 12, `Albuz: ${albuz.length}`);
  assert.ok(hypro.length >= 10, `Hypro: ${hypro.length}`);
  hypro.forEach(p => assert.ok(!p.escalaPropria, `${p.id} deveria usar a escala ISO`));
  // escala própria (ATR, APE) fica fora da seleção automática, porque a vazão não é ISO
  const s = P.selecionar({ modo: 'area', espacamento: 0.5, volumeHa: 150, velocidade: 6, alvo: 'fungicida', limite: 40 });
  assert.ok(!s.opcoes.some(o => o.ponta === 'alb-ape'), 'ponta sem ISO e sem tabela não pode ser sugerida');
  assert.ok(s.opcoes.some(o => P.PONTA_MAP[o.ponta].marca === 'Hypro'));
});

test('as marcas novas aparecem na seleção para herbicida no café', () => {
  const s = P.selecionar({ modo: 'faixa', larguraFaixa: 1.6, bicosPorPassada: 2, entreLinhas: 3.5, volumeHa: 200, velocidade: 4.5, alvo: 'herbicida-cafe', limite: 20 });
  const marcas = new Set(s.opcoes.map(o => o.marca));
  assert.ok(marcas.has('Albuz'), 'Albuz deve aparecer');
  assert.ok(marcas.has('Hypro'), 'Hypro deve aparecer');
  s.opcoes.slice(0, 10).forEach(o => assert.ok(o.gota.grau >= P.GOTA_MAP['G'].grau));
});

test('cones Albuz usam a tabela de vazão publicada, não a ISO', () => {
  // ATR 80° (escala de cores Albuz) — catálogo 2022, p. 20
  perto(P.vazaoDaPonta('jc-atr', 'vermelho', 10), 1.92, 0.01);
  perto(P.vazaoDaPonta('jc-atr', 'amarelo', 5), 0.73, 0.01);
  perto(P.vazaoDaPonta('jc-atr', 'roxo', 25), 6.52, 0.01);
  // linhas intermediárias: interpolação em √p bate com o catálogo
  perto(P.vazaoDaPonta('jc-atr', 'vermelho', 11), 2.01, 0.02);
  perto(P.vazaoDaPonta('jc-atr', 'amarelo', 18), 1.37, 0.02);
  perto(P.vazaoDaPonta('jc-atr', 'azul', 8), 3.06, 0.03);
  // ATI / TVI / ATF (código ISO, mas vazão publicada até 25 bar)
  perto(P.vazaoDaPonta('alb-ati', '015', 10), 1.10, 0.01);
  perto(P.vazaoDaPonta('alb-ati', '0050', 5), 0.26, 0.01);
  perto(P.vazaoDaPonta('alb-tvi', '01', 3), 0.40, 0.01);   // extrapolação abaixo da tabela
  perto(P.vazaoDaPonta('alb-atf', '03', 4), 1.39, 0.02);
  // a tabela do fabricante difere da extrapolação ISO pura — e é ela que vale
  assert.ok(Math.abs(P.vazaoDaPonta('alb-ati', '015', 20) - P.vazaoPonta('015', 20)) > 0.02);
});

test('pressão é a inversa da tabela', () => {
  ['jc-atr', 'alb-ati', 'alb-tvi', 'alb-atf'].forEach(id => {
    const t = P.tabelaDaPonta(id);
    Object.keys(t.valores).forEach(tam => {
      t.pressoes.forEach((bar, i) => {
        perto(P.pressaoDaPonta(id, tam, t.valores[tam][i]), bar, 0.05);
        perto(P.vazaoDaPonta(id, tam, bar), t.valores[tam][i], 0.005);
      });
    });
  });
});

test('regulagem de turbo atomizador com cone Albuz fecha sem alerta', () => {
  const r = P.calcular({ ...P.PRESETS.find(p => p.id === 'cafe-turbo'), tanque: 2000, area: 20 });
  perto(r.vazaoPorBico, 0.681, 0.005);          // 400 L/ha ÷ 12 bicos na rua de 3,5 m a 3,5 km/h
  assert.ok(r.pressao > 5 && r.pressao < 25, `pressão ${r.pressao} fora da faixa da ATR`);
  perto(r.vazaoTotal, 8.17, 0.05);
  assert.ok(!r.avisos.some(a => a.nivel === 'alta' || a.nivel === 'media'), r.avisos.map(a => a.texto).join(' / '));
  assert.ok(r.formulas.some(f => f.nome === 'Posição no arco'), 'cone não deve ganhar altura de barra');
});

test('tabela cruzada de ponta com tabela usa as pressões do fabricante', () => {
  const t = P.tabelaCruzada({ ponta: 'jc-atr', velocidade: 3.5, faixaPorBico: 0.29, volumeAlvo: 400 });
  assert.deepEqual(t.pressoes, [5, 7, 10, 12, 15, 20, 25]);
  assert.ok(t.sizes.includes('roxo') && t.sizes.includes('branco'));
  assert.ok(t.tabela && /Albuz/.test(t.tabela), 'deve declarar a fonte da tabela');
  perto(t.linhas.find(l => l.bar === 10).celulas.find(c => c.iso === 'marrom').vazao, 0.67, 0.01);
});
