#!/bin/bash
P="/c/mirror/9459bbda5458.spectrum.myjino.ru/product"

echo "===== 0. catalog.json цел? ====="
wc -c "/c/Users/W/Documents/Завод Рязань/intercross_pro/src/_data/catalog.json"
grep -c '"slug"' "/c/Users/W/Documents/Завод Рязань/intercross_pro/src/_data/catalog.json"

# --- 1. depth-3 категория с bx_=12 ---
F1="$P/telekomunikatsionnoe-napravlenie/krossovoe-oborudovanie/analogovyy-kross/index.html"
echo ""
echo "===== analogovyy-kross (depth 3) ====="
grep -oP '<h1[^>]*>[\s\S]{0,200}?</h1>' "$F1" | head -1
echo "--- bx_ ids ---"
grep -oP 'id="bx_[^"]*"' "$F1" | head -15
echo "--- ссылки на depth-4 ---"
grep -oP 'href="/product/telekomunikatsionnoe-napravlenie/krossovoe-oborudovanie/analogovyy-kross/[^"#]+/"' "$F1" | sort -u | head -15
echo "--- tile-классы ---"
grep -oP 'class="[^"]*item[^"]*"' "$F1" | sort -u | head -10

# --- 2. leaf с «товарным» именем (depth 5) ---
F2="$P/telekomunikatsionnoe-napravlenie/telekommunikatsionnye-klimaticheskie-shkafy/shkaf-klimaticheskiy-1024x740x662/index.html"
echo ""
echo "===== shkaf-klimaticheskiy-1024x740x662 (depth 5) ====="
grep -oP '<h1[^>]*>[\s\S]{0,200}?</h1>' "$F2" | head -1
echo "размер: $(wc -c < "$F2")"
echo "--- bx_ ids ---"
grep -oP 'id="bx_[^"]*"' "$F2" | head -15
echo "--- признаки товара (price/cart/sku) ---"
grep -oP 'class="[^"]*(price|cart|sku|article|props|chars|properties)[^"]*"' "$F2" | sort -u | head -10

# --- 3. самый глубокий SKU-лист ---
F3=$(find "$P" -type d -name "1-vertikal-na-128-plinta-2kh64-plinta" | head -1)
echo ""
echo "===== 1-vertikal-na-128-plinta-2kh64-plinta ====="
echo "path: $F3"
if [ -f "$F3/index.html" ]; then
  echo "размер: $(wc -c < "$F3/index.html")"
  grep -oP '<h1[^>]*>[\s\S]{0,200}?</h1>' "$F3/index.html" | head -1
  grep -oP 'class="[^"]*(price|cart|sku|article|props|chars|properties)[^"]*"' "$F3/index.html" | sort -u | head -10
  echo "--- <title> ---"
  grep -oP '<title>[^<]+' "$F3/index.html" | head -1
fi
