# Stock Management System

Local stock management and counting application. Built with React + TypeScript + Tailwind CSS, containerized with Docker.

## Features

- **Stock Management**: View and update product stock counts
- **Price Management**: Bulk update product prices
- **Cost Management**: Edit product cost information
- **Barcode Management**: Update product barcodes
- **Physical Counting**: Real stock counting with difference calculation
- **Stock Addition**: Add new products to existing stock
- **API Integration**: REST API for stock, price and cost updates
- **Category Filtering**: Filter by product groups
- **History Tracking**: Stock change history and reporting
- **Responsive Design**: Mobile and desktop compatible interface
- **System Logs**: Detailed operation and error logs

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4
- **UI Components**: Radix UI, Lucide Icons
- **Build Tool**: Vite
- **Container**: Docker + Nginx
- **Testing**: Vitest

## Installation

### Manual Setup

```bash
# Clone the repository
git clone [repository-url]
cd gizmo-stock

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Application runs at http://localhost:5173

### Docker Setup

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run
```

Application runs at http://localhost:3000

### Docker Compose

```bash
# Start services
npm run docker:compose

# Start with build
npm run docker:compose:build

# Stop
npm run docker:stop
```

## API Configuration

Configure API parameters from the settings page:

- **Server IP**: API server address (e.g., 192.168.1.5)
- **Username/Password**: Basic authentication credentials
- **Endpoints**: Products and categories endpoints
- **Pagination**: Products per page limit

### API Endpoints

```bash
# Product list
GET http://[IP]/api/v2.0/products?IsDeleted=false&EnableStock=true&Pagination.Limit=500

# Category list
GET http://[IP]/api/v2.0/productgroups

# Stock update
POST http://[IP]/api/stock/[PRODUCT_ID]/[NEW_STOCK_COUNT]

# Price/Cost/Barcode update
# First fetch product data
GET http://[IP]/api/v2.0/products/[PRODUCT_ID]

# Then update with ALL fields
PUT http://[IP]/api/v2.0/products
Content-Type: application/json
{
  "id": 10,
  "productType": 0,
  "guid": "...",
  "productImages": [],
  "productGroupId": 13,
  "name": "Product Name",
  "price": 44.00,
  "cost": 19.99,
  "barcode": "1234567890"
}
```

**Important**: When updating price, cost or barcode, you MUST send ALL required fields. Partial updates are NOT supported.

API response format:
```json
{
  "result": { "id": 10, "name": "...", "price": 40, ... },
  "httpStatusCode": 200,
  "isError": false
}
```

## Development

### Available Scripts

```bash
npm run dev          # Development mode
npm run build        # Production build
npm run preview      # Build preview
npm run lint         # ESLint check
npm run test:run     # Run tests
npm run test:coverage # Run tests with coverage
npm run docker:build # Build Docker image
npm run docker:run   # Run Docker container
```

Note: Vite preview doesn't proxy API. Either enable CORS on backend or use Docker/Nginx for production proxy.

### Folder Structure

```
components/           # React components
├── ui/               # Radix UI components
├── figma/            # Figma import components
└── NumpadInput.tsx   # Custom numpad input
services/             # API services
├── api.ts            # Gizmo API functions
└── __tests__/        # API contract tests
types/                # TypeScript types
├── stock.ts          # Stock data types
└── gizmo-api.ts      # Gizmo API response types
hooks/                # Custom React hooks
i18n/                 # Internationalization
styles/               # CSS files
└── globals.css       # Global Tailwind CSS (v4)
App.tsx               # Main application component
main.tsx              # Application entry point
```

## Testing

The project includes comprehensive API contract tests to prevent breaking changes:

```bash
# Run all tests
npm run test:run

# Run API tests only
npm run test:run -- services/__tests__/api.test.ts

# Run with coverage
npm run test:coverage
```

### Test Coverage Requirements

- Services folder requires minimum 70% coverage
- API contract tests verify Gizmo API integration
- Tests run automatically in CI/CD pipeline

## Docker Configuration

### Dockerfile
- Multi-stage build for optimized image
- Nginx Alpine for lightweight production image
- Health check for container monitoring
- Gzip compression for performance

### Nginx Configuration
- SPA routing support
- Static asset caching
- Security headers
- CORS support

## Usage

1. **Load Products**: Fetch product list from API
2. **Stock Counting**: Enter physical count values
3. **Stock Addition**: Use "Added" field to add new products
4. **Price/Cost Update**: Enter values in "Price - New" and "Cost - New" fields
5. **Barcode Update**: Edit product barcodes
6. **Difference Check**: System auto-calculates differences
7. **Apply Changes**: Send stock, price and cost updates via API
8. **History Review**: View counting history and reports

## Security

- HTTPS required (production)
- Basic Authentication
- CORS configuration
- XSS protection
- Content Security Policy

## Troubleshooting

### Docker Build Error
```bash
# Clear cache
docker system prune -a

# Force rebuild
docker build --no-cache -t gizmo-stock .
```

### API Connection Error
- Check IP address
- Verify firewall settings
- Check CORS configuration
- Test network connection

### Log Check
- System logs available in settings page
- Browser console for detailed errors
- Docker logs: `docker logs gizmo-stock-app`

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

## Notes

- Tailwind CSS v4 requires PostCSS plugin: `@tailwindcss/postcss`
- Development proxy target can be managed via `.env`:
  - `VITE_API_PROXY_TARGET=http://192.168.1.5`
- Docker production image is multi-stage (Node builder + Nginx)
- Animation utilities via `tailwindcss-animate` plugin
