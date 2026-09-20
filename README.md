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
| `pontas.js` | Catálogo de pontas (TeeJet, Albuz, Hypro, Magnojet, Jacto) e motor de regulagem: vazão ISO 10625 e tabelas de vazão dos fabricantes, classe de gota ASABE S572.1, área total × faixa dirigida, cruzamento vazão × pressão, calibração a campo |
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

* **Catálogo por família** — 53 famílias das cinco marcas que rodam no Brasil, com tipo de jato,
  ângulo, faixa útil de pressão, material, tamanhos e classe de gota, cada uma com a sua fonte:
  TeeJet (XR, XRC, TT, AIXR, AI, AIC, TTI, DG, TTJ60, AITTJ60, AI3070, TP…E, TF flood, TX),
  Albuz (AXI, AXI TWIN, ADI, APE, AVI, AVI TWIN, AVI-UC, CVI, CVI TWIN, MVI, ATR, ATI, TVI, ATF),
  Hypro (ULD, ULDM, GuardianAIR, GuardianAIR Twin, Guardian, LD, 3D, VP, E FanTip, DeflecTip, HCX, XT),
  Magnojet (AD, ADGA, AD-IA, AD-IA/D, MUG, MUG-CV, BD, MAG) e Jacto (JTT, J3D, JDF, AIRMIX).
  **Trinta e seis famílias trazem a tabela de vazão publicada** em vez da vazão nominal calculada:
  a linha de jato plano da TeeJet (catálogo Brasil, 1 a 6 bar), a da Hypro (Crop Spraying Guide,
  1 a 5 bar), a linha Magnojet (AD, AD-IA, MUG, MUG-CV e o cone MAG, 15 a 150 PSI), os cones da
  Albuz (ATR, ATI, TVI e o cone cheio ATF, 3 a 25 bar) e a Jacto AIRMIX (folheto 930000238,
  20 a 80 PSI). O motor interpola em √p entre as linhas da
  tabela (exato nos pontos publicados) e extrapola pela lei da raiz quadrada fora dela.

  Por que isso muda alguma coisa: para a ponta 02 a 3 bar a TeeJet publica 0,79 L/min e Hypro,
  Magnojet e Albuz publicam 0,80 — ~1 % de diferença entre catálogos da mesma norma. Com a tabela
  embutida, o app mostra o número do catálogo que está na mão do operador.

  **Cinco famílias não usam o código ISO e só existem em tabela**, e é justamente onde o cálculo
  por norma erraria feio: o flood TeeJet TF (TF-2 a TF-10, numerado em gpm a 10 psi — a TF-2 dá
  1,58 L/min a 3 bar, quase o dobro da 02 ISO), o cone TeeJet TX (TX-1 a TX-26, por disco e
  núcleo), o leque Albuz APE (cores europeias: o amarelo dá 0,49 L/min a 2 bar, contra 0,65 do
  amarelo ISO), o defletor Hypro DeflecTip (DT0.5 a DT3.0, com ângulo e largura de faixa próprios
  por tamanho) e o boomless Hypro XT (faixa de 3,9 a 4,9 m). Todas entram na regulagem normalmente.

* **Vazão pela norma, não pela marca** — a vazão sai da ISO 10625 (vazão nominal a 3 bar por
  tamanho e cor) e da lei da raiz quadrada `q₂ = q₁ × √(p₂ ÷ p₁)`. É assim que o catálogo do
  fabricante é montado; por isso o cálculo bate com qualquer marca. Os valores conferem com a
  tabela da TeeJet Brasil (ex.: 11002 → 0,46 · 0,65 · 0,79 · 0,91 L/min a 1 · 2 · 3 · 4 bar).
* **Classe de gota do catálogo** — ASABE S572.1 (muito fina → ultragrossa), em três níveis de
  fidelidade, sempre declarados na tela: quando o fabricante publica a matriz tamanho × pressão
  (caso da Jacto AIRMIX), o app usa a célula exata; quando publica só a linha de referência, usa
  essa linha e engrossa uma classe nos tamanhos 04 para cima; quando publica só a faixa, interpola
  e marca o resultado com asterisco de estimado.
* **Equações à vista** — `q = (V × v × e) ÷ 600`, `V = (600 × q) ÷ (v × e)`, `p₂ = p₁ × (q₂ ÷ q₁)²`,
  altura da barra pelo ângulo do leque, largura da faixa, área/tempo/percurso por tanque e
  rendimento em ha/h: cada uma aparece com os seus números substituídos, não só o resultado.
* **Cruzamento vazão × pressão** — com um par conhecido (vazão medida numa pressão medida) o app
  devolve a pressão de qualquer vazão ou volume desejado, a velocidade equivalente e a tabela
  cruzada pressão × tamanho com o volume de cada célula. Funciona para ponta gasta, sem tabela ou
  de escala própria, e avisa quando o ajuste passa de ±20 % — aí é troca de ponta,
  não de manômetro.
