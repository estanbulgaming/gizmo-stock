import { ApiConfig } from '../hooks/useApiConfig';
import { ProductGroup, StockData } from '../types/stock';
import { extractPrice, getImageSrcFromRecord } from '../utils/product';

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

export const fetchProducts = async ({ apiConfig, joinApi }: ApiContext): Promise<FetchProductsResult> => {
  const deletedParam = apiConfig.includeDeleted ? 'IsDeleted=true' : 'IsDeleted=false';
  const url = `${joinApi(apiConfig.endpoint)}?${deletedParam}&${apiConfig.baseParams}&Pagination.Limit=${apiConfig.paginationLimit}`;

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
    const productGroupIdValue = entry['productGroupId'];

    products.push({
      id: String(entry['id'] ?? ''),
      name: parseString(entry['name'], 'İsimsiz Ürün'),
      barcode: parseString(entry['barcode'], 'Barkod Yok'),
      count: Math.round(parseNumber(entry['stockProductAmount'], 0)),
      imageUrl,
      price: price ?? undefined,
      productGroupId:
        productGroupIdValue == null ? undefined : parseNumber(productGroupIdValue, 0),
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
