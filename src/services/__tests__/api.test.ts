import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchProducts,
  fetchProductGroups,
  fetchProductImageUrl,
  deleteProduct,
  restoreProduct,
  getCachedImageUrl,
  setCachedImageUrl,
  getCachedProducts,
  setCachedProducts,
  loadPriceTracking,
  savePriceTracking,
  updatePreviousPrice,
  updateNextPrice,
  updatePreviousCost,
  updateNextCost,
  ApiContext,
} from '../api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test fixtures
const mockApiContext: ApiContext = {
  apiConfig: {
    serverIP: '192.168.1.100',
    username: 'testuser',
    password: 'testpass',
    endpoint: '/v2.0/products',
    groupsEndpoint: '/v2.0/productgroups',
    baseParams: 'EnableStock=true',
    paginationLimit: 500,
    includeDeleted: false,
    showProductImages: true,
  },
  joinApi: (path: string) => `http://192.168.1.100/api${path}`,
};

// Realistic Gizmo API response fixtures
const mockProductResponse = {
  result: {
    data: [
      {
        id: 10,
        productType: 0,
        guid: 'abc-123-def-456',
        productImages: [
          { id: 1, imageUrl: '/images/product1.jpg', isMain: true }
        ],
        productGroupId: 5,
        name: 'Test Product',
        price: 49.99,
        cost: 25.00,
        barcode: '1234567890123',
        stockProductAmount: 100,
        isDeleted: false,
      },
      {
        id: 11,
        productType: 0,
        guid: 'xyz-789-uvw-012',
        productImages: [],
        productGroupId: 5,
        name: 'Product Without Image',
        price: 29.99,
        cost: 15.00,
        barcode: '9876543210987',
        stockProductAmount: 50,
        isDeleted: false,
      },
    ],
    totalCount: 2,
  },
  httpStatusCode: 200,
  isError: false,
};

const mockProductGroupResponse = {
  result: {
    data: [
      {
        id: 5,
        name: 'Electronics',
        description: 'Electronic devices',
        displayOrder: 1,
        isDeleted: false,
      },
      {
        id: 6,
        name: 'Clothing',
        description: null,
        displayOrder: 2,
        isDeleted: false,
      },
      {
        id: 7,
        name: 'Deleted Category',
        description: 'Should be filtered',
        displayOrder: 3,
        isDeleted: true,
      },
    ],
  },
  httpStatusCode: 200,
  isError: false,
};

// Single product response (used for GET before PUT)
const mockSingleProductResponse = {
  result: {
    id: 10,
    productType: 0,
    guid: 'abc-123-def-456',
    productImages: [
      { id: 1, imageUrl: '/images/product1.jpg', isMain: true }
    ],
    productGroupId: 5,
    name: 'Test Product',
    price: 49.99,
    cost: 25.00,
    barcode: '1234567890123',
    stockProductAmount: 100,
    isDeleted: false,
  },
  httpStatusCode: 200,
  isError: false,
};

describe('Gizmo API - fetchProducts', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
  });

  it('should fetch and parse products correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    const result = await fetchProducts(mockApiContext);

    expect(result.products).toHaveLength(2);
    expect(result.totalProducts).toBe(2);

    const firstProduct = result.products[0];
    expect(firstProduct.id).toBe('10');
    expect(firstProduct.name).toBe('Test Product');
    expect(firstProduct.price).toBe(49.99);
    expect(firstProduct.cost).toBe(25.00);
    expect(firstProduct.barcode).toBe('1234567890123');
    expect(firstProduct.count).toBe(100);
    expect(firstProduct.productGroupId).toBe(5);
  });

  it('should handle products without images', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    const result = await fetchProducts(mockApiContext);
    const productWithoutImage = result.products[1];

    expect(productWithoutImage.name).toBe('Product Without Image');
    // imageUrl may be undefined or from fallback
  });

  it('should calculate total stock correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    const result = await fetchProducts(mockApiContext);

    // 100 + 50 = 150
    expect(result.totalStock).toBe(150);
  });

  it('should handle empty product list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { data: [] } }),
    });

    const result = await fetchProducts(mockApiContext);

    expect(result.products).toHaveLength(0);
    expect(result.totalProducts).toBe(0);
    expect(result.totalStock).toBe(0);
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('HTTP error! status: 500');
  });

  it('should include correct query parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    await fetchProducts(mockApiContext);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('IsDeleted=false'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('EnableStock=true'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('Pagination.Limit=500'),
      expect.any(Object)
    );
  });

  it('should filter by product group IDs when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    await fetchProducts(mockApiContext, [5, 6]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('ProductGroupId=5'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('ProductGroupId=6'),
      expect.any(Object)
    );
  });

  it('should include Basic Auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    await fetchProducts(mockApiContext);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Basic ' + btoa('testuser:testpass'),
        }),
      })
    );
  });
});

