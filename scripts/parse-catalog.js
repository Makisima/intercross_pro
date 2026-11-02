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

// Шаблонное описание сайта из meta — не брать
const SITE_DESC_RE = /Завод Интеркросс - российский производитель телекоммуникационного оборудования/i;

// Шаблонные картинки: logo, favicon, placeholder, иконки меню, svg-логотип, общий баннер
const TEMPLATE_IMG_RE = /(\/logo\.png$|\/favicon|noimage_sections|top-bnr|\/CAllcorp2\/|\/resize_cache\/|\/bitrix\/templates\/|\/07f\/v13nl6j6qmvr90qaslmy1butr8cxvb7w\.png)/i;

// Убирает HTML-теги и сущности
function stripTags(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSpecs(html) {
  const startM = html.match(/<table[^>]*class="[^"]*props_table[^"]*"[^>]*>/);
  if (!startM) return null;
  const start = startM.index;
  const endIdx = html.indexOf('</table>', start);
  if (endIdx === -1) return null;
  let table = html.slice(start, endIdx + 8);
  table = table
    .replace(/\sdata-(?!src)[^=]*="[^"]*"/g, '')
    .replace(/\sid="[^"]*"/g, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\s+/g, ' ');
  return table;
}

function extractImage(html) {
  // 1. og:image — только если не шаблон
  const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (og && og[1]) {
    const u = og[1].replace(/^https?:\/\/[^\/]+/, '');
    if (u && !TEMPLATE_IMG_RE.test(u)) return u;
  }

  // 2. .detailimage (баннер раздела/товара) — реальная картинка
  const di = html.match(/class="[^"]*detailimage[^"]*"[^>]*>[\s\S]{0,500}?data-src=["'](\/upload\/[^"']+\.(?:jpe?g|png|webp))["']/i);
  if (di && di[1] && !TEMPLATE_IMG_RE.test(di[1])) return di[1];

  // 3. Все /upload/iblock/ картинки (не resize_cache) — берём первую не-шаблонную
  const all = [...html.matchAll(/(?:data-src|src|href)=["'](\/upload\/iblock\/[^"']+\.(?:jpe?g|png|webp))["']/gi)].map(m => m[1]);
  for (const u of all) {
    if (!TEMPLATE_IMG_RE.test(u)) return u;
  }

  return null;
}

function extractDescription(html) {
  // 1. meta name="description" — только если не шаблон
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
         || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  if (m) {
    const clean = stripTags(m[1]);
    if (clean && !SITE_DESC_RE.test(clean)) return clean.slice(0, 300);
  }

  // 2. introtext
  const im = html.match(/<div[^>]*class="[^"]*\bintrotext\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (im) {
    const t = stripTags(im[1]);
    if (t && !SITE_DESC_RE.test(t) && t.length > 20) return t.slice(0, 300);
  }

  // 3. text_block
  const tb = html.match(/<div[^>]*class="[^"]*\btext_block\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (tb) {
    const t = stripTags(tb[1]);
    if (t && !SITE_DESC_RE.test(t) && t.length > 20) return t.slice(0, 300);
  }

  return null;
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

  const description = extractDescription(html);
  const image       = extractImage(html);

  const isProduct  = /class="[^"]*props_table[^"]*"/.test(html);
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
    image,
    description,
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

// --- базовые счётчики ---
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

// --- description / image ---
const descList  = nodes.map(n => n.description).filter(Boolean);
const imgList   = nodes.map(n => n.image).filter(Boolean);
const uniqDescs = new Set(descList);
const uniqImgs  = new Set(imgList);

const logoCount = imgList.filter(u => /logo\.png$/i.test(u)).length;
const banner07f = imgList.filter(u => /07f\/v13nl6/.test(u)).length;
const resizeImg = imgList.filter(u => /\/resize_cache\//i.test(u)).length;

// --- вывод ---
console.log('=== CATALOG DIAGNOSTICS ===');
console.log('total nodes:      ', nodes.length);
console.log('  categories:     ', byKind.category);
console.log('  products:       ', byKind.product);
console.log('by level:         ', JSON.stringify(byLevel));
console.log('orphan nodes:     ', noParent, missingParents.slice(0, 5));
console.log('');
console.log('--- description ---');
console.log('  with description:', descList.length, '/ ' + nodes.length);
console.log('  unique descs:    ', uniqDescs.size);
console.log('--- image ---');
console.log('  with image:      ', imgList.length,  '/ ' + nodes.length);
console.log('  unique images:   ', uniqImgs.size);
console.log('  logo.png:        ', logoCount, '(должно быть 0)');
console.log('  07f-баннер:      ', banner07f, '(должно быть 0)');
console.log('  resize_cache:    ', resizeImg, '(должно быть 0)');
console.log('');
console.log('duplicate slugs (безопасны через path):');
dupSlugs.forEach(([s, c]) => console.log('  ' + s + ' × ' + c));
console.log('');
console.log('max depth examples:');
nodes.filter(n => n.level >= 5).slice(0, 5).forEach(n => console.log('  L' + n.level + ' ' + n.path));
console.log('');
console.log('sample products:');
nodes.filter(n => n.kind === 'product').slice(0, 5).forEach(n => {
  console.log('  ' + n.path);
  console.log('    specs=' + (n.specs_html ? n.specs_html.length + 'b' : 'NONE')
            + ' img=' + (n.image || 'NONE')
            + ' desc=' + (n.description ? n.description.slice(0, 40) + '…' : 'NONE'));
});
console.log('');
console.log('уникальные image:');
[...uniqImgs].forEach(i => console.log('  ' + i));
console.log('');
console.log('уникальные description (первые 3):');
[...uniqDescs].slice(0, 3).forEach(d => console.log('  ' + d.slice(0, 120)));

// --- предупреждения ---
if (nodes.length === 0) { console.log('\nABORT: 0 nodes'); process.exit(1); }

const badSpecs = nodes.filter(n => n.kind === 'product' && !n.specs_html).length;
if (badSpecs > 0) console.log('\n⚠ products без specs_html: ' + badSpecs);
if (logoCount > 0) console.log('\n⚠⚠ в image остались logo.png: ' + logoCount);
if (banner07f > 0) console.log('\n⚠⚠ в image остались 07f-баннеры: ' + banner07f);
if (resizeImg > 0) console.log('\n⚠⚠ в image остались resize_cache: ' + resizeImg);
if (uniqDescs.size <= 1 && descList.length > 1)
  console.log('\n⚠⚠ все description одинаковые — шаблонный текст не отфильтрован');
if (uniqImgs.size <= 1 && imgList.length > 1)
  console.log('\n⚠⚠ все image одинаковые — шаблон не отфильтрован');

fs.writeFileSync(OUT, JSON.stringify(nodes, null, 2));
console.log('\n✅ ' + OUT + ' (' + nodes.length + ' nodes)');