# 📦 СНАПШОТ v4.0 — Intercross.ru на Eleventy

Обновлено: 2026-11-03
Стабильная точка отката: `5ab814b` (все P0 закрыты)
Наследует: СНАПШОТ v3.0 (`_snapshot/СНАПШОТ ПРОЕКТА v3.0 — Intercross.ru на.txt`)
Технический долг: `_snapshot/TECH_DEBT.md`

---

## 🖥 Среда и ограничения (наследуется из v3.0 — не терять!)

- **ОС:** Windows 7 (64-bit), Git Bash
- **Node.js:** v18.20.2 (`C:\nodejs`) — 🚫 **обновлять запрещено**
- **Стек:** Eleventy v2.0.1 + Nunjucks. 🚫 **Без Astro / React / Vue / Vite / Rollup / Tailwind / Next.js**
- **Проект:** `/c/Users/W/Documents/Завод Рязань/intercross_pro` — пути с пробелами и кириллицей, **ВСЕГДА в кавычках**
- **Зеркало:** `/c/mirror/9459bbda5458.spectrum.myjino.ru`
- **Git:** `master`, origin НЕ настроен (локально)
- **Сервер:** `npx @11ty/eleventy --serve --port=8081`
  - Если 8081 занят — поднимется на 8082 / 8083. Работать на том порту, что в выводе.
  - **`--serve` не подхватывает `eleventy.config.js`** — при правках конфига перезапуск обязателен.
  - **`--serve` не чистит `dist/`** — при пересборке каталога делать `rm -rf dist/` перед запуском, иначе остаются старые slug'и.
- **Проверка frontmatter:** `head -8 src/путь/index.njk` и `grep -c '^---$' src/путь/index.njk` (= 2)
- **`.gitignore`:** `dist/`, `node_modules/`, `.11ty/`, `news_raw.json`

---

## 🚨 Критические правила (НЕ ЛОМАТЬ)

1. **`<style>` блок в `layout.njk` (в `<head>`)** — НЕ ТРОГАТЬ. Восстанавливает меню, показывает тексты баннеров, задаёт высоту плиткам производства, стилизует дропдауны.
2. **Дропдаун «Компания»:** `.table-menu td.menu-item { position: static !important; }` — **НЕ ТРОГАТЬ** (~90% случаев работает). Без явной необходимости не переделывать.
3. **Класс `unvisible`** в HTML меню удалён вручную — не возвращать.
4. **`<style>` для мобильного меню (`#mobilemenu`)** — изолированный блок **перед `</body>`**, не путать с `<style>` в `<head>`.
5. **Все файлы в `src/`** — `.njk`, не `.html`, не `.md`. Для `.html` Eleventy не применяет Nunjucks.
6. **`data-event="jqm"`** в оригинале → заменяем на обычные ссылки (`/contacts/`, `mailto:`, `tel:`).
7. **Изображения** — нативный `src`, **не** `lazyload` / `data-src` / `data-bg`.
8. **`git reset --hard`** — только для полного отката всей сессии. Для точечного отката — `git revert` или `git checkout <hash> -- <path>`. См. TECH_DEBT.
9. **CSS Aspro перебивается через `!important`** — осознанно, не рефакторить.

---

## 🎯 Статус (что готово)

| Раздел | Статус | Коммит |
|--------|--------|--------|
| Главная | ✅ (6 баннеров, слайдер, тизеры, партнёры, карта, видео, счётчики) | было в v3.0 |
| Компания 8/8 | ✅ | `4d3e462` |
| Новости 7/7 | ✅ | `fb3d11f` |
| Услуги 4/4 | ✅ | `d3ee324` |
| 404 | ✅ (`/404.html`) | `f1d605c` |
| Мобильное меню (бургер) | ✅ (не протестировано на телефоне — P1-4) | `f2bee20` |
| Вакансии (без `hr@`) + Доставка | ✅ | `5cfd63a` |
| Каталог 84 узла | ✅ | `6236a35` |
| P0-1: `description`/`image` шаблоны убраны | ✅ 11 img + 4 desc реальных | `94aaae3` |
| P0-1 fallback: `<meta description>` из title | ✅ | `da616bf` |
| P0-2: `description` в теле категории | ✅ | `5ab814b` |
| P0-3: placeholder вместо `src=""` | ✅ | `5ab814b` |
| TECH_DEBT обновлён | ✅ | `32cde51` |

**Все P0 закрыты.** Остались P1 и P2 — не блокируют деплой.

---

## 📁 Архитектура

### Данные (`src/_data/`)

- **`catalog.json`** — **84 узла** (65 категорий + 19 товаров).
  Поля: `id` (path с `__`), `slug`, `path`, `parent_id`, `level`, `title`, `kind` (`category` | `product`), `direction`, `image` (11 реальных, 73 `null`), `description` (4 реальных, 80 `null`), `specs_html` (только product).
- **`news.json`** — 7 статей.
  Поля: `slug, title, date, dateISO, image, intro, content, description`.
- **`services.json`** — 4 услуги.
  Поля: `slug, title, intro, content, gallery[]` (5-10 фото у каждой).

### Парсеры (`scripts/`)

- **`parse-catalog.js`** — `catalog.json` из зеркала.
  Фильтры: `SITE_DESC_RE` (шаблонный meta description «Завод Интеркросс — российский производитель…»), `TEMPLATE_IMG_RE` (`logo.png`, `07f`-баннер, `resize_cache`, `CAllcorp2`, `favicon`, `noimage_sections`, `top-bnr`, `/bitrix/templates/`).
  Extractors: `image` (og:image → .detailimage → /upload/iblock/ → null), `description` (meta → introtext → text_block → null).
- **`parse-news.js`** — `news.json`.
- **`parse-services.js`** — `services.json` (`stripTags` для intro).
- **`probe-catalog.sh`** — диагностика зеркала (разовый скрипт).

### Шаблоны с `pagination`

- **`src/product/category.njk`** — `permalink: /product/{{ category.path }}/index.html`
  - `eleventyComputed: title + description` (fallback на title + "продукция АО «Интеркросс»")
  - Ветка `isProduct` — рендерит `specs_html` (props_table)
  - Блок `{% if category.description %}` — описание категории в теле
  - `PLACEHOLDER` для `null image` через `{{ item.image or PLACEHOLDER }}` (не `default` — тот не заменяет `null`)
- **`src/product/index.njk`** — корень каталога, 6 направлений (`parent_id == null`), `item.path`
- **`src/info/news/index.njk`** — список (простой `for`, без pagination)
- **`src/info/news/article.njk`** — `permalink: /info/news/{{ article.slug }}/index.html`
- **`src/services/service.njk`** — `permalink: /services/{{ service.slug }}/index.html`

### Единый макет

- **`src/_includes/layout.njk`** — `<style>` в `<head>` (правило #1) + изолированный `<style>` + `<div id="mobilemenu">` + `<script>` перед `</body>`.

---

## 📊 Каталог — факты

- **Пересборка:** `6236a35` — плоский `slug`-permalink → `path`-permalink.
- **84 узла** (65 категорий + 19 товаров), 0 orphans, 7 дублей slug (безопасны через `path`).
- **Уровни:** L1=6 (направления), L2=27, L3=25, L4=19, L5=7.
- **Товары:** 2 (кроссы, 320b specs) + 17 (`klimaticheskie shkafy`, 720-786b specs). Только в Телекоме.
- **`dist/product/`** после `rm -rf dist/` → **85 файлов** = 84 узла + `index.html`. Это норма, не баг.
- **Выдуманные slug'и** старого `catalog.json` (15 из 26) — удалены автоматически при пересборке.
- **Реальные данные:**
  - **11 картинок** — 6 иконок направлений (`eef`, `4c6`, `d40`, `ee1`, `6bc`, `fe1`) + 5 категорий L2 (`535`, `f86`, `a67`, `fed`, `be6`).
  - **4 описания** — `opticheskie-korobki`, `shkafy-fttb`, `shkafy-opticheskie-raspredelitelnye`, `telekommunikatsionnye-klimaticheskie-shkafy`.

---

## 🚨 Известные проблемы

См. `_snapshot/TECH_DEBT.md`. Ключевые:

- **P1-1:** `/search/` — 404 (кнопка-лупа есть в `layout.njk`, страницы нет).
- **P1-2:** `/info/` — 404 (дропдаун «Клиентам» ведёт на несуществующую страницу).
- **P1-3:** картинки товаров — 19 товаров `image: null`, в зеркале у товаров нет `href /upload/iblock` (только `resize_cache/60_60` иконки).
- **P1-4:** мобильное меню — не протестировано на реальном телефоне.
- **P1-5:** 73 категории + 19 товаров без картинок → placeholder `noimage_sections.png` (честный).
- **P2-1:** 404-роутинг на Jino — настроить `ErrorDocument 404 /404.html` при деплое.
- **P2-2:** плитки «Наше производство» на главной — заглушки (оригиналов в зеркале нет).
- **P2-3:** дропдаун «Компания» иногда влево — фикс ~90%, **не трогать**.
- **P2-4:** главная — 6 направлений хардкодятся в `src/index.njk` (не из `catalog.json`).

### Закрыто в этой сессии

- ✅ **P0-1:** шаблонные `description`/`image` каталога (`94aaae3`, `da616bf`) — было 84/84 шаблонных → 11 img + 4 desc реальных, остальное `null`, fallback в `<meta>`.
- ✅ **P0-2:** `description` не рендерился в теле категории — регресс при переходе на `path`-permalink. Симптом: `/shkafy-fttb/` показывал «нет товаров» без описания. Фикс: блок `{% if category.description %}` перед плитками. → `5ab814b`
- ✅ **P0-3:** `src=""` в плитках подкатегорий — `default` в Nunjucks не заменяет `null`. Заменено на `or PLACEHOLDER`. Симптом: браузер делал 11 лишних запросов на каждую страницу каталога. → `5ab814b`
- ✅ **Выдуманные slug'и** (15 из 26) — удалены при пересборке каталога (`6236a35`).
- ✅ **`hr@interkross.ru`** в `/company/vacancy/` — убран (`5cfd63a`).
- ✅ **`.php`-ссылки** в шаблонах — отсутствуют (`grep -rn "\.php" src/ --include="*.njk"` → пусто).

---

## 🎯 Следующая сессия — приоритеты

1. **P1-2** — `/info/` (15 минут: создать `src/info/index.njk` или редирект).
2. **P1-1** — инлайн-поиск (последний пункт v3.0, требует `/search/index.njk` + JS).
3. **Деплой на Jino** — 404-роутинг, `.htaccess`, пути.
4. **Полировка** — `/product/` визуальная проверка 7 URL, картинки товаров.

---

## 🔒 Стабильные точки отката

- **`32cde51`** — TECH_DEBT обновлён
- **`5ab814b`** — последний стабильный (все P0 закрыты: каталог + описание + placeholder)
- **`da616bf`** — до P0-2/P0-3 фиксов (каталог 84 + P0-1 fix)
- **`94aaae3`** — до fallback description
- **`6236a35`** — до P0-1 фикса (каталог 84, но с шаблонным `image`/`description`)
- **`5cfd63a`** — до пересборки каталога
- **`f2bee20`** — мобильное меню
- **`f1d605c`** — до мобильного меню
- **`4d3e462`** — до всей текущей сессии (крайний случай)

---

## 📋 Сделано с v3.0

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Новости 7/7 из зеркала (список + карточка, `eleventyComputed`) | `fb3d11f` |
| 2 | Услуги 4/4 из зеркала (единый `service.njk` + `services.json`) | `d3ee324` |
| 3 | Страница 404 | `f1d605c` |
| 4 | Мобильное меню (бургер) — чистый JS, изолированный `<style>` | `f2bee20` |
| 5 | Вакансии — убран выдуманный `hr@interkross.ru` | `5cfd63a` |
| 6 | Доставка и оплата — реальный контент из зеркала | `5cfd63a` |
| 7 | Каталог пересобран: 26 → 84 узла, 15 выдуманных slug'ов удалены, `path`-permalink | `6236a35` |
| 8 | P0-1: убраны шаблонные `image`/`description` (было 84/84 шаблон → 11/4 реальных) | `94aaae3` |
| 9 | P0-1 fallback: `<meta description>` из `title` для 80 узлов без описания | `da616bf` |
| 10 | P0-2: `description` в теле категории (было только в meta) | `5ab814b` |
| 11 | P0-3: placeholder для `null image` через `or` (было `src=""`) | `5ab814b` |
| 12 | `.php`-ссылки отсутствуют | — |

---

## 📖 Честные уроки сессии

1. **`with description: 84/84` не значит «готово»**. Настоящая метрика — `Set().size` (уникальные значения). 84 шаблонных описания = 1 уникальное = хуже, чем `null`. Всегда проверять `unique descs` / `unique images`.
2. **`/logo.png` и шаблонный `07f`-баннер** — 85 из 85 файлов каталога. Без проверки частоты (`grep -l ... | wc -l`) не отличить от реальных картинок.
3. **`git reset --hard <hash>` в TECH_DEBT** — опасно. `reset` переписывает историю, удаляет коммиты после `<hash>`. Для точечного отката — `git revert` или `git checkout <hash> -- <path>`.
4. **Выдуманные данные ИИ** — `hr@interkross.ru`, 15 slug'ов каталога (`kross-opticheskiy-19-1u`, `shkafy-asud`, `meteoposty` и т.д.). Всегда проверять в зеркале: `find` или `grep` перед использованием.
5. **`default` в Nunjucks не заменяет `null`/`""`** — только `undefined`. Для `null` использовать `or`.
6. **`--serve` не чистит `dist/`** — после пересборки `catalog.json` обязательно `rm -rf dist/`, иначе в `dist/product/` остаются старые slug'и.