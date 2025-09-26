# Agents Guidelines for Stok Yönetim Sistemi

Bu dosya, depodaki yapıya ve proje çalışma şekline uygun üretim yapmak için AI ajanlarına kısa ve net yönergeler sağlar.

## Amaç ve Kapsam
- Tek sayfa uygulama (SPA): temel akış `App.tsx` içinde, yardımcı bileşenler `components/` altında.
- API erişimi yalnızca istemci tarafında ve proxy ile (`/api`) yapılır.
- Hedef: stok sayım/ekleme işlemleri; ürün görselleri (opsiyonel) ve loglama.

## Kod Stili ve Yapı
- TypeScript + React fonksiyonel bileşenler kullan.
- Yardımcı işlevleri ayrı dosyalara ayır (örn. `utils/`), gereksiz soyutlamadan kaçın.
- Prop ve state adları açıklayıcı olsun; tek harfli isimler kullanma.
- Değişiklikleri küçük ve odaklı yap; mevcut stilleri koru.

## UI/UX
- Shadcn/Radix bileşenleri kullan; erişilebilirliği gözet (role/aria, klavye desteği).
- Mobil öncelikli, responsive düzen (Tailwind yardımcıları) uygula.
- Numpad: klavye rakamları ve kontrol tuşları (Enter/Escape/Backspace/↑/↓) desteklenir.

## Ağ ve Proxy
- Tüm API çağrıları göreceli `apiBase = '/api'` üzerinden yapılır (Vite dev proxy, prod NGINX).
- Görsel yolları: API JSON içindeki mutlak URL’yi aynen kullan; göreli yol varsa `http(s)://{serverIP} + path` üret veya proxy yolu tanımla.
- Basic Auth: `<img>` istekleri Authorization header göndermez. Gerekirse yetkili `fetch→blob→URL.createObjectURL()` yaklaşımı tercih edilebilir; CORS kısıtları göz önünde bulundur.

## Durum ve Kalıcılık
- `apiConfig` LocalStorage’a kaydedilir ve açılışta yüklenir (anahtar: `apiConfig`).
- `showProductImages` açıldığında listede eksik görseller otomatik denensin (batch ve sınırlı sayıda).

## Loglama
- `addLog(level, category, message, details?)` kullan.
- Kategoriler: `PRODUCTS_API`, `STOCK_API`, `IMAGE`, `IMAGE_TEST`, `SYSTEM`.
- Hatalarda mümkünse `status`, `url` ve `error.message` ayrıntılarını ekle.

## i18n
- Metinler `i18n/t` ile çağrılır. Yeni anahtar eklerken `tr.json`’a ekle.
- Mojibake görüldüğünde `scripts/fix-mojibake.cjs` ile temizle ve manuel kontrol et.

## Test/Doğrulama
- Hızlı smoke:
  - Ürünleri getir → liste dolmalı.
  - Numpad: rakam tuşları çalışır; Enter kapatır.
  - Görsel Test: ürün ID ile istek atar, sonuç sayısını ve JSON’u gösterir.

## PR/Rehber
- Küçük PR’lar, net kapsam.
- Açıklamaya kabul kriterlerini ve test adımlarını ekle.
- Build/lint komutları: `npm run build`, `npm run lint`.

