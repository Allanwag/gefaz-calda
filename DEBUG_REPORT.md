# Relatório de debug e benchmark — Gefaz Calda

Data da revisão: **19/09/2026**
Base revisada: commit `051cddb` (`main`)

## Resultado executivo

O núcleo técnico estava estável: os 75 testes existentes passaram antes das mudanças e os principais fluxos abriram sem erro de console no Chrome. O debug encontrou cinco defeitos de produto — três de integridade/auditoria e dois de acessibilidade/migração — e todos foram corrigidos. A suíte agora tem **76 testes passando**, além de 11 cenários de ponta a ponta no Chrome.

O produto está acima da média em profundidade técnica para mistura de calda: combina compatibilidade físico-química e agronômica, AGROFIT offline, regulagem de pontas, jar test e laudo rastreável. A maior lacuna frente aos melhores aplicativos agrícolas não é outro cálculo: é fechar o ciclo operacional com estoque, custo por talhão e sincronização confiável entre Gefaz Calda, PVGest e Gefaz360.

## Bugs encontrados e corrigidos

| Prioridade | Defeito | Reprodução / impacto | Causa raiz | Correção |
|---|---|---|---|---|
| P1 | Data do arquivo mudava após 21h em Brasília | Às 21:17 de 19/09, o export saía como `laudo-calda-2026-09-20.json` | `toISOString()` converte a data local para UTC antes de cortar o dia | A data civil agora usa `getFullYear()`, `getMonth()` e `getDate()` locais |
| P1 | Resultado antigo de jar test podia prevalecer | Com dois registros da mesma mistura, um novo “compatível” ainda podia manter o bloqueio antigo | A interface grava com `unshift()` (mais recente no índice 0), mas o motor lia o último elemento | O motor usa o primeiro registro filtrado; teste de regressão cobre as duas ordens |
| P1 | “Reabrir” duplicava o histórico | Cada clique em **Reabrir** criava uma nova análise idêntica | A mesma função servia para calcular e para persistir, sem opção de leitura | A reanálise pode pular a gravação; reabrir mantém o total de registros |
| P2 | Backup antigo podia falhar ao restaurar | Backup sem `config.custo` ou `config.rastreio` causava erro ao renderizar Integração | A restauração só mesclava o primeiro nível de `config` | Defaults aninhados são recompostos durante a migração |
| P2 | Busca e observações sem nome acessível; atalhos sem teclado | Leitor de tela não identificava três campos; resultados/chips dependiam de clique | Inputs sem rótulo acessível e ações renderizadas como `<span>`/`<div>` | `aria-label` nos campos e elementos interativos convertidos em botões nativos |

## Validação

### Motores

- `node --test tests/engine.test.cjs tests/pontas.test.cjs`: **76/76 passaram**.
- `node --check`: `app.js`, `engine.js` e `pontas.js` sem erro.
- `git diff --check`: sem erro de whitespace (apenas aviso esperado de LF/CRLF do Windows).

### Chrome — ponta a ponta

Passaram os 11 cenários abaixo, sem `pageerror`, erro de console ou requisição falha:

1. carregamento inicial e índice de pontas;
2. IDs únicos e 166 controles com nome acessível;
3. mistura manual incompatível (glifosato + sulfato de zinco);
4. export com a data civil local correta;
5. geração do protocolo de jar test e persistência do histórico;
6. reabertura sem registro duplicado;
7. regulagem padrão com resultados finitos;
8. viewport móvel de 390 px sem overflow horizontal;
9. reload sem duplicar análise;
10. reabertura offline com o PWA e os 4.403 registros do índice AGROFIT em cache;
11. restauração de backup antigo com defaults completos.

## Benchmark competitivo

Foram separados dois grupos para não comparar produtos de naturezas diferentes.

### Referências diretas — mistura e aplicação

| Capacidade | Gefaz Calda | Referência de mercado | Leitura |
|---|---|---|---|
| Veredito e base de evidências | **Forte em regras**, sem banco laboratorial por marca | [Yara Tankmix](https://www.yara.us/crop-nutrition/tools-and-services/tankmix/) | Diferenciar claramente “regra técnica” de “teste laboratorial”; o app já declara confiança e fonte |
| Ordem de mistura e ficha de tanque | **Forte** | [Precision Laboratories Mix Tank](https://www.precisionlab.com/news-resources/mix-tank-app/) e [Bayer Tank Mix](https://cropscience.bayer.co.uk/tankmix) | Paridade funcional relevante; preservar a sequência por formulação e a rastreabilidade da carga |
| Jar test | **Forte** | [Embrapa, Documentos 437](https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1132371/1/DOCUMENTOS-437-1.pdf) e [Ask IFAS PI-301](https://ask.ifas.ufl.edu/publication/PI301) | O protocolo em proporção real e o histórico local são diferenciais práticos |
| Biológicos | **Adequado por regra de grupo** | [Koppert Compatibilidade](https://www.koppert.com.br/aplicativo-de-compatibilidade-de-produtos/) | Falta profundidade por organismo/produto; manter a limitação visível |
| Registro legal | **Forte e offline** | [AGROFIT/MAPA](https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit) | O índice local é um diferencial, desde que exista rotina de atualização e versão exibida |
| Pontas e regulagem | **Forte** | Seletores de TeeJet, Magnojet e fabricantes | A comparação pressão × vazão × gota × alvo num único fluxo supera soluções que apenas consultam catálogo |

### Referências adjacentes — gestão agrícola

| Padrão observado | Exemplos | Situação do Gefaz Calda | Implicação |
|---|---|---|---|
| Uma operação atualiza campo, estoque, custo e financeiro | [Aegro](https://aegro.com.br/solucoes/gestao-rural/), [TOTVS Agro Multicultivo](https://www.totvs.com/agro/multicultivo/), [AGRIVI 360](https://www2.agrivi.com/products) | Exporta e integra receitas, mas não fecha uma transação única | Maior prioridade de produto: aplicação confirmada deve baixar insumo e apropriar custo ao talhão sem duplicidade |
| Dashboards mostram exceções, não apenas números | Aegro, AGRIVI, [Farmbrite](https://www.farmbrite.com/plan-features) | O laudo é profundo, mas falta uma fila operacional consolidada | Alertar mistura pendente, jar test vencido, estoque insuficiente e regulagem divergente |
| Offline expõe estado de sincronização e conflitos | AGRIVI, AgriWebb | O PWA é offline local; a integração entre apps depende de `localStorage`/arquivo | Se houver backend, implementar fila persistente, idempotência, retry e estado por registro |
| Genealogia do café atravessa recepção, processo, secagem e lote | [Cropster Origin](https://help.cropster.com/en_US/getting-started-/getting-started-with-cropster-origin) | Fora do escopo da calda; deve pertencer ao Gefaz360 | O laudo de aplicação deve apenas publicar um evento rastreável para a genealogia, sem transformar este app em ERP completo |

## Prioridades recomendadas

1. **P0 — manter a integridade agora corrigida:** não regredir data local, ordem do jar test, histórico e migração de backup.
2. **P1 — operação transacional entre apps:** confirmar aplicação → validar saldo → baixar lote/estoque → apropriar custo ao talhão/safra → registrar estorno e trilha de auditoria. Usar um identificador idempotente para impedir dupla baixa.
3. **P1 — evidência por produto:** incorporar, quando licenciável, resultados laboratoriais por marca/formulação; manter regra de grupo como fallback explicitamente rotulado.
4. **P1 — painel de exceções:** jar tests pendentes, mistura incompatível, produto sem registro/lote, volume divergente, estoque insuficiente e janela climática inadequada.
5. **P1 — integração offline confiável:** quando sair do modelo puramente local, adotar fila de sincronização, retry, conflito e indicador de estado por registro.
6. **P2 — UX de campo:** fluxo rápido por talhão/receita recente, ações grandes, busca totalmente navegável por teclado e teste em aparelho sob sol/conectividade ruim.

## Limites desta revisão

- Não houve validação agronômica laboratorial das regras; foi validada a implementação e a coerência com as fontes declaradas.
- A acessibilidade foi verificada estruturalmente, não por auditoria WCAG completa com leitor de tela real.
- O teste móvel foi em viewport emulado de 390 × 844; ainda convém testar em Android de campo e iPhone reais.
- Nenhuma mudança foi enviada ao GitHub; a cópia corrigida está neste diretório para revisão e commit.
