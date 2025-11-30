import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStockHistory, STOCK_HISTORY_KEY } from './useStockHistory';
import type { StockChange } from '../types/stock';

const mockChange: StockChange = {
  id: '1',
  date: '30.11.2024',
  productName: 'Test Product',
  change: 5,
  reason: 'Sayim',
  previousCount: 10,
  countedValue: 15,
  finalCount: 15,
};

describe('useStockHistory', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should return empty array when localStorage is empty', () => {
    const { result } = renderHook(() => useStockHistory());
    expect(result.current.stockChanges).toEqual([]);
  });

  it('should load saved history from localStorage', () => {
    const savedHistory = [mockChange];
    window.localStorage.setItem(STOCK_HISTORY_KEY, JSON.stringify(savedHistory));

    const { result } = renderHook(() => useStockHistory());
    expect(result.current.stockChanges).toEqual(savedHistory);
  });

  it('should add changes to history', () => {
    const { result } = renderHook(() => useStockHistory());

    act(() => {
      result.current.addChanges([mockChange]);
    });

    expect(result.current.stockChanges).toHaveLength(1);
    expect(result.current.stockChanges[0]).toEqual(mockChange);
  });

  it('should persist changes to localStorage', () => {
    const { result } = renderHook(() => useStockHistory());

    act(() => {
      result.current.addChanges([mockChange]);
    });

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STOCK_HISTORY_KEY,
      expect.stringContaining(mockChange.productName)
    );
  });

  it('should add multiple changes at once', () => {
    const { result } = renderHook(() => useStockHistory());

    const changes: StockChange[] = [
      mockChange,
      { ...mockChange, id: '2', productName: 'Product 2' },
      { ...mockChange, id: '3', productName: 'Product 3' },
    ];

    act(() => {
      result.current.addChanges(changes);
    });

    expect(result.current.stockChanges).toHaveLength(3);
  });

  it('should append to existing history', () => {
    const { result } = renderHook(() => useStockHistory());

    act(() => {
      result.current.addChanges([mockChange]);
    });

    act(() => {
      result.current.addChanges([{ ...mockChange, id: '2', productName: 'Product 2' }]);
    });

    expect(result.current.stockChanges).toHaveLength(2);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useStockHistory());

    act(() => {
      result.current.addChanges([mockChange]);
    });

    expect(result.current.stockChanges).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.stockChanges).toHaveLength(0);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    window.localStorage.setItem(STOCK_HISTORY_KEY, 'invalid-json');

    const { result } = renderHook(() => useStockHistory());
    expect(result.current.stockChanges).toEqual([]);
  });

  it('should handle non-array JSON in localStorage gracefully', () => {
    window.localStorage.setItem(STOCK_HISTORY_KEY, JSON.stringify({ not: 'an array' }));

    const { result } = renderHook(() => useStockHistory());
    expect(result.current.stockChanges).toEqual([]);
  });
});
