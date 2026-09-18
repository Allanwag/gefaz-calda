# Gefaz Calda — compatibilidade de mistura de calda

PWA estático (HTML + CSS + JS, sem build) que avalia uma calda de pulverização antes de ela ir
para o tanque, nos dois eixos que o campo exige:

* **Compatibilidade físico-química** — pH alvo (interseção das faixas de estabilidade de cada
  produto), água dura/turva, precipitações (fosfato × cátions, boro × cálcio, sulfato × cálcio),
  hidrólise alcalina/ácida, quebra de emulsão por sais, ordem de adição por formulação
  (Embrapa, Documentos 437), jar test na proporção real com cronômetro e registro.
* **Compatibilidade agronômica** — antagonismos (glifosato × paraquate, ACCase × auxina,
  OP × sulfonilureia em milho/sorgo), fitotoxicidade (enxofre × óleo, captana × óleo, cúprico ×
  ácido), efeito sobre biológicos (Koppert/Biobest), modo de ação repetido (FRAC/IRAC/HRAC),
  registro MAPA da marca na cultura e no alvo (índice offline do AGROFIT, 4.403 produtos ativos)
  e custo por hectare (produto + operação por equipamento).

Cada alerta traz **severidade** (alta bloqueia · média exige jar test · baixa é atenção · info),
**conduta**, **confiança declarada** e **fonte**. O veredito global segue as categorias usadas
pelos bancos de mistura de mercado: *Compatível · Compatível com restrições · Incompatível ·
Não testado (fazer jar test)*.