* **Minha ponta** — a ponta que você usa não está no catálogo? Em *3 · Ponta → ＋ Minha ponta* cadastre marca, modelo, tipo de jato, ângulo, faixa de pressão e os tamanhos, um por linha: `SF-02: 0,46@1 0,65@2 0,79@3` (vazão em L/min @ pressão em bar, do catálogo ou medida na bancada; entre os pontos o motor interpola em √p, fora deles usa a raiz quadrada) ou só o código ISO (`03`), que usa a vazão nominal da norma. A ponta fica salva (entra no backup), aparece marcada com ★ em Modelo, nas sugestões e na calibração, e serve a qualquer regulagem.
* **Seleção por alvo** — informando alvo (sistêmico, contato, pré-emergente, fungicida…), volume e
  velocidade, o app lista as pontas cuja classe de gota serve ao alvo **e** cuja pressão cai dentro
  da faixa útil do modelo, ordenadas por adequação.
* **Condições do ar (Delta T)** — temperatura, umidade e vento entram na regulagem e saem como
  janela de aplicação: Delta T pelo bulbo úmido de Stull, ponto de orvalho, déficit de pressão de
  vapor e as quatro faixas (abaixo de 2 é inversão térmica, 2 a 8 é a janela, 8 a 10 é limiar,
  acima de 10 suspende), mais a escala de vento. O critério é o mesmo do
  [PVGest](https://allanwag.github.io/pvgest/) — os dois apps da fazenda respondem igual. A
  condição do ar cruza com a gota: gota fina ou média com Delta T acima de 8 vira alerta alto
  (evapora antes de chegar), e herbicida dirigido no café com vento acima de 15 km/h também, porque
  nessa faixa a proteção física do bico já não segura a deriva.
* **Velocidade pelo cronômetro** — percurso de 50 m (ajustável) e o tempo marcado, uma ou várias passadas: `v = 3,6 × d ÷ t`. A velocidade da regulagem é preenchida sozinha, o app avisa se as passadas variam mais de 5 % e, com a velocidade já definida, diz quanto o cronômetro deve marcar. O tempo e o percurso vão para a regulagem salva e para o laudo.
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
3,60 m, 4 bicos flood TF-2.5 de 130°, gota de ~500 µm, 250 L/ha a 4,5 km/h), barra de área total e turbo
atomizador. O equipamento *Barra de herbicida para café* também entrou na aba Calda, com custo
operacional próprio.

O botão **Usar … L/ha na calda** joga o volume calculado direto no contexto da análise de
compatibilidade — regulagem e calda passam a falar do mesmo número.

## Alvo da aplicação e área por carga

A calda separa os **alvos em quatro grupos** — **doenças**, **insetos**, **ácaros e outras pragas** (nematoides, lesmas) e **plantas daninhas** —, cada um com a lista da cultura e vários alvos por grupo: um campo por alvo (mais as etiquetas com ×), com o botão **＋ Adicionar campo** para abrir quantos forem precisos (até 30 em branco por grupo). A lista junta as curadas do `kb.js` (café, milho, soja, sorgo, trigo, feijão, algodão, pastagens, cana e citros) com tudo o que o AGROFIT registra para a cultura; o índice é classificado pelo nome e pela classe dos produtos (herbicida → daninha, fungicida → doença, inseticida → inseto, acaricida/nematicida → outras pragas). O registro na bula confere cada produto só com o grupo que a classe dele ataca (herbicida × daninha, fungicida × doença…) e reconhece o alvo pelo nome científico. Somam-se **nível de infestação**, **estádio fenológico** e **parte da planta alvo**, que ficam no laudo e no código de conferência. O laudo traz também a **próxima aplicação permitida**: cada produto tem o campo *Intervalo mín. (dias)*, que você preenche com o valor da bula/receituário (o Agrofit aberto não traz esse número, então sem ele o app não estima data; o valor fica lembrado por produto). A data é o dia da aplicação (término, senão início, senão a emissão) mais o maior intervalo, com o produto limitante, os produtos sem intervalo listados e um alerta se o mesmo produto ainda estiver dentro do intervalo de uma aplicação já marcada como feita no talhão. Isso é o intervalo entre aplicações, não a carência. Ao lado dele vai a **carência e colheita liberada**: campo *Carência (dias)* por produto (0 = sem carência; vem preenchida do estoque do Gefaz360 quando o produto tem carência numérica lá, e fica lembrada por produto), com a data de colheita liberada de cada produto, o produto limitante e, por talhão, o que vence por último — contando aplicações anteriores já marcadas como feitas, cuja carência foi guardada no registro. Sem carência informada não há data. O laudo ainda tem **Aplicações por ciclo**: campo *Máx. aplic./ciclo* por produto (da bula/receituário, lembrado por produto) e, no cadastro do talhão, o *início do ciclo (safra)*. O app conta as aplicações do mesmo produto já marcadas como feitas no talhão desde esse início (sem início, todo o histórico) mais a de agora, e avisa quando esta é a última permitida ou já passa do máximo — o que também aparece no bloco da próxima aplicação. Reanalisar a mesma calda com o mesmo horário não conta duas vezes. O checklist pré-saída
passa a cobrar o que esses campos afirmam: alvo confirmado no talhão, ponta escolhida para a parte
da planta onde ele está, e carência e fitotoxidez conferidas para o estádio.

