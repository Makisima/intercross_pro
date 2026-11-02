// scripts/parse-news.js — одноразовый парсер новостей из зеркала
const fs = require('fs');
const path = require('path');

const MIRROR    = 'C:/mirror/9459bbda5458.spectrum.myjino.ru/info/news';
const PUBLIC    = path.resolve(__dirname, '..', 'public');
const DATA_OUT  = path.resolve(__dirname, '..', 'src/_data/news.json');
const RAW_OUT   = path.resolve(__dirname, '..', 'news_raw.json');

const MONTHS = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
  'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
};

function parseISO(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

// Ищем <div class="content..."> и балансируем только <div/</div (не парсим атрибуты)
function extractContent(html) {
  const openMatch = html.match(/<div[^>]*class="content[^"]*"[^>]*>/);
  if (!openMatch) return { ok: false, content: '' };
  const start = openMatch.index + openMatch[0].length;
  let pos = start, depth = 1;
  while (pos < html.length) {
    const nextOpen  = html.indexOf('<div',  pos);
    const nextClose = html.indexOf('</div', pos);
    if (nextClose === -1) return { ok: false, content: '' };
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
    else {
      depth--;
      if (depth === 0) return { ok: true, content: html.slice(start, nextClose) };
      pos = nextClose + 5;
    }
  }
  return { ok: false, content: '' };
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
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function truncateText(html, max) {
  const t = (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

// --------- main ---------
const listHtml = fs.readFileSync(path.join(MIRROR, 'index.html'), 'utf8');
const dirs = fs.readdirSync(MIRROR)
  .filter(d => fs.statSync(path.join(MIRROR, d)).isDirectory() && d !== 'rss');

const articles = [];
for (const slug of dirs) {
  const file = path.join(MIRROR, slug, 'index.html');
  if (!fs.existsSync(file)) { console.log('MISSING FILE', slug); continue; }
  const html = fs.readFileSync(file, 'utf8');

  const titleM  = html.match(/<h1[^>]*id="pagetitle"[^>]*>([\s\S]*?)<\/h1>/);
  const title   = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : null;

  const dateM   = html.match(/<span class="date">([\s\S]*?)<\/span>/);
  const date    = dateM ? dateM[1].trim() : null;
  const dateISO = parseISO(date);

  const introM  = html.match(/<div class="introtext[^"]*">([\s\S]*?)<\/div>/);
  const intro   = cleanHTML(introM ? introM[1] : '');

  const detailImgM = html.match(/data-src="(\/upload\/[^"]+\.(?:jpe?g|png|webp))"/i);
  const detailImg  = detailImgM ? detailImgM[1] : null;

  // preview из карточки списка (приоритетнее — это то что видел пользователь в списке)
  const cardRe = new RegExp(`<a href="/info/news/${slug}/">[\\s\\S]*?<img[^>]*data-src="(\\/upload\\/[^"]+\\.(?:jpe?g|png|webp))"`, 'i');
  const cardM  = listHtml.match(cardRe);
  const image  = cardM ? cardM[1] : detailImg;

  const ex = extractContent(html);
  const content = ex.ok ? cleanHTML(ex.content) : '';
  const imageExists = !!(image && fs.existsSync(path.join(PUBLIC, image)));

  articles.push({
    slug, title, date, dateISO, image, imageExists, intro, content,
    description: truncateText(intro || content, 160),
    _diag: { titleOk: !!title, dateOk: !!dateISO, contentOk: ex.ok, contentLen: content.length }
  });
}

// Сортировка по dateISO убыв., без даты — в конце
articles.sort((a, b) => {
  if (!a.dateISO && !b.dateISO) return 0;
  if (!a.dateISO) return 1;
  if (!b.dateISO) return -1;
  return b.dateISO.localeCompare(a.dateISO);
});

// ---- диагностика ----
console.log('=== DIAGNOSTICS ===');
let problems = 0;
for (const a of articles) {
  const d = a._diag;
  const flags = [];
  if (!d.titleOk)             flags.push('NO_TITLE');
  if (!d.dateOk)              flags.push('NO_DATE');
  if (!d.contentOk)           flags.push('NO_CONTENT_DIV');
  if (d.contentLen < 300)     flags.push('SHORT_CONTENT');
  if (!a.imageExists)         flags.push('IMG_MISSING:' + a.image);
  if (flags.length) problems++;
  console.log(
    (a.slug + '                             ').slice(0, 44) +
    '| ' + (a.dateISO || '??') +
    ' | c=' + String(d.contentLen).padStart(4) +
    ' i=' + String(a.intro.length).padStart(3) +
    ' | ' + (flags.length ? '⚠ ' + flags.join(',') : 'OK')
  );
}
console.log(`\nTotal: ${articles.length}, problems: ${problems}`);

if (problems > 0) {
  console.log('\n❌ Есть проблемы — news.json НЕ записан. Разбираем причины.');
  process.exit(1);
}

const clean = articles.map(({ _diag, ...rest }) => rest);
fs.writeFileSync(DATA_OUT, JSON.stringify(clean, null, 2));
fs.writeFileSync(RAW_OUT,  JSON.stringify(clean, null, 2));
console.log(`\n✅ ${DATA_OUT}`);
console.log(`✅ ${RAW_OUT}`);