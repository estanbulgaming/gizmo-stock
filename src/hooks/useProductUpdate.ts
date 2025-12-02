import { useCallback } from 'react';
import { ApiConfig } from './useApiConfig';

type LogLevel = 'info' | 'success' | 'warning' | 'error';
type AddLogFn = (level: LogLevel, category: string, message: string, details?: unknown) => void;

interface ProductUpdatePayload {
  id: number;
  productType: number;
  guid: string;
  productImages: unknown[];
  productGroupId: number;
  name: string;
  price: number;
  cost: number;
  barcode: string;
}

interface UseProductUpdateOptions {
  apiConfig: ApiConfig;
  joinApi: (path: string) => string;
  addLog: AddLogFn;
}

interface ProductUpdateResult {
  updateStock: (productId: string, newStockCount: number) => Promise<unknown>;
  updatePrice: (productId: string, newPrice: number) => Promise<unknown>;
  updateCost: (productId: string, newCost: number) => Promise<unknown>;
  updateBarcode: (productId: string, newBarcode: string) => Promise<unknown>;
  updateName: (productId: string, newName: string) => Promise<unknown>;
  updateProduct: (productId: string, updates: Partial<Pick<ProductUpdatePayload, 'price' | 'cost' | 'barcode' | 'name'>>) => Promise<unknown>;
}

/**
 * Hook for updating product data via Gizmo API
 *
 * IMPORTANT: Gizmo API PUT /v2.0/products requires ALL fields:
 * id, productType, guid, productImages, productGroupId, name, price, cost, barcode
 * Partial updates are NOT supported - missing fields will be set to default values.
 */
export function useProductUpdate({ apiConfig, joinApi, addLog }: UseProductUpdateOptions): ProductUpdateResult {
  const getAuthHeader = useCallback(() => {
    return 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`);
  }, [apiConfig.username, apiConfig.password]);

  /**
   * Fetch product data from API
   */
  const fetchProduct = useCallback(async (productId: string, category: string): Promise<ProductUpdatePayload> => {
    const url = joinApi(`/v2.0/products/${productId}`);
    addLog('info', category, `Ürün bilgisi alınıyor: ID ${productId}`, { url });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      addLog('error', category, `GET request failed: ${response.status}`, { url, status: response.status, errorText });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const productData = await response.json();
    // API response returns data in result object
    const product = productData.result || productData;
    addLog('info', category, `Ürün bilgisi alındı: ID ${productId}`, { product });

    return product;
  }, [joinApi, addLog, getAuthHeader]);

  /**
   * Update product via PUT request (requires ALL fields)
   */
  const putProduct = useCallback(async (payload: ProductUpdatePayload, category: string, description: string): Promise<unknown> => {
    const url = joinApi('/v2.0/products');
    addLog('info', category, description, { url, body: payload });

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      addLog('error', category, `PUT request failed: ${response.status}`, { url, status: response.status, errorText });
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const result = await response.json().catch(() => ({ success: true }));
    return result;
  }, [joinApi, addLog, getAuthHeader]);

  /**
   * Update stock count (simple POST endpoint)
   */
  const updateStock = useCallback(async (productId: string, newStockCount: number): Promise<unknown> => {
    const category = 'STOCK_API';
    const url = joinApi(`/stock/${productId}/${newStockCount}`);

    try {
      addLog('info', category, `Stok güncelleniyor: ID ${productId} → ${newStockCount}`, { url });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addLog('success', category, `Stok güncellendi: ID ${productId} → ${newStockCount}`);
      const result = await response.json().catch(() => ({ success: true }));
      return result;
    } catch (error) {
      addLog('error', category, `Stok güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [joinApi, addLog, getAuthHeader]);

  /**
   * Update product price (requires GET then PUT with all fields)
   */
  const updatePrice = useCallback(async (productId: string, newPrice: number): Promise<unknown> => {
    const category = 'PRICE_API';
    try {
      const product = await fetchProduct(productId, category);

      const updatedProduct: ProductUpdatePayload = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: newPrice,
        cost: product.cost,
        barcode: product.barcode,
      };

      const result = await putProduct(updatedProduct, category, `Fiyat güncelleniyor: ID ${productId} → ${newPrice}`);
      addLog('success', category, `Fiyat güncellendi: ID ${productId} → ${newPrice}`);
      return result;
    } catch (error) {
      addLog('error', category, `Fiyat güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [fetchProduct, putProduct, addLog]);

  /**
   * Update product cost (requires GET then PUT with all fields)
   */
  const updateCost = useCallback(async (productId: string, newCost: number): Promise<unknown> => {
    const category = 'COST_API';
    try {
      const product = await fetchProduct(productId, category);

      const updatedProduct: ProductUpdatePayload = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: product.price,
        cost: newCost,
        barcode: product.barcode,
      };

      const result = await putProduct(updatedProduct, category, `Maliyet güncelleniyor: ID ${productId} → ${newCost}`);
      addLog('success', category, `Maliyet güncellendi: ID ${productId} → ${newCost}`);
      return result;
    } catch (error) {
      addLog('error', category, `Maliyet güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [fetchProduct, putProduct, addLog]);

  /**
   * Update product barcode (requires GET then PUT with all fields)
   */
  const updateBarcode = useCallback(async (productId: string, newBarcode: string): Promise<unknown> => {
    const category = 'BARCODE_API';
    try {
      const product = await fetchProduct(productId, category);

      const updatedProduct: ProductUpdatePayload = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: product.price,
        cost: product.cost,
        barcode: newBarcode,
      };

      const result = await putProduct(updatedProduct, category, `Barkod güncelleniyor: ID ${productId} → ${newBarcode}`);
      addLog('success', category, `Barkod güncellendi: ID ${productId} → ${newBarcode}`);
      return result;
    } catch (error) {
      addLog('error', category, `Barkod güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [fetchProduct, putProduct, addLog]);

  /**
   * Update product name (requires GET then PUT with all fields)
   */
  const updateName = useCallback(async (productId: string, newName: string): Promise<unknown> => {
    const category = 'NAME_API';
    try {
      const product = await fetchProduct(productId, category);

      const updatedProduct: ProductUpdatePayload = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: newName,
        price: product.price,
        cost: product.cost,
        barcode: product.barcode,
      };

      const result = await putProduct(updatedProduct, category, `İsim güncelleniyor: ID ${productId} → ${newName}`);
      addLog('success', category, `İsim güncellendi: ID ${productId} → ${newName}`);
      return result;
    } catch (error) {
      addLog('error', category, `İsim güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [fetchProduct, putProduct, addLog]);

  /**
   * Update multiple product fields at once (single GET/PUT round trip)
   */
  const updateProduct = useCallback(async (
    productId: string,
    updates: Partial<Pick<ProductUpdatePayload, 'price' | 'cost' | 'barcode' | 'name'>>
  ): Promise<unknown> => {
    const category = 'PRODUCT_API';
    try {
      const product = await fetchProduct(productId, category);

      const updatedProduct: ProductUpdatePayload = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: updates.name ?? product.name,
        price: updates.price ?? product.price,
        cost: updates.cost ?? product.cost,
        barcode: updates.barcode ?? product.barcode,
      };

      const result = await putProduct(updatedProduct, category, `Ürün güncelleniyor: ID ${productId}`);
      addLog('success', category, `Ürün güncellendi: ID ${productId}`, updates);
      return result;
    } catch (error) {
      addLog('error', category, `Ürün güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  }, [fetchProduct, putProduct, addLog]);

  return {
    updateStock,
    updatePrice,
    updateCost,
    updateBarcode,
    updateName,
    updateProduct,
  };
}