A **área por carga** é calculada direto, nas duas abas: capacidade do tanque ÷ volume por hectare.
A aba Calda mostra quantos hectares uma carga cobre e quantas cargas o talhão exige; a aba Pontas
mostra a mesma conta com o volume da regulagem, e as duas têm botão para adotar o resultado como
área. Em aplicação em faixa a conta usa o L/ha de lavoura, não o da faixa — senão a área sairia
inflada na mesma proporção da economia de produto.

## Regulagem no laudo e rastreabilidade

O laudo deixou de ser só a receita. Ele agora carrega **a regulagem com que a calda foi aplicada** e
**o registro de quem aplicou** — as duas coisas que um caderno de campo, uma certificação ou a defesa
do responsável técnico numa autuação pedem depois, quando já não há como reconstituir.

**A regulagem entra anexada e conferida.** Em `3 · Rastreabilidade` escolhe-se o que vai no laudo: a
regulagem atual da aba Pontas, uma das salvas, ou nenhuma. O laudo então mostra ponta, tamanho ISO e
cor, ângulo, classe de gota, pressão, vazão por bico e do conjunto, velocidade, arranjo (bicos e
espaçamento, ou faixa e entrelinha), altura, rendimento, a condição do ar registrada (Delta T, vento,
bulbo úmido, ponto de orvalho) e a calibração a campo, se houver — com as fórmulas que produziram
cada número.

A conferência que justifica tudo isso: **o volume que a regulagem entrega é comparado com o volume
para o qual as doses foram calculadas.** Acima de 5 % de desvio vira restrição, acima de 15 % vira
alerta crítico, porque o erro de volume é erro de dose na mesma proporção — a calda montada para 300
L/ha aplicada por uma barra que entrega 250 põe 20 % a mais de produto em cada hectare. Em aplicação
em faixa a comparação usa o L/ha de lavoura, não o da faixa. Sem regulagem anexada o laudo diz
isso na cara: registra a receita, mas não prova com que ponta, pressão e velocidade ela foi aplicada.

**O registro de campo** tem o **talhão pulverizado**, marcado em etiquetas no topo da aba Calda (um ou
mais; cadastre com ＋ Novo talhão ou importe do PVGest/Gefaz360). Marcar já lança a **área** (somada, se
forem vários) e a cultura, e cada análise entra no **histórico do talhão** (aba Histórico → Talhões), onde
você marca quais foram aplicadas de fato; a aba Calda avisa se o talhão foi pulverizado há até 7 dias. O **laudo** traz um bloco "Histórico do
talhão" (retrato até a emissão: última aplicação, quantas foram feitas, aviso do que a calda repete
das últimas três aplicações feitas — mesmo produto, mesmo **ingrediente ativo**, mesmo **modo de ação**
(código FRAC/IRAC/HRAC do KB) e, onde falta o código, mesmo grupo químico; adjuvantes e foliares não
contam — e a tabela dos 8 registros mais recentes), que também vai no JSON do laudo; ele não entra
no código de conferência.
Tem ainda trator/pulverizador, operador, responsável técnico e CREA, número do receituário e
horário de início e término. Máquina, operador e RT voltam sozinhos na próxima aplicação; talhão,
receituário e horário ficam em branco de propósito, porque são de cada aplicação. Cada produto ganhou
campo de **lote** — é o lote que liga a embalagem ao que foi aplicado, e por ele que se faz recall,
se investiga fitotoxidez e se responde a resíduo acima do LMR. Campo exigido em branco e produto sem
lote viram pendência apontada nominalmente, sem travar o laudo.

**Código de conferência.** Cada laudo sai com um código (`GC-XXXXXXX`), um hash FNV-1a de 32 bits
sobre a versão canônica do registro: data, fazenda, talhão, cultura, alvo, equipamento, volume, área,
água, máquina, operador, RT, receituário, janela de horário, cada produto com dose e lote, a
regulagem, a condição do ar e o veredito. Mudou qualquer um desses, muda o código. O texto canônico
vai no próprio laudo, então o código é recalculável por quem recebe (`GCEngine.codigoDe(texto)`), e o
código também entra no checklist pré-saída e no histórico. **Não é assinatura digital**: prova que
dois registros são o mesmo, não quem os emitiu — por isso o laudo impresso traz linhas de assinatura
do operador e do responsável técnico.

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
