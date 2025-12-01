import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProductUpdate } from './useProductUpdate';
import { ApiConfig } from './useApiConfig';

describe('useProductUpdate', () => {
  const mockApiConfig: ApiConfig = {
    serverIP: '192.168.1.5',
    username: 'testuser',
    password: 'testpass',
    endpoint: '/v2.0/products',
    groupsEndpoint: '/v2.0/productgroups',
    paginationLimit: 500,
    baseParams: 'EnableStock=true',
    includeDeleted: false,
    showProductImages: true,
  };

  const mockJoinApi = (path: string) => `http://192.168.1.5/api${path}`;
  const mockAddLog = vi.fn();

  const mockProduct = {
    id: 123,
    productType: 1,
    guid: 'test-guid-123',
    productImages: [],
    productGroupId: 5,
    name: 'Test Product',
    price: 100,
    cost: 50,
    barcode: '1234567890',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockAddLog.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('updateStock', () => {
    it('should update stock via POST endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateStock('123', 50);

      expect(fetch).toHaveBeenCalledWith(
        'http://192.168.1.5/api/stock/123/50',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
          }),
        })
      );
      expect(mockAddLog).toHaveBeenCalledWith('success', 'STOCK_API', expect.any(String));
    });

    it('should throw and log error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await expect(result.current.updateStock('123', 50)).rejects.toThrow('HTTP error! status: 500');
      expect(mockAddLog).toHaveBeenCalledWith('error', 'STOCK_API', expect.any(String), expect.any(Error));
    });
  });

  describe('updatePrice', () => {
    it('should fetch product then update price via PUT', async () => {
      // First call: GET product
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: mockProduct }),
      } as Response);
      // Second call: PUT product
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updatePrice('123', 150);

      // Verify GET call
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'http://192.168.1.5/api/v2.0/products/123',
        expect.objectContaining({ method: 'GET' })
      );

      // Verify PUT call with ALL fields
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'http://192.168.1.5/api/v2.0/products',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            id: 123,
            productType: 1,
            guid: 'test-guid-123',
            productImages: [],
            productGroupId: 5,
            name: 'Test Product',
            price: 150, // Updated
            cost: 50,
            barcode: '1234567890',
          }),
        })
      );
    });

    it('should include all required fields in PUT payload', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updatePrice('123', 200);

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      // Verify all required fields are present
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('productType');
      expect(body).toHaveProperty('guid');
      expect(body).toHaveProperty('productImages');
      expect(body).toHaveProperty('productGroupId');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('price');
      expect(body).toHaveProperty('cost');
      expect(body).toHaveProperty('barcode');
    });
  });

  describe('updateCost', () => {
    it('should update cost while preserving other fields', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateCost('123', 75);

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      expect(body.cost).toBe(75);
      expect(body.price).toBe(100); // Preserved
      expect(body.name).toBe('Test Product'); // Preserved
    });
  });

  describe('updateBarcode', () => {
    it('should update barcode while preserving other fields', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateBarcode('123', '9999999999');

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      expect(body.barcode).toBe('9999999999');
      expect(body.price).toBe(100); // Preserved
    });
  });

  describe('updateName', () => {
    it('should update name while preserving other fields', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateName('123', 'New Product Name');

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      expect(body.name).toBe('New Product Name');
      expect(body.price).toBe(100); // Preserved
    });
  });

  describe('updateProduct (batch update)', () => {
    it('should update multiple fields in single request', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateProduct('123', {
        price: 200,
        cost: 100,
        name: 'Updated Name',
      });

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      expect(body.price).toBe(200);
      expect(body.cost).toBe(100);
      expect(body.name).toBe('Updated Name');
      expect(body.barcode).toBe('1234567890'); // Preserved
    });

    it('should only update specified fields', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await result.current.updateProduct('123', { price: 300 });

      const putCall = vi.mocked(fetch).mock.calls[1];
      const body = JSON.parse(putCall[1]?.body as string);

      expect(body.price).toBe(300);
      expect(body.cost).toBe(50); // Preserved from original
      expect(body.name).toBe('Test Product'); // Preserved
      expect(body.barcode).toBe('1234567890'); // Preserved
    });
  });

  describe('error handling', () => {
    it('should handle GET failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await expect(result.current.updatePrice('999', 100)).rejects.toThrow('HTTP error! status: 404');
      expect(mockAddLog).toHaveBeenCalledWith('error', 'PRICE_API', expect.stringContaining('GET request failed'), expect.any(Object));
    });

    it('should handle PUT failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ result: mockProduct }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad request'),
        } as Response);

      const { result } = renderHook(() =>
        useProductUpdate({
          apiConfig: mockApiConfig,
          joinApi: mockJoinApi,
          addLog: mockAddLog,
        })
      );

      await expect(result.current.updatePrice('123', 100)).rejects.toThrow('HTTP error! status: 400');
    });
  });
});
