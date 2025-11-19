export const normalizeImageSrc = (raw: unknown, serverIP: string): string | undefined => {
  if (!raw) return undefined;
  const value = String(raw).trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;

  // Heuristic: long base64 string (must not look like a file path)
  // Base64 strings contain /, but file paths typically have :, ., or multiple consecutive /
  const looksLikeBase64 = /^[A-Za-z0-9+/=]{100,}$/.test(value) &&
                         !value.includes('://') &&
                         !value.includes('\\') &&
                         !/\.\w{2,4}$/.test(value); // not ending with file extension

  if (looksLikeBase64) {
    // Detect image format from base64 signature
    if (value.startsWith('iVBORw0')) {
      return `data:image/png;base64,${value}`;
    } else if (value.startsWith('/9j/')) {
      return `data:image/jpeg;base64,${value}`;
    }
    // Default fallback
    return `data:image/png;base64,${value}`;
  }

  if (value.startsWith('/')) {
    return `http://${serverIP}${value}`;
  }

  return undefined;
};

export const getImageSrcFromRecord = (record: unknown, serverIP: string): string | undefined => {
  if (!record || typeof record !== 'object') return undefined;

  const candidate =
    (record as Record<string, unknown>).imageUrl ??
    (record as Record<string, unknown>).url ??
    (record as Record<string, unknown>).imagePath ??
    (record as Record<string, unknown>).path ??
    (record as Record<string, unknown>).image;

  return normalizeImageSrc(candidate, serverIP);
};

const parsePriceValue = (value: unknown): number | undefined => {
  if (value == null) return undefined;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof value === 'object') {
    const bucket = value as Record<string, unknown>;
    return (
      parsePriceValue(bucket.value) ??
      parsePriceValue(bucket.amount) ??
      parsePriceValue(bucket.price)
    );
  }

  return undefined;
};

export const extractPrice = (record: unknown): number | undefined => {
  if (!record || typeof record !== 'object') return undefined;

  const source = record as Record<string, unknown>;
  const directCandidates = [
    source.salePrice,
    source.price,
    source.currentPrice,
    source.retailPrice,
    source.unitPrice,
    source.listPrice,
    source.stockPrice,
    source.price1,
    source.price2,
    source.price3,
    source.prices,
  ];

  for (const candidate of directCandidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  if (Array.isArray(source.productPrices)) {
    for (const item of source.productPrices as unknown[]) {
      const parsed = parsePriceValue(item);
      if (parsed !== undefined) {
        return parsed;
      }

      if (item && typeof item === 'object') {
        const entry = item as Record<string, unknown>;
        const nested =
          parsePriceValue(entry.value) ??
          parsePriceValue(entry.amount) ??
          parsePriceValue(entry.price);
        if (nested !== undefined) {
          return nested;
        }
      }
    }
  }

  return undefined;
};

export const extractCost = (record: unknown): number | undefined => {
  if (!record || typeof record !== 'object') return undefined;

  const source = record as Record<string, unknown>;
  const costCandidates = [
    source.cost,
    source.costPrice,
    source.purchasePrice,
    source.buyPrice,
    source.unitCost,
    source.baseCost,
  ];

  for (const candidate of costCandidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
};

export const formatPrice = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(2);
};
