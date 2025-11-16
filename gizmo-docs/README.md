# Gizmo API Dokümantasyonu

Bu klasör, Gizmo sisteminin API dokümantasyonunu içermektedir.

## İçerik

- **gizmoapiv1.json**: Gizmo API v1 OpenAPI spesifikasyonu
- **gizmoapiv2.json**: Gizmo API v2 OpenAPI spesifikasyonu
- **gizmoswagger.md**: Konsolide Swagger dokümantasyonu (v1 + v2)
- **gizmodbschema.md**: Gizmo veritabanı şema dokümantasyonu
- **gizmoraportschema.md**: Gizmo rapor şema dokümantasyonu

## Proje İçin Önemli Bulgular

### ✅ BARCODE (Barkod) Desteği

**API v1** - `ProductBase` schema'sında barcode alanı mevcut:

```json
{
  "barcode": {
    "maxLength": 255,
    "minLength": 0,
    "type": "string",
    "description": "Gets or sets barcode.",
    "nullable": true
  }
}
```

#### Barcode Veri Çekme (GET)

**v1 API**:
```bash
GET /api/products
Response: ProductBase[] (içinde barcode var)
```

**v2 API**:
```bash
GET /api/v2.0/products
Response: ProductModel[] (barcode alanı kontrol edilmeli)
```

#### ⚠️ Barcode Güncelleme (UPDATE)

**DURUM**: Gizmo API'de direkt barcode update endpoint'i bulunamadı.

**Olası Çözümler**:

1. **PUT /api/products/{productId}** (v1) - Kontrol edilmeli
   - Tam şema henüz görülmedi
   - ProductBase schema'sı barcode içeriyorsa, buradan güncellenebilir olmalı

2. **PUT /api/v2.0/products** (v2) - ❌ Barcode içermiyor
   ```json
   {
     "id": 1,
     "productGroupId": 1,
     "name": "string",
     "description": "string",
     "price": 0,
     "cost": 0,
     // BARCODE YOK!
   }
   ```

3. **Veritabanı Direkt Erişim**
   - Son çare olarak `gizmodbschema.md` incelenmeli
   - Product tablosunda barcode kolonu varsa, direkt DB güncellemesi yapılabilir

### 📊 Projede Kullanılan Endpoint'ler

#### ✅ Şu An Kullanılanlar

| Endpoint | Metod | Kullanım | Durum |
|----------|-------|----------|-------|
| `/api/v2.0/products` | GET | Ürün listesi çekme (barcode, fiyat, stok) | ✅ Çalışıyor |
| `/api/v2.0/productgroups` | GET | Kategori listesi çekme | ✅ Çalışıyor |
| `/api/stock/{productId}` | GET | Tekil stok sorgulama | ✅ Çalışıyor |
| `/api/stock/{productId}/{amount}` | POST | Stok güncelleme | ✅ Çalışıyor |
| `/api/price/{productId}/{price}` | POST | Fiyat güncelleme | ✅ Çalışıyor |

**Kaynak Dosyalar**:
- `services/api.ts`: GET işlemleri
- `App.tsx`: POST işlemleri

#### 🔍 İncelenmesi Gerekenler

| Endpoint | Metod | Potansiyel Kullanım | Öncelik |
|----------|-------|---------------------|---------|
| `/api/products` | GET | v1 Ürün listesi (barcode içerir) | P1 |
| `/api/products/{productId}` | GET | Tekil ürün detayı | P2 |
| `/api/products/{productId}` | PUT | Ürün güncelleme (barcode?) | P0 |
| `/api/v2.0/products/{id}` | GET | v2 Tekil ürün detayı | P2 |
| `/api/v2.0/products/images` | PUT | Ürün görseli güncelleme | P3 |

## Eylem Adımları

### 1. Barcode Update Endpoint'ini Bul (P0 - Kritik)

```bash
# Test edilmesi gereken endpoint:
curl -u cenx:123 -X PUT "http://192.168.1.5/api/products/{productId}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "name": "Test Product",
    "barcode": "123456789012"
  }'
```

**Adımlar**:
1. v1 API'de `/api/products/{productId}` PUT endpoint'ini test et
2. Request body schema'sını kontrol et (barcode alanı var mı?)
3. Başarılı olursa, projede implement et

### 2. Database Schema İncele (P1)

Eğer API endpoint'i yoksa:
1. `gizmodbschema.md` dosyasını incele
2. `Product` tablosundaki `barcode` kolonunu bul
3. Direkt SQL update seçeneğini değerlendir (son çare)

### 3. API Version Migration (P2)

**v1 → v2 Karşılaştırma**:
- v1: `ProductBase` (barcode içerir)
- v2: `ProductModel` (barcode durumu belirsiz)

v2 API'de barcode desteği varsa, projeyi v2'ye migrate et.

## TypeScript Tipler

### ProductBase (v1 API)

```typescript
interface ProductBase {
  id: number;
  createdById?: number | null;
  createdTime: string;
  modifiedById?: number | null;
  modifiedTime?: string | null;
  name: string; // max 45 karakter
  description?: string | null; // max 65535 karakter
  price: number;
  cost?: number | null;
  orderOptions: OrderOptionType;
  purchaseOptions: PurchaseOptionType;
  points?: number | null;
  pointsPrice?: number | null;
  barcode?: string | null; // ✅ max 255 karakter
  // ... diğer alanlar
}
```

### ProductStockDTO (v1 API)

```typescript
interface ProductStockDTO {
  id: number;
  productName?: string | null;
  initial: number;      // Başlangıç stok
  added: number;        // Eklenen
  removed: number;      // Çıkarılan
  set: number;          // Manuel set edilen
  sold: number;         // Satılan
  returned: number;     // İade edilen
  final: number;        // Son stok
  diff: number;         // Fark
}
```

## Referanslar

- **Base URL**: `http://192.168.1.5`
- **Auth**: Basic Authentication (`cenx:123`)
- **v2 Token**: Bearer token (finansal endpoint'ler için)

**Token Alma**:
```bash
GET /api/v2.0/auth/accesstoken?Username=cenx&Password=123
```

## Notlar

- Pagination için cursor-based veya limit-based kullanılabilir
- v2 endpoint'leri `Pagination.IsScroll=true&Pagination.Limit=500` parametrelerini destekler
- Tarih formatı: ISO 8601 (`2025-09-10T12:34:56Z`)
- Response format: `{ result: { data: [...] } }` veya direkt array