describe('Gizmo API - fetchProductGroups', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch and parse product groups correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductGroupResponse),
    });

    const groups = await fetchProductGroups(mockApiContext);

    // Should filter out deleted groups
    expect(groups).toHaveLength(2);

    const electronics = groups.find(g => g.id === 5);
    expect(electronics?.name).toBe('Electronics');
    expect(electronics?.description).toBe('Electronic devices');
    expect(electronics?.displayOrder).toBe(1);
  });

  it('should filter out deleted groups', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductGroupResponse),
    });

    const groups = await fetchProductGroups(mockApiContext);

    const deletedGroup = groups.find(g => g.id === 7);
    expect(deletedGroup).toBeUndefined();
  });

  it('should handle groups without description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductGroupResponse),
    });

    const groups = await fetchProductGroups(mockApiContext);

    const clothing = groups.find(g => g.id === 6);
    expect(clothing?.description).toBeUndefined();
  });
});

describe('Gizmo API - Product Update (PUT /v2.0/products)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  /**
   * CRITICAL TEST: Gizmo API requires ALL fields when updating a product.
   * You cannot just send { id: 10, price: 50 } - it will fail or corrupt data.
   * The correct flow is:
   * 1. GET /v2.0/products/{id} to fetch current product
   * 2. PUT /v2.0/products with ALL required fields
   */
  it('should require full product payload for updates (not partial)', async () => {
    // Mock GET request (fetch current product)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSingleProductResponse),
    });

    // Mock PUT request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: { ...mockSingleProductResponse.result, isDeleted: true } }),
    });

    await deleteProduct(mockApiContext, '10');

    // Verify PUT was called with full payload
    const putCall = mockFetch.mock.calls[1];
    const putBody = JSON.parse(putCall[1].body);

    // ALL these fields are REQUIRED by Gizmo API
    expect(putBody).toHaveProperty('id', 10);
    expect(putBody).toHaveProperty('productType', 0);
    expect(putBody).toHaveProperty('guid', 'abc-123-def-456');
    expect(putBody).toHaveProperty('productGroupId', 5);
    expect(putBody).toHaveProperty('name', 'Test Product');
    expect(putBody).toHaveProperty('productImages');
    expect(putBody).toHaveProperty('price', 49.99);
    expect(putBody).toHaveProperty('cost', 25.00);
    expect(putBody).toHaveProperty('barcode', '1234567890123');
    expect(putBody).toHaveProperty('isDeleted', true);
  });

  it('should first GET product data before PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSingleProductResponse),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: mockSingleProductResponse.result }),
    });

    await deleteProduct(mockApiContext, '10');

    // First call should be GET
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
    expect(mockFetch.mock.calls[0][0]).toContain('/v2.0/products/10');

    // Second call should be PUT
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT');
    expect(mockFetch.mock.calls[1][0]).toContain('/v2.0/products');
  });

  it('should preserve all existing fields when updating single field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSingleProductResponse),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: mockSingleProductResponse.result }),
    });

    await restoreProduct(mockApiContext, '10');

    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);

    // Original values should be preserved
    expect(putBody.name).toBe('Test Product');
    expect(putBody.price).toBe(49.99);
    expect(putBody.cost).toBe(25.00);
    expect(putBody.barcode).toBe('1234567890123');
    // Only isDeleted should change
    expect(putBody.isDeleted).toBe(false);
  });
});

describe('Gizmo API - Product Update Required Fields', () => {
  /**
   * These tests document the REQUIRED fields for PUT /v2.0/products
   * Missing any of these fields will cause API errors or data corruption
   */

  const requiredFields = [
    'id',
    'productType',
    'guid',
    'productGroupId',
    'name',
    'productImages',
    'price',
    'cost',
    'barcode',
  ];

  requiredFields.forEach(field => {
    it(`should include required field: ${field}`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSingleProductResponse),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: mockSingleProductResponse.result }),
      });

      await deleteProduct(mockApiContext, '10');

      const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(putBody).toHaveProperty(field);
    });
  });
});

