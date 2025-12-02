import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiConfig, DEFAULT_API_CONFIG, API_CONFIG_STORAGE_KEY } from './useApiConfig';

describe('useApiConfig', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return default config when localStorage is empty', () => {
    const { result } = renderHook(() => useApiConfig());

    expect(result.current[0]).toEqual(DEFAULT_API_CONFIG);
  });

  it('should load saved config from localStorage', () => {
    const savedConfig = {
      ...DEFAULT_API_CONFIG,
      serverIP: '192.168.1.100',
      username: 'testuser',
    };
    window.localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(savedConfig));

    const { result } = renderHook(() => useApiConfig());

    expect(result.current[0].serverIP).toBe('192.168.1.100');
    expect(result.current[0].username).toBe('testuser');
  });

  it('should persist config changes to localStorage', async () => {
    const { result } = renderHook(() => useApiConfig());

    act(() => {
      result.current[1]({
        ...result.current[0],
        serverIP: '10.0.0.1',
      });
    });

    // Wait for debounced localStorage save (300ms)
    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        API_CONFIG_STORAGE_KEY,
        expect.stringContaining('10.0.0.1')
      );
    }, { timeout: 500 });
  });

  it('should merge partial saved config with defaults', () => {
    window.localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify({
      serverIP: '192.168.1.50',
    }));

    const { result } = renderHook(() => useApiConfig());

    expect(result.current[0].serverIP).toBe('192.168.1.50');
    expect(result.current[0].endpoint).toBe(DEFAULT_API_CONFIG.endpoint);
    expect(result.current[0].paginationLimit).toBe(DEFAULT_API_CONFIG.paginationLimit);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    window.localStorage.setItem(API_CONFIG_STORAGE_KEY, 'invalid-json');

    const { result } = renderHook(() => useApiConfig());

    expect(result.current[0]).toEqual(DEFAULT_API_CONFIG);
  });

  it('should update config correctly', () => {
    const { result } = renderHook(() => useApiConfig());

    act(() => {
      result.current[1](prev => ({
        ...prev,
        paginationLimit: 100,
        includeDeleted: true,
      }));
    });

    expect(result.current[0].paginationLimit).toBe(100);
    expect(result.current[0].includeDeleted).toBe(true);
  });
});
