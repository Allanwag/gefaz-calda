// Gera data/agrofit-index.json (compacto) a partir do CSV aberto do AGROFIT/MAPA.
// Uso: node build-agrofit-index.js agrofit.csv saida.json
const fs = require('fs'), readline = require('readline');
const file = process.argv[2], out = process.argv[3];
function parseLine(line) {
  const o = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ';') { o.push(cur); cur = ''; } else cur += ch; }
  }
  o.push(cur); return o;
}
const fix = s => String(s || '').replace(//g, '-').replace(/\s+/g, ' ').trim();
const TARGET_CROPS = new Set(['Café', 'Milho', 'Soja', 'Sorgo', 'Trigo', 'Feijão', 'Algodão', 'Pastagens', 'Todas as culturas']);
function parseIA(s) {
  return fix(s).split(/\s\+\s/).map(p => {
    const m = p.match(/^(.*?)\s*\(([^()]*)\)\s*\(([^()]*)\)\s*$/);
    if (m) return [fix(m[1]), fix(m[2]), fix(m[3])];
    const m2 = p.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (m2) return [fix(m2[1]), '', fix(m2[2])];
    return [fix(p), '', ''];
  });
}
function toxCat(s) {
  s = fix(s); let m = s.match(/Categoria\s*(\d)/i); if (m) return m[1];
  m = s.match(/Classe\s*(I{1,3}|IV)/i); if (m) return m[1];
  if (/n[ãa]o classificado/i.test(s)) return 'NC'; return s.slice(0, 20);
}
function formCode(s) {
  s = fix(s); const m = s.match(/^([A-Z]{2,3})\s*-\s*/); if (m) return m[1];
  if (/mista CS e SC/i.test(s)) return 'CS+SC';
  if (/insetos vivos|nemat|caros vivos|parasitoide/i.test(s)) return 'BIO';
  return s ? s.slice(0, 12) : '';
}
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let header = null, pending = '';
  const crops = [], cropIdx = new Map(), alvos = [], alvoIdx = new Map();
  const idx = (arr, map, v) => { if (!map.has(v)) { map.set(v, arr.length); arr.push(v); } return map.get(v); };
  const prods = new Map();
  for await (const raw of rl) {
    const line = pending ? pending + '\n' + raw : raw;
    if (((line.match(/"/g) || []).length) % 2) { pending = line; continue; }
    pending = '';
    if (!header) { header = parseLine(line); continue; }
    const f = parseLine(line); if (f.length < 15) continue;
    const [reg, marca, formu, ia, tit, cl, ma, cu, pc, pn, emp, tx, amb, org, st] = f.map(fix);
    if (st !== 'TRUE') continue;
    let p = prods.get(reg);
    if (!p) {
      p = { r: reg, m: marca, f: formCode(formu), ia: parseIA(ia), cl, tit: tit.replace(/\s*-\s*[^-]+\/[A-Z]{2}\s*$/, '').slice(0, 60), tox: toxCat(tx), org: org === 'SIM' ? 1 : 0, c: new Set(), a: {} };
      prods.set(reg, p);
    }
    const ci = idx(crops, cropIdx, cu); p.c.add(ci);
    if (TARGET_CROPS.has(cu) && pn) {
      const names = pn.split(/;\s*/).map(fix).filter(Boolean);
      const primary = names[0] + (pc ? ' (' + pc + ')' : '');
      const ai = idx(alvos, alvoIdx, primary);
      p.a[ci] = p.a[ci] || []; if (!p.a[ci].includes(ai)) p.a[ci].push(ai);
    }
  }
  const produtos = [...prods.values()].map(p => ({ ...p, c: [...p.c].sort((a, b) => a - b) })).sort((a, b) => a.m.localeCompare(b.m, 'pt'));
  const json = {
    fonte: 'AGROFIT/MAPA - dados abertos (CC-BY), produtos formulados com registro ativo',
    url: 'https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit',
    gerado: new Date().toISOString().slice(0, 10), alvosPara: [...TARGET_CROPS], culturas: crops, alvos, produtos
  };
  fs.writeFileSync(out, JSON.stringify(json));
  console.log('produtos', produtos.length, 'culturas', crops.length, 'alvos', alvos.length, 'bytes', fs.statSync(out).size);
  const s = produtos.filter(p => /glifosato|azoxistrobina|mancozebe/i.test(p.ia.map(x => x[0]).join())).slice(0, 4);
  console.log(JSON.stringify(s.map(p => ({ ...p, c: p.c.slice(0, 6).map(i => crops[i]), a: Object.fromEntries(Object.entries(p.a).slice(0, 2).map(([k, v]) => [crops[k], v.slice(0, 3).map(i => alvos[i])])) })), null, 1));
  const groups = new Map(); produtos.forEach(p => p.ia.forEach(x => groups.set(x[1], (groups.get(x[1]) || 0) + 1)));
  console.log('grupos quimicos top:', [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(g => g[0] + ':' + g[1]).join(' | '));
})();
