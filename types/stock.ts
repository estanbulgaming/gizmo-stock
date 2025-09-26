export interface StockData {
  id: string;
  name: string;
  barcode: string;
  count: number;
  price?: number;
  imageUrl?: string;
  productGroupId?: number;
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
}

export interface DailyReport {
  date: string;
  totalProducts: number;
  totalCounted: number;
  totalAdded: number;
  totalChanged: number;
  totalPriceChanges: number;
  changes: StockChange[];
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
