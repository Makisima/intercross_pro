// scripts/parse-catalog.js — пересборка catalog.json из зеркала
const fs = require('fs');
const path = require('path');

const MIRROR = 'C:/mirror/9459bbda5458.spectrum.myjino.ru/product';
const OUT    = path.resolve(__dirname, '..', 'src/_data/catalog.json');

const DIRECTION_MAP = {
  'avtodorozhnoe-napravlenie':       'avtodor',
  'telekomunikatsionnoe-napravlenie':'telecom',
  'neftegazovoe-napravlenie':        'neftegaz',
  'gornorudnoe-napravlenie':         'gornorud',
  'elektrotekhnicheskoe-napravlenie':'elektrotekh',
  'tsentr-obrabotki-dannykh':        'tsod'
};

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function extractSpecs(html) {
  const startM = html.match(/<table[^>]*class="[^"]*props_table[^"]*"[^>]*>/);
  if (!startM) return null;
  const start = startM.index;
  const endIdx = html.indexOf('</table>', start);
  if (endIdx === -1) return null;
  let table = html.slice(start, endIdx + 8);
  // минимальная чистка
  table = table
    .replace(/\sdata-(?!src)[^=]*="[^"]*"/g, '')
    .replace(/\sid="[^"]*"/g, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\s+/g, ' ');
  return table;
}

function parseNode(relPath, idxPath) {
  const html     = fs.readFileSync(idxPath, 'utf8');
  const segments = relPath.split('/');
  const slug     = segments[segments.length - 1];
  const level    = segments.length;
  const direction= DIRECTION_MAP[segments[0]] || 'unknown';
  const id       = segments.join('__');
  const parentId = segments.length === 1 ? null : segments.slice(0, -1).join('__');

  const h1M = html.match(/<h1[^>]*id="pagetitle"[^>]*>([\s\S]*?)<\/h1>/)
           || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = h1M ? stripTags(h1M[1]) : slug;

  const isProduct = /class="[^"]*props_table[^"]*"/.test(html);
  const specs_html = isProduct ? extractSpecs(html) : null;

  return {
    id,
    slug,
    path: relPath,
    parent_id: parentId,
    level,
    title,
    kind: isProduct ? 'product' : 'category',
    direction,
    image: null,
    description: null,
    ...(specs_html ? { specs_html } : {})
  };
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === 'rss') continue;
    const childDir = path.join(dir, e.name);
    const rel = path.relative(MIRROR, childDir).split(path.sep).join('/');
    const idx = path.join(childDir, 'index.html');
    if (fs.existsSync(idx)) {
      out.push(parseNode(rel, idx));
    }
    out.push(...walk(childDir));
  }
  return out;
}

// ---- main ----
const nodes = walk(MIRROR);
nodes.sort((a, b) => a.path.localeCompare(b.path));

// diagnostics
const byKind = { category: 0, product: 0 };
const byLevel = {};
const slugCount = {};
let noParent = 0;
const missingParents = [];
const ids = new Set(nodes.map(n => n.id));

for (const n of nodes) {
  byKind[n.kind] = (byKind[n.kind] || 0) + 1;
  byLevel[n.level] = (byLevel[n.level] || 0) + 1;
  slugCount[n.slug] = (slugCount[n.slug] || 0) + 1;
  if (n.parent_id && !ids.has(n.parent_id)) {
    noParent++;
    missingParents.push(n.path);
  }
}

const dupSlugs = Object.entries(slugCount).filter(([s, c]) => c > 1).sort((a, b) => b[1] - a[1]);

console.log('=== CATALOG DIAGNOSTICS ===');
console.log('total nodes:    ', nodes.length);
console.log('  categories:   ', byKind.category);
console.log('  products:     ', byKind.product);
console.log('by level:       ', JSON.stringify(byLevel));
console.log('orphan nodes:   ', noParent, missingParents.slice(0, 5));
console.log('');
console.log('duplicate slugs (collision candidates для плоского URL, теперь безопасны):');
dupSlugs.forEach(([s, c]) => console.log('  ' + s + ' × ' + c));
console.log('');
console.log('max depth examples:');
nodes.filter(n => n.level >= 5).slice(0, 5).forEach(n => console.log('  L' + n.level + ' ' + n.path));
console.log('');
console.log('sample products:');
nodes.filter(n => n.kind === 'product').slice(0, 5).forEach(n => {
  console.log('  ' + n.path + '  specs=' + (n.specs_html ? n.specs_html.length + 'b' : 'NONE'));
});

if (nodes.length === 0) { console.log('ABORT: 0 nodes'); process.exit(1); }
if (byKind.product > 0) {
  const badSpecs = nodes.filter(n => n.kind === 'product' && !n.specs_html).length;
  if (badSpecs > 0) console.log('\n⚠ products без specs_html: ' + badSpecs);
}

fs.writeFileSync(OUT, JSON.stringify(nodes, null, 2));
console.log('\n✅ ' + OUT + ' (' + nodes.length + ' nodes)');