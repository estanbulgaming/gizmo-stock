# Gizmo Stock - TODO Listesi

Bu liste, Gizmo API dokümantasyonu incelemesi sonrası oluşturulmuştur.

## 🔴 P0 - Kritik Öncelik (Hemen Yapılmalı)

### 1. Barkod Güncelleme Endpoint'ini Test Et ve Implement Et

**Durum**: ❌ Şu an barkod güncelleme özelliği YOK

**Adımlar**:

- [ ] **Test 1**: v1 API `/api/products/{productId}` PUT endpoint'ini test et
  ```bash
  curl -u cenx:123 -X PUT "http://192.168.1.5/api/products/{productId}" \
    -H "Content-Type: application/json" \
    -d '{
      "id": 123,
      "name": "Test Product",
      "barcode": "NEW_BARCODE_VALUE"
    }'
  ```

- [ ] **Test 2**: Request body schema'sını dokümante et
  - PUT endpoint'i hangi alanları kabul ediyor?
  - Barcode alanı update edilebiliyor mu?
  - Hangi alanlar zorunlu/opsiyonel?

- [ ] **Implementation**: Eğer endpoint çalışıyorsa
  - `services/api.ts`'ye `updateProductBarcode` fonksiyonu ekle
  - `App.tsx`'e barkod düzenleme UI'ı ekle
  - Batch barcode update desteği ekle
  - Validation ekle (barkod formatı, unique kontrolü)

- [ ] **Alternatif Çözüm**: Endpoint yoksa
  - Database schema'yı incele
  - Direkt SQL update seçeneğini değerlendir
  - Ya da Gizmo desteğe feature request gönder

**Dosyalar**:
- `gizmo-docs/gizmoapiv1.json` (schema referansı)
- `services/api.ts` (yeni fonksiyon eklenecek)
- `App.tsx` (UI implementasyonu)

---

## 🟡 P1 - Yüksek Öncelik (1-2 Hafta)

### 2. App.tsx Refactoring

**Durum**: ⚠️ 4471 satırlık monolitik dosya

**Adımlar**:

- [ ] **Bileşenlere Ayırma**:
  - [ ] `components/StockList/` oluştur
    - StockList.tsx
    - StockListItem.tsx
    - StockFilters.tsx
  - [ ] `components/History/` oluştur
    - HistoryView.tsx
    - DailyReportCard.tsx
  - [ ] `components/Settings/` oluştur
    - SettingsView.tsx
    - ApiConfigForm.tsx
    - SystemLogs.tsx

- [ ] **Custom Hooks**:
  - [ ] `hooks/useStockData.ts` - Stok verisi yönetimi
  - [ ] `hooks/useStockUpdate.ts` - Stok güncelleme logic
  - [ ] `hooks/usePriceUpdate.ts` - Fiyat güncelleme logic
  - [ ] `hooks/useBarcodeUpdate.ts` - Barkod güncelleme (yeni)

- [ ] **Service Layer**:
  - [ ] `services/stockService.ts` - Stok işlemleri
  - [ ] `services/priceService.ts` - Fiyat işlemleri
  - [ ] `services/barcodeService.ts` - Barkod işlemleri (yeni)

**Faydalar**:
- Kod okunabilirliği ↑
- Test yazma kolaylığı ↑
- Bakım maliyeti ↓
- Performance (code splitting)

### 3. TypeScript Tip Güvenliği İyileştirmesi

**Durum**: ⚠️ API cevapları için eksik tipler

**Adımlar**:

- [ ] **Yeni Tip Dosyası**: `types/gizmo-api.ts` oluştur
  ```typescript
  // Gizmo API response tipleri
  export interface GizmoApiResponse<T> { ... }
  export interface GizmoProduct { ... }
  export interface GizmoProductStock { ... }
  export interface GizmoStockUpdateResponse { ... }
  ```

- [ ] **Mevcut Tipleri Güncelle**:
  - [ ] `services/api.ts`'de any kullanımını azalt
  - [ ] API response parsing'i type-safe yap
  - [ ] Strict type checking aktif et (`tsconfig.json`)

- [ ] **API v1 Tipleri Ekle**:
  - [ ] ProductBase interface
  - [ ] ProductStockDTO interface
  - [ ] Barcode update request/response tipleri

**Referans**: `gizmo-docs/gizmoapiv1.json` ve `gizmoapiv2.json`

### 4. Hata Yönetimi ve Retry Mekanizması

**Durum**: ❌ Otomatik retry yok

**Adımlar**:

- [ ] **Retry Utility**: `utils/retry.ts` oluştur
  ```typescript
  export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T>
  ```

- [ ] **API İşlemlerinde Kullan**:
  - [ ] Stock update
  - [ ] Price update
  - [ ] Barcode update (yeni)
  - [ ] Product fetch

- [ ] **Error Logging İyileştir**:
  - [ ] HTTP status code bazlı kategorize
  - [ ] Retry attempt sayısını logla
  - [ ] Network error vs API error ayırımı

### 5. Database Schema Analizi

**Durum**: 📋 Henüz incelenmedi

**Adımlar**:

- [ ] `gizmo-docs/gizmodbschema.md` dosyasını incele
- [ ] Product tablosu yapısını dokümante et
- [ ] Barcode kolonu varlığını ve constraint'leri kontrol et
- [ ] İndeks ve unique constraint'leri not al
- [ ] Foreign key ilişkilerini belge

**Kullanım**: Barcode update endpoint'i yoksa, alternatif çözüm için

---

## 🟢 P2 - Orta Öncelik (2-4 Hafta)

### 6. Test Altyapısı Kurulumu

**Durum**: ❌ Test yok

**Adımlar**:

- [ ] **Kurulum**:
  ```bash
  npm install --save-dev vitest @testing-library/react @testing-library/user-event
  ```

- [ ] **Test Dosyaları**:
  - [ ] `__tests__/services/api.test.ts`
  - [ ] `__tests__/utils/product.test.ts`
  - [ ] `__tests__/components/StockList.test.tsx`

- [ ] **Coverage Hedefi**:
  - [ ] Critical path: %80+
  - [ ] Services: %70+
  - [ ] Utils: %90+
  - [ ] Components: %60+

### 7. Offline Destek ve Senkronizasyon

**Durum**: ❌ Offline çalışmıyor

**Adımlar**:

- [ ] **IndexedDB Entegrasyonu**:
  - [ ] Ürün verilerini cache'le
  - [ ] Offline değişiklikleri queue'a al
  - [ ] Online olunca otomatik sync

- [ ] **Conflict Resolution**:
  - [ ] Timestamp bazlı çözümleme
  - [ ] Kullanıcı seçimi (manual resolve)
  - [ ] Log conflict'leri

- [ ] **UI İyileştirmeleri**:
  - [ ] Online/offline indicator
  - [ ] Pending changes badge
  - [ ] Sync progress bar

### 8. Performance Optimizasyonları

**Adımlar**:

- [ ] **React.memo Kullanımı**:
  - [ ] StockListItem component'i optimize et
  - [ ] Unnecessary re-render'ları önle

- [ ] **Virtual List**:
  ```bash
  npm install @tanstack/react-virtual
  ```
  - [ ] 500+ ürün için virtual scrolling ekle

- [ ] **Debounced Search**:
  - [ ] 300ms debounce ekle
  - [ ] Search performance'ı iyileştir

- [ ] **Code Splitting**:
  - [ ] Route-based splitting
  - [ ] Component-based lazy loading

### 9. API Version Migration Analizi

**Adımlar**:

- [ ] **v1 vs v2 Karşılaştırması**:
  - [ ] Barcode desteği (v1: ✅, v2: ?)
  - [ ] Response format farkları
  - [ ] Performance farkları
  - [ ] Yeni özellikler (v2'de)

- [ ] **Migration Plan**:
  - [ ] Hangi endpoint'ler migrate edilebilir?
  - [ ] Breaking changes var mı?
  - [ ] Backward compatibility stratejisi

- [ ] **Dokümantasyon**:
  - [ ] Migration guide yaz
  - [ ] API version switch özelliği ekle

---

## 🔵 P3 - Düşük Öncelik (Nice to Have)

### 10. Advanced Raporlama

**Adımlar**:

- [ ] **Rapor Endpoint'lerini İncele**:
  - `/api/reports/products`
  - `/api/reports/product/{ProductId}`
  - `/api/reports/stock`

- [ ] **Yeni Raporlar**:
  - [ ] Stok hareket raporu
  - [ ] Fiyat değişim geçmişi
  - [ ] Barkod değişim log'u (yeni)

### 11. Barcode Scanner Entegrasyonu

**Adımlar**:

- [ ] **USB Barcode Scanner Desteği**:
  - [ ] Keyboard event'lerini yakala
  - [ ] Otomatik ürün arama
  - [ ] Bulk scanning modu

- [ ] **Camera-based Scanner**:
  - [ ] QuaggaJS veya ZXing kullan
  - [ ] Mobile-friendly

### 12. Multi-Store Desteği

**Adımlar**:

- [ ] Farklı server IP'leri için config profilleri
- [ ] Profile switching UI
- [ ] Cross-store veri karşılaştırması

---

## 📋 Dokümantasyon TODO

- [ ] **API Endpoint Katalog**: Kullanılan tüm endpoint'leri dokümante et
- [ ] **Barcode Update Guide**: Bulduğumuz endpoint için kullanım kılavuzu
- [ ] **Database Schema Guide**: DB yapısını detaylı açıkla
- [ ] **Developer Onboarding**: Yeni geliştirici için rehber
- [ ] **Deployment Guide**: Production deployment adımları

---

## 🔍 Araştırma Notları

### Barcode Update - Durum Raporu

**Tarih**: 2025-11-16

**Bulgular**:
1. ✅ GET işlemlerinde barcode verisi geliyor (`ProductBase` schema)
2. ❌ v2 API'de PUT/POST barcode field'i yok
3. ❓ v1 API PUT endpoint'i test edilmedi
4. 📋 Database schema henüz incelenmedi

**Next Steps**:
1. v1 API PUT endpoint'ini test et
2. Başarısız olursa DB schema'ya bak
3. Son çare: Gizmo support'a ticket aç

**Referanslar**:
- `gizmo-docs/README.md` - Detaylı API analizi
- `gizmo-docs/gizmoapiv1.json` - v1 API schema
- `services/api.ts:117` - Barcode GET implementasyonu

---

## ✅ Tamamlananlar

- [x] Gizmo API dokümantasyonunu repoya ekle
- [x] API dosyalarını `gizmo-docs/` klasörüne organize et
- [x] Barcode alanının varlığını doğrula (GET endpoint'lerinde)
- [x] Kullanılabilir endpoint'leri listele
- [x] TODO listesi oluştur

---

## 📊 İlerleme Takibi

| Kategori | Tamamlanan | Toplam | % |
|----------|------------|--------|---|
| P0 - Kritik | 0 | 1 | 0% |
| P1 - Yüksek | 0 | 5 | 0% |
| P2 - Orta | 0 | 4 | 0% |
| P3 - Düşük | 0 | 3 | 0% |
| **TOPLAM** | **0** | **13** | **0%** |

Son Güncelleme: 2025-11-16
