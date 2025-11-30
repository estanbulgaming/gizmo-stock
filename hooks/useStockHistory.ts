import { useEffect, useState, useCallback } from 'react';
import type { StockChange } from '../types/stock';

export const STOCK_HISTORY_KEY = 'gizmo-stock-history';

const getStoredHistory = (): StockChange[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STOCK_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as StockChange[];
    }
    return [];
  } catch (error) {
    console.warn('stockHistory load failed', error);
    return [];
  }
};

const saveHistory = (history: StockChange[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STOCK_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('stockHistory save failed', error);
  }
};

type UseStockHistoryReturn = {
  stockChanges: StockChange[];
  addChanges: (changes: StockChange[]) => void;
  clearHistory: () => void;
};

export function useStockHistory(): UseStockHistoryReturn {
  const [stockChanges, setStockChanges] = useState<StockChange[]>(() => getStoredHistory());

  useEffect(() => {
    saveHistory(stockChanges);
  }, [stockChanges]);

  const addChanges = useCallback((changes: StockChange[]) => {
    setStockChanges(prev => [...prev, ...changes]);
  }, []);

  const clearHistory = useCallback(() => {
    setStockChanges([]);
  }, []);

  return { stockChanges, addChanges, clearHistory };
}
