import React, { useEffect, useState, useMemo, useCallback, useDeferredValue } from 'react';

import { NumpadInput } from './components/NumpadInput';



import { Card } from './components/ui/card';

import { Button } from './components/ui/button';

import { Input } from './components/ui/input';

import { Label } from './components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

import { Checkbox } from './components/ui/checkbox';

import { Download, Settings, RefreshCw, Eye, EyeOff, X, Search, ImageIcon, Filter, Terminal, Trash2, Copy, Undo2, Check, ChevronDown, RotateCcw } from 'lucide-react';

import { Progress } from './components/ui/progress';

import { ImageWithFallback } from './components/figma/ImageWithFallback';

import { t, getLang, setLang, availableLanguages, languageNames, Lang } from './i18n';

import { DEFAULT_API_CONFIG, useApiConfig } from './hooks/useApiConfig';
import { useToast } from './hooks/useToast';
import { useCountingSession, downloadSessionReport } from './hooks/useCountingSession';
import { ToastContainer } from './components/Toast';
import { CountingPage } from './components/pages/CountingPage';
import { SettingsPage } from './components/pages/SettingsPage';

import { formatPrice } from './utils/product';
import { ProductGroup, StockChange, StockData, SystemLogEntry } from './types/stock';
import { fetchProductGroups as fetchProductGroupsService, fetchProducts as fetchProductsService, fetchProductImageUrl, deleteProduct, restoreProduct, updatePreviousPrice, updateNextPrice, updatePreviousCost, updateNextCost, getCachedImageUrl, setCachedImageUrl, updateEnableStock } from './services/api';



