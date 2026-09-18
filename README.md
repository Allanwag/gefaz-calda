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
| `index.html`, `app.css`, `app.js` | Interface (abas Calda · Resultado · Jar test · Histórico · Integração · Fontes) |
| `engine.js` | Motor puro (sem DOM): `GCEngine.analisar(itens, opts)` → status, alertas, matriz de pares, pH, ordem, jar test, custo, ficha de tanque, checklist |
| `kb.js` | Base de conhecimento: ~120 ingredientes ativos (classe, grupo, MoA, faixa de pH, tags), produtos comerciais da fazenda, 41 regras de pares com confiança e fonte, fontes |
| `data/agrofit-index.json` | Índice compacto do AGROFIT (marca, formulação, ativos, classe, culturas, alvos para café/milho/soja/sorgo/trigo/feijão/algodão/pastagens) — 1,5 MB |
| `tools/build-agrofit-index.js` | Regenera o índice a partir do CSV aberto do MAPA (392 MB) |
| `sdk.js` | SDK para os outros apps (deep-link, iframe/postMessage, análise local) |
| `sw.js`, `manifest.json`, `icon-*.png` | PWA (offline, instalável) |
| `tests/engine.test.cjs` | Testes do motor (`node --test`) |
| `serve.ps1` | Servidor estático local na porta 8124 (não há Node/Python “de sistema” nesta máquina) |

Dados do app ficam em `localStorage` na chave `gefazcalda_v1` (catálogo importado, receitas,
caldas salvas, histórico de análises, jar tests, configuração). Há backup/restauração em
**Integração → Configuração da fazenda**.

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
