# Benchmarks — estado da arte em compatibilidade de mistura de calda (set/2026)

Levantamento feito antes de desenhar o Gefaz Calda. Para cada referência: o que ela faz, o
que foi incorporado e o que **não** dá para replicar num app estático de fazenda.

| # | Referência | O que faz | Incorporado no Gefaz Calda | Lacuna assumida |
|---|---|---|---|---|
| 1 | **Yara TankmixIT / Tankmix** (app iOS/Android + tankmix.yv-yara.com) | Banco com milhares de testes laboratoriais (ISO 9001) de YaraVita × defensivos; busca por marca ou ingrediente ativo; lista todos os testes da combinação; pedido de teste novo “em poucas horas” | Busca por marca/ativo (índice Agrofit + base própria); categorias de veredito; **base de testes da fazenda**: cada jar test registrado é reaproveitado na próxima análise da mesma combinação | Não há laboratório: os vereditos são por regra (grupo químico), não por teste da marca |
| 2 | **Precision Laboratories — Mix Tank** (iOS/Android) | Ordem de mistura a partir dos produtos escolhidos, mix sheet por acre/carga/talhão, spray log, clima no início do log, favoritos | Ordem de adição por formulação (11 passos Embrapa), ficha de tanque por carga cheia/última carga/total, histórico de análises, chips de favoritos (estoque da fazenda) | Clima em tempo real (o PVGest já cobre ΔT; o app só põe a janela climática no checklist) |
| 3 | **Bayer UK — Tank Mix Database** (v5.6, planilha) | Registro de testes físicos com produtos Bayer; ordem em 15 passos (condicionadores → WG/WSB/WP → SC … → adjuvantes → foliares); “sempre ler o rótulo” | Distinção explícita física × química × legal em cada alerta; passos de adição; frase de responsabilidade | Testes por marca |
| 4 | **Koppert Side Effects / Compatibilidade de Produtos** e **Biobest Side Effects** (apps, offline) | Efeito de químicos sobre inimigos naturais e polinizadores; classes IOBC; pH do tanque 5–8,5; exceção do cobre | Regras biológicas (cúprico × biológico, fungicida × fungo benéfico, dessecante × biológico), pH mínimo para biológicos, matriz de pares | Classes por produto/organismo |
| 5 | **Embrapa Soja — Documentos 437 (2021)** *Manual técnico para subsidiar a mistura em tanque* | Tipos de incompatibilidade; água (pH, cátions, dureza, turbidez); temperatura; agitação; taxa de aplicação (≥ 100 L/ha, mais diluição com 3+ produtos); ordem em 11 passos; teste da jarra em 1 L com 2/3 de água, 2 h de repouso | Base de toda a parte físico-química: ordem, jar test na proporção real, água dura/turva, alerta de 3+ produtos e de baixo volume | — |
| 6 | **Ask IFAS PI-301** (Univ. Flórida) | Incompatibilidade física, química e **legal**; A.P.P.L.E.S.; jar test 15–30 min ×2 | Categoria “legal/registro”; leituras intermediárias (0/15/30 min) no cronômetro | — |
| 7 | **AGROFIT / MAPA** (consulta aberta + dados abertos CC-BY) | Registro oficial: marca, formulação, ativos com grupo químico, classe, cultura × alvo, toxicologia | Índice offline com 4.403 produtos ativos (do CSV de 392 MB, 279.707 linhas); checagem de registro na cultura e alvo; `tools/build-agrofit-index.js` para atualizar | Bulas completas (link para o Agrofit) |
| 8 | **IN MAPA nº 40/2018** | Mistura em tanque só com receituário agronômico; restrições de mistura da bula são obrigatórias na receita | Alerta legal quando o produto não está registrado na cultura; checklist pede o receituário | — |
| 9 | **ABNT NBR 13875** (avaliação físico-química, técnica dinâmica) | Água padrão 20 mg/L CaCO₃; leituras 0, 2, 6 e 24 h; homogeneidade, floculação, sedimentação, separação de fases/óleo, cristais, creme, espuma, grumos | Lista de sinais a observar; tempos “para laudo formal” | Ensaio normalizado de laboratório |
| 10 | **FRAC-BR / IRAC-BR / HRAC-BR** | Códigos de modo de ação (obrigatórios no rótulo) e manejo de resistência | Código por ativo; alerta de MoA repetido; sugestão de multissítio | — |
| 11 | **Corteva / Nufarm tank-mix pages**, **UPL Spray**, **BASF Agro App**, **Aegro** | PDFs de compatibilidade por produto; calibração e pré-mistura; custo por talhão | Custo/ha com custo operacional por equipamento; talhões, preços e estoque vindos do PVGest/Gefaz360 | Calibração (fica no PVGest) |

## Padrões que os melhores produtos compartilham (e que o app segue)

1. **Veredito em categorias**, nunca binário: compatível / com restrições / incompatível / não testado.
2. **Separar o tipo de problema** (físico, químico, agronômico, biológico, legal) — a conduta é diferente para cada um.
3. **Ordem de adição por formulação**, condicionador de água primeiro, adjuvante e foliar por último.
4. **Jar test na proporção real** (volume de calda real, água da mesma fonte) e registro do resultado.
5. **Rastreabilidade**: fonte e confiança de cada afirmação; “ler o rótulo” como cláusula permanente.
6. **Offline-first** no celular (Koppert, Mix Tank) — PWA com service worker.

## Fontes

* Embrapa Soja, Documentos 437: <https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1132371/1/DOCUMENTOS-437-1.pdf>
* IN MAPA 40/2018: <https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/45173700/do1-2018-10-15-instrucao-normativa-n-40-de-11-de-outubro-de-2018-45173522>
* AGROFIT dados abertos: <https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit>
* Ask IFAS PI-301: <https://ask.ifas.ufl.edu/publication/PI301>
* Yara Tankmix: <https://www.yara.us/crop-nutrition/tools-and-services/tankmix/>
* Precision Labs Mix Tank: <https://www.precisionlab.com/news-resources/mix-tank-app/>
* Bayer UK Tank Mix Database: <https://cropscience.bayer.co.uk/tankmix>
* Koppert compatibilidade: <https://www.koppert.com.br/aplicativo-de-compatibilidade-de-produtos/>
* Koppert One / Side Effects: <https://www.koppert.com/koppert-one/>
* Biobest Side Effects: <https://apps.apple.com/us/app/biobest-side-effects-app/id6467640637>
* NBR 13875: <https://www.target.com.br/produtos/normas-tecnicas/33988/nbr13875-agrotoxicos-e-afins-avaliacao-de-compatibilidade-fisico-quimica>
* IRAC-BR modo de ação: <https://www.irac-br.org/modo-de-acao>
* Aegro, guia de mistura: <https://aegro.com.br/blog/mistura-defensivos-tanque-guia/>
* Agrolink, mistura em tanque (NBR 13875 × ASTM E1518): <https://www.agrolink.com.br/agrolinkfito/defensivos-e-adjuvantes/aspectos-gerais/como-realizar-a-mistura-de-defensivos-em-tanques-_485965.html>
* Corteva tank mixes (UK): <https://www.corteva.com/uk/tools-and-advice/tank-mix.html>
* UPL Spray (Revista Cultivar): <https://revistacultivar.com.br/noticias/upl-apresenta-nova-versao-de-aplicativo-gratuito-para-agricultor-otimizar-aplicacao-de-defensivos>
* Sprayers101, tank mix: <https://sprayers101.com/tankmix/>