export default function App() {

  const [stockData, setStockData] = useState<StockData[]>([]);

  const [countedValues, setCountedValues] = useState<{ [key: string]: number | '' }>({});

  const [addedValues, setAddedValues] = useState<{ [key: string]: number | '' }>({});

  const [priceValues, setPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [previousPriceValues, setPreviousPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [nextPriceValues, setNextPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [costValues, setCostValues] = useState<{ [key: string]: number | '' }>({});

  const [previousCostValues, _setPreviousCostValues] = useState<{ [key: string]: number | '' }>({});

  const [nextCostValues, _setNextCostValues] = useState<{ [key: string]: number | '' }>({});

  const [barcodeValues, setBarcodeValues] = useState<{ [key: string]: string }>({});

  const [nameValues, setNameValues] = useState<{ [key: string]: string }>({});

  const [wasteValues, setWasteValues] = useState<{ [key: string]: number | '' }>({});

  const [countedProductIds, setCountedProductIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('gizmo-counted-product-ids');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  });

  const { toasts, showToast, dismissToast } = useToast();
  const { session, isSessionActive, startSession, endSession, addChange } = useCountingSession();

  // Save countedProductIds to localStorage
  useEffect(() => {
    if (isSessionActive && countedProductIds.size > 0) {
      localStorage.setItem('gizmo-counted-product-ids', JSON.stringify([...countedProductIds]));
    } else if (!isSessionActive) {
      localStorage.removeItem('gizmo-counted-product-ids');
    }
  }, [countedProductIds, isSessionActive]);

  const [currentPage, setCurrentPage] = useState<'stock' | 'counting' | 'settings'>('stock');

  

  // API Configuration states

  const [apiConfig, setApiConfig] = useApiConfig(DEFAULT_API_CONFIG);

  // Explicit login state - requires manual login button click
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Language state - triggers re-render when language changes
  const [currentLanguage, setCurrentLanguage] = useState<Lang>(getLang());


  // Build API base URL from serverIP
  const apiBase = apiConfig.serverIP ? `http://${apiConfig.serverIP}/api` : '';

  const joinApi = (path: string) => {
    let p = (path || '').trim();
    if (!p.startsWith('/')) p = '/' + p;
    return `${apiBase}${p}`;
  };



  // Queue-based image loading to prevent ERR_INSUFFICIENT_RESOURCES
  const [imageLoadingQueue, setImageLoadingQueue] = useState<string[]>([]);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Process image loading queue - one image at a time with delay
  useEffect(() => {
    if (!apiConfig.showProductImages || imageLoadingQueue.length === 0) return;

    const productId = imageLoadingQueue[0];
    if (loadedImages.has(productId)) {
      setImageLoadingQueue(prev => prev.slice(1));
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadImage = async () => {
      // Check cache first
      const cachedUrl = getCachedImageUrl(productId);
      if (cachedUrl) {
        if (isCancelled) return;
        setStockData(prev => prev.map(item =>
          item.id === productId ? { ...item, imageUrl: cachedUrl } : item
        ));
        setLoadedImages(prev => new Set(prev).add(productId));
        setImageLoadingQueue(prev => prev.slice(1));
        return;
      }

      const product = stockData.find(p => p.id === productId);
      if (!product) {
        if (isCancelled) return;
        setImageLoadingQueue(prev => prev.slice(1));
        return;
      }

      try {
        const imageUrl = await fetchProductImageUrl({ apiConfig, joinApi }, productId, product);
        if (isCancelled) return;
        if (imageUrl) {
          setCachedImageUrl(productId, imageUrl);
          setStockData(prev => prev.map(item =>
            item.id === productId ? { ...item, imageUrl } : item
          ));
        }
      } catch {
        // Silent fail
      }

      if (isCancelled) return;
      setLoadedImages(prev => new Set(prev).add(productId));
      // Wait before next image
      timeoutId = setTimeout(() => {
        if (isCancelled) return;
        setImageLoadingQueue(prev => prev.slice(1));
      }, 300);
    };

    loadImage();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [imageLoadingQueue, apiConfig.showProductImages, apiConfig, joinApi, stockData, loadedImages]);

  // Queue first 10 images when products load
  useEffect(() => {
    if (!apiConfig.showProductImages || stockData.length === 0) return;

    const idsToLoad = stockData
      .filter(p => !p.imageUrl && !loadedImages.has(p.id))
      .slice(0, 10)
      .map(p => p.id);

    if (idsToLoad.length > 0) {
      setImageLoadingQueue(idsToLoad);
    }
  }, [stockData, apiConfig.showProductImages, loadedImages]);

  // Load a single product image on demand (when user clicks "Show" button)
  const loadProductImage = useCallback((productId: string) => {
    if (!loadedImages.has(productId) && !imageLoadingQueue.includes(productId)) {
      setImageLoadingQueue(prev => [...prev, productId]);
    }
  }, [loadedImages, imageLoadingQueue]);

  const [showPassword, setShowPassword] = useState(false);

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);

  const [selectedProductGroups, setSelectedProductGroups] = useState<number[]>([]);

  const [activeProductGroupFilter, setActiveProductGroupFilter] = useState<number | null>(null);

  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });

  // Live stock fetch (GET /api/stock/:id) states

  const [isFetchingStocks, setIsFetchingStocks] = useState(false);

  const [stockFetchProgress, setStockFetchProgress] = useState({ current: 0, total: 0 });



  // System Logs

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);





  const handleCountedChange = useCallback((id: string, countedValue: number | '') => {
    setCountedValues(prev => ({
      ...prev,
      [id]: countedValue
    }));
  }, []);



  // Single product stock fetch (GET /api/stock/:id)

  const fetchStockById = async (productId: string) => {
    const url = `${apiBase}/stock/${productId}`;
    addLog('info', 'STOCK_GET', `Stok sorgulanıyor: ID ${productId}`, { url });
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Try JSON first; fallback to plain text number
    let text: string | null = null;
    try {
      const data = await response.json();
      const resultValue =
        typeof data === 'object' && data !== null && 'result' in data
          ? (data as Record<string, unknown>).result
          : data;
      const numeric = Number(resultValue);
      if (Number.isFinite(numeric)) return Math.round(numeric);
      text = JSON.stringify(resultValue);
    } catch {
      // ignore JSON parse error, try as text
    }
    if (text == null) text = (await response.text())?.trim();
    const num = Number((text || '').toString().trim());
    if (!Number.isFinite(num)) {
      throw new Error('Invalid stock response');
    }
    return Math.round(num);
  };



  // Batch fetch stocks for a list of product IDs with progress (similar to update batch)

  const fetchStocksForProducts = async (ids: string[]) => {

    if (!ids || ids.length === 0) return;

    setIsFetchingStocks(true);

    setStockFetchProgress({ current: 0, total: ids.length });

    addLog('info', 'STOCK_GET_BATCH', `${ids.length} ürünün stokları çekiliyor...`);

    const concurrency = 5;

    let success = 0;

    let failed = 0;

    try {

      for (let i = 0; i < ids.length; i += concurrency) {

        const batch = ids.slice(i, i + concurrency);

        await Promise.all(

          batch.map(async (id) => {

            try {

              const stock = await fetchStockById(id);

              setStockData((prev) => prev.map((p) => (p.id === id ? { ...p, count: stock } : p)));

              addLog('success', 'STOCK_GET', `Stok alındı: ${id} -> ${stock}`);

              success += 1;

            } catch (error) {

              addLog('warning', 'STOCK_GET', `Stok alınamadı: ${id}`, error);

              failed += 1;

            } finally {

              setStockFetchProgress((prev) => ({ ...prev, current: prev.current + 1 }));

            }

          })

        );

      }

    } finally {

      addLog('info', 'STOCK_GET_BATCH', `Stok çekimi tamamlandı. Başarılı: ${success}, Başarısız: ${failed}`);

      setIsFetchingStocks(false);

      setStockFetchProgress({ current: 0, total: 0 });

    }

  };



  const handleAddedChange = useCallback((id: string, addedValue: number | '') => {
    setAddedValues(prev => ({
      ...prev,
      [id]: addedValue
    }));
  }, []);

  const handlePriceChange = useCallback((id: string, value: number | '') => {
    setPriceValues(prev => ({
      ...prev,
      [id]: value
    }));
  }, []);

  const handleCostChange = useCallback((id: string, value: number | '') => {
    setCostValues(prev => ({
      ...prev,
      [id]: value
    }));
  }, []);

  const handleBarcodeChange = useCallback((id: string, value: string) => {
    setBarcodeValues(prev => ({
      ...prev,
      [id]: value
    }));
  }, []);

  const handleNameChange = useCallback((id: string, value: string) => {
    setNameValues(prev => ({
      ...prev,
      [id]: value
    }));
  }, []);



  const _handlePreviousPriceChange = (id: string, inputValue: string) => {

    const normalized = inputValue.replace(',', '.').trim();

    if (normalized === '') {

      setPreviousPriceValues(prev => ({

        ...prev,

        [id]: ''

      }));

      return;

    }



    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {

      return;

    }



    setPreviousPriceValues(prev => ({

      ...prev,

      [id]: parsed

    }));

  };



  const _handleNextPriceChange = (id: string, inputValue: string) => {

    const normalized = inputValue.replace(',', '.').trim();

    if (normalized === '') {

      setNextPriceValues(prev => ({

        ...prev,

        [id]: ''

      }));

      return;

    }



    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {

      return;

    }



    setNextPriceValues(prev => ({

      ...prev,

      [id]: parsed

    }));

  };



  // Logging function

  const addLog = (level: 'info' | 'success' | 'warning' | 'error', category: string, message: string, details?: unknown) => {

    const logEntry: SystemLogEntry = {

      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),

      timestamp: new Date().toLocaleString('tr-TR'),

      level,

      category,

      message,

      details

    };

    

    setSystemLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep only last 100 logs

    

    // Also log to browser console for development

    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';

    console[consoleMethod](`[${category}] ${message}`, details || '');

  };



  // Stock Update API Function

  const updateProductStock = async (productId: string, newStockCount: number) => {

    try {

      const url = joinApi(`/stock/${productId}/${newStockCount}`);

      addLog('info', 'STOCK_API', `Stok güncelleniyor: ID ${productId} → ${newStockCount}`, { url });

      const response = await fetch(url, {

        method: 'POST',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

      });

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', 'STOCK_API', `HTTP ${response.status} hatası`, { status: response.status, body: errorText });
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      addLog('success', 'STOCK_API', `Stok güncellendi: ID ${productId} → ${newStockCount}`);

      const result = await response.json().catch(() => ({ success: true }));

      return result;

      

    } catch (error) {

      addLog('error', 'STOCK_API', `Stok güncellenemedi: ID ${productId}`, error);

      throw error;

    }

  };



  const updateProductPrice = async (productId: string, newPriceValue: number) => {

    try {

      // Önce ürün bilgisini al
      const getUrl = joinApi(`/v2.0/products/${productId}`);

      addLog('info', 'PRICE_API', `Ürün bilgisi alınıyor: ID ${productId}`, { getUrl });

      const getResponse = await fetch(getUrl, {

        method: 'GET',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

      });

      if (!getResponse.ok) {

        const errorText = await getResponse.text();

        addLog('error', 'PRICE_API', `GET request failed: ${getResponse.status}`, { url: getUrl, status: getResponse.status, errorText });

        throw new Error(`HTTP error! status: ${getResponse.status}, body: ${errorText}`);

      }

      const productData = await getResponse.json();

      addLog('info', 'PRICE_API', `Ürün bilgisi alındı: ID ${productId}`, { productData });

      // API response'u result objesi içinde dönüyor
      const product = productData.result || productData;

      // Tüm gerekli alanlarla PUT isteği gönder
      const updatedProduct = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: newPriceValue,
        cost: product.cost,
        barcode: product.barcode
      };

      const putUrl = joinApi('/v2.0/products');

      addLog('info', 'PRICE_API', `Fiyat guncelleniyor: ID ${productId} -> ${newPriceValue}`, { putUrl, body: updatedProduct });

      const putResponse = await fetch(putUrl, {

        method: 'PUT',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

        body: JSON.stringify(updatedProduct),

      });

      if (!putResponse.ok) {

        const errorText = await putResponse.text();

        addLog('error', 'PRICE_API', `PUT request failed: ${putResponse.status}`, { url: putUrl, status: putResponse.status, errorText });

        throw new Error(`HTTP error! status: ${putResponse.status}, body: ${errorText}`);

      }

      addLog('success', 'PRICE_API', `Fiyat guncellendi: ID ${productId} -> ${newPriceValue}`);

      const result = await putResponse.json().catch(() => ({ success: true }));

      return result;

    } catch (error) {

      addLog('error', 'PRICE_API', `Fiyat guncellenemedi: ID ${productId}`, error);

      throw error;

    }

  };



  const updateProductCost = async (productId: string, newCostValue: number) => {

    try {

      // Önce ürün bilgisini al
      const getUrl = joinApi(`/v2.0/products/${productId}`);

      addLog('info', 'COST_API', `Ürün bilgisi alınıyor: ID ${productId}`, { getUrl });

      const getResponse = await fetch(getUrl, {

        method: 'GET',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

      });

      if (!getResponse.ok) {

        throw new Error(`HTTP error! status: ${getResponse.status}`);

      }

      const productData = await getResponse.json();

      // API response'u result objesi içinde dönüyor
      const product = productData.result || productData;

      // Tüm gerekli alanlarla PUT isteği gönder
      const updatedProduct = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: product.price,
        cost: newCostValue,
        barcode: product.barcode
      };

      const putUrl = joinApi('/v2.0/products');

      addLog('info', 'COST_API', `Maliyet guncelleniyor: ID ${productId} -> ${newCostValue}`, { putUrl, body: updatedProduct });

      const putResponse = await fetch(putUrl, {

        method: 'PUT',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

        body: JSON.stringify(updatedProduct),

      });

      if (!putResponse.ok) {

        throw new Error(`HTTP error! status: ${putResponse.status}`);

      }

      addLog('success', 'COST_API', `Maliyet guncellendi: ID ${productId} -> ${newCostValue}`);

      const result = await putResponse.json().catch(() => ({ success: true }));

      return result;

    } catch (error) {

      addLog('error', 'COST_API', `Maliyet guncellenemedi: ID ${productId}`, error);

      throw error;

    }

  };



  const updateProductBarcode = async (productId: string, newBarcodeValue: string) => {

    try {

      // Önce ürün bilgisini al
      const getUrl = joinApi(`/v2.0/products/${productId}`);

      addLog('info', 'BARCODE_API', `Ürün bilgisi alınıyor: ID ${productId}`, { getUrl });

      const getResponse = await fetch(getUrl, {

        method: 'GET',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

      });

      if (!getResponse.ok) {

        throw new Error(`HTTP error! status: ${getResponse.status}`);

      }

      const productData = await getResponse.json();

      // API response'u result objesi içinde dönüyor
      const product = productData.result || productData;

      // Tüm gerekli alanlarla PUT isteği gönder
      const updatedProduct = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: product.name,
        price: product.price,
        cost: product.cost,
        barcode: newBarcodeValue
      };

      const putUrl = joinApi('/v2.0/products');

      addLog('info', 'BARCODE_API', `Barkod guncelleniyor: ID ${productId} -> ${newBarcodeValue}`, { putUrl, body: updatedProduct });

      const putResponse = await fetch(putUrl, {

        method: 'PUT',

        headers: {

          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),

          'Content-Type': 'application/json',

        },

        body: JSON.stringify(updatedProduct),

      });

      if (!putResponse.ok) {

        throw new Error(`HTTP error! status: ${putResponse.status}`);

      }

      addLog('success', 'BARCODE_API', `Barkod guncellendi: ID ${productId} -> ${newBarcodeValue}`);

      const result = await putResponse.json().catch(() => ({ success: true }));

      return result;

    } catch (error) {

      addLog('error', 'BARCODE_API', `Barkod guncellenemedi: ID ${productId}`, error);

      throw error;

    }

  };

  const updateProductName = async (productId: string, newNameValue: string) => {
    try {
      const getUrl = joinApi(`/v2.0/products/${productId}`);
      addLog('info', 'NAME_API', `Ürün bilgisi alınıyor: ID ${productId}`, { getUrl });

      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),
          'Content-Type': 'application/json',
        },
      });

      if (!getResponse.ok) {
        const errorText = await getResponse.text();
        addLog('error', 'NAME_API', `GET request failed: ${getResponse.status}`, { url: getUrl, status: getResponse.status, errorText });
        throw new Error(`HTTP error! status: ${getResponse.status}, body: ${errorText}`);
      }

      const productData = await getResponse.json();
      addLog('info', 'NAME_API', `Ürün bilgisi alındı: ID ${productId}`, { productData });

      const product = productData.result || productData;

      const updatedProduct = {
        id: product.id,
        productType: product.productType,
        guid: product.guid,
        productImages: product.productImages,
        productGroupId: product.productGroupId,
        name: newNameValue,
        price: product.price,
        cost: product.cost,
        barcode: product.barcode
      };

      const putUrl = joinApi('/v2.0/products');
      addLog('info', 'NAME_API', `İsim güncelleniyor: ID ${productId} -> ${newNameValue}`, { putUrl, body: updatedProduct });

      const putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedProduct),
      });

      if (!putResponse.ok) {
        const errorText = await putResponse.text();
        addLog('error', 'NAME_API', `PUT request failed: ${putResponse.status}`, { url: putUrl, status: putResponse.status, errorText });
        throw new Error(`HTTP error! status: ${putResponse.status}, body: ${errorText}`);
      }

      addLog('success', 'NAME_API', `İsim güncellendi: ID ${productId} -> ${newNameValue}`);
      const result = await putResponse.json().catch(() => ({ success: true }));
      return result;

    } catch (error) {
      addLog('error', 'NAME_API', `İsim güncellenemedi: ID ${productId}`, error);
      throw error;
    }
  };

  // Promise Pool for parallel API calls with concurrency limit

  const updateStockBatch = async (updates: Array<{ productId: string; newStock: number }>) => {

    const concurrency = 5; // Max 5 simultaneous requests

    const results: Array<{ success: boolean; productId: string; error?: string }> = [];

    

    setIsUpdatingStock(true);

    setUpdateProgress({ current: 0, total: updates.length });

    

    try {

      // Process updates in batches

      for (let i = 0; i < updates.length; i += concurrency) {

        const batch = updates.slice(i, i + concurrency);

        

        // Execute batch in parallel

        const batchPromises = batch.map(async (update) => {

          try {

            await updateProductStock(update.productId, update.newStock);

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return { success: true, productId: update.productId };

          } catch (error) {

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return { 

              success: false, 

              productId: update.productId, 

              error: error instanceof Error ? error.message : 'Unknown error' 

            };

          }

        });

        

        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);

        

        // Small delay between batches to avoid overwhelming the server

        if (i + concurrency < updates.length) {

          await new Promise(resolve => setTimeout(resolve, 100));

        }

      }

      

      return results;

      

    } finally {

      setIsUpdatingStock(false);

      setUpdateProgress({ current: 0, total: 0 });

    }

  };



  const updatePriceBatch = async (updates: Array<{ productId: string; newPrice: number }>) => {

    if (updates.length === 0) {

      return [];

    }



    const concurrency = 5;

    const results: Array<{ success: boolean; productId: string; error?: string }> = [];



    setIsUpdatingStock(true);

    setUpdateProgress({ current: 0, total: updates.length });



    try {

      for (let i = 0; i < updates.length; i += concurrency) {

        const batch = updates.slice(i, i + concurrency);

        const batchPromises = batch.map(async (update) => {

          try {

            await updateProductPrice(update.productId, update.newPrice);

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return { success: true, productId: update.productId };

          } catch (error) {

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return {

              success: false,

              productId: update.productId,

              error: error instanceof Error ? error.message : 'Unknown error'

            };

          }

        });



        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);



        if (i + concurrency < updates.length) {

          await new Promise(resolve => setTimeout(resolve, 100));

        }

      }



      return results;

    } finally {

      setIsUpdatingStock(false);

      setUpdateProgress({ current: 0, total: 0 });

    }

  };



  const updateCostBatch = async (updates: Array<{ productId: string; newCost: number }>) => {

    if (updates.length === 0) {

      return [];

    }



    const concurrency = 5;

    const results: Array<{ success: boolean; productId: string; error?: string }> = [];



    setIsUpdatingStock(true);

    setUpdateProgress({ current: 0, total: updates.length });



    try {

      for (let i = 0; i < updates.length; i += concurrency) {

        const batch = updates.slice(i, i + concurrency);

        const batchPromises = batch.map(async (update) => {

          try {

            await updateProductCost(update.productId, update.newCost);

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return { success: true, productId: update.productId };

          } catch (error) {

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return {

              success: false,

              productId: update.productId,

              error: error instanceof Error ? error.message : 'Unknown error'

            };

          }

        });



        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);



        if (i + concurrency < updates.length) {

          await new Promise(resolve => setTimeout(resolve, 100));

        }

      }



      return results;

    } finally {

      setIsUpdatingStock(false);

      setUpdateProgress({ current: 0, total: 0 });

    }

  };



  const updateBarcodeBatch = async (updates: Array<{ productId: string; newBarcode: string }>) => {

    if (updates.length === 0) {

      return [];

    }



    const concurrency = 5;

    const results: Array<{ success: boolean; productId: string; error?: string }> = [];



    setIsUpdatingStock(true);

    setUpdateProgress({ current: 0, total: updates.length });



    try {

      for (let i = 0; i < updates.length; i += concurrency) {

        const batch = updates.slice(i, i + concurrency);

        const batchPromises = batch.map(async (update) => {

          try {

            await updateProductBarcode(update.productId, update.newBarcode);

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return { success: true, productId: update.productId };

          } catch (error) {

            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));

            return {

              success: false,

              productId: update.productId,

              error: error instanceof Error ? error.message : 'Unknown error'

            };

          }

        });



        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);



        if (i + concurrency < updates.length) {

          await new Promise(resolve => setTimeout(resolve, 100));

        }

      }



      return results;

    } finally {

      setIsUpdatingStock(false);

      setUpdateProgress({ current: 0, total: 0 });

    }

  };

  const updateNameBatch = async (updates: Array<{ productId: string; newName: string }>) => {
    if (updates.length === 0) {
      return [];
    }

    const concurrency = 5;
    const results: Array<{ success: boolean; productId: string; error?: string }> = [];

    setIsUpdatingStock(true);
    setUpdateProgress({ current: 0, total: updates.length });

    try {
      for (let i = 0; i < updates.length; i += concurrency) {
        const batch = updates.slice(i, i + concurrency);
        const batchPromises = batch.map(async (update) => {
          try {
            await updateProductName(update.productId, update.newName);
            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));
            return { success: true, productId: update.productId };
          } catch (error) {
            setUpdateProgress(prev => ({ ...prev, current: prev.current + 1 }));
            return {
              success: false,
              productId: update.productId,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (i + concurrency < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return results;
    } finally {
      setIsUpdatingStock(false);
      setUpdateProgress({ current: 0, total: 0 });
    }
  };

  // API Functions

  const fetchProductGroups = async () => {
    try {
      const url = joinApi(apiConfig.groupsEndpoint);
      addLog('info', 'GROUPS_API', 'Kategoriler yükleniyor...', { url, auth: `${apiConfig.username}:***` });
      const groups = await fetchProductGroupsService({ apiConfig, joinApi });
      setProductGroups(groups);
      addLog('success', 'GROUPS_API', `${groups.length} kategori yüklendi`, { groups: groups.map(g => g.name) });
    } catch (error) {
      addLog('error', 'GROUPS_API', 'Kategoriler yüklenirken hata', error);
      showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }
  };



  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    addLog('info', 'PRODUCTS_API', 'Ürünler yükleniyor...');

    try {
      // Always fetch fresh data from API (stock counts must be current)
      // Pass selected product groups to filter on server-side
      const { products, totalProducts, totalStock } = await fetchProductsService(
        { apiConfig, joinApi },
        selectedProductGroups.length > 0 ? selectedProductGroups : undefined
      );
      setStockData(products);
      setCountedValues({});
      setAddedValues({});
      setPriceValues({});

      fetchStocksForProducts(products.map((p) => p.id));
      addLog('success', 'PRODUCTS_API', `${totalProducts} ürün yüklendi, toplam stok: ${totalStock}`);
      // Images are loaded by useEffect, not here
    } catch (error) {
      addLog('error', 'PRODUCTS_API', 'Ürünler yüklenirken hata', error);
      showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    } finally {
      setIsLoadingProducts(false);
    }
  };



  const applyChanges = async () => {

    const today = new Date().toLocaleDateString('tr-TR');

    const newChanges: StockChange[] = [];

    const stockUpdates: Array<{ productId: string; newStock: number }> = [];

    const priceUpdates: Array<{ productId: string; newPrice: number }> = [];

    const costUpdates: Array<{ productId: string; newCost: number }> = [];

    const barcodeUpdates: Array<{ productId: string; newBarcode: string }> = [];

    const nameUpdates: Array<{ productId: string; newName: string }> = [];



    const updatedStockData = stockData.map(item => {

      const countedValue: number | null = typeof countedValues[item.id] === 'number' ? countedValues[item.id] as number : null;

      const addedValue: number = typeof addedValues[item.id] === 'number' ? addedValues[item.id] as number : 0;

      const wasteValue: number = typeof wasteValues[item.id] === 'number' ? wasteValues[item.id] as number : 0;

      const pendingPrice: number | null = typeof priceValues[item.id] === 'number' ? priceValues[item.id] as number : null;

      const pendingCost: number | null = typeof costValues[item.id] === 'number' ? costValues[item.id] as number : null;

      const pendingBarcode = barcodeValues[item.id] || null;

      const pendingName = nameValues[item.id] || null;

      let finalCount = item.count;

      if (countedValue !== null) {

        finalCount = countedValue + (addedValue as number);

      } else if (addedValue > 0) {

        finalCount = item.count + addedValue;

      }



      const stockChanged = finalCount !== item.count;

      const previousPrice = typeof item.price === 'number' ? item.price : undefined;

      const priceChanged = pendingPrice !== null && (previousPrice === undefined || Math.abs(pendingPrice - previousPrice) > 0.0001);

      const previousCost = typeof item.cost === 'number' ? item.cost : undefined;

      const costChanged = pendingCost !== null && (previousCost === undefined || Math.abs(pendingCost - previousCost) > 0.0001);

      const barcodeChanged = pendingBarcode !== null && pendingBarcode.trim() !== '' && pendingBarcode !== item.barcode;

      const nameChanged = pendingName !== null && pendingName.trim() !== '' && pendingName !== item.name;

      if (stockChanged) {

        stockUpdates.push({

          productId: item.id,

          newStock: finalCount

        });

      }



      if (priceChanged) {

        priceUpdates.push({

          productId: item.id,

          newPrice: pendingPrice as number

        });

      }



      if (costChanged) {

        costUpdates.push({

          productId: item.id,

          newCost: pendingCost as number

        });

      }



      if (barcodeChanged) {

        barcodeUpdates.push({

          productId: item.id,

          newBarcode: pendingBarcode as string

        });

      }

      if (nameChanged) {

        nameUpdates.push({

          productId: item.id,

          newName: pendingName as string

        });

      }

      if (stockChanged || priceChanged || costChanged || barcodeChanged || nameChanged) {

        let reason = '';

        if (stockChanged && priceChanged && costChanged) {

          reason = 'Stok + Fiyat + Maliyet';

        } else if (stockChanged && priceChanged) {

          reason = 'Stok + Fiyat';

        } else if (stockChanged && costChanged) {

          reason = 'Stok + Maliyet';

        } else if (priceChanged && costChanged) {

          reason = 'Fiyat + Maliyet';

        } else if (stockChanged) {

          if (countedValue !== null && addedValue > 0) {

            reason = 'Sayim + Ekleme';

          } else if (countedValue !== null) {

            reason = 'Sayim';

          } else {

            reason = 'Ekleme';

          }

        } else if (priceChanged) {

          reason = 'Fiyat';

        } else {

          reason = 'Maliyet';

        }



        const changeValue = stockChanged ? finalCount - item.count : 0;

        const computedPriceChange = priceChanged

          ? (previousPrice !== undefined ? (pendingPrice as number) - previousPrice : pendingPrice as number)

          : undefined;

        const computedCostChange = costChanged

          ? (previousCost !== undefined ? (pendingCost as number) - previousCost : pendingCost as number)

          : undefined;



        // Calculate waste cost (wasteValue * cost)
        const wasteCost = wasteValue > 0 && previousCost !== undefined
          ? wasteValue * previousCost
          : undefined;

        newChanges.push({

          id: item.id,

          date: today,

          productName: item.name,

          change: changeValue,

          reason,

          previousCount: item.count,

          countedValue: countedValue ?? undefined,

          addedValue: addedValue as number,

          wasteValue: wasteValue > 0 ? wasteValue : undefined,

          wasteCost,

          finalCount: finalCount,

          previousPrice,

          newPrice: priceChanged ? (pendingPrice as number) : previousPrice,

          priceChange: computedPriceChange,

          previousCost,

          newCost: costChanged ? (pendingCost as number) : previousCost,

          costChange: computedCostChange,

          previousName: nameChanged ? item.name : undefined,

          newName: nameChanged ? (pendingName as string) : undefined

        });

      }



      return {

        ...item,

        count: finalCount,

        price: priceChanged ? (pendingPrice as number) : item.price,

        cost: costChanged ? (pendingCost as number) : item.cost,

        barcode: barcodeChanged ? (pendingBarcode as string) : item.barcode,

        name: nameChanged ? (pendingName as string) : item.name

      };

    });



    // Check if there are any counted values entered (even if no actual change)
    const hasCountedEntries = Object.keys(countedValues).some(id =>
      countedValues[id] !== '' && countedValues[id] !== undefined
    );

    if (stockUpdates.length === 0 && priceUpdates.length === 0 && costUpdates.length === 0 && barcodeUpdates.length === 0 && nameUpdates.length === 0) {
      // In counting session, mark products as counted even if no actual changes
      if (isSessionActive && hasCountedEntries) {
        const countedIds = Object.keys(countedValues).filter(id =>
          countedValues[id] !== '' && countedValues[id] !== undefined
        );
        setCountedProductIds(prev => new Set([...prev, ...countedIds]));
        setCountedValues({});
        showToast('success', `${countedIds.length} ürün sayıldı olarak işaretlendi`);
        return;
      }

      showToast('warning', t('errors.noChanges'));

      return;

    }



    const summaryParts: string[] = [];

    if (stockUpdates.length > 0) {

      summaryParts.push(`Stok: ${stockUpdates.length} urun`);

    }

    if (priceUpdates.length > 0) {

      summaryParts.push(`Fiyat: ${priceUpdates.length} urun`);

    }

    if (costUpdates.length > 0) {

      summaryParts.push(`Maliyet: ${costUpdates.length} urun`);

    }

    if (barcodeUpdates.length > 0) {

      summaryParts.push(`Barkod: ${barcodeUpdates.length} urun`);

    }

    if (nameUpdates.length > 0) {

      summaryParts.push(`Isim: ${nameUpdates.length} urun`);

    }

    const totalUpdates = stockUpdates.length + priceUpdates.length + costUpdates.length + barcodeUpdates.length + nameUpdates.length;
    const details = summaryParts.join('\n');

    if (!confirm(t('confirm.applyChanges', { details: `${totalUpdates} updates\n${details}` }))) {

      return;

    }



    try {

      let stockResults: Array<{ success: boolean; productId: string; error?: string }> = [];

      let priceResults: Array<{ success: boolean; productId: string; error?: string }> = [];

      let costResults: Array<{ success: boolean; productId: string; error?: string }> = [];

      let barcodeResults: Array<{ success: boolean; productId: string; error?: string }> = [];



      if (stockUpdates.length > 0) {

        addLog('info', 'STOCK_BATCH', `${stockUpdates.length} urunun stoku guncelleniyor...`, stockUpdates);

        stockResults = await updateStockBatch(stockUpdates);

      }



      if (priceUpdates.length > 0) {

        addLog('info', 'PRICE_BATCH', `${priceUpdates.length} urunun fiyati guncelleniyor...`, priceUpdates);

        priceResults = await updatePriceBatch(priceUpdates);

      }



      if (costUpdates.length > 0) {

        addLog('info', 'COST_BATCH', `${costUpdates.length} urunun maliyeti guncelleniyor...`, costUpdates);

        costResults = await updateCostBatch(costUpdates);

      }



      if (barcodeUpdates.length > 0) {

        addLog('info', 'BARCODE_BATCH', `${barcodeUpdates.length} urunun barkodu guncelleniyor...`, barcodeUpdates);

        barcodeResults = await updateBarcodeBatch(barcodeUpdates);

      }

      let nameResults: Array<{ success: boolean; productId: string; error?: string }> = [];
      if (nameUpdates.length > 0) {
        addLog('info', 'NAME_BATCH', `${nameUpdates.length} urunun ismi guncelleniyor...`, nameUpdates);
        nameResults = await updateNameBatch(nameUpdates);
      }

      // Save previous/next price values to localStorage

      Object.entries(previousPriceValues).forEach(([productId, price]) => {

        if (typeof price === 'number') {

          updatePreviousPrice(productId, price);

        }

      });

      Object.entries(nextPriceValues).forEach(([productId, price]) => {

        if (typeof price === 'number') {

          updateNextPrice(productId, price);

        }

      });



      // Save previous/next cost values to localStorage

      Object.entries(previousCostValues).forEach(([productId, cost]) => {

        if (typeof cost === 'number') {

          updatePreviousCost(productId, cost);

        }

      });

      Object.entries(nextCostValues).forEach(([productId, cost]) => {

        if (typeof cost === 'number') {

          updateNextCost(productId, cost);

        }

      });



      const failedStock = stockResults.filter(result => !result.success);

      const successfulStock = stockResults.filter(result => result.success);

      const failedPrice = priceResults.filter(result => !result.success);

      const successfulPrice = priceResults.filter(result => result.success);

      const failedCost = costResults.filter(result => !result.success);

      const successfulCost = costResults.filter(result => result.success);

      const failedBarcode = barcodeResults.filter(result => !result.success);

      const successfulBarcode = barcodeResults.filter(result => result.success);

      const failedName = nameResults.filter(result => !result.success);

      const successfulName = nameResults.filter(result => result.success);



      if (stockUpdates.length > 0) {

        if (failedStock.length > 0) {

          const failedProducts = failedStock.map(f => {

            const product = stockData.find(p => p.id === f.productId);

            return product?.name || f.productId;

          }).join(', ');

          addLog('warning', 'STOCK_BATCH', `Kismi basari: ${successfulStock.length} basarili, ${failedStock.length} basarisiz`, {

            successful: successfulStock.length,

            failed: failedStock.length,

            failedProducts

          });

        } else {

          addLog('success', 'STOCK_BATCH', `Tum stok guncellemeleri basarili: ${successfulStock.length} urun`);

        }

      }



      if (priceUpdates.length > 0) {

        if (failedPrice.length > 0) {

          const failedProducts = failedPrice.map(f => {

            const product = stockData.find(p => p.id === f.productId);

            return product?.name || f.productId;

          }).join(', ');

          addLog('warning', 'PRICE_BATCH', `Kismi basari: ${successfulPrice.length} basarili, ${failedPrice.length} basarisiz`, {

            successful: successfulPrice.length,

            failed: failedPrice.length,

            failedProducts

          });

        } else {

          addLog('success', 'PRICE_BATCH', `Tum fiyat guncellemeleri basarili: ${successfulPrice.length} urun`);

        }

      }



      if (costUpdates.length > 0) {

        if (failedCost.length > 0) {

          const failedProducts = failedCost.map(f => {

            const product = stockData.find(p => p.id === f.productId);

            return product?.name || f.productId;

          }).join(', ');

          addLog('warning', 'COST_BATCH', `Kismi basari: ${successfulCost.length} basarili, ${failedCost.length} basarisiz`, {

            successful: successfulCost.length,

            failed: failedCost.length,

            failedProducts

          });

        } else {

          addLog('success', 'COST_BATCH', `Tum maliyet guncellemeleri basarili: ${successfulCost.length} urun`);

        }

      }



      if (barcodeUpdates.length > 0) {

        if (failedBarcode.length > 0) {

          const failedProducts = failedBarcode.map(f => {

            const product = stockData.find(p => p.id === f.productId);

            return product?.name || f.productId;

          }).join(', ');

          addLog('warning', 'BARCODE_BATCH', `Kismi basari: ${successfulBarcode.length} basarili, ${failedBarcode.length} basarisiz`, {

            successful: successfulBarcode.length,

            failed: failedBarcode.length,

            failedProducts

          });

        } else {

          addLog('success', 'BARCODE_BATCH', `Tum barkod guncellemeleri basarili: ${successfulBarcode.length} urun`);

        }

      }

      if (nameUpdates.length > 0) {

        if (failedName.length > 0) {

          const failedProducts = failedName.map(f => {

            const product = stockData.find(p => p.id === f.productId);

            return product?.name || f.productId;

          }).join(', ');

          addLog('warning', 'NAME_BATCH', `Kismi basari: ${successfulName.length} basarili, ${failedName.length} basarisiz`, {

            successful: successfulName.length,

            failed: failedName.length,

            failedProducts

          });

        } else {

          addLog('success', 'NAME_BATCH', `Tum isim guncellemeleri basarili: ${successfulName.length} urun`);

        }

      }

      const totalFailures = failedStock.length + failedPrice.length + failedCost.length + failedBarcode.length + failedName.length;

      if (totalFailures > 0) {

        const failureLines: string[] = [];

        if (stockUpdates.length > 0) {

          failureLines.push(`Stok - basarili: ${successfulStock.length}, basarisiz: ${failedStock.length}`);

        }

        if (priceUpdates.length > 0) {

          failureLines.push(`Fiyat - basarili: ${successfulPrice.length}, basarisiz: ${failedPrice.length}`);

        }

        if (costUpdates.length > 0) {

          failureLines.push(`Maliyet - basarili: ${successfulCost.length}, basarisiz: ${failedCost.length}`);

        }

        if (barcodeUpdates.length > 0) {

          failureLines.push(`Barkod - basarili: ${successfulBarcode.length}, basarisiz: ${failedBarcode.length}`);

        }

        if (nameUpdates.length > 0) {

          failureLines.push(`Isim - basarili: ${successfulName.length}, basarisiz: ${failedName.length}`);

        }

        showToast('warning', t('errors.partialFail') + '\n' + failureLines.join('\n'));

      } else {

        showToast('success', t('success.updateComplete'));

      }



      setStockData(updatedStockData);

      // Add changes to counting session if active
      if (isSessionActive) {
        for (const change of newChanges) {
          const item = stockData.find(p => p.id === change.id);
          addChange({
            productId: change.id,
            productName: change.productName,
            barcode: item?.barcode,
            previousCount: change.previousCount,
            countedValue: change.countedValue,
            addedValue: change.addedValue,
            wasteValue: change.wasteValue,
            wasteCost: change.wasteCost,
            finalCount: change.finalCount,
            previousPrice: change.previousPrice,
            newPrice: change.newPrice,
            previousCost: change.previousCost,
            newCost: change.newCost,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Mark products as counted if session is active
      // Include all products that had a counted value entered, even if no change
      if (isSessionActive) {
        const countedIds = Object.keys(countedValues).filter(id =>
          countedValues[id] !== '' && countedValues[id] !== undefined
        );
        const updatedProductIds = new Set([
          ...countedIds,
          ...stockUpdates.map(u => u.productId),
          ...priceUpdates.map(u => u.productId),
          ...costUpdates.map(u => u.productId),
          ...barcodeUpdates.map(u => u.productId),
        ]);
        setCountedProductIds(prev => new Set([...prev, ...updatedProductIds]));
      }

      setCountedValues({});

      setAddedValues({});

      setWasteValues({});

      setPriceValues({});

      setBarcodeValues({});

      setNameValues({});

      setCostValues({});

    } catch (error) {

      if (stockUpdates.length > 0) {

        addLog('error', 'STOCK_BATCH', 'Kritik hata: Stok guncelleme basarisiz', error);

      }

      if (priceUpdates.length > 0) {

        addLog('error', 'PRICE_BATCH', 'Kritik hata: Fiyat guncelleme basarisiz', error);

      }

      showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));

    }

  };



  const resetAllToZero = () => {

    // If categories are selected, target only those groups; otherwise use current filters

    const filtered = selectedProductGroups.length > 0

      ? stockData.filter(it => selectedProductGroups.includes((it.productGroupId ?? -1)))

      : getFilteredStockData();

    if (filtered.length === 0) {

      showToast('warning', t('reset.none'));

      return;

    }



    setCountedValues(prev => {

      const next = { ...prev } as { [key: string]: number | '' };

      for (const item of filtered) {

        next[item.id] = 0;

      }

      return next;

    });



    setAddedValues(prev => {

      const next = { ...prev } as { [key: string]: number | '' };

      for (const item of filtered) {

        next[item.id] = 0;

      }

      return next;

    });



    addLog('info', 'RESET', `Filtreye uyan ${filtered.length} ürün için sayılan=0 atandı.`, {

      affected: filtered.map(f => f.id)

    });

    showToast('success', t('reset.done', { count: filtered.length }));

  };



  const _totalStock = stockData.reduce((sum, item) => sum + item.count, 0);



  // Filter and sort stock data based on search query and product group (memoized)
  const filteredStockData = useMemo(() => {
    let filteredData = stockData;

    // Apply product group filter first
    if (activeProductGroupFilter !== null) {
      filteredData = stockData.filter(item => item.productGroupId === activeProductGroupFilter);
    }

    // Then apply search filter if there's a query (use deferred value for smooth typing)
    if (!deferredSearchQuery.trim()) {
      return filteredData;
    }

    const query = deferredSearchQuery.toLowerCase().trim();

    // Separate exact matches and partial matches
    const exactMatches: StockData[] = [];
    const partialMatches: StockData[] = [];

    filteredData.forEach(item => {
      const nameMatch = item.name.toLowerCase();
      const barcodeMatch = item.barcode.toLowerCase();

      // Check for exact barcode or exact name match
      if (barcodeMatch === query || nameMatch === query) {
        exactMatches.push(item);
      }
      // Check for partial matches
      else if (nameMatch.includes(query) || barcodeMatch.includes(query)) {
        partialMatches.push(item);
      }
    });

    // Return exact matches first, then partial matches
    return [...exactMatches, ...partialMatches];
  }, [stockData, activeProductGroupFilter, deferredSearchQuery]);

  // Helper function for resetAllToZero (uses current searchQuery, not deferred)
  const getFilteredStockData = useCallback(() => {
    let filteredData = stockData;
    if (activeProductGroupFilter !== null) {
      filteredData = stockData.filter(item => item.productGroupId === activeProductGroupFilter);
    }
    if (!searchQuery.trim()) return filteredData;
    const query = searchQuery.toLocaleLowerCase('tr').trim();
    return filteredData.filter(item =>
      item.name.toLocaleLowerCase('tr').includes(query) || item.barcode.toLocaleLowerCase('tr').includes(query)
    );
  }, [stockData, activeProductGroupFilter, searchQuery]);



  const clearSearch = () => {

    setSearchQuery('');

  };










  // Initialize app with welcome log

  React.useEffect(() => {

    addLog('success', 'SYSTEM', 'Stok Yönetim Sistemi başlatıldı', {

      version: '1.0.0',

      timestamp: new Date().toISOString(),

      userAgent: navigator.userAgent

    });

  }, []);



  // Handle ESC key for enlarged image modal

  React.useEffect(() => {

    const handleEscKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape' && enlargedImage) {

        setEnlargedImage(null);

      }

    };



    document.addEventListener('keydown', handleEscKey);

    return () => document.removeEventListener('keydown', handleEscKey);

  }, [enlargedImage]);



  // Handle paste events for stock page

  React.useEffect(() => {

    const handlePaste = (e: ClipboardEvent) => {

      // Only handle paste on stock page

      if (currentPage !== 'stock') return;

      

      // Don't interfere if user is already focused on an input

      const activeElement = document.activeElement;

      if (activeElement && (

        activeElement.tagName === 'INPUT' || 

        activeElement.tagName === 'TEXTAREA' ||

        activeElement.getAttribute('contenteditable') === 'true'

      )) {

        return;

      }



      // Get pasted text

      const pastedText = e.clipboardData?.getData('text');

      if (pastedText) {

        e.preventDefault();

        setSearchQuery(pastedText.trim());

        

        // Focus the search input after a short delay

        setTimeout(() => {

          const searchInput = document.querySelector('input[placeholder*="Ürün adı veya barkod"]') as HTMLInputElement;

          if (searchInput) {

            searchInput.focus();

            searchInput.select();

          }

        }, 100);

      }

    };



    document.addEventListener('paste', handlePaste);

    return () => document.removeEventListener('paste', handlePaste);

  }, [currentPage]);










  // Login state
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Login handler - validates credentials against API
  const handleLogin = async () => {
    if (!apiConfig.serverIP.trim() || !apiConfig.username.trim() || !apiConfig.password.trim()) {
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const testUrl = `http://${apiConfig.serverIP}/api${apiConfig.groupsEndpoint}`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(`${apiConfig.username}:${apiConfig.password}`),
        },
      });

      if (response.status === 401 || response.status === 403) {
        setLoginError(t('login.error.credentials'));
        return;
      }

      if (!response.ok) {
        setLoginError(t('login.error.connection'));
        return;
      }

      setIsLoggedIn(true);
    } catch {
      setLoginError(t('login.error.connection'));
    } finally {
      setLoginLoading(false);
    }
  };

  // Login screen
  if (!isLoggedIn) {
    const canSubmit = apiConfig.serverIP.trim() && apiConfig.username.trim() && apiConfig.password.trim();

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Language selector */}
          <div className="flex justify-end">
            <Select
              value={currentLanguage}
              onValueChange={(value: Lang) => {
                setLang(value);
                setCurrentLanguage(value);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {languageNames[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{t('login.title')}</h1>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <div>
              <Label htmlFor="login-username" className="text-gray-700">{t('login.username')}</Label>
              <Input
                id="login-username"
                type="text"
                value={apiConfig.username}
                onChange={(e) => setApiConfig(prev => ({ ...prev, username: e.target.value }))}
                className="mt-1"
                placeholder={t('login.username')}
              />
            </div>

            <div>
              <Label htmlFor="login-password" className="text-gray-700">{t('login.password')}</Label>
              <Input
                id="login-password"
                type="password"
                value={apiConfig.password}
                onChange={(e) => setApiConfig(prev => ({ ...prev, password: e.target.value }))}
                className="mt-1"
                placeholder={t('login.password')}
              />
            </div>

            <div className="pt-4 border-t">
              <Label htmlFor="login-serverip" className="text-gray-700">{t('login.serverIP')}</Label>
              <Input
                id="login-serverip"
                type="text"
                value={apiConfig.serverIP}
                onChange={(e) => setApiConfig(prev => ({ ...prev, serverIP: e.target.value }))}
                className="mt-1"
                placeholder="192.168.1.5"
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={!canSubmit || loginLoading}
            >
              {loginLoading ? t('controls.loading') : t('login.submit')}
            </Button>

            {!canSubmit && (
              <p className="text-sm text-red-500 text-center">{t('login.error.required')}</p>
            )}

            {loginError && (
              <p className="text-sm text-red-500 text-center">{loginError}</p>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-background p-3 sm:p-6">

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}

        <div>

          <h1>{t('app.title')}</h1>

          <p className="text-muted-foreground">{t('app.subtitle')}</p>

        </div>



        {/* Navigation */}

        <div className="bg-card border rounded-lg p-1 flex">

          <button

            onClick={() => setCurrentPage('stock')}

            className={`flex-1 py-2 px-2 sm:px-4 rounded transition-colors text-sm sm:text-base ${

              currentPage === 'stock' 

                ? 'bg-primary text-primary-foreground' 

                : 'hover:bg-muted'

            }`}

          >

            <span className="hidden sm:inline">{t('nav.stock')}</span>

            <span className="sm:hidden">Stok</span>

          </button>

          <button

            onClick={() => setCurrentPage('counting')}

            className={`flex-1 py-2 px-2 sm:px-4 rounded transition-colors text-sm sm:text-base ${

              currentPage === 'counting'

                ? 'bg-primary text-primary-foreground'

                : 'hover:bg-muted'

            }${isSessionActive ? ' ring-2 ring-green-500' : ''}`}

          >

            <span className="hidden sm:inline">{t('nav.counting')}</span>

            <span className="sm:hidden">{t('nav.countingShort')}</span>

          </button>

          <button

            onClick={() => setCurrentPage('settings')}

            className={`flex-1 py-2 px-2 sm:px-4 rounded transition-colors text-sm sm:text-base ${

              currentPage === 'settings' 

                ? 'bg-primary text-primary-foreground' 

                : 'hover:bg-muted'

            }`}

          >

            <Settings className="h-4 w-4 inline mr-0 sm:mr-2" />

            <span className="hidden sm:inline">Ayarlar</span>

          </button>

        </div>



        {currentPage === 'counting' ? (

          <CountingPage
            session={session}
            isSessionActive={isSessionActive}
            startSession={startSession}
            endSession={endSession}
            downloadSessionReport={downloadSessionReport}
            setCountedProductIds={setCountedProductIds}
            showToast={showToast}
            t={t}
          />

        ) : currentPage === 'settings' ? (

          <SettingsPage
            apiConfig={apiConfig}
            setApiConfig={setApiConfig}
            systemLogs={systemLogs}
            setSystemLogs={setSystemLogs}
            addLog={addLog}
            currentLanguage={currentLanguage}
            setCurrentLanguage={setCurrentLanguage}
            productGroups={productGroups}
            fetchProductGroups={fetchProductGroups}
            selectedProductGroups={selectedProductGroups}
            setSelectedProductGroups={setSelectedProductGroups}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            resetAllToZero={resetAllToZero}
            t={t}
          />

        ) : (

          <>

        {/* Header */}

        <div>

          <h1>{t('app.title')}</h1>

          <p className="text-muted-foreground">{t('app.subtitle')}</p>

        </div>







        {/* Controls */}

        <div className="bg-card border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">

          <h2>{t('controls.title')}</h2>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">

            <Button 

              onClick={fetchProducts}

              disabled={isLoadingProducts || isUpdatingStock || isFetchingStocks}

              className="flex items-center gap-2 w-full sm:w-auto"

              size="sm"

            >

              <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />

              <span className="sm:hidden">{isLoadingProducts ? 'Yükleniyor...' : 'Getir'}</span>

              <span className="hidden sm:inline">{isLoadingProducts ? 'Yükleniyor...' : 'Ürünleri Getir'}</span>

            </Button>

            <Button 

              onClick={applyChanges}

              disabled={isUpdatingStock || isLoadingProducts || isFetchingStocks}

              variant="default"

              className="w-full sm:w-auto"

              size="sm"

            >

              {isUpdatingStock ? (

                <>

                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />

                  <span className="sm:hidden">{updateProgress.current}/{updateProgress.total}</span>

                  <span className="hidden sm:inline">Güncelleniyor... ({updateProgress.current}/{updateProgress.total})</span>

                </>

              ) : (

                <>

                  <span className="sm:hidden">{t('controls.apply.short')}</span>

                  <span className="hidden sm:inline">{t('controls.apply')}</span>

                </>

              )}

            </Button>

            <Button 

              onClick={() => setCurrentPage('settings')}

              variant="outline"

              disabled={isUpdatingStock || isLoadingProducts || isFetchingStocks}

              className="flex items-center gap-2 w-full sm:w-auto"

              size="sm"

            >

              <Settings className="h-4 w-4" />

              Ayarlar

            </Button>

          </div>

          

          {/* Progress Bar */}

          {isUpdatingStock && (

            <div className="space-y-2">

              <div className="flex justify-between text-sm">

                <span>Stok güncelleniyor...</span>

                <span>{updateProgress.current} / {updateProgress.total}</span>

              </div>

              <Progress 

                value={(updateProgress.current / updateProgress.total) * 100} 

                className="w-full"

              />

            </div>

          )}

        </div>



        {/* Live Stock Fetch Progress */}

        {isFetchingStocks && (

          <div className="space-y-2">

            <div className="flex justify-between text-sm">

              <span>Stoklar yükleniyor...</span>

              <span>{stockFetchProgress.current} / {stockFetchProgress.total}</span>

            </div>

            <Progress 

              value={stockFetchProgress.total ? (stockFetchProgress.current / stockFetchProgress.total) * 100 : 0}

              className="w-full"

            />

          </div>

        )}



        {/* Stock Items */}

        <div className="space-y-3 sm:space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

            <h2 className="text-lg sm:text-xl">Stok Ürünleri</h2>

            <div className="flex items-center gap-2 flex-1 max-w-full sm:max-w-md">

              <div className="relative flex-1">

                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />

                <Input

                  type="text"

                  placeholder="Ürün adı veya barkod ile ara..."

                  value={searchQuery}

                  onChange={(e) => setSearchQuery(e.target.value)}

                  className="pl-10 text-sm sm:text-base"

                />

              </div>

              {searchQuery && (

                <Button

                  type="button"

                  variant="outline"

                  size="sm"

                  onClick={clearSearch}

                  className="px-2 sm:px-3 py-2 h-10 text-xs sm:text-sm"

                >

                  Clear

                </Button>

              )}

            </div>

          </div>



          {/* Category Filter Buttons */}

          {selectedProductGroups.length > 0 && (

            <div className="flex flex-wrap gap-2">

              <Button

                variant={activeProductGroupFilter === null ? "default" : "outline"}

                size="sm"

                onClick={() => setActiveProductGroupFilter(null)}

                className="flex items-center gap-2"

              >

                <Filter className="h-4 w-4" />

                Hepsini Göster

              </Button>

              {selectedProductGroups.map((groupId) => {

                const group = productGroups.find(g => g.id === groupId);

                if (!group) return null;



                return (

                  <Button

                    key={groupId}

                    variant={activeProductGroupFilter === groupId ? "default" : "outline"}

                    size="sm"

                    onClick={() => setActiveProductGroupFilter(groupId)}

                  >

                    {group.name}

                  </Button>

                );

              })}

            </div>

          )}

          {(searchQuery || activeProductGroupFilter !== null) && (

            <div className="text-sm text-muted-foreground">

              {filteredStockData.length} ürün bulundu

              {searchQuery && `: "${searchQuery}"`}

              {activeProductGroupFilter !== null && (

                <span className="ml-2">

                   Kategori: {productGroups.find(g => g.id === activeProductGroupFilter)?.name}

                </span>

              )}

            </div>

          )}

          {stockData.length === 0 && !isLoadingProducts && (

            <div className="text-center py-12 text-muted-foreground">

              {t('empty.hint')}

            </div>

          )}

          <div className="space-y-3">

            {filteredStockData.map((item) => {

              const countedValue: number | null = typeof countedValues[item.id] === 'number' ? countedValues[item.id] as number : null;

              const addedValue: number = typeof addedValues[item.id] === 'number' ? addedValues[item.id] as number : 0;

              const totalAfterCount = countedValue !== null ? countedValue + addedValue : item.count + addedValue;

              const countDiff = countedValue !== null ? countedValue - item.count : null;

              const enteredPrice: number | null = typeof priceValues[item.id] === 'number' ? priceValues[item.id] as number : null;

              const currentPrice = typeof item.price === 'number' ? item.price : null;

              const cost = typeof item.cost === 'number' ? item.cost : null;

              const enteredPreviousPrice: number | null = typeof previousPriceValues[item.id] === 'number' ? previousPriceValues[item.id] as number : null;

              const previousPrice = enteredPreviousPrice ?? (typeof item.previousPrice === 'number' ? item.previousPrice : null);

              const enteredNextPrice: number | null = typeof nextPriceValues[item.id] === 'number' ? nextPriceValues[item.id] as number : null;

              const nextPrice = enteredNextPrice ?? (typeof item.nextPrice === 'number' ? item.nextPrice : null);

              const _priceDiff = enteredPrice !== null && currentPrice !== null

                ? enteredPrice - currentPrice

                : enteredPrice !== null && currentPrice === null

                  ? enteredPrice

                  : null;

              const _priceChangeDiff = previousPrice !== null && nextPrice !== null

                ? nextPrice - previousPrice

                : null;

              const enteredCost: number | null = typeof costValues[item.id] === 'number' ? costValues[item.id] as number : null;

              const enteredPreviousCost: number | null = typeof previousCostValues[item.id] === 'number' ? previousCostValues[item.id] as number : null;

              const _previousCost = enteredPreviousCost ?? (typeof item.previousCost === 'number' ? item.previousCost : null);

              const enteredNextCost: number | null = typeof nextCostValues[item.id] === 'number' ? nextCostValues[item.id] as number : null;

              const _nextCost = enteredNextCost ?? (typeof item.nextCost === 'number' ? item.nextCost : null);

              return (

              <div key={item.id} className={`bg-card border rounded-lg p-3 sm:p-4 ${item.isDeleted ? 'opacity-60 border-dashed' : ''}`}>

                {/* Counted Badge & Delete/Restore Button */}
                <div className="flex justify-between items-center mb-2">
                  {isSessionActive && countedProductIds.has(item.id) ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ {t('item.countedBadge')}
                    </span>
                  ) : (
                    <span></span>
                  )}
                  <div>
                  {item.isDeleted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={async () => {
                        try {
                          await restoreProduct({ apiConfig, joinApi }, item.id);
                          setStockData(prev => prev.map(p =>
                            p.id === item.id ? { ...p, isDeleted: false } : p
                          ));
                          addLog('success', 'RESTORE', `Ürün geri alındı: ${item.name}`);
                          showToast('success', `${item.name} geri alındı`);
                        } catch (error) {
                          addLog('error', 'RESTORE', `Geri alma hatası: ${item.name}`, error);
                          showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {t('controls.restore')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (!confirm(t('confirm.deleteProduct', { name: item.name }))) return;
                        try {
                          await deleteProduct({ apiConfig, joinApi }, item.id);
                          setStockData(prev => prev.map(p =>
                            p.id === item.id ? { ...p, isDeleted: true } : p
                          ));
                          addLog('success', 'DELETE', `Ürün silindi: ${item.name}`);
                          showToast('success', `${item.name} silindi`);
                        } catch (error) {
                          addLog('error', 'DELETE', `Silme hatası: ${item.name}`, error);
                          showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t('controls.delete')}
                    </Button>
                  )}
                  </div>
                </div>

                {/* Mobile Layout */}

                <div className="sm:hidden space-y-3">

                  <div className="flex gap-3">

                    {/* Product Image - Mobile */}

                    <div className="w-16 h-16 flex-shrink-0">

                      {item.imageUrl ? (

                        <ImageWithFallback

                          src={item.imageUrl}

                          alt={item.name}

                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"

                          onClick={() => setEnlargedImage({

                            url: item.imageUrl!,

                            name: item.name

                          })}

                        />

                      ) : (

                        <div className="w-16 h-16 bg-muted rounded border flex flex-col items-center justify-center">

                          <Button

                            variant="ghost"

                            size="sm"

                            onClick={() => loadProductImage(item.id)}

                            className="h-full w-full p-1 text-xs"

                          >

                            <div className="text-center">

                              <ImageIcon className="h-4 w-4 mx-auto mb-1" />

                              <span className="text-xs">Göster</span>

                            </div>

                          </Button>

                        </div>

                      )}

                    </div>

                    

                    <div className="flex-1 min-w-0">

                      <p className="text-xs text-muted-foreground">{t('item.name')}</p>

                      <Input

                        value={nameValues[item.id] ?? item.name}

                        onChange={(e) => handleNameChange(item.id, e.target.value)}

                        placeholder={item.name}

                        className="text-sm h-7 px-2 font-medium"

                      />

                      <p className="text-xs text-muted-foreground mt-1">ID: {item.id}</p>

                      <div className="flex items-center gap-2 mt-1">

                        <p className="text-xs text-muted-foreground">{t('item.barcode')}:</p>

                        <Input

                          value={barcodeValues[item.id] ?? item.barcode}

                          onChange={(e) => handleBarcodeChange(item.id, e.target.value)}

                          placeholder={item.barcode}

                          className="text-xs h-6 px-2"

                        />

                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <Checkbox
                          id={`enableStock-${item.id}`}
                          checked={item.enableStock ?? false}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateEnableStock({ apiConfig, joinApi }, item.id, checked as boolean);
                              setStockData(prev => prev.map(p =>
                                p.id === item.id ? { ...p, enableStock: checked as boolean } : p
                              ));
                              addLog('success', 'STOCK_ENABLE', `Stok takibi ${checked ? 'açıldı' : 'kapatıldı'}: ${item.name}`);
                              showToast('success', `${item.name} - Stok takibi ${checked ? 'açıldı' : 'kapatıldı'}`);
                            } catch (error) {
                              addLog('error', 'STOCK_ENABLE', `Stok takibi değiştirilemedi: ${item.name}`, error);
                              showToast('error', `Stok takibi değiştirilemedi`);
                            }
                          }}
                        />
                        <label htmlFor={`enableStock-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                          {t('item.enableStock')}
                        </label>
                        {!item.enableStock && (
                          <span className="text-xs text-orange-500">({t('item.stockDisabled')})</span>
                        )}
                      </div>

                    </div>

                  </div>



                  {/* Fiyat Bilgileri - İsim Altında */}

                  <div className="grid grid-cols-4 gap-2">

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">Fiyat</p>

                      <p className="bg-muted px-2 py-1 rounded text-sm">{formatPrice(currentPrice)}</p>

                    </div>

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">Yeni</p>

                      <NumpadInput

                        value={enteredPrice ?? ''}

                        onChange={(value) => handlePriceChange(item.id, value)}

                        placeholder="0.00"

                        allowDecimal={true}

                        step={0.01}

                        className="text-xs"

                      />

                    </div>

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">Maliyet</p>

                      <p className="bg-muted px-2 py-1 rounded text-sm">{formatPrice(cost)}</p>

                    </div>

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">Yeni</p>

                      <NumpadInput

                        value={enteredCost ?? ''}

                        onChange={(value) => handleCostChange(item.id, value)}

                        placeholder="0.00"

                        allowDecimal={true}

                        step={0.01}

                        className="text-xs"

                      />

                    </div>

                  </div>



                  {/* Stok Bilgileri - Fiyat Altında */}

                  <div className="grid grid-cols-2 gap-3">

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">Mevcut</p>

                      <p className="bg-muted px-2 py-1 rounded text-sm">{item.count}</p>

                    </div>

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">Toplam</p>

                      <p className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">

                        {totalAfterCount}

                      </p>

                    </div>

                  </div>



                  <div className="grid grid-cols-3 gap-2">

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">Sayılan</p>

                      <NumpadInput

                        value={countedValues[item.id] ?? ''}

                        onChange={(value) => handleCountedChange(item.id, value)}

                        placeholder="0"

                        defaultValue={item.count}

                        className="text-xs"

                      />

                    </div>

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">{t('item.added')}</p>

                      <NumpadInput

                        value={addedValues[item.id] || ''}

                        onChange={(value) => handleAddedChange(item.id, value)}

                        placeholder="0"

                        className="text-xs"

                      />

                    </div>

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">{t('item.waste')}</p>

                      <NumpadInput

                        value={wasteValues[item.id] || ''}

                        onChange={(value) => setWasteValues(prev => ({ ...prev, [item.id]: value === '' ? '' : Number(value) }))}

                        placeholder="0"

                        className="text-xs"

                      />

                    </div>

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">{t('item.diff')}</p>

                      <p className={`px-1 py-1 rounded text-xs ${

                        countDiff !== null

                          ? countDiff > 0 ? 'bg-green-100 text-green-800' :

                            countDiff < 0 ? 'bg-red-100 text-red-800' : 'bg-muted'

                          : 'bg-muted'

                      }`}>

                        {countDiff !== null

                          ? `${countDiff > 0 ? '+' : ''}${countDiff}`

                          : '-'

                        }

                      </p>

                    </div>

                  </div>

                </div>



                {/* Desktop Layout */}

                <div className="hidden sm:block">

                  {/* Product Info Row */}

                  <div className="flex items-center gap-3 mb-3">

                    {/* Product Image - Desktop */}

                    <div className="w-16 h-16 flex-shrink-0">

                      {item.imageUrl ? (

                        <ImageWithFallback

                          src={item.imageUrl}

                          alt={item.name}

                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"

                          onClick={() => setEnlargedImage({

                            url: item.imageUrl!,

                            name: item.name

                          })}

                        />

                      ) : (

                        <div className="w-16 h-16 bg-muted rounded border flex flex-col items-center justify-center">

                          <Button

                            variant="ghost"

                            size="sm"

                            onClick={() => loadProductImage(item.id)}

                            className="h-full w-full p-1 text-xs"

                          >

                            <div className="text-center">

                              <ImageIcon className="h-3 w-3 mx-auto mb-1" />

                              <span className="text-xs">Göster</span>

                            </div>

                          </Button>

                        </div>

                      )}

                    </div>



                    <div className="flex-1 min-w-0">

                      <p className="text-sm text-muted-foreground">{t('item.name')}</p>

                      <Input

                        value={nameValues[item.id] ?? item.name}

                        onChange={(e) => handleNameChange(item.id, e.target.value)}

                        placeholder={item.name}

                        className="text-sm h-8 px-2 font-medium max-w-md"

                      />

                      <p className="text-sm text-muted-foreground mt-1">ID: {item.id}</p>

                      <div className="flex items-center gap-2 mt-1">

                        <p className="text-sm text-muted-foreground">{t('item.barcode')}:</p>

                        <Input

                          value={barcodeValues[item.id] ?? item.barcode}

                          onChange={(e) => handleBarcodeChange(item.id, e.target.value)}

                          placeholder={item.barcode}

                          className="text-sm h-7 px-2 max-w-xs"

                        />

                      </div>

                    </div>

                  </div>



                  {/* Desktop Price Section - Below Name */}

                  <div className="flex items-center gap-3 text-sm mb-3">

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">{t('item.price')}:</p>

                      <p className="bg-muted px-2 py-1 rounded min-w-[60px]">{formatPrice(currentPrice)}</p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[40px]">{t('item.new')}:</p>

                      <NumpadInput

                        value={enteredPrice ?? ''}

                        onChange={(value) => handlePriceChange(item.id, value)}

                        placeholder="0.00"

                        allowDecimal={true}

                        step={0.01}

                        className="w-20"

                      />

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">Maliyet:</p>

                      <p className="bg-muted px-2 py-1 rounded min-w-[60px]">{formatPrice(cost)}</p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[40px]">{t('item.new')}:</p>

                      <NumpadInput

                        value={enteredCost ?? ''}

                        onChange={(value) => handleCostChange(item.id, value)}

                        placeholder="0.00"

                        allowDecimal={true}

                        step={0.01}

                        className="w-20"

                      />

                    </div>

                  </div>



                  {/* Desktop Stock Section - Below Price */}

                  <div className="flex items-center gap-3 text-sm">

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">Mevcut:</p>

                      <p className="bg-muted px-2 py-1 rounded min-w-[60px]">{item.count}</p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">Sayılan:</p>

                      <NumpadInput

                        value={countedValues[item.id] ?? ''}

                        onChange={(value) => handleCountedChange(item.id, value)}

                        placeholder="0"

                        defaultValue={item.count}

                        className="w-20"

                      />

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[40px]">Fark:</p>

                      <p className={`px-2 py-1 rounded min-w-[60px] text-center ${

                        countDiff !== null

                          ? countDiff > 0 ? 'bg-green-100 text-green-800' :

                            countDiff < 0 ? 'bg-red-100 text-red-800' : 'bg-muted'

                          : 'bg-muted'

                      }`}>

                        {countDiff !== null

                          ? `${countDiff > 0 ? '+' : ''}${countDiff}`

                          : '-'

                        }

                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">{t('item.added')}:</p>

                      <NumpadInput

                        value={addedValues[item.id] || ''}

                        onChange={(value) => handleAddedChange(item.id, value)}

                        placeholder="0"

                        className="w-20"

                      />

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[40px]">{t('item.waste')}:</p>

                      <NumpadInput

                        value={wasteValues[item.id] || ''}

                        onChange={(value) => setWasteValues(prev => ({ ...prev, [item.id]: value === '' ? '' : Number(value) }))}

                        placeholder="0"

                        className="w-20"

                      />

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">{t('item.total')}:</p>

                      <p className="bg-primary text-primary-foreground px-2 py-1 rounded min-w-[60px] text-center">

                        {totalAfterCount}

                      </p>

                    </div>

                  </div>

                </div>

                {/* Action Buttons */}
                {(() => {
                  const hasChanges =
                    (countedValues[item.id] !== undefined && countedValues[item.id] !== '') ||
                    (addedValues[item.id] !== undefined && addedValues[item.id] !== 0 && addedValues[item.id] !== '') ||
                    (wasteValues[item.id] !== undefined && wasteValues[item.id] !== 0 && wasteValues[item.id] !== '') ||
                    (priceValues[item.id] !== undefined && priceValues[item.id] !== '') ||
                    (costValues[item.id] !== undefined && costValues[item.id] !== '') ||
                    (barcodeValues[item.id] !== undefined && barcodeValues[item.id] !== item.barcode);

                  if (!hasChanges) return null;

                  return (
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <Button
                        onClick={() => {
                          // Reset all changes for this item
                          setCountedValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                          setAddedValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                          setPriceValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                          setCostValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                          setBarcodeValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                          setWasteValues(prev => {
                            const newValues = { ...prev };
                            delete newValues[item.id];
                            return newValues;
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Undo2 className="h-4 w-4 mr-1" />
                        {t('controls.undo')}
                      </Button>
                      <Button
                        onClick={async () => {
                          // Apply changes for this single item
                          const countedValue: number | null = typeof countedValues[item.id] === 'number' ? countedValues[item.id] as number : null;
                          const addedValue: number = typeof addedValues[item.id] === 'number' ? addedValues[item.id] as number : 0;
                          const wasteValue: number = typeof wasteValues[item.id] === 'number' ? wasteValues[item.id] as number : 0;
                          const pendingPrice: number | null = typeof priceValues[item.id] === 'number' ? priceValues[item.id] as number : null;
                          const pendingCost: number | null = typeof costValues[item.id] === 'number' ? costValues[item.id] as number : null;
                          const pendingBarcode = barcodeValues[item.id] || null;

                          let finalCount = item.count;
                          if (countedValue !== null) {
                            finalCount = countedValue + (addedValue as number);
                          } else if (addedValue > 0) {
                            finalCount = item.count + addedValue;
                          }

                          const stockChanged = finalCount !== item.count;
                          const previousPrice = typeof item.price === 'number' ? item.price : undefined;
                          const priceChanged = pendingPrice !== null && (previousPrice === undefined || Math.abs(pendingPrice - previousPrice) > 0.0001);
                          const previousCost = typeof item.cost === 'number' ? item.cost : undefined;
                          const costChanged = pendingCost !== null && (previousCost === undefined || Math.abs(pendingCost - previousCost) > 0.0001);
                          const barcodeChanged = pendingBarcode !== null && pendingBarcode.trim() !== '' && pendingBarcode !== item.barcode;

                          if (!stockChanged && !priceChanged && !costChanged && !barcodeChanged) {
                            return;
                          }

                          try {
                            // Perform updates using existing functions
                            if (stockChanged) {
                              await updateProductStock(item.id, finalCount);
                            }

                            if (priceChanged) {
                              await updateProductPrice(item.id, pendingPrice as number);
                            }

                            if (costChanged) {
                              await updateProductCost(item.id, pendingCost as number);
                            }

                            if (barcodeChanged) {
                              await updateProductBarcode(item.id, pendingBarcode as string);
                            }

                            // Add to counting session if active
                            if (isSessionActive) {
                              const wasteCost = wasteValue > 0 && previousCost !== undefined
                                ? wasteValue * previousCost
                                : undefined;

                              addChange({
                                productId: item.id,
                                productName: item.name,
                                barcode: item.barcode,
                                previousCount: item.count,
                                countedValue: countedValue ?? undefined,
                                addedValue: addedValue as number,
                                wasteValue: wasteValue > 0 ? wasteValue : undefined,
                                wasteCost,
                                finalCount: finalCount,
                                previousPrice,
                                newPrice: priceChanged ? (pendingPrice as number) : previousPrice,
                                previousCost,
                                newCost: costChanged ? (pendingCost as number) : previousCost,
                                timestamp: new Date().toISOString(),
                              });

                              // Mark product as counted
                              setCountedProductIds(prev => new Set([...prev, item.id]));
                            }

                            // Update local state
                            setStockData(prev => prev.map(product => {
                              if (product.id === item.id) {
                                return {
                                  ...product,
                                  count: finalCount,
                                  price: priceChanged ? (pendingPrice as number) : product.price,
                                  cost: costChanged ? (pendingCost as number) : product.cost,
                                  barcode: barcodeChanged ? (pendingBarcode as string) : product.barcode,
                                };
                              }
                              return product;
                            }));

                            // Clear the values for this item
                            setCountedValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });
                            setAddedValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });
                            setPriceValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });
                            setCostValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });
                            setBarcodeValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });
                            setWasteValues(prev => {
                              const newValues = { ...prev };
                              delete newValues[item.id];
                              return newValues;
                            });

                            addLog('success', 'APPLY', `Değişiklikler uygulandı: ${item.name}`);
                          } catch (error) {
                            addLog('error', 'APPLY', `Hata: ${item.name} güncellenemedi`, error);
                            showToast('error', t('errors.updateFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
                          }
                        }}
                        size="sm"
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Uygula
                      </Button>
                    </div>
                  );
                })()}

              </div>

            );

            })}

          </div>

          {filteredStockData.length === 0 && (searchQuery || activeProductGroupFilter !== null) && (

            <div className="text-center py-8 text-muted-foreground">

              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />

              {searchQuery ? (

                <>

                  <p>"{searchQuery}" araması için sonuç bulunamadı</p>

                  <p className="text-sm mt-2">Ürün adı veya barkod numarasını kontrol edin</p>

                </>

              ) : (

                <>

                  <p>Bu kategoride ürün bulunamadı</p>

                  <p className="text-sm mt-2">Farklı bir kategori seçin veya "Hepsini Göster" butonuna tıklayın</p>

                </>

              )}

            </div>

          )}

        </div>

          </>

        )}



        {/* Enlarged Image Modal */}

        {enlargedImage && (

          <div 

            className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"

            onClick={() => setEnlargedImage(null)}

          >

            <div 

              className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden shadow-2xl"

              onClick={(e) => e.stopPropagation()}

            >

              {/* Close button */}

              <Button

                variant="outline"

                size="sm"

                className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white"

                onClick={() => setEnlargedImage(null)}

              >

                <X className="h-4 w-4" />

              </Button>

              

              {/* Product name header */}

              <div className="absolute top-2 left-2 z-10 bg-black/70 text-white px-3 py-1 rounded text-sm">

                {enlargedImage.name}

              </div>

              

              {/* Large image */}

              <ImageWithFallback

                src={enlargedImage.url}

                alt={enlargedImage.name}

                className="max-w-full max-h-[80vh] object-contain cursor-pointer"

                onClick={() => setEnlargedImage(null)}

              />

              

              {/* Tap to close hint for mobile */}

              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-xs sm:hidden">

                {t('ui.tapToClose')}

              </div>

            </div>

          </div>

        )}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      </div>

    </div>

  );

}



