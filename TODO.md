# TODO

## P0 - Temel temizlik
- [x] `stok sistem eski/` klasörünü kaldır.
- [ ] Lint sonuçlarındaki gerçek hataları sıfırla.

## P1 - Kod sağlığı
- [x] API yardımcılarını `services/` altında toplamak ve `App.tsx` üzerindeki yükü azaltmak.
- [ ] `App.tsx` içindeki görsel, rapor ve stok liste bileşenlerini ayrı dosyalara böl.
- [ ] Yerel dil metinlerinde mojibake kalan bölümleri düzelt.

## P2 - Tip güvenliği ve test
- [ ] API cevapları için TypeScript tiplerini çıkar ve `any` kullanımını azalt.
- [ ] Lint'e eklenen hook bağımlılık uyarılarını ele al.
- [ ] Kritik akışlar için smoke test (stok güncelleme, fiyat güncelleme) planı hazırla.