O app é o irmão do [PVGest](https://allanwag.github.io/pvgest/) e do
[Gefaz360](https://allanwag.github.io/gefaz360/): mesma família visual, mesmo modelo
(localStorage, service worker, sem servidor) e integração nativa com os dois e com o protótipo
Gefaz360 Codex — ver [INTEGRACAO.md](INTEGRACAO.md).

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html`, `app.css`, `app.js` | Interface (abas Calda · Resultado · Jar test · Pontas · Histórico · Integração · Fontes) |
| `pontas.js` | Catálogo de pontas (TeeJet, Magnojet, Jacto/Albuz) e motor de regulagem: vazão ISO 10625, classe de gota ASABE S572.1, área total × faixa dirigida, cruzamento vazão × pressão, calibração a campo |
| `engine.js` | Motor puro (sem DOM): `GCEngine.analisar(itens, opts)` → status, alertas, matriz de pares, pH, ordem, jar test, custo, ficha de tanque, checklist |
| `kb.js` | Base de conhecimento: ~120 ingredientes ativos (classe, grupo, MoA, faixa de pH, tags), produtos comerciais da fazenda, 41 regras de pares com confiança e fonte, fontes |
| `data/agrofit-index.json` | Índice compacto do AGROFIT (marca, formulação, ativos, classe, culturas, alvos para café/milho/soja/sorgo/trigo/feijão/algodão/pastagens) — 1,5 MB |
| `tools/build-agrofit-index.js` | Regenera o índice a partir do CSV aberto do MAPA (392 MB) |
| `sdk.js` | SDK para os outros apps (deep-link, iframe/postMessage, análise local) |
| `sw.js`, `manifest.json`, `icon-*.png` | PWA (offline, instalável) |
| `tests/engine.test.cjs`, `tests/pontas.test.cjs` | Testes dos dois motores (`node --test`) |
| `serve.ps1` | Servidor estático local na porta 8124 (não há Node/Python “de sistema” nesta máquina) |

Dados do app ficam em `localStorage` na chave `gefazcalda_v1` (catálogo importado, receitas,
caldas salvas, histórico de análises, jar tests, regulagens de pontas, configuração). Há backup/restauração em
**Integração → Configuração da fazenda**.

## Pontas e regulagem

A aba **Pontas** resolve a outra metade da aplicação: que ponta usar, em que pressão e a que
velocidade — e quanto disso vira volume de calda.

* **Catálogo por família** — 51 famílias das cinco marcas que rodam no Brasil, com tipo de jato,
  ângulo, faixa útil de pressão, material, tamanhos e classe de gota, cada uma com a sua fonte:
  TeeJet (XR, XRC, TT, AIXR, AI, AIC, TTI, DG, TTJ60, AITTJ60, AI3070, TP…E, TF flood, TX),
  Albuz (AXI, AXI TWIN, ADI, APE, AVI, AVI TWIN, AVI-UC, CVI, CVI TWIN, MVI, ATR, ATI, TVI, ATF),
  Hypro (ULD, GuardianAIR, GuardianAIR Twin, Guardian, LD, 3D, VP, E FanTip, DeflecTip, HCX, XT),
  Magnojet (AD, ADGA, AD-IA, AD-IA/D, MUG, BD, MAG) e Jacto (JTT, J3D, JDF, AIRMIX).
  Os cones da Albuz (ATR, ATI, TVI e o cone cheio ATF) trazem a **tabela de vazão publicada** —
  de 3 a 25 bar, incluindo a escala de cores europeia da ATR (branco → roxo), que não é ISO. O motor
  interpola em √p entre as linhas da tabela (exato nos pontos publicados) e extrapola pela lei da
  raiz quadrada fora dela, então regulagem, seleção e tabela cruzada funcionam também nessas pontas.
  A APE, que usa a mesma escala europeia mas cuja tabela não está embutida, fica declarada como
  escala própria: o app não calcula a vazão dela nem a sugere.
* **Vazão pela norma, não pela marca** — a vazão sai da ISO 10625 (vazão nominal a 3 bar por
  tamanho e cor) e da lei da raiz quadrada `q₂ = q₁ × √(p₂ ÷ p₁)`. É assim que o catálogo do
  fabricante é montado; por isso o cálculo bate com qualquer marca. Os valores conferem com a
  tabela da TeeJet Brasil (ex.: 11002 → 0,46 · 0,65 · 0,79 · 0,91 L/min a 1 · 2 · 3 · 4 bar).
* **Classe de gota do catálogo** — ASABE S572.1 (muito fina → ultragrossa). Para as famílias em que
  o fabricante publica a classe pressão a pressão, o app usa a tabela; quando publica só a faixa,
  interpola e marca o resultado como estimado.
* **Equações à vista** — `q = (V × v × e) ÷ 600`, `V = (600 × q) ÷ (v × e)`, `p₂ = p₁ × (q₂ ÷ q₁)²`,
  altura da barra pelo ângulo do leque, largura da faixa, área/tempo/percurso por tanque e
  rendimento em ha/h: cada uma aparece com os seus números substituídos, não só o resultado.
* **Cruzamento vazão × pressão** — com um par conhecido (vazão medida numa pressão medida) o app
  devolve a pressão de qualquer vazão ou volume desejado, a velocidade equivalente e a tabela
  cruzada pressão × tamanho com o volume de cada célula. Funciona para ponta gasta, sem tabela ou
  de escala própria (cone vazio ATR), e avisa quando o ajuste passa de ±20 % — aí é troca de ponta,
  não de manômetro.
* **Seleção por alvo** — informando alvo (sistêmico, contato, pré-emergente, fungicida…), volume e
  velocidade, o app lista as pontas cuja classe de gota serve ao alvo **e** cuja pressão cai dentro
  da faixa útil do modelo, ordenadas por adequação.
* **Calibração a campo** — coleta por bico, CV do conjunto, desgaste contra a vazão nominal (troca
  acima de 10 %), volume real medido e a correção a fazer (pressão ou velocidade).

### Herbicida no café (faixa dirigida)

O modo **faixa** trata o arranjo do café: entrelinhas, largura da faixa tratada, bicos por faixa e
proteção física dos bicos. Ele separa os dois volumes que a lavoura confunde — **L/ha de faixa**
(o que a bula dosa) e **L/ha de lavoura** (o que sai do tanque) — e mostra a economia de produto da
aplicação dirigida. Gota abaixo de "muito grossa" vira alerta alto sem proteção física e alerta
médio com chapéu de Napoleão / saia protetora, porque nesse arranjo é a proteção que segura a
deriva sobre a saia do cafeeiro.

Presets prontos: faixa na linha (dois lados da saia), café em formação (faixa de 0,80 m — 0,40 m de
cada lado, ponta de faixa uniforme), rua/entrelinha, barra tipo **Jacto PH-400** (faixa de 1,40 a
3,60 m, 4 bicos flood de 130°, gota de ~500 µm, 250 L/ha a 4,5 km/h), barra de área total e turbo
atomizador. O equipamento *Barra de herbicida para café* também entrou na aba Calda, com custo
operacional próprio.

O botão **Usar … L/ha na calda** joga o volume calculado direto no contexto da análise de
compatibilidade — regulagem e calda passam a falar do mesmo número.

## Rodar localmente

```powershell
pwsh -File C:\Users\Usuario\.claude\gefaz-calda\serve.ps1
```

Abra <http://localhost:8124/>. No Claude Preview a configuração `gefaz-calda` está em
`.claude/launch.json`.

## Testes

```powershell
& "$env:LOCALAPPDATA\OpenAI\Codex\bin\node.exe" --test tests/*.test.cjs
```

## Atualizar o índice AGROFIT

1. Baixe `agrofitprodutosformulados.csv` em
   <https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit> (CC-BY).
2. `node tools/build-agrofit-index.js agrofitprodutosformulados.csv data/agrofit-index.json`
3. Suba a versão do cache em `sw.js` (`gefaz-calda-vN`).

## Decisões técnicas que divergem do protocolo da fazenda (declaradas, não escondidas)

* **Ordem de adição por formulação, não por classe.** O protocolo MIT 5.0 ordena
  *foliares → fungicidas → inseticidas → herbicidas → adjuvantes*. Embrapa (Doc. 437), IFAS
  (A.P.P.L.E.S.) e Bayer ordenam por **tipo de formulação** (WP → WG/SG → SC → SL → EC), com
  condicionadores de água primeiro e foliares por último. O app usa a ordem por formulação —
  é o estado da arte e evita o erro clássico (EC antes de WP forma pasta).
* **Acidificante no passo 3, não por último.** Embrapa coloca acidificantes/sequestrantes
  antes de qualquer produto (condicionam a água). O protocolo da fazenda manda o redutor de pH
  por último. Como o Wetcit é acidificante **e** espalhante, o app o coloca no passo 3 por padrão
  e oferece a chave **“Regra da fazenda: acidificante por último”** em Integração →
  Configuração; a ordem gerada anota a divergência.
* **Sulfonilureias e 2,4-D amina não gostam de pH baixo.** A tabela de pH da fazenda só
  cobre produtos sensíveis a pH alto; o app acrescenta os sensíveis a pH baixo (cúpricos,
  sulfonilureias, mancozebe abaixo de 5) e avisa quando a acidificação prejudica um deles.

## Limites

* A base de regras é por **grupo químico/tags**, não por marca: não substitui os bancos de
  testes laboratoriais (Yara TankmixIT, Bayer) nem a tabela de efeitos colaterais por produto
  (Koppert). Por isso toda mistura com 3+ produtos ou produto desconhecido sai como
  “fazer jar test”, e o jar test registrado vira a base de testes da fazenda.
* Custo operacional por equipamento é estimativa configurável.
* O app apoia a decisão técnica; não substitui bula nem receituário agronômico (IN 40/2018).
