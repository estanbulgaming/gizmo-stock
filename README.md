# Stok Yönetim Sistemi

Yerel stok yönetimi ve sayım uygulaması. React + TypeScript + Tailwind CSS ile geliştirilmiş, Docker ile containerize edilmiş modern bir web uygulamasıdır.

## 🚀 Özellikler

- **Stok Yönetimi**: Ürün stok sayılarını görüntüleme ve güncelleme
- **Fiziki Sayım**: Gerçek stok sayımı ve fark hesaplama  
- **Stok Ekleme**: Mevcut stoğa yeni ürün ekleme
- **API Entegrasyonu**: REST API ile stok güncelleme
- **Kategori Filtreleme**: Ürün gruplarına göre filtreleme
- **Geçmiş Takibi**: Stok değişiklik geçmişi ve raporlama
- **Responsive Design**: Mobil ve desktop uyumlu arayüz
- **Sistem Logları**: Detaylı işlem ve hata logları

## 🛠️ Teknolojiler

- **Frontend**: React 18, TypeScript, Tailwind CSS v4
- **UI Components**: Radix UI, Lucide Icons
- **Build Tool**: Vite
- **Container**: Docker + Nginx
- **Styling**: Tailwind CSS v4

## 📦 Kurulum

### Manuel Kurulum

1. **Projeyi klonlayın:**
   ```bash
   git clone [repository-url]
   cd stok-yonetim-sistemi
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Geliştirme modunda çalıştırın:**
   ```bash
   npm run dev
   ```
   Uygulama http://localhost:5173 adresinde çalışacak.

### Docker ile Kurulum

1. **Docker image oluşturun:**
   ```bash
   npm run docker:build
   ```

2. **Container'ı çalıştırın:**
   ```bash
   npm run docker:run
   ```
   Uygulama http://localhost:3000 adresinde çalışacak.

### Docker Compose ile Kurulum

1. **Servisleri başlatın:**
   ```bash
   npm run docker:compose
   ```

2. **Build ile başlatın:**
   ```bash
   npm run docker:compose:build
   ```

3. **Durdurma:**
   ```bash
   npm run docker:stop
   ```

## ⚙️ API Yapılandırması

Uygulama ayarlar sayfasından aşağıdaki API parametrelerini yapılandırabilirsiniz:

- **Sunucu IP**: API sunucu adresi (örn: 192.168.1.5)
- **Kullanıcı Adı/Şifre**: Basic authentication bilgileri
- **Endpoints**: Ürünler ve kategoriler için endpoint'ler
- **Pagination**: Sayfa başı ürün sayısı limiti

### API Endpoints

```bash
# Ürün listesi
GET http://[IP]/api/v2.0/products?IsDeleted=false&EnableStock=true&Pagination.Limit=500

# Kategori listesi  
GET http://[IP]/api/v2.0/productgroups

# Stok güncelleme
POST http://[IP]/api/stock/[PRODUCT_ID]/[NEW_STOCK_COUNT]
```

## 🔧 Geliştirme

### Mevcut npm Scripts

```bash
npm run dev          # Geliştirme modu
npm run build        # Production build
npm run preview      # Build önizleme
npm run lint         # ESLint kontrolü
npm run docker:build # Docker image oluştur
npm run docker:run   # Docker container çalıştır
```

Not: Vite preview API proxy yapmaz. API çağrıları için ya CORS'u backend'de açın ya da Docker/Nginx ile prod proxy kullanın. Geliştirme sırasında API için Vite proxy (npm run dev) önerilir.

### Linting ve TypeScript

- Proje ESLint + TypeScript ile yapılandırıldı. Lint çalıştırmak için:

```bash
npm run lint
```

- ESLint config: `.eslintrc.cjs`
- TS config: `tsconfig.json`
- Ignore dosyası: `.eslintignore`

### Klasör Yapısı

```
components/           # React bileşenleri
├── ui/               # Radix UI bileşenleri
├── figma/            # Figma import bileşenleri
└── NumpadInput.tsx   # Özel numpad input
styles/               # CSS dosyaları
└── globals.css       # Global Tailwind CSS (Tailwind v4)
App.tsx               # Ana uygulama bileşeni
main.tsx              # Uygulama giriş noktası
```

## 🐳 Docker Yapılandırması

### Dockerfile
- **Multi-stage build** ile optimize edilmiş image
- **Nginx Alpine** ile hafif production image
- **Health check** ile container sağlık kontrolü
- **Gzip compression** ile performans optimizasyonu

### Nginx Yapılandırması
- SPA routing desteği
- Static asset caching
- Security headers
- CORS desteği

## 📱 Kullanım

1. **Ürünleri Yükle**: API'den ürün listesini çekin
2. **Stok Sayımı**: Fiziki sayım değerlerini girin
3. **Stok Ekleme**: Yeni ürün eklemek için "Eklenen" alanını kullanın
4. **Fark Kontrolü**: Sistem otomatik fark hesaplar
5. **Değişiklikleri Uygula**: API ile stok güncellemelerini gönderin
6. **Geçmiş İnceleme**: Sayım geçmişini ve raporları görüntüleyin

## 🔒 Güvenlik

- HTTPS zorunlu (production)
- Basic Authentication
- CORS yapılandırması
- XSS koruması
- Content Security Policy

## 📊 Performans

- Code splitting ile optimize yükleme
- Lazy loading
- Service Worker desteği (opsiyonel)
- CDN ready static assets

## 🐛 Sorun Giderme

### Docker Build Hatası
```bash
# Cache temizleme
docker system prune -a

# Image'ı force rebuild
docker build --no-cache -t stok-yonetim .
```

### API Bağlantı Hatası
- IP adresini kontrol edin
- Güvenlik duvarı ayarlarını kontrol edin  
- CORS ayarlarını kontrol edin
- Network bağlantısını test edin

### Log Kontrolü
- Sistem logları ayarlar sayfasında görüntülenebilir
- Browser console'da detaylı hatalar
- Docker logs: `docker logs stok-yonetim-app`

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun
3. Değişikliklerinizi commit edin
4. Pull request gönderin

## 📞 Destek

Sorularınız için:
- Issues sayfasını kullanın
- Sistem loglarını kontrol edin
- Docker loglarını inceleyin

---

## Notlar ve İyileştirmeler

- Tailwind CSS v4 kullanımı için PostCSS eklentisi zorunludur: `@tailwindcss/postcss`.
  - `postcss.config.js` içinde `plugins: [require('@tailwindcss/postcss')(), require('autoprefixer')()]` benzeri yapı kullanılır.
- Geliştirme proxy hedefi `.env` ile yönetilebilir:
  - `VITE_API_PROXY_TARGET=http://192.168.1.5`
  - `vite.config.ts` bu değeri otomatik okur.
- Docker üretim imajı çok aşamalıdır (Node builder + Nginx). Context şişmesini önlemek için `.dockerignore` eklenmiştir.
- Animasyon yardımcı sınıfları için `tailwindcss-animate` eklendi; `styles/globals.css` içinde `@plugin "tailwindcss-animate";` tanımlıdır.
