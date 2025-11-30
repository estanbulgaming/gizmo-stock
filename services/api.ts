import { ApiConfig } from '../hooks/useApiConfig';
import { ProductGroup, StockData } from '../types/stock';
import { extractPrice, extractCost, getImageSrcFromRecord } from '../utils/product';

export interface ApiContext {
  apiConfig: ApiConfig;
  joinApi: (path: string) => string;
}

const authHeader = (config: ApiConfig): HeadersInit => ({
  Authorization: 'Basic ' + btoa(`${config.username}:${config.password}`),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const parseOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export interface FetchProductsResult {
  products: StockData[];
  totalProducts: number;
  totalStock: number;
}

export const fetchProductGroups = async ({ apiConfig, joinApi }: ApiContext): Promise<ProductGroup[]> => {
  const url = joinApi(apiConfig.groupsEndpoint);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...authHeader(apiConfig),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const payload = await response.json();
  const rawGroups = Array.isArray(payload?.result?.data) ? payload.result.data : [];
  const groups: ProductGroup[] = [];

  for (const entry of rawGroups) {
    if (!isRecord(entry)) {
      continue;
    }

    const isDeleted = Boolean(entry['isDeleted']);
    if (isDeleted) {
      continue;
    }

    groups.push({
      id: parseNumber(entry['id'], 0),
      name: parseString(entry['name'], 'İsimsiz Kategori'),
      description: parseOptionalString(entry['description']),
      displayOrder: parseNumber(entry['displayOrder'], 0),
      isDeleted,
    });
  }

  return groups;
};

export const fetchProducts = async (
  { apiConfig, joinApi }: ApiContext,
  productGroupIds?: number[]
): Promise<FetchProductsResult> => {
  const deletedParam = apiConfig.includeDeleted ? 'IsDeleted=true' : '';
  const groupParams = productGroupIds && productGroupIds.length > 0
    ? productGroupIds.map(id => `ProductGroupId=${id}`).join('&')
    : '';
  const baseUrl = `${joinApi(apiConfig.endpoint)}?${apiConfig.baseParams}&Pagination.Limit=${apiConfig.paginationLimit}`;
  const url = `${baseUrl}${deletedParam ? '&' + deletedParam : ''}${groupParams ? '&' + groupParams : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...authHeader(apiConfig),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const payload = await response.json();
  const rawProducts = Array.isArray(payload?.result?.data) ? payload.result.data : [];
  const products: StockData[] = [];

  for (const entry of rawProducts) {
    if (!isRecord(entry)) {
      continue;
    }

    const imagesField = entry['productImages'];
    const imageCandidates = Array.isArray(imagesField)
      ? imagesField.filter(isRecord)
      : [];
    const mainImage = imageCandidates.find((img) => Boolean(img['isMain'])) ?? imageCandidates[0];
    const imageRecord = mainImage ?? entry;
    const imageUrl = apiConfig.showProductImages
      ? getImageSrcFromRecord(imageRecord, apiConfig.serverIP)
      : undefined;
    const price = extractPrice(entry);
    const cost = extractCost(entry);
    const productGroupIdValue = entry['productGroupId'];
    const productId = String(entry['id'] ?? '');

    // Load price tracking from localStorage
    const priceTracking = loadPriceTracking(productId);

    products.push({
      id: productId,
      name: parseString(entry['name'], 'İsimsiz Ürün'),
      barcode: parseString(entry['barcode'], 'Barkod Yok'),
      count: Math.round(parseNumber(entry['stockProductAmount'], 0)),
      imageUrl,
      price: price ?? undefined,
      cost: cost ?? undefined,
      previousPrice: priceTracking.previousPrice,
      nextPrice: priceTracking.nextPrice,
      previousCost: priceTracking.previousCost,
      nextCost: priceTracking.nextCost,
      productGroupId:
        productGroupIdValue == null ? undefined : parseNumber(productGroupIdValue, 0),
      isDeleted: Boolean(entry['isDeleted']),
    });
  }

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, item) => sum + item.count, 0);

  return {
    products,
    totalProducts,
    totalStock,
  };
};

// Update product isDeleted status via PUT
const updateProductDeletedStatus = async (
  { apiConfig, joinApi }: ApiContext,
  productId: string,
  isDeleted: boolean
): Promise<void> => {
  // First fetch the product to get all required fields
  const getUrl = `${joinApi(`/v2.0/products/${productId}`)}?id=${productId}`;
  const getResponse = await fetch(getUrl, {
    method: 'GET',
    headers: {
      ...authHeader(apiConfig),
      'Content-Type': 'application/json',
    },
  });

  if (!getResponse.ok) {
    throw new Error(`HTTP error! status: ${getResponse.status}`);
  }

  const productData = await getResponse.json();
  const product = productData.result || productData;

  // Build update payload with required fields
  const updatedProduct = {
    id: product.id,
    productType: product.productType,
    guid: product.guid,
    productGroupId: product.productGroupId,
    name: product.name,
    productImages: product.productImages,
    price: product.price,
    cost: product.cost,
    barcode: product.barcode,
    isDeleted,
  };

  // Send PUT request to update product
  const putUrl = joinApi('/v2.0/products');
  const putResponse = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      ...authHeader(apiConfig),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedProduct),
  });

  if (!putResponse.ok) {
    throw new Error(`HTTP error! status: ${putResponse.status}`);
  }
};

export const deleteProduct = async (
  context: ApiContext,
  productId: string
): Promise<void> => {
  await updateProductDeletedStatus(context, productId, true);
};

export const restoreProduct = async (
  context: ApiContext,
  productId: string
): Promise<void> => {
  await updateProductDeletedStatus(context, productId, false);
};

export const fetchProductImageUrl = async (
  { apiConfig, joinApi }: ApiContext,
  productId: string,
  fallbackRecord?: unknown,
): Promise<string | undefined> => {
  const url = `${joinApi(`/v2.0/products/${productId}/images`)}?id=${productId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: authHeader(apiConfig),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const payload = await response.json();

  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.result)
      ? payload.result
      : Array.isArray(payload?.result?.data)
        ? payload.result.data
        : [];

  const records = rawList.filter(isRecord);
  const mainImage = records.find((img) => Boolean(img['isMain'])) ?? records[0];

  return (
    getImageSrcFromRecord(mainImage, apiConfig.serverIP) ??
    (fallbackRecord ? getImageSrcFromRecord(fallbackRecord, apiConfig.serverIP) : undefined)
  );
};

// Image cache localStorage functions
const IMAGE_CACHE_KEY = 'gizmo_image_cache';
const IMAGE_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface ImageCache {
  [productId: string]: {
    url: string;
    timestamp: number;
  };
}

const loadImageCache = (): ImageCache => {
  try {
    const stored = localStorage.getItem(IMAGE_CACHE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ImageCache;
  } catch {
    return {};
  }
};

const saveImageCache = (cache: ImageCache): void => {
  try {
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail
  }
};

export const getCachedImageUrl = (productId: string): string | undefined => {
  const cache = loadImageCache();
  const entry = cache[productId];
  if (!entry) return undefined;

  // Check if cache is expired
  if (Date.now() - entry.timestamp > IMAGE_CACHE_EXPIRY) {
    return undefined;
  }
  return entry.url;
};

export const setCachedImageUrl = (productId: string, url: string): void => {
  const cache = loadImageCache();
  cache[productId] = { url, timestamp: Date.now() };
  saveImageCache(cache);
};

// Product list cache localStorage functions
const PRODUCTS_CACHE_KEY = 'gizmo_products_cache';
const PRODUCTS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface ProductsCache {
  products: StockData[];
  timestamp: number;
}

export const getCachedProducts = (): StockData[] | null => {
  try {
    const stored = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!stored) return null;
    const cache = JSON.parse(stored) as ProductsCache;

    // Check if cache is expired
    if (Date.now() - cache.timestamp > PRODUCTS_CACHE_EXPIRY) {
      return null;
    }
    return cache.products;
  } catch {
    return null;
  }
};

export const setCachedProducts = (products: StockData[]): void => {
  try {
    const cache: ProductsCache = { products, timestamp: Date.now() };
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail
  }
};

// Price tracking localStorage functions
const PRICE_TRACKING_KEY = 'gizmo_price_tracking';

interface PriceTracking {
  previousPrice?: number;
  nextPrice?: number;
  previousCost?: number;
  nextCost?: number;
}

interface PriceTrackingStorage {
  [productId: string]: PriceTracking;
}

const loadAllPriceTracking = (): PriceTrackingStorage => {
  try {
    const stored = localStorage.getItem(PRICE_TRACKING_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as PriceTrackingStorage;
  } catch {
    return {};
  }
};

const saveAllPriceTracking = (data: PriceTrackingStorage): void => {
  try {
    localStorage.setItem(PRICE_TRACKING_KEY, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

export const loadPriceTracking = (productId: string): PriceTracking => {
  const all = loadAllPriceTracking();
  return all[productId] ?? {};
};

export const savePriceTracking = (
  productId: string,
  tracking: Partial<PriceTracking>,
): void => {
  const all = loadAllPriceTracking();
  all[productId] = { ...all[productId], ...tracking };
  saveAllPriceTracking(all);
};

export const updatePreviousPrice = (productId: string, price: number): void => {
  savePriceTracking(productId, { previousPrice: price });
};

export const updateNextPrice = (productId: string, price: number): void => {
  savePriceTracking(productId, { nextPrice: price });
};

export const updatePreviousCost = (productId: string, cost: number): void => {
  savePriceTracking(productId, { previousCost: cost });
};

export const updateNextCost = (productId: string, cost: number): void => {
  savePriceTracking(productId, { nextCost: cost });
};