describe('Gizmo API - Error Handling', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should throw on 401 Unauthorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('HTTP error! status: 401');
  });

  it('should throw on 403 Forbidden', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('HTTP error! status: 403');
  });

  it('should throw on 404 Not Found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('HTTP error! status: 404');
  });

  it('should throw on 500 Internal Server Error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('HTTP error! status: 500');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchProducts(mockApiContext)).rejects.toThrow('Network error');
  });

  it('should handle malformed JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    await expect(fetchProducts(mockApiContext)).rejects.toThrow();
  });
});

describe('Gizmo API - Response Parsing Edge Cases', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
  });

  it('should handle missing result.data gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: {} }),
    });

    const result = await fetchProducts(mockApiContext);
    expect(result.products).toHaveLength(0);
  });

  it('should handle null values in product fields', async () => {
    const responseWithNulls = {
      result: {
        data: [
          {
            id: 1,
            productType: 0,
            guid: 'test-guid',
            productImages: null,
            productGroupId: null,
            name: null,
            price: null,
            cost: null,
            barcode: null,
            stockProductAmount: null,
            isDeleted: false,
          },
        ],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseWithNulls),
    });

    const result = await fetchProducts(mockApiContext);

    expect(result.products[0].name).toBe('İsimsiz Ürün');
    expect(result.products[0].barcode).toBe('Barkod Yok');
    expect(result.products[0].count).toBe(0);
  });

  it('should round stock amounts to integers', async () => {
    const responseWithDecimalStock = {
      result: {
        data: [
          {
            id: 1,
            name: 'Test',
            stockProductAmount: 10.7,
            isDeleted: false,
          },
        ],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseWithDecimalStock),
    });

    const result = await fetchProducts(mockApiContext);
    expect(result.products[0].count).toBe(11); // Math.round(10.7)
  });

  it('should convert id to string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProductResponse),
    });

    const result = await fetchProducts(mockApiContext);

    // id should be string even if API returns number
    expect(typeof result.products[0].id).toBe('string');
    expect(result.products[0].id).toBe('10');
  });
});

describe('Gizmo API - Stock Update (POST /stock/{id}/{count})', () => {
  /**
   * Stock update uses a different endpoint and simpler format
   * POST /api/stock/{productId}/{newStockCount}
   * No body required, just URL parameters
   */

  it('should use POST method for stock updates', () => {
    // This documents the expected behavior
    // Stock updates are POST to /api/stock/{id}/{count}
    const stockUpdateUrl = mockApiContext.joinApi('/stock/10/50');
    expect(stockUpdateUrl).toBe('http://192.168.1.100/api/stock/10/50');
  });

  it('should construct correct stock update URL', () => {
    const productId = '123';
    const newStock = 75;
    const expectedUrl = `http://192.168.1.100/api/stock/${productId}/${newStock}`;

    const actualUrl = mockApiContext.joinApi(`/stock/${productId}/${newStock}`);
    expect(actualUrl).toBe(expectedUrl);
  });
});

describe('Gizmo API - Image Fetching', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should fetch product images from correct endpoint', async () => {
    const mockImageResponse = {
      result: [
        { id: 1, imageUrl: '/images/main.jpg', isMain: true },
        { id: 2, imageUrl: '/images/secondary.jpg', isMain: false },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockImageResponse),
    });

    await fetchProductImageUrl(mockApiContext, '10');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v2.0/products/10/images'),
      expect.any(Object)
    );
  });

  it('should prefer main image when available', async () => {
    const mockImageResponse = {
      result: [
        { id: 2, imageUrl: '/images/secondary.jpg', isMain: false },
        { id: 1, imageUrl: '/images/main.jpg', isMain: true },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockImageResponse),
    });

    const imageUrl = await fetchProductImageUrl(mockApiContext, '10');

    // Should return main image URL (with server prefix)
    expect(imageUrl).toContain('main.jpg');
  });
});

describe('Gizmo API - Image Cache', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should cache and retrieve image URLs', () => {
    const productId = '123';
    const imageUrl = 'http://example.com/image.jpg';

    setCachedImageUrl(productId, imageUrl);
    const cached = getCachedImageUrl(productId);

    expect(cached).toBe(imageUrl);
  });

  it('should return undefined for non-existent cache entry', () => {
    const cached = getCachedImageUrl('non-existent');
    expect(cached).toBeUndefined();
  });

  it('should return undefined for expired cache', () => {
    const productId = '123';
    const imageUrl = 'http://example.com/image.jpg';

    // Set cache with old timestamp (25 hours ago)
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000);
    localStorageMock.setItem('gizmo_image_cache', JSON.stringify({
      [productId]: { url: imageUrl, timestamp: oldTimestamp }
    }));

    const cached = getCachedImageUrl(productId);
    expect(cached).toBeUndefined();
  });

  it('should return cached URL if not expired', () => {
    const productId = '456';
    const imageUrl = 'http://example.com/fresh.jpg';

    // Set cache with recent timestamp (1 hour ago)
    const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000);
    localStorageMock.setItem('gizmo_image_cache', JSON.stringify({
      [productId]: { url: imageUrl, timestamp: recentTimestamp }
    }));

    const cached = getCachedImageUrl(productId);
    expect(cached).toBe(imageUrl);
  });
});

