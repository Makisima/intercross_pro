// scripts/parse-services.js — одноразовый парсер 4 услуг из зеркала
const fs = require('fs');
const path = require('path');

const MIRROR   = 'C:/mirror/9459bbda5458.spectrum.myjino.ru/services';
const PUBLIC   = path.resolve(__dirname, '..', 'public');
const DATA_OUT = path.resolve(__dirname, '..', 'src/_data/services.json');

const SLUGS = [
  'instrumentalnoe-proizvodstvo',
  'mekhanicheskoe-proizvodstvo',
  'sborochnoe-proizvodstvo',
  'proizvodstvo-galvano-poroshkovykh-pokrytiy'
];

// Вырезать div с балансировкой <div>/</div (без парсинга атрибутов)
function extractBalancedDiv(html, openingIdx) {
  const openEnd = html.indexOf('>', openingIdx);
  if (openEnd === -1) return { ok: false, html: '' };
  let pos = openEnd + 1, depth = 1;
  while (pos < html.length) {
    const nextOpen  = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div', pos);
    if (nextClose === -1) return { ok: false, html: '' };
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
    else {
      depth--;
      if (depth === 0) return { ok: true, html: html.slice(openEnd + 1, nextClose) };
      pos = nextClose + 5;
    }
  }
  return { ok: false, html: '' };
}

function cleanHTML(s) {
  if (!s) return '';
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\sdata-event="[^"]*"/g, '')
    .replace(/\sid="bx_[^"]*"/g, '')
    .replace(/\ssrc="data:[^"]*"/g, '')
    .replace(/\sdata-src="([^"]+)"/g, ' src="$1"')
    .replace(/\sclass="([^"]*)"/g, (m, cls) => {
      const c = cls.replace(/\blazyload\b/g, '').replace(/\s+/g, ' ').trim();
      return c ? ` class="${c}"` : '';
    })
    .replace(/\bnorder\b/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

const services = [];
for (const slug of SLUGS) {
  const file = path.join(MIRROR, slug, 'index.html');
  if (!fs.existsSync(file)) { console.log('MISSING', slug); continue; }
  const html = fs.readFileSync(file, 'utf8');

  const h1M    = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title  = h1M ? h1M[1].replace(/<[^>]+>/g, '').trim() : null;

  const introM = html.match(/<div class="intro-text"[^>]*>([\s\S]*?)<\/div>/);
  const intro  = introM ? introM[1].replace(/\s+/g, ' ').trim() : '';

  const contentOpen = html.match(/<div[^>]*class="content"[^>]*>/);
  let content = '';
  if (contentOpen) {
    const r = extractBalancedDiv(html, contentOpen.index);
    content = r.ok ? cleanHTML(r.html) : '';
  }

  // Галерея: <img data-src="/upload/resize_cache/..."> + <a href="/upload/iblock/...">
  const gallery = [];
  const gScope = html.match(/<div[^>]*class="small-gallery-block"[^>]*>/);
  if (gScope) {
    const r = extractBalancedDiv(html, gScope.index);
    if (r.ok) {
      const thumbRe = /data-src="(\/upload\/resize_cache\/[^"]+\.(?:jpe?g|png|webp))"/gi;
      const fullRe  = /<a href="(\/upload\/iblock\/[^"]+\.(?:jpe?g|png|webp))"/gi;
      const thumbs = [...r.html.matchAll(thumbRe)].map(m => m[1]);
      const fulls  = [...r.html.matchAll(fullRe)].map(m => m[1]);
      for (let i = 0; i < fulls.length; i++) {
        gallery.push({ thumb: thumbs[i] || fulls[i], full: fulls[i] });
      }
    }
  }

  const galChecks = gallery.map(g => ({
    thumbExists: fs.existsSync(path.join(PUBLIC, g.thumb)),
    fullExists:  fs.existsSync(path.join(PUBLIC, g.full))
  }));

  services.push({ slug, title, intro, content, gallery, _galChecks: galChecks });
}

// ---- диагностика ----
console.log('=== DIAGNOSTICS ===');
let problems = 0;
for (const s of services) {
  const flags = [];
  if (!s.title) flags.push('NO_TITLE');
  if (!s.intro) flags.push('NO_INTRO');
  if (!s.content || s.content.length < 100) flags.push('SHORT_CONTENT');
  if (s.gallery.length === 0) flags.push('NO_GALLERY');
  const badThumb = s._galChecks.filter(c => !c.thumbExists).length;
  const badFull  = s._galChecks.filter(c => !c.fullExists).length;
  if (badThumb) flags.push('THUMBS_MISSING:' + badThumb);
  if (badFull)  flags.push('FULLS_MISSING:' + badFull);
  if (flags.length) problems++;
  console.log(
    (s.slug + '                                     ').slice(0, 44) +
    '| t=' + (s.title ? 'Y' : 'N') +
    ' i=' + String(s.intro.length).padStart(3) +
    ' c=' + String(s.content.length).padStart(4) +
    ' g=' + String(s.gallery.length).padStart(2) +
    ' | ' + (flags.length ? '⚠ ' + flags.join(',') : 'OK')
  );
}
console.log(`\nTotal: ${services.length}, problems: ${problems}`);

if (problems > 0) {
  console.log('\n❌ Есть проблемы — services.json НЕ записан. Разбираем.');
  process.exit(1);
}

const clean = services.map(({ _galChecks, ...rest }) => rest);
fs.writeFileSync(DATA_OUT, JSON.stringify(clean, null, 2));
console.log(`\n✅ ${DATA_OUT}`);