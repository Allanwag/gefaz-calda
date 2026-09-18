# Integração — Gefaz360 · Gefaz360 Codex · PVGest

O Gefaz Calda foi desenhado para ser **chamado pelos outros apps** e para **devolver** o
resultado a eles. Há três níveis, do mais simples ao mais integrado. Todos funcionam sem
servidor.

## 0. Mesma origem = dados compartilhados (o caminho mais curto)

Os apps da fazenda estão em `https://allanwag.github.io/<repo>/` — **uma única origem**. Se o
Gefaz Calda for publicado em `https://allanwag.github.io/gefaz-calda/`, ele enxerga o
`localStorage` dos outros três no mesmo navegador:

| App | Chave | O que o Gefaz Calda faz |
|---|---|---|
| PVGest | `pvgest_v1` | Importa produtos (com preço/estoque), receitas e talhões · **envia** a calda como receita (cria produtos faltantes com estoque 0) |
| Gefaz360 | `pvgest-erp-v1` | Importa defensivos, receitas e talhões · **envia** a calda como receita (`{nome, cultura, alvo, volumeHa, itens:[{prodId, dose}]}`) |
| Gefaz360 Codex | `pvgest-activities` | Registra uma atividade na *Central PVGest* (`{icon, title, meta}`; o protótipo mostra as 5 últimas) |

Tudo isso está na aba **Integração → Apps neste navegador** e nos botões
**📤 PVGest / 📤 Gefaz360 / 📤 Codex** do Resultado. Cada envio pede confirmação e só
**acrescenta** registros — nunca apaga.

Fora da mesma origem (por exemplo, testando local em portas diferentes) valem os arquivos:
importe o JSON de `localStorage.getItem('pvgest_v1')` ou o **backup completo** do Gefaz360
(`format: "gefaz360-backup"`), e exporte a receita no formato PVGest, que o Gefaz360 já lê em
**Cadastros & Dados → Importar do PVgest**.

## 1. Deep-link `?mix=`

```
https://allanwag.github.io/gefaz-calda/index.html?mix=<base64url(JSON)>
```

O app abre com a calda montada e já analisada (aba Resultado). Formato `mix` v1:

```json
{
  "v": 1, "origem": "pvgest",
  "cultura": "Café", "alvo": "Hemileia vastatrix",
  "equipamento": "turbo", "volumeHa": 400, "area": 12, "tanque": 2000,
  "agua": { "ph": 7.5, "dureza": 120, "turbidez": "limpa" },
  "itens": [
    { "nome": "Azoxistrobina + Ciproconazol", "dose": 0.5, "unidade": "L/ha", "formulacao": "SC", "classe": "Fungicida", "preco": 185 },
    { "nome": "Wetcit", "dose": 100, "unidade": "mL/100L" }
  ]
}
```

Unidades aceitas: `L/ha`, `kg/ha`, `mL/ha`, `g/ha`, `mL/100L`, `g/100L`, `L/100L`, `kg/100L`.
Campos opcionais: `formulacao` (SC, EC, WG…), `classe`, `preco` (R$ por L ou kg), `ativos`
(chaves da base, ex. `["glifosato"]`), `ingredientes` (texto livre com o ativo).

## 2. SDK (`sdk.js`)

```html
<script src="https://allanwag.github.io/gefaz-calda/sdk.js"></script>
<script>
  // abrir o app com a receita (deep-link)
  GefazCalda.abrir(mix);

  // embutir (iframe) e receber o resultado por postMessage
  const h = GefazCalda.embed('#slot', mix, (resultado, mixEnviado) => {
    console.log(resultado.status, resultado.resumo.frase);
  });
  h.enviar(outroMix);   // reanalisa sem recriar o iframe

  // analisar sem UI (carrega kb.js + engine.js do app)
  const res = await GefazCalda.analisar(mix);
  el.innerHTML = GefazCalda.resumoHTML(res);

  // conversores a partir dos formatos nativos
  GefazCalda.dePVGest(receita, DB.produtos, { agua: { ph: 7.5 } });
  GefazCalda.deGefaz360(receita, db.defensivos, { equipamento: 'turbo' });
</script>
```

`GEFAZ_CALDA_URL` (global) sobrescreve a URL base se o SDK for copiado para outro lugar.

### Protocolo postMessage

| Direção | Mensagem |
|---|---|
| host → iframe | `{ type: 'gefaz-calda:analisar', mix }` |
| iframe → host | `{ type: 'gefaz-calda:resultado', resultado, mix }` — enviada após cada análise (também na carga por `?mix=`) |

`resultado` contém `status`, `resumo`, `score`, `confianca`, `alertas[]`, `ph`, `ordem[]`,
`custo`, `tanque`, `checklist[]`, `registro[]`, `jarTest`, `contexto`, `versao`.

## 3. Patches prontos para cada app

### PVGest (`pvgest/index.html` + `app.js`)

```html
<!-- index.html, antes de app.js -->
<script src="../gefaz-calda/sdk.js"></script>
```

```js
// app.js — dentro de openReceitaDetail(id), junto dos botões de ação da receita:
`<button class="btn btn-secondary" onclick="verificarCalda('${r.id}')">🧪 Compatibilidade</button>`

// app.js — nova função:
function verificarCalda(id) {
  const r = byId(DB.receitas, id); if (!r || !window.GefazCalda) return;
  GefazCalda.abrir(GefazCalda.dePVGest(r, DB.produtos, { equipamento: 'turbo', agua: { ph: 7.5 } }));
}
```

Quando a calda voltar do Gefaz Calda (botão **📤 PVGest**), ela aparece em **Receitas** com o
status no campo de observações; produtos novos entram no Estoque com quantidade 0.

### Gefaz360 (`repo/index.html` + `app.js`, página `pgPvgest`)

```html
<script src="../gefaz-calda/sdk.js"></script>   <!-- mesma origem: passa na CSP default-src 'self' -->
```

```js
// na tabela de receitas de pgPvgest(), coluna de ações:
`<button class="btn ghost mini" data-action="calda" data-id="${r.id}">🧪 Compat.</button>`

// no despachante de data-action:
else if (a === 'calda') { const r = db.receitas.find(x => x.id === id);
  GefazCalda.abrir(GefazCalda.deGefaz360(r, db.defensivos, { cultura: r.cultura, volumeHa: r.volumeHa })); return; }
```

Sentido inverso: **📤 Gefaz360** grava a receita em `pvgest-erp-v1` (mesma origem) ou exporte
o JSON e use **Importar do PVgest** no Gefaz360 — o formato é o mesmo.

### Gefaz360 Codex (`gefaz360-codex-site/app.js`, vista `spray`)

```js
// painel na vista de pulverização:
panel('Compatibilidade de calda', 'Gefaz Calda embutido', '<div id="calda-slot"></div>');
GefazCalda.embed('#calda-slot', mixDaReceitaSelecionada, res => {
  state.activities.unshift({ icon: res.status === 'incompativel' ? 'alert' : 'check',
    title: 'Gefaz Calda: ' + res.resumo.rotulo, meta: res.contexto.cultura + ' · ' + res.data });
  localStorage.setItem('pvgest-activities', JSON.stringify(state.activities.slice(0, 5)));
});
```

O botão **📤 Codex (atividade)** faz o mesmo sem patch, pela chave `pvgest-activities`.

## 4. Publicar no GitHub Pages (mesma origem dos outros apps)

```powershell
cd C:\Users\Usuario\.claude\gefaz-calda
git init -b main
git add .
git commit -m "Gefaz Calda v1"
# criar o repositório Allanwag/gefaz-calda no site do GitHub (gh não está logado nesta máquina)
git remote add origin https://github.com/Allanwag/gefaz-calda.git
git push -u origin main
# Settings → Pages → branch main, pasta raiz → https://allanwag.github.io/gefaz-calda/
```

Depois de publicado, os três apps e o Gefaz Calda compartilham o `localStorage` no mesmo
navegador e a integração do nível 0 passa a funcionar sem nenhum patch.
