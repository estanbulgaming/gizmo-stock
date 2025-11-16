# Gizmo API - Endpoints Hızlı Referans

Bu dokümanda projede kullanılan ve kullanılabilecek tüm endpoint'ler listelenmiştir.

## 🔧 Temel Bilgiler

- **Base URL**: `http://192.168.1.5`
- **Auth Method**: Basic Authentication
- **Credentials**: `cenx:123`
- **Header**: `Authorization: Basic Y2VueDoxMjM=` (base64 encoded)

---

## ✅ Şu An Kullanılan Endpoint'ler

### 1. Ürün Listesi (GET)

**Endpoint**: `GET /api/v2.0/products`

**Parametreler**:
- `Pagination.Limit`: Sayfa başı ürün sayısı (default: 500)
- `Pagination.IsScroll`: Scroll pagination (true/false)
- `IsDeleted`: Silinmiş ürünleri dahil et (true/false)
- `EnableStock`: Sadece stok takipli ürünler (default: true)
- `ProductGroupId`: Kategori filtresi (optional)
- `ProductName`: İsme göre arama (optional)

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/v2.0/products?IsDeleted=false&EnableStock=true&Pagination.Limit=500&Pagination.IsScroll=true"
```

**Response**:
```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "name": "Ürün Adı",
        "barcode": "1234567890123",
        "stockProductAmount": 100,
        "price": 99.90,
        "salePrice": 89.90,
        "productGroupId": 5,
        "productImages": [
          { "imageUrl": "/images/product1.jpg", "isMain": true }
        ]
      }
    ]
  }
}
```

**Proje Dosyası**: `services/api.ts:77-134`

---

### 2. Kategori Listesi (GET)

**Endpoint**: `GET /api/v2.0/productgroups`

**Parametreler**:
- `Pagination.Limit`: Sayfa başı kategori sayısı
- `IsDeleted`: Silinmiş kategorileri dahil et (default: false)

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/v2.0/productgroups"
```

**Response**:
```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "name": "Kategori Adı",
        "description": "Açıklama",
        "displayOrder": 0,
        "isDeleted": false
      }
    ]
  }
}
```

**Proje Dosyası**: `services/api.ts:37-75`

---

### 3. Stok Sorgulama (GET)

**Endpoint**: `GET /api/stock/{productId}`

**Parametreler**:
- `productId` (path): Ürün ID

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/stock/123"
```

**Response**:
```json
{
  "result": 50
}
```
veya sadece sayı: `50`

**Proje Dosyası**: `App.tsx:162-195`

---

### 4. Stok Güncelleme (POST)

**Endpoint**: `POST /api/stock/{productId}/{amount}`

**Parametreler**:
- `productId` (path): Ürün ID
- `amount` (path): Yeni stok miktarı

**Örnek**:
```bash
curl -u cenx:123 -X POST "http://192.168.1.5/api/stock/123/75"
```

**Response**:
```json
{
  "success": true
}
```

**Proje Dosyası**: `App.tsx:396-440`

**Batch İşlem**: `App.tsx:498-584` (5 concurrent request)

---

### 5. Fiyat Güncelleme (POST)

**Endpoint**: `POST /api/price/{productId}/{price}`

**Parametreler**:
- `productId` (path): Ürün ID
- `price` (path): Yeni fiyat

**Örnek**:
```bash
curl -u cenx:123 -X POST "http://192.168.1.5/api/price/123/199.90"
```

**Response**:
```json
{
  "success": true
}
```

**Proje Dosyası**: `App.tsx:444-492`

**Batch İşlem**: `App.tsx:588-656`

---

## 🔍 Test Edilmesi Gerekenler

### 6. Ürün Listesi v1 (GET) - Barcode İçerir

**Endpoint**: `GET /api/products`

**Avantajı**: v1 API, `ProductBase` schema'sı kullanır ve barcode alanını içerir

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/products"
```

**Beklenen Response**:
```json
[
  {
    "id": 1,
    "name": "Ürün Adı",
    "barcode": "1234567890123",  // ✅ v1'de var
    "price": 99.90,
    "cost": 50.00,
    "description": "Ürün açıklaması",
    "purchaseOptions": 0,
    "pointsPrice": 100,
    "createdTime": "2024-01-01T00:00:00Z"
  }
]
```

**Schema**: `ProductBase` (gizmoapiv1.json)

**Durum**: ⏳ Test edilmedi

---

### 7. Ürün Güncelleme (PUT) - Barcode İçerebilir

**Endpoint**: `PUT /api/products/{productId}`

**VEYA**: `PUT /api/products` (body'de id ile)

**Hipotez**: ProductBase schema'sı barcode içerdiğinden, PUT endpoint'i de barcode güncellemesini destekleyebilir.

**Test Edilecek Request**:
```bash
curl -u cenx:123 -X PUT "http://192.168.1.5/api/products/123" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "name": "Updated Product Name",
    "barcode": "9876543210987",
    "price": 199.90,
    "cost": 100.00,
    "purchaseOptions": 0
  }'
```

**Durum**: ❓ Test edilmedi - **P0 öncelikli**

**Adımlar**:
1. Önce GET ile mevcut ürün bilgilerini al
2. PUT ile barcode'u güncellemeyi dene
3. Başarılıysa schema'yı dokümante et
4. Projede implement et

---

### 8. Tekil Ürün Detayı (GET)

**v1 Endpoint**: `GET /api/products/{productId}`

**v2 Endpoint**: `GET /api/v2.0/products/{id}`

**Kullanım**: Ürün detaylarını çekmek için (update öncesi)

**Örnek**:
```bash
# v1
curl -u cenx:123 "http://192.168.1.5/api/products/123"

# v2
curl -u cenx:123 "http://192.168.1.5/api/v2.0/products/123"
```

**Durum**: ⏳ Test edilmedi

---

## 📊 Rapor Endpoint'leri

### 9. Stok Raporu

**Endpoint**: `GET /api/reports/stock`

**Parametreler**:
- `DateFrom`: Başlangıç tarihi (ISO format)
- `DateTo`: Bitiş tarihi (ISO format)

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/reports/stock?DateFrom=2025-01-01T00:00:00Z&DateTo=2025-11-16T23:59:59Z"
```

**Response**: `gizmoraportschema.md` dosyasında detaylar

**Durum**: 📋 Dokümantasyon incelenmedi

---

### 10. Ürün Satış Raporu

**Endpoint**: `GET /api/reports/products`

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/reports/products?DateFrom=2025-01-01T00:00:00Z&DateTo=2025-11-16T23:59:59Z"
```

**Durum**: 📋 Kullanılmıyor

---

### 11. Tekil Ürün Raporu

**Endpoint**: `GET /api/reports/product/{ProductId}`

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/reports/product/123?DateFrom=2025-01-01T00:00:00Z&DateTo=2025-11-16T23:59:59Z"
```

**Durum**: 📋 Kullanılmıyor

---

## 🔐 Auth Endpoint'leri

### 12. Token Alma (v2 için)

**Endpoint**: `GET /api/v2.0/auth/accesstoken`

**Parametreler**:
- `Username`: Kullanıcı adı
- `Password`: Şifre

**Örnek**:
```bash
curl "http://192.168.1.5/api/v2.0/auth/accesstoken?Username=cenx&Password=123"
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

**Kullanım**:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." "http://192.168.1.5/api/v2.0/..."
```

**Durum**: 📋 Projede kullanılmıyor (Basic Auth yeterli)

---

## 🖼️ Görsel Endpoint'leri

### 13. Ürün Görselleri (GET)

**Endpoint**: `GET /api/v2.0/products/{id}/images`

**Parametreler**:
- `id` (path): Ürün ID

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/v2.0/products/123/images"
```

**Response**:
```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "productId": 123,
        "imageUrl": "/uploads/products/image1.jpg",
        "isMain": true
      }
    ]
  }
}
```

**Proje Dosyası**: `services/api.ts:136-164`

---

### 14. Görsel Güncelleme (PUT)

**Endpoint**: `PUT /api/v2.0/products/images`

**Request Body**:
```json
{
  "id": 1,
  "productId": 123,
  "image": "base64_encoded_image_data",
  "isMain": true
}
```

**Durum**: 📋 Projede kullanılmıyor

---

## 📦 Stok İşlem Endpoint'leri (v2)

### 15. Stok İşlem Geçmişi

**Endpoint**: `GET /api/v2.0/stocktransactions`

**Parametreler**:
- `ProductId`: Ürün ID filtresi
- `DateFrom`: Başlangıç tarihi
- `DateTo`: Bitiş tarihi
- `Pagination.Limit`: Sayfa başı kayıt

**Örnek**:
```bash
curl -u cenx:123 "http://192.168.1.5/api/v2.0/stocktransactions?ProductId=123&Pagination.Limit=100"
```

**Response**:
```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "productId": 123,
        "type": "Add",  // Add, Remove, Set, Sold, Return
        "amount": 10,
        "previousStock": 50,
        "newStock": 60,
        "createdTime": "2025-11-16T10:30:00Z",
        "userId": 1
      }
    ]
  }
}
```

**Durum**: 📋 Kullanılabilir (gelecek için)

---

### 16. Stok İşlemi Oluşturma (PUT)

**Endpoint**: `PUT /api/v2.0/products/stock`

**Request Body**:
```json
{
  "id": 123,  // Product ID
  "type": 0,  // 0=Add, 1=Remove, 2=Set
  "amount": 10
}
```

**Örnek**:
```bash
curl -u cenx:123 -X PUT "http://192.168.1.5/api/v2.0/products/stock" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123,
    "type": 2,
    "amount": 75
  }'
```

**Schema**: `ProductStockModelUpdate` (gizmoapiv2.json)

**Durum**: 🔄 Mevcut `/api/stock/{id}/{amount}` yerine kullanılabilir

---

## 🎯 Öncelikli Test Edilecekler

| # | Endpoint | Metod | Amaç | Öncelik |
|---|----------|-------|------|---------|
| 1 | `/api/products/{productId}` | PUT | Barcode update | P0 |
| 2 | `/api/products` | GET | v1 ürün listesi (barcode dahil) | P1 |
| 3 | `/api/v2.0/products/stock` | PUT | Alternatif stok update | P2 |
| 4 | `/api/v2.0/stocktransactions` | GET | Stok geçmişi | P2 |
| 5 | `/api/reports/stock` | GET | Stok raporu | P3 |

---

## 📝 Notlar

### Pagination

**Cursor-based** (v2 önerilen):
```
Pagination.IsScroll=true&Pagination.Cursor=<cursor>&Pagination.Limit=500
```

**Limit-based**:
```
Pagination.Limit=500&Pagination.Skip=0
```

### Date Format

ISO 8601 formatı kullanın:
```
2025-11-16T10:30:00Z
```

### Response Parsing

v2 API genelde şu formatta döner:
```json
{
  "result": {
    "data": [...]
  }
}
```

v1 API direkt array dönebilir:
```json
[...]
```

### Error Handling

HTTP Status Codes:
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (auth error)
- `404`: Not Found
- `500`: Internal Server Error

Error Response:
```json
{
  "error": "Error message",
  "details": {
    "field": "validation details"
  }
}
```

---

## 🔗 Kaynaklar

- **Swagger Docs**: `gizmo-docs/gizmoswagger.md`
- **v1 API Schema**: `gizmo-docs/gizmoapiv1.json`
- **v2 API Schema**: `gizmo-docs/gizmoapiv2.json`
- **DB Schema**: `gizmo-docs/gizmodbschema.md`
- **Report Schema**: `gizmo-docs/gizmoraportschema.md`

Son Güncelleme: 2025-11-16
