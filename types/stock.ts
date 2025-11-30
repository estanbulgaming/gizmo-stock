export interface StockData {
  id: string;
  name: string;
  barcode: string;
  count: number;
  price?: number;
  cost?: number;
  previousPrice?: number;
  nextPrice?: number;
  previousCost?: number;
  nextCost?: number;
  imageUrl?: string;
  productGroupId?: number;
  isDeleted?: boolean;
}

export interface StockChange {
  id: string;
  date: string;
  productName: string;
  change: number;
  reason: string;
  previousCount: number;
  countedValue?: number;
  addedValue?: number;
  finalCount: number;
  previousPrice?: number;
  newPrice?: number;
  priceChange?: number;
  previousCost?: number;
  newCost?: number;
  costChange?: number;
  previousBarcode?: string;
  newBarcode?: string;
}

export interface ProductGroup {
  id: number;
  name: string;
  description?: string;
  displayOrder: number;
  isDeleted: boolean;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  category: string;
  message: string;
  details?: unknown;
}