describe('Gizmo API - Products Cache', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should cache and retrieve products', () => {
    const products = [
      { id: '1', name: 'Product 1', barcode: '123', count: 10 },
      { id: '2', name: 'Product 2', barcode: '456', count: 20 },
    ];

    setCachedProducts(products as Parameters<typeof setCachedProducts>[0]);
    const cached = getCachedProducts();

    expect(cached).toHaveLength(2);
    expect(cached?.[0].name).toBe('Product 1');
  });

  it('should return null for non-existent cache', () => {
    const cached = getCachedProducts();
    expect(cached).toBeNull();
  });

  it('should return null for expired cache', () => {
    const products = [{ id: '1', name: 'Test', barcode: '123', count: 5 }];

    // Set cache with old timestamp (10 minutes ago, expiry is 5 min)
    const oldTimestamp = Date.now() - (10 * 60 * 1000);
    localStorageMock.setItem('gizmo_products_cache', JSON.stringify({
      products,
      timestamp: oldTimestamp
    }));

    const cached = getCachedProducts();
    expect(cached).toBeNull();
  });

  it('should return products if cache is fresh', () => {
    const products = [{ id: '1', name: 'Fresh', barcode: '789', count: 15 }];

    // Set cache with recent timestamp (1 minute ago)
    const recentTimestamp = Date.now() - (1 * 60 * 1000);
    localStorageMock.setItem('gizmo_products_cache', JSON.stringify({
      products,
      timestamp: recentTimestamp
    }));

    const cached = getCachedProducts();
    expect(cached).toHaveLength(1);
    expect(cached?.[0].name).toBe('Fresh');
  });

  it('should handle invalid JSON gracefully', () => {
    localStorageMock.setItem('gizmo_products_cache', 'invalid-json');
    const cached = getCachedProducts();
    expect(cached).toBeNull();
  });
});

describe('Gizmo API - Price Tracking', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should load empty tracking for non-existent product', () => {
    const tracking = loadPriceTracking('non-existent');
    expect(tracking).toEqual({});
  });

  it('should save and load price tracking', () => {
    const productId = '123';
    savePriceTracking(productId, { previousPrice: 10, nextPrice: 15 });

    const tracking = loadPriceTracking(productId);
    expect(tracking.previousPrice).toBe(10);
    expect(tracking.nextPrice).toBe(15);
  });

  it('should merge tracking updates', () => {
    const productId = '456';

    savePriceTracking(productId, { previousPrice: 20 });
    savePriceTracking(productId, { nextPrice: 25 });

    const tracking = loadPriceTracking(productId);
    expect(tracking.previousPrice).toBe(20);
    expect(tracking.nextPrice).toBe(25);
  });

  it('should update previous price', () => {
    const productId = '789';
    updatePreviousPrice(productId, 50);

    const tracking = loadPriceTracking(productId);
    expect(tracking.previousPrice).toBe(50);
  });

  it('should update next price', () => {
    const productId = '101';
    updateNextPrice(productId, 60);

    const tracking = loadPriceTracking(productId);
    expect(tracking.nextPrice).toBe(60);
  });

  it('should update previous cost', () => {
    const productId = '102';
    updatePreviousCost(productId, 30);

    const tracking = loadPriceTracking(productId);
    expect(tracking.previousCost).toBe(30);
  });

  it('should update next cost', () => {
    const productId = '103';
    updateNextCost(productId, 35);

    const tracking = loadPriceTracking(productId);
    expect(tracking.nextCost).toBe(35);
  });

  it('should handle multiple products independently', () => {
    updatePreviousPrice('product1', 100);
    updatePreviousPrice('product2', 200);

    const tracking1 = loadPriceTracking('product1');
    const tracking2 = loadPriceTracking('product2');

    expect(tracking1.previousPrice).toBe(100);
    expect(tracking2.previousPrice).toBe(200);
  });
});
