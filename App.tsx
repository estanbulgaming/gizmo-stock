import React, { useEffect, useState } from 'react';

import { NumpadInput } from './components/NumpadInput';


import { Calendar } from './components/ui/calendar';

import { Card } from './components/ui/card';

import { Button } from './components/ui/button';

import { Input } from './components/ui/input';

import { Label } from './components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

import { Checkbox } from './components/ui/checkbox';

import { Download, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Settings, RefreshCw, Eye, EyeOff, X, Search, ImageIcon, Filter, Terminal, Trash2, Copy, Undo2, Check } from 'lucide-react';

import { Progress } from './components/ui/progress';

import { ImageWithFallback } from './components/figma/ImageWithFallback';

import { t, getLang, setLang, availableLanguages, languageNames, Lang } from './i18n';

import { DEFAULT_API_CONFIG, useApiConfig } from './hooks/useApiConfig';

import { formatPrice } from './utils/product';
import { DailyReport, ProductGroup, StockChange, StockData, SystemLogEntry } from './types/stock';
import { fetchProductGroups as fetchProductGroupsService, fetchProductImageUrl, fetchProducts as fetchProductsService, updatePreviousPrice, updateNextPrice, updatePreviousCost, updateNextCost } from './services/api';



export default function App() {

  const [stockData, setStockData] = useState<StockData[]>([]);

  const [countedValues, setCountedValues] = useState<{ [key: string]: number | '' }>({});

  const [addedValues, setAddedValues] = useState<{ [key: string]: number | '' }>({});

  const [priceValues, setPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [previousPriceValues, setPreviousPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [nextPriceValues, setNextPriceValues] = useState<{ [key: string]: number | '' }>({});

  const [costValues, setCostValues] = useState<{ [key: string]: number | '' }>({});

  const [previousCostValues, setPreviousCostValues] = useState<{ [key: string]: number | '' }>({});

  const [nextCostValues, setNextCostValues] = useState<{ [key: string]: number | '' }>({});

  const [barcodeValues, setBarcodeValues] = useState<{ [key: string]: string }>({});

  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);

  const [currentPage, setCurrentPage] = useState<'stock' | 'history' | 'settings'>('stock');

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [showDateList, setShowDateList] = useState(true);

  const [currentDateIndex, setCurrentDateIndex] = useState(0);

  

  // API Configuration states

  const [apiConfig, setApiConfig] = useApiConfig(DEFAULT_API_CONFIG);

  // Language state - triggers re-render when language changes
  const [currentLanguage, setCurrentLanguage] = useState<Lang>(getLang());


  // Use relative base path so dev (Vite) and prod (Nginx) proxies handle CORS

  const apiBase = '/api';

  const joinApi = (path: string) => {

    let p = (path || '').trim();

    if (!p.startsWith('/')) p = '/' + p;

    return p.startsWith('/api/') ? p : `${apiBase}${p}`;

  };



  // Auto-load missing product images when the setting is enabled

  useEffect(() => {

    if (!apiConfig.showProductImages || stockData.length === 0) return;

    const idsToLoad = stockData

      .filter(p => !p.imageUrl && !productImages[p.id])

      .slice(0, 24)

      .map(p => p.id);

    if (idsToLoad.length === 0) return;

    const concurrency = 5;

    (async () => {

      for (let i = 0; i < idsToLoad.length; i += concurrency) {

        const batch = idsToLoad.slice(i, i + concurrency);

        await Promise.all(batch.map(id => loadProductImage(id)));

      }

    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.showProductImages, stockData]);

  const [showPassword, setShowPassword] = useState(false);

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [productImages, setProductImages] = useState<{ [key: string]: string }>({});

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





  const handleCountedChange = (id: string, countedValue: number | '') => {

    setCountedValues(prev => ({

      ...prev,

      [id]: countedValue

    }));

  };



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



  const handleAddedChange = (id: string, addedValue: number | '') => {

    setAddedValues(prev => ({

      ...prev,

      [id]: addedValue

    }));

  };



  const handlePriceInputChange = (id: string, inputValue: string) => {

    const normalized = inputValue.replace(',', '.').trim();

    if (normalized === '') {

      setPriceValues(prev => ({

        ...prev,

        [id]: ''

      }));

      return;

    }



    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {

      return;

    }



    setPriceValues(prev => ({

      ...prev,

      [id]: parsed

    }));

  };

  const handlePriceChange = (id: string, value: number | '') => {

    setPriceValues(prev => ({

      ...prev,

      [id]: value

    }));

  };

  const handleCostChange = (id: string, value: number | '') => {

    setCostValues(prev => ({

      ...prev,

      [id]: value

    }));

  };

  const handleBarcodeChange = (id: string, value: string) => {

    setBarcodeValues(prev => ({

      ...prev,

      [id]: value

    }));

  };



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



  // Load product image for a specific product (real API via proxy)

  const loadProductImage = async (productId: string) => {
    if (!apiConfig.showProductImages) return;
    if (productImages[productId]) return;
    const product = stockData.find(p => p.id === productId);
    if (!product) {
      addLog('warning', 'IMAGE', `Ürün bulunamadı: ${productId}`);
      return;
    }
    addLog('info', 'IMAGE', `Ürün fotoğrafı yükleniyor: ${product.name}`);
    try {
      const imageUrl = await fetchProductImageUrl({ apiConfig, joinApi }, productId, product);
      if (!imageUrl) {
        addLog('warning', 'IMAGE', 'Ürün için fotoğraf bulunamadı');
        return;
      }
      setProductImages(prev => ({
        ...prev,
        [productId]: imageUrl,
      }));
      setStockData(prev => prev.map(item =>
        item.id === productId ? { ...item, imageUrl } : item
      ));
      addLog('success', 'IMAGE', `Ürün fotoğrafı yüklendi: ${product.name}`);
    } catch (error) {
      addLog('error', 'IMAGE', `Ürün fotoğrafı yüklenirken hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
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

        throw new Error(`HTTP error! status: ${response.status}`);

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
      let errorMessage = 'Ürün kategorileri yüklenirken hata oluştu!';
      if (error instanceof Error) {
        errorMessage += `\n\nDetay: ${error.message}`;
      }
      alert(errorMessage);
    }
  };



  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    addLog('info', 'PRODUCTS_API', 'Ürünler yükleniyor...');
    const deletedParam = apiConfig.includeDeleted ? "IsDeleted=true" : "IsDeleted=false";
    const requestUrl = `${joinApi(apiConfig.endpoint)}?${deletedParam}&${apiConfig.baseParams}&Pagination.Limit=${apiConfig.paginationLimit}`;
    addLog('info', 'PRODUCTS_API', 'API çağrısı yapılıyor', {
      url: requestUrl,
      auth: `${apiConfig.username}:***`,
      params: { deletedParam, limit: apiConfig.paginationLimit },
    });
    try {
      const { products, totalProducts, totalStock } = await fetchProductsService({ apiConfig, joinApi });
      setStockData(products);
      setCountedValues({});
      setAddedValues({});
      setPriceValues({});
      fetchStocksForProducts(products.map((p) => p.id));
      addLog('success', 'PRODUCTS_API', `${totalProducts} ürün yüklendi, toplam stok: ${totalStock}`, {
        productCount: totalProducts,
        totalStock,
        hasImages: products.filter(p => p.imageUrl).length,
      });
      if (apiConfig.showProductImages) {
        const idsToLoad = products
          .filter(p => !p.imageUrl)
          .slice(0, 24)
          .map(p => p.id);
        if (idsToLoad.length > 0) {
          const concurrency = 5;
          for (let i = 0; i < idsToLoad.length; i += concurrency) {
            const batch = idsToLoad.slice(i, i + concurrency);
            await Promise.all(batch.map(id => loadProductImage(id)));
          }
        }
      }
    } catch (error) {
      addLog('error', 'PRODUCTS_API', 'Ürünler yüklenirken hata', error);
      let errorMessage = 'Ürünler yüklenirken hata oluştu!';
      if (error instanceof Error) {
        errorMessage += `\n\nDetay: ${error.message}`;
      }
      alert(errorMessage);
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



    const updatedStockData = stockData.map(item => {

      const countedValue = typeof countedValues[item.id] === 'number' ? countedValues[item.id] : null;

      const addedValue = typeof addedValues[item.id] === 'number' ? addedValues[item.id] : 0;

      const pendingPrice = typeof priceValues[item.id] === 'number' ? priceValues[item.id] : null;

      const pendingCost = typeof costValues[item.id] === 'number' ? costValues[item.id] : null;

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



      if (stockChanged || priceChanged || costChanged || barcodeChanged) {

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



        newChanges.push({

          id: item.id,

          date: today,

          productName: item.name,

          change: changeValue,

          reason,

          previousCount: item.count,

          countedValue: countedValue ?? undefined,

          addedValue: addedValue as number,

          finalCount: finalCount,

          previousPrice,

          newPrice: priceChanged ? (pendingPrice as number) : previousPrice,

          priceChange: computedPriceChange,

          previousCost,

          newCost: costChanged ? (pendingCost as number) : previousCost,

          costChange: computedCostChange

        });

      }



      return {

        ...item,

        count: finalCount,

        price: priceChanged ? (pendingPrice as number) : item.price,

        cost: costChanged ? (pendingCost as number) : item.cost,

        barcode: barcodeChanged ? (pendingBarcode as string) : item.barcode

      };

    });



    if (stockUpdates.length === 0 && priceUpdates.length === 0 && costUpdates.length === 0 && barcodeUpdates.length === 0) {

      alert('Guncellenecek stok, fiyat, maliyet veya barkod degisikligi bulunamadi!');

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



    const confirmMessageLines: string[] = [

      `Toplam ${stockUpdates.length + priceUpdates.length + costUpdates.length + barcodeUpdates.length} guncelleme uygulanacak.`

    ];

    if (summaryParts.length > 0) {

      confirmMessageLines.push(summaryParts.join('\n'));

    }

    confirmMessageLines.push('Isleme devam etmek istiyor musunuz?');



    if (!confirm(confirmMessageLines.join('\n\n'))) {

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



      const totalFailures = failedStock.length + failedPrice.length + failedCost.length + failedBarcode.length;

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

        alert(`Guncelleme tamamlandi fakat bazi kayitlar basarisiz oldu.\n\n${failureLines.join('\n')}`);

      } else {

        const successLines: string[] = [];

        if (stockUpdates.length > 0) {

          successLines.push(`${successfulStock.length} stok guncellemesi`);

        }

        if (priceUpdates.length > 0) {

          successLines.push(`${successfulPrice.length} fiyat guncellemesi`);

        }

        if (costUpdates.length > 0) {

          successLines.push(`${successfulCost.length} maliyet guncellemesi`);

        }

        if (barcodeUpdates.length > 0) {

          successLines.push(`${successfulBarcode.length} barkod guncellemesi`);

        }

        alert(`Tum guncellemeler basariyla tamamlandi!\n\n${successLines.join('\n')}`);

      }



      setStockData(updatedStockData);

      setStockChanges(prev => [...prev, ...newChanges]);

      setCountedValues({});

      setAddedValues({});

      setPriceValues({});

      setBarcodeValues({});

      setCostValues({});

    } catch (error) {

      if (stockUpdates.length > 0) {

        addLog('error', 'STOCK_BATCH', 'Kritik hata: Stok guncelleme basarisiz', error);

      }

      if (priceUpdates.length > 0) {

        addLog('error', 'PRICE_BATCH', 'Kritik hata: Fiyat guncelleme basarisiz', error);

      }

      alert(`Guncelleme sirasinda kritik hata olustu!



Detay: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}



Lutfen tekrar deneyin.`);

    }

  };



  const resetAllToZero = () => {

    // If categories are selected, target only those groups; otherwise use current filters

    const filtered = selectedProductGroups.length > 0

      ? stockData.filter(it => selectedProductGroups.includes((it.productGroupId ?? -1)))

      : getFilteredStockData();

    if (filtered.length === 0) {

      alert('Filtreye uyan ürün bulunamadı.');

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

    alert(`Filtreye uyan ${filtered.length} ürün 0 olarak sayıldı.\n\n"Değişiklikleri Uygula" ile stokları 0'a güncelleyebilirsiniz.`);

  };



  const _totalStock = stockData.reduce((sum, item) => sum + item.count, 0);



  // Filter and sort stock data based on search query and product group

  const getFilteredStockData = () => {

    let filteredData = stockData;



    // Apply product group filter first

    if (activeProductGroupFilter !== null) {

      filteredData = stockData.filter(item => item.productGroupId === activeProductGroupFilter);

    }



    // Then apply search filter if there's a query

    if (!searchQuery.trim()) {

      return filteredData;

    }



    const query = searchQuery.toLowerCase().trim();

    

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

      // Check for partial matches (name contains search query or barcode starts with query)

      else if (nameMatch.includes(query) || barcodeMatch.includes(query)) {

        partialMatches.push(item);

      }

    });

    

    // Return exact matches first, then partial matches

    return [...exactMatches, ...partialMatches];

  };



  const filteredStockData = getFilteredStockData();



  const clearSearch = () => {

    setSearchQuery('');

  };



  // Get dates that have stock changes

  const getDatesWithChanges = (): Date[] => {

    const uniqueDates = [...new Set(stockChanges.map(change => change.date))];

    return uniqueDates.map(dateStr => {

      const [day, month, year] = dateStr.split('.');

      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    });

  };



  // Get daily report for a specific date

  const getDailyReport = (date: Date): DailyReport => {



    const dateStr = date.toLocaleDateString('tr-TR');



    const dayChanges = stockChanges.filter(change => change.date === dateStr);



    



    const totalCounted = dayChanges.filter(c => c.reason.includes('Say?m')).length;



    const totalAdded = dayChanges.filter(c => c.reason.includes('Ekleme')).length;



    const totalChanged = dayChanges.reduce((sum, c) => sum + Math.abs(c.change), 0);



    const totalPriceChanges = dayChanges.filter(change => {



      const previous = typeof change.previousPrice === 'number' ? change.previousPrice : undefined;



      const next = typeof change.newPrice === 'number' ? change.newPrice : undefined;



      if (previous === undefined && next === undefined) return false;



      if (previous === undefined || next === undefined) return true;



      return Math.abs(next - previous) > 0.0001;



    }).length;



    



    return {



      date: dateStr,



      totalProducts: dayChanges.length,



      totalCounted,



      totalAdded,



      totalChanged,



      totalPriceChanges,



      changes: dayChanges



    };



  };







  // Get unique dates sorted by date

  const getUniqueDatesSorted = (): string[] => {

    const uniqueDates = [...new Set(stockChanges.map(change => change.date))];

    return uniqueDates.sort((a, b) => {

      const [dayA, monthA, yearA] = a.split('.').map(Number);

      const [dayB, monthB, yearB] = b.split('.').map(Number);

      const dateA = new Date(yearA, monthA - 1, dayA);

      const dateB = new Date(yearB, monthB - 1, dayB);

      return dateB.getTime() - dateA.getTime(); // Most recent first

    });

  };



  // Navigation functions

  const navigateToDate = (direction: 'prev' | 'next') => {

    const sortedDates = getUniqueDatesSorted();

    if (sortedDates.length === 0) return;



    let newIndex = currentDateIndex;

    if (direction === 'prev' && currentDateIndex > 0) {

      newIndex = currentDateIndex - 1;

    } else if (direction === 'next' && currentDateIndex < sortedDates.length - 1) {

      newIndex = currentDateIndex + 1;

    }



    setCurrentDateIndex(newIndex);

    const [day, month, year] = sortedDates[newIndex].split('.').map(Number);

    setSelectedDate(new Date(year, month - 1, day));

  };



  // Handle keyboard navigation

  const handleKeyPress = (e: KeyboardEvent) => {

    if (currentPage === 'history' && selectedDate) {

      if (e.key === 'ArrowLeft') {

        navigateToDate('prev');

      } else if (e.key === 'ArrowRight') {

        navigateToDate('next');

      }

    }

  };



  // Add keyboard event listener

  React.useEffect(() => {

    document.addEventListener('keydown', handleKeyPress);

    return () => document.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedDate, currentDateIndex]);



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



  // Download CSV report for a specific date

  const downloadCSVReport = (report: DailyReport) => {



    const headers = ['Urun Adi', 'Mevcut', 'Sayim', 'Eklenen', 'Fark (Sayim)', 'Toplam', 'Eski Fiyat', 'Yeni Fiyat', 'Fiyat Farki', 'Islem Turu', 'Tarih'];



    const rows = report.changes.map(change => {



      const countDifference = change.countedValue !== undefined && change.countedValue !== null



        ? change.countedValue - change.previousCount



        : 0;



      const totalAmount = change.countedValue !== undefined && change.countedValue !== null



        ? change.countedValue + (change.addedValue || 0)



        : change.previousCount + (change.addedValue || 0);



      const previousPrice = typeof change.previousPrice === 'number' ? change.previousPrice : null;



      const newPrice = typeof change.newPrice === 'number' ? change.newPrice : null;



      let priceDifference: number | null = null;



      if (typeof change.priceChange === 'number') {



        priceDifference = change.priceChange;



      } else if (previousPrice !== null && newPrice !== null) {



        priceDifference = newPrice - previousPrice;



      } else if (previousPrice === null && newPrice !== null) {



        priceDifference = newPrice;



      } else if (previousPrice !== null && newPrice === null) {



        priceDifference = -previousPrice;



      }







      return [



        change.productName,



        change.previousCount.toString(),



        change.countedValue?.toString() || '-',



        change.addedValue?.toString() || '0',



        change.countedValue !== undefined && change.countedValue !== null



          ? (countDifference > 0 ? '+' : '') + countDifference.toString()



          : '-',



        totalAmount.toString(),



        previousPrice !== null ? previousPrice.toFixed(2) : '-',



        newPrice !== null ? newPrice.toFixed(2) : '-',



        priceDifference !== null ? `${priceDifference > 0 ? '+' : ''}${priceDifference.toFixed(2)}` : '-',



        change.reason,



        change.date



      ];



    });







    const csvContent = [



      headers.join(','),



      ...rows.map(row => row.join(','))



    ].join('\n');







    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });



    const link = document.createElement('a');



    const url = URL.createObjectURL(blob);



    link.setAttribute('href', url);



    link.setAttribute('download', `stok_raporu_${report.date.replace(/\./g, '_')}.csv`);



    link.style.visibility = 'hidden';



    document.body.appendChild(link);



    link.click();



    document.body.removeChild(link);



  };







  const StockHistoryPage = () => {

    const datesWithChanges = getDatesWithChanges();

    const uniqueDatesSorted = getUniqueDatesSorted();

    const selectedReport = selectedDate ? getDailyReport(selectedDate) : null;



    return (

      <div className="space-y-6">

        <div>

          <h2>Stok Sayım Geçmişi</h2>

          <p className="text-muted-foreground">Günlük stok değişikliklerini görüntüleyin (← → tuşları ile navigasyon)</p>

        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* Calendar/Date List */}

          <Card className="p-3 sm:p-4">

            <div className="space-y-4">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2">

                  {showDateList ? <List className="h-5 w-5" /> : <CalendarIcon className="h-5 w-5" />}

                  <h3>{showDateList ? 'Sayım Günleri' : 'Sayım Takvimi'}</h3>

                </div>

                <Button

                  variant="outline"

                  size="sm"

                  onClick={() => setShowDateList(!showDateList)}

                  className="flex items-center gap-2"

                >

                  {showDateList ? <CalendarIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}

                  {showDateList ? 'Takvim' : 'Liste'}

                </Button>

              </div>



              {showDateList ? (

                <div className="space-y-2 max-h-80 overflow-y-auto">

                  {uniqueDatesSorted.length === 0 ? (

                    <p className="text-muted-foreground text-center py-8">Henüz sayım yapılmamış</p>

                  ) : (

                    uniqueDatesSorted.map((dateStr, index) => {

                      const [day, month, year] = dateStr.split('.').map(Number);

                      const date = new Date(year, month - 1, day);

                      const isSelected = selectedDate && selectedDate.toLocaleDateString('tr-TR') === dateStr;

                      const report = getDailyReport(date);

                      

                      return (

                        <div

                          key={dateStr}

                          onClick={() => {

                            setSelectedDate(date);

                            setCurrentDateIndex(index);

                          }}

                          className={`p-3 rounded cursor-pointer border transition-colors ${

                            isSelected 

                              ? 'bg-primary text-primary-foreground border-primary' 

                              : 'hover:bg-muted border-border'

                          }`}

                        >

                          <div className="flex items-center justify-between">

                            <div>

                              <p className="font-medium">{dateStr}</p>

                              <p className="text-sm opacity-80">

                                {report.totalProducts} ürün, {report.totalChanged} değişiklik

                              </p>

                            </div>

                            <div className="text-right">

                              <p className="text-sm">Sayılan: {report.totalCounted}</p>

                              <p className="text-sm">Eklenen: {report.totalAdded}</p>

                            </div>

                          </div>

                        </div>

                      );

                    })

                  )}

                </div>

              ) : (

                <>

                  <Calendar

                    mode="single"

                    selected={selectedDate}

                    onSelect={(date) => {

                      if (date) {

                        setSelectedDate(date);

                        const dateStr = date.toLocaleDateString('tr-TR');

                        const index = uniqueDatesSorted.indexOf(dateStr);

                        if (index !== -1) setCurrentDateIndex(index);

                      }

                    }}

                    modifiers={{

                      hasChanges: datesWithChanges

                    }}

                    modifiersStyles={{

                      hasChanges: {

                        backgroundColor: 'hsl(var(--primary))',

                        color: 'hsl(var(--primary-foreground))',

                        fontWeight: 'bold'

                      }

                    }}

                    className="rounded-md border"

                  />

                  <button

                    onClick={() => setShowDateList(true)}

                    className="text-sm text-primary hover:underline cursor-pointer"

                  >

                    <div className="flex items-center gap-2">

                      <div className="w-3 h-3 bg-primary rounded"></div>

                      <span>Sayım yapılan günler</span>

                    </div>

                  </button>

                </>

              )}

            </div>

          </Card>



          {/* Daily Report */}

          <Card className="p-3 sm:p-4">

            {selectedReport ? (

              <div className="space-y-4">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-2">

                    <Button

                      variant="outline"

                      size="sm"

                      onClick={() => navigateToDate('prev')}

                      disabled={currentDateIndex === 0}

                    >

                      <ChevronLeft className="h-4 w-4" />

                    </Button>

                    <h3>Günlük Rapor - {selectedReport.date}</h3>

                    <Button

                      variant="outline"

                      size="sm"

                      onClick={() => navigateToDate('next')}

                      disabled={currentDateIndex === uniqueDatesSorted.length - 1}

                    >

                      <ChevronRight className="h-4 w-4" />

                    </Button>

                  </div>

                  <Button

                    size="sm"

                    onClick={() => downloadCSVReport(selectedReport)}

                    className="flex items-center gap-2"

                  >

                    <Download className="h-4 w-4" />

                    CSV ?ndir

                  </Button>

                </div>



                {/* Summary Stats */}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">

                  <div className="bg-muted p-2 sm:p-3 rounded">

                    <p className="text-xs sm:text-sm text-muted-foreground">Toplam Urun</p>

                    <p className="text-lg sm:text-2xl font-bold">{selectedReport.totalProducts}</p>

                  </div>

                  <div className="bg-muted p-2 sm:p-3 rounded">

                    <p className="text-xs sm:text-sm text-muted-foreground">Sayilan Urun</p>

                    <p className="text-lg sm:text-2xl font-bold">{selectedReport.totalCounted}</p>

                  </div>

                  <div className="bg-muted p-2 sm:p-3 rounded">

                    <p className="text-xs sm:text-sm text-muted-foreground">Eklenen Urun</p>

                    <p className="text-lg sm:text-2xl font-bold">{selectedReport.totalAdded}</p>

                  </div>

                  <div className="bg-muted p-2 sm:p-3 rounded">

                    <p className="text-xs sm:text-sm text-muted-foreground">Toplam Degisim</p>

                    <p className="text-lg sm:text-2xl font-bold">{selectedReport.totalChanged}</p>

                  </div>

                  <div className="bg-muted p-2 sm:p-3 rounded">

                    <p className="text-xs sm:text-sm text-muted-foreground">Fiyat Degisimi</p>

                    <p className="text-lg sm:text-2xl font-bold">{selectedReport.totalPriceChanges}</p>

                  </div>

                </div>



                {/* Changes List */}



                <div className="space-y-2">

                  <h4>De?i?iklik Detaylar?</h4>

                  <div className="max-h-64 overflow-y-auto space-y-2">

                    {selectedReport.changes.map((change, index) => {

                      const priceDelta = typeof change.priceChange === 'number'

                        ? change.priceChange

                        : typeof change.newPrice === 'number' && typeof change.previousPrice === 'number'

                          ? change.newPrice - change.previousPrice

                          : typeof change.newPrice === 'number'

                            ? change.newPrice

                            : typeof change.previousPrice === 'number'

                              ? -change.previousPrice

                              : null;

                      return (

                        <div key={index} className="py-2 px-3 bg-muted rounded">

                        <div className="flex items-center justify-between mb-2">

                          <div className="flex-1">

                            <p className="text-sm font-medium">{change.productName}</p>

                            <p className="text-xs text-muted-foreground">{change.reason}</p>

                          </div>

                          <div className={`px-2 py-1 rounded text-sm ${

                            change.change > 0 

                              ? 'bg-green-100 text-green-800' 

                              : 'bg-red-100 text-red-800'

                          }`}>

                            {change.change > 0 ? '+' : ''}{change.change}

                          </div>

                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-2 text-xs">

                          <div className="text-center">

                            <p className="text-muted-foreground">Mevcut</p>

                            <p className="font-medium">{change.previousCount}</p>

                          </div>

                          <div className="text-center">

                            <p className="text-muted-foreground">Sayim</p>

                            <p className="font-medium">{change.countedValue ?? '-'}</p>

                          </div>

                          <div className="text-center hidden sm:block">

                            <p className="text-muted-foreground">Eklenen</p>

                            <p className="font-medium">{change.addedValue || 0}</p>

                          </div>

                          <div className="text-center hidden sm:block">

                            <p className="text-muted-foreground">Fark</p>

                            <p className={`font-medium ${

                              change.countedValue !== undefined && change.countedValue !== null

                                ? (change.countedValue - change.previousCount > 0 ? 'text-green-600' : 

                                   change.countedValue - change.previousCount < 0 ? 'text-red-600' : 'text-muted-foreground')

                                : 'text-muted-foreground'

                            }`}>

                              {change.countedValue !== undefined && change.countedValue !== null

                                ? (change.countedValue - change.previousCount > 0 ? '+' : '') + (change.countedValue - change.previousCount)

                                : '-'

                              }

                            </p>

                          </div>

                          <div className="text-center">

                            <p className="text-muted-foreground">Toplam</p>

                            <p className="font-medium">

                              {change.countedValue !== undefined && change.countedValue !== null

                                ? change.countedValue + (change.addedValue || 0)

                                : change.previousCount + (change.addedValue || 0)

                              }

                            </p>

                          </div>

                        </div>

                        {(change.previousPrice !== undefined || change.newPrice !== undefined) && (

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-2 text-xs mt-2">

                            <div className="text-center">

                              <p className="text-muted-foreground">Eski Fiyat</p>

                              <p className="font-medium">{formatPrice(change.previousPrice ?? null)}</p>

                            </div>

                            <div className="text-center">

                              <p className="text-muted-foreground">Yeni Fiyat</p>

                              <p className="font-medium">{formatPrice(change.newPrice ?? null)}</p>

                            </div>

                            <div className="text-center">

                              <p className="text-muted-foreground">Fiyat Farki</p>

                              <p className={`font-medium ${

                                priceDelta !== null

                                  ? priceDelta > 0 ? 'text-green-600' :

                                    priceDelta < 0 ? 'text-red-600' : 'text-muted-foreground'

                                  : 'text-muted-foreground'

                              }`}>

                                {priceDelta !== null

                                  ? `${priceDelta > 0 ? '+' : ''}${priceDelta.toFixed(2)}`

                                  : '-'

                                }

                              </p>

                            </div>

                          </div>

                        )}

                      </div>

                      );

                    })}

                  </div>

                </div>

              </div>

            ) : (

              <div className="text-center py-8">

                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />

                <p className="text-muted-foreground">Günlük rapor görmek için {showDateList ? 'listeden' : 'takvimden'} bir tarih seçin</p>

                {uniqueDatesSorted.length === 0 && (

                  <p className="text-sm text-muted-foreground mt-2">Henüz hiç sayım yapılmamış</p>

                )}

              </div>

            )}

          </Card>

        </div>



        {/* All Changes History */}

        <Card className="p-4">

          <h3 className="mb-4">Tüm Değişiklikler</h3>

          {stockChanges.length === 0 ? (

            <p className="text-muted-foreground text-center py-8">Henüz stok değişikliği yok</p>

          ) : (

            <div className="space-y-3 max-h-96 overflow-y-auto">

              {stockChanges.slice().reverse().map((change, index) => (

                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">

                  <div className="flex-1">

                    <p className="text-sm text-muted-foreground">{change.date}</p>

                    <p>{change.productName}</p>

                    <p className="text-xs text-muted-foreground">{change.reason}</p>

                    <div className="text-xs text-muted-foreground mt-1 space-y-1">

                      <div>

                        Mevcut: {change.previousCount} ? Son: {change.finalCount}

                        {change.countedValue !== undefined && ` (Say?m: ${change.countedValue})`}

                        {change.addedValue ? ` (Eklenen: ${change.addedValue})` : ''}

                      </div>

                      {(change.previousPrice !== undefined || change.newPrice !== undefined) && (

                        <div>

                          Fiyat: {formatPrice(change.previousPrice ?? null)} ? {formatPrice(change.newPrice ?? null)}

                          {typeof change.priceChange === 'number' && ` (${change.priceChange > 0 ? '+' : ''}${change.priceChange.toFixed(2)})`}

                        </div>

                      )}

                    </div>

                  </div>

                  <div className={`px-3 py-1 rounded ${

                    change.change > 0 

                      ? 'bg-green-100 text-green-800' 

                      : 'bg-red-100 text-red-800'

                  }`}>

                    {change.change > 0 ? '+' : ''}{change.change}

                  </div>

                </div>

              ))}

            </div>

          )}

        </Card>

      </div>

    );

  };



  const SettingsPage = () => {

    const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');

    // API URL test states
    const [apiUrlTests, setApiUrlTests] = useState<{[key: string]: boolean}>({});
    const [editableUrls, setEditableUrls] = useState({
      productsUrl: `curl -u ${apiConfig.username}:${apiConfig.password} "http://${apiConfig.serverIP}${apiConfig.endpoint}?${apiConfig.includeDeleted ? 'IsDeleted=true' : 'IsDeleted=false'}&${apiConfig.baseParams}&Pagination.Limit=${apiConfig.paginationLimit}"`,
      categoriesUrl: `curl -u ${apiConfig.username}:${apiConfig.password} "http://${apiConfig.serverIP}${apiConfig.groupsEndpoint}"`,
      stockUpdateUrl: `curl -u ${apiConfig.username}:${apiConfig.password} -X POST "http://${apiConfig.serverIP}/api/stock/[PRODUCT_ID]/[NEW_STOCK_COUNT]"`,
      priceUpdateUrl: `curl -H "Content-Type: application/json" -u ${apiConfig.username}:${apiConfig.password} -X PUT "http://${apiConfig.serverIP}${joinApi('/v2.0/products')}" -d '{"id": [PRODUCT_ID], "productType": [PRODUCT_TYPE], "guid": "[PRODUCT_GUID]", "productGroupId": [PRODUCT_GROUP_ID], "name": "[PRODUCT_NAME]", "price": [NEW_PRICE], "cost": [NEW_COST], "barcode": "[BARCODE]"}'`
    });



    const filteredLogs = systemLogs.filter(log =>

      logFilter === 'all' || log.level === logFilter

    );

    const testApiUrl = async (urlKey: string, curlCommand: string): Promise<void> => {
      setApiUrlTests(prev => ({ ...prev, [urlKey]: true }));
      addLog('info', 'API_TEST', `Test başlatıldı`, { command: curlCommand });

      try {
        // Parse curl command to extract the actual URL and method
        const urlMatch = curlCommand.match(/"(https?:\/\/[^"]+)"/);
        const methodMatch = curlCommand.match(/-X\s+(POST|PUT|GET|DELETE)/);
        const authMatch = curlCommand.match(/-u\s+([^:]+):([^\s"]+)/);

        if (!urlMatch) {
          throw new Error('URL bulunamadı');
        }

        const url = urlMatch[1];
        const method = methodMatch ? methodMatch[1] : 'GET';
        const username = authMatch ? authMatch[1] : apiConfig.username;
        const password = authMatch ? authMatch[2] : apiConfig.password;

        // Extract body if it's a POST/PUT request
        const bodyMatch = curlCommand.match(/-d\s+'([^']+)'/);
        const body = bodyMatch ? bodyMatch[1] : undefined;

        const headers: HeadersInit = {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`)
        };

        if (body) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        if (!response.ok) {
          addLog('error', 'API_TEST', `Test başarısız: HTTP ${response.status}`, {
            status: response.status,
            statusText: response.statusText,
            response: responseData
          });
        } else {
          addLog('success', 'API_TEST', `Test başarılı: HTTP ${response.status}`, {
            status: response.status,
            response: responseData
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
        addLog('error', 'API_TEST', `Test hatası: ${msg}`, { error: msg });
      } finally {
        setApiUrlTests(prev => ({ ...prev, [urlKey]: false }));
      }
    };



    const clearLogs = () => {

      if (confirm('Tüm logları temizlemek istediğinizden emin misiniz?')) {

        setSystemLogs([]);

        addLog('info', 'SYSTEM', 'Loglar temizlendi');

      }

    };



    const copyLogsToClipboard = () => {

      const logsText = filteredLogs.map(log => 

        `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.details ? '\n  Details: ' + JSON.stringify(log.details, null, 2) : ''}`

      ).join('\n\n');

      

      navigator.clipboard.writeText(logsText).then(() => {

        addLog('success', 'SYSTEM', `${filteredLogs.length} log kopyalandı`);

      }).catch(() => {

        addLog('error', 'SYSTEM', 'Loglar kopyalanırken hata oluştu');

      });

    };



    return (

      <div className="space-y-6">

        <div>

          <h2>Sistem Ayarları</h2>

          <p className="text-muted-foreground">API bağlantı ayarlarını ve sistem parametrelerini yapılandırın</p>

        </div>



        {/* Language Selection */}
        <Card className="p-6">
          <h3 className="mb-4">{t('settings.language')}</h3>
          <p className="text-muted-foreground text-sm mb-4">{t('settings.language.description')}</p>
          <Select
            value={currentLanguage}
            onValueChange={(value: Lang) => {
              setLang(value);
              setCurrentLanguage(value);
            }}
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder={t('settings.language')} />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {languageNames[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* API Configuration */}

        <Card className="p-6">

          <h3 className="mb-4">API Bağlantı Ayarları</h3>

          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>

                <Label htmlFor="serverIP">Sunucu IP Adresi</Label>

                <Input

                  id="serverIP"

                  value={apiConfig.serverIP}

                  onChange={(e) => setApiConfig(prev => ({ ...prev, serverIP: e.target.value }))}

                  placeholder="192.168.1.5"

                />

              </div>

              <div>

                <Label htmlFor="endpoint">API Endpoint</Label>

                <Input

                  id="endpoint"

                  value={apiConfig.endpoint}

                  onChange={(e) => setApiConfig(prev => ({ ...prev, endpoint: e.target.value }))}

                  placeholder="/v2.0/products"

                />

              </div>

            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>

                <Label htmlFor="username">Kullanıcı Adı</Label>

                <Input

                  id="username"

                  value={apiConfig.username}

                  onChange={(e) => setApiConfig(prev => ({ ...prev, username: e.target.value }))}

                  placeholder="kullanıcı adı"

                />

              </div>

              <div>

                <Label htmlFor="password">Şifre</Label>

                <div className="relative">

                  <Input

                    id="password"

                    type={showPassword ? "text" : "password"}

                    value={apiConfig.password}

                    onChange={(e) => setApiConfig(prev => ({ ...prev, password: e.target.value }))}

                    placeholder="şifre"

                    className="pr-10"

                  />

                  <Button

                    type="button"

                    variant="ghost"

                    size="sm"

                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"

                    onClick={() => setShowPassword(!showPassword)}

                  >

                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}

                  </Button>

                </div>

              </div>

            </div>



            <div>

              <Label htmlFor="paginationLimit">Sayfa Başı Ürün Sayısı</Label>

              <Select

                value={apiConfig.paginationLimit.toString()}

                onValueChange={(value) => setApiConfig(prev => ({ ...prev, paginationLimit: parseInt(value) }))}

              >

                <SelectTrigger className="w-48">

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="20">20</SelectItem>

                  <SelectItem value="50">50</SelectItem>

                  <SelectItem value="100">100</SelectItem>

                  <SelectItem value="500">500</SelectItem>

                </SelectContent>

              </Select>

            </div>



            <div className="space-y-4">

              <div className="flex items-center space-x-2">

                <Checkbox

                  id="includeDeleted"

                  checked={apiConfig.includeDeleted}

                  onCheckedChange={(checked) => 

                    setApiConfig(prev => ({ ...prev, includeDeleted: checked as boolean }))

                  }

                />

                <Label htmlFor="includeDeleted">

                  Silinmiş Ürünler

                </Label>

              </div>

              

              <div className="flex items-center space-x-2">

                <Checkbox

                  id="showProductImages"

                  checked={apiConfig.showProductImages}

                  onCheckedChange={(checked) => 

                    setApiConfig(prev => ({ ...prev, showProductImages: checked as boolean }))

                  }

                />

                <Label htmlFor="showProductImages">

                  Ürün Fotoğraflarını Göster

                </Label>

              </div>

              



              <div>

                <Label htmlFor="baseParams">Temel Parametreler</Label>

                <Input

                  id="baseParams"

                  value={apiConfig.baseParams}

                  onChange={(e) => setApiConfig(prev => ({ ...prev, baseParams: e.target.value }))}

                  placeholder="EnableStock=true&Pagination.IsScroll=true"

                />

              </div>

            </div>

          </div>

        </Card>



        {/* Product Categories */}

        <Card className="p-6">

          <div className="flex items-center justify-between mb-4">

            <h3>Ürün Kategorileri</h3>

            <Button

              onClick={fetchProductGroups}

              variant="outline"

              size="sm"

              className="flex items-center gap-2"

            >

              <RefreshCw className="h-4 w-4" />

              Kategorileri Yükle

            </Button>

          </div>

          

          {productGroups.length > 0 ? (

            <div className="space-y-4">

              <div>

                <Label>Stok Sayfasında Gösterilecek Kategoriler</Label>

                <p className="text-sm text-muted-foreground mb-3">

                  Seçilen kategoriler stok sayfasında filtre butonları olarak görünecek

                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

                  {productGroups.map((group) => (

                    <div key={group.id} className="flex items-center space-x-2">

                      <Checkbox

                        id={`group-${group.id}`}

                        checked={selectedProductGroups.includes(group.id)}

                        onCheckedChange={(checked) => {

                          if (checked) {

                            setSelectedProductGroups(prev => [...prev, group.id]);

                          } else {

                            setSelectedProductGroups(prev => prev.filter(id => id !== group.id));

                          }

                        }}

                      />

                      <Label htmlFor={`group-${group.id}`} className="text-sm">

                        {group.name}

                      </Label>

                    </div>

                  ))}

                </div>

              </div>

              

              {selectedProductGroups.length > 0 && (

                <div className="p-3 bg-muted rounded">

                  <p className="text-sm font-medium mb-2">Seçilen Kategoriler:</p>

                  <div className="flex flex-wrap gap-2">

                    {selectedProductGroups.map((groupId) => {

                      const group = productGroups.find(g => g.id === groupId);

                      return group ? (

                        <span key={groupId} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">

                          {group.name}

                        </span>

                      ) : null;

                    })}

                  </div>

                </div>

              )}

            </div>

          ) : (

            <div className="text-center py-8 text-muted-foreground">

              <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />

              <p>Kategori bulunamadı</p>

              <p className="text-sm mt-2">Kategorileri yüklemek için yukarıdaki butona tıklayın</p>

            </div>

          )}

        </Card>



        {/* Current API URL Preview */}

        <Card className="p-4">

          <h4 className="mb-2">Oluşturulan API URL'leri:</h4>

          <div className="space-y-3">

            <div>

              <p className="text-sm font-medium mb-1">Ürünler Listesi (GET):</p>

              <div className="flex gap-2">

                <Input

                  className="font-mono text-sm flex-1"

                  value={editableUrls.productsUrl}

                  onChange={(e) => setEditableUrls(prev => ({ ...prev, productsUrl: e.target.value }))}

                />

                <Button

                  onClick={() => testApiUrl('productsUrl', editableUrls.productsUrl)}

                  disabled={apiUrlTests.productsUrl}

                  size="sm"

                >

                  {apiUrlTests.productsUrl ? 'Gönderiliyor...' : 'Send'}

                </Button>

              </div>

            </div>

            <div>

              <p className="text-sm font-medium mb-1">Kategoriler Listesi (GET):</p>

              <div className="flex gap-2">

                <Input

                  className="font-mono text-sm flex-1"

                  value={editableUrls.categoriesUrl}

                  onChange={(e) => setEditableUrls(prev => ({ ...prev, categoriesUrl: e.target.value }))}

                />

                <Button

                  onClick={() => testApiUrl('categoriesUrl', editableUrls.categoriesUrl)}

                  disabled={apiUrlTests.categoriesUrl}

                  size="sm"

                >

                  {apiUrlTests.categoriesUrl ? 'Gönderiliyor...' : 'Send'}

                </Button>

              </div>

            </div>

            <div>

              <p className="text-sm font-medium mb-1">Stok Güncelleme (POST):</p>

              <div className="flex gap-2">

                <Input

                  className="font-mono text-sm flex-1"

                  value={editableUrls.stockUpdateUrl}

                  onChange={(e) => setEditableUrls(prev => ({ ...prev, stockUpdateUrl: e.target.value }))}

                />

                <Button

                  onClick={() => testApiUrl('stockUpdateUrl', editableUrls.stockUpdateUrl)}

                  disabled={apiUrlTests.stockUpdateUrl}

                  size="sm"

                >

                  {apiUrlTests.stockUpdateUrl ? 'Gönderiliyor...' : 'Send'}

                </Button>

              </div>

              <p className="text-xs text-muted-foreground mt-2">

                Örnek: curl -u {apiConfig.username}:{apiConfig.password} -X POST "http://{apiConfig.serverIP}/api/stock/48/25"

              </p>

            </div>

            <div>

              <p className="text-sm font-medium mb-1">Fiyat/Maliyet Güncelleme (PUT):</p>

              <div className="flex gap-2">

                <Input

                  className="font-mono text-sm flex-1"

                  value={editableUrls.priceUpdateUrl}

                  onChange={(e) => setEditableUrls(prev => ({ ...prev, priceUpdateUrl: e.target.value }))}

                />

                <Button

                  onClick={() => testApiUrl('priceUpdateUrl', editableUrls.priceUpdateUrl)}

                  disabled={apiUrlTests.priceUpdateUrl}

                  size="sm"

                >

                  {apiUrlTests.priceUpdateUrl ? 'Gönderiliyor...' : 'Send'}

                </Button>

              </div>

              <p className="text-xs text-muted-foreground mt-2">

                Örnek: curl -H "Content-Type: application/json" -u {apiConfig.username}:{apiConfig.password} -X PUT "http://{apiConfig.serverIP}{joinApi('/v2.0/products')}" -d '{`{`}"id": 48, "productType": 0, "guid": "abc-123", "productGroupId": 5, "name": "Ürün Adı", "price": 199.90, "cost": 100, "barcode": "1234567890"{`}`}'

              </p>

            </div>

          </div>

        </Card>



        {/* System Logs */}

        <Card className="p-4 sm:p-6">

          <div className="flex items-center justify-between mb-4">

            <div className="flex items-center gap-2">

              <Terminal className="h-5 w-5" />

              <h3>Sistem Logları</h3>

            </div>

            <div className="flex items-center gap-2">

              <Select value={logFilter} onValueChange={(value: 'all' | 'info' | 'success' | 'warning' | 'error') => setLogFilter(value)}>

                <SelectTrigger className="w-32">

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="all">Hepsi</SelectItem>

                  <SelectItem value="info">Bilgi</SelectItem>

                  <SelectItem value="success">Başarı</SelectItem>

                  <SelectItem value="warning">Uyarı</SelectItem>

                  <SelectItem value="error">Hata</SelectItem>

                </SelectContent>

              </Select>

              <Button

                variant="outline"

                size="sm"

                onClick={copyLogsToClipboard}

                disabled={filteredLogs.length === 0}

                className="flex items-center gap-2"

              >

                <Copy className="h-4 w-4" />

                <span className="hidden sm:inline">Kopyala</span>

              </Button>

              <Button

                variant="outline"

                size="sm"

                onClick={clearLogs}

                disabled={systemLogs.length === 0}

                className="flex items-center gap-2"

              >

                <Trash2 className="h-4 w-4" />

                <span className="hidden sm:inline">Temizle</span>

              </Button>

            </div>

          </div>



          <div className="bg-black text-green-400 p-3 rounded font-mono text-xs sm:text-sm max-h-80 overflow-y-auto">

            {filteredLogs.length === 0 ? (

              <div className="text-gray-500 text-center py-4">

                {logFilter === 'all' ? 'Henüz log kaydı yok' : `${logFilter} seviyesinde log kaydı yok`}

              </div>

            ) : (

              <div className="space-y-2">

                {filteredLogs.map((log) => (

                  <div key={log.id} className="border-l-2 pl-3 py-1 border-l-gray-600">

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">

                      <span className="text-gray-400 text-xs">{log.timestamp}</span>

                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${

                        log.level === 'error' ? 'bg-red-900 text-red-200' :

                        log.level === 'warning' ? 'bg-yellow-900 text-yellow-200' :

                        log.level === 'success' ? 'bg-green-900 text-green-200' :

                        'bg-blue-900 text-blue-200'

                      }`}>

                        {log.level.toUpperCase()}

                      </span>

                      <span className="text-cyan-400 text-xs font-medium">[{log.category}]</span>

                    </div>

                    <div className="mt-1">

                      <span className="text-white">{log.message}</span>

                      {log.details && (

                        <details className="mt-1">

                          <summary className="text-gray-400 cursor-pointer text-xs hover:text-gray-300">

                            Detaylar...

                          </summary>

                          <pre className="mt-1 text-gray-300 text-xs bg-gray-800 p-2 rounded overflow-x-auto">

                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}

                          </pre>

                        </details>

                      )}

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>



          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">

            <span>

              {filteredLogs.length} log görüntüleniyor

              {logFilter !== 'all' && ` (${logFilter} filtreli)`}

            </span>

            <span>Son 100 log saklanır</span>

          </div>

        </Card>



        {/* Danger Zone */}

        <Card className="p-6 border-destructive/20">

          <h3 className="mb-4 text-destructive">Tehlikeli İşlemler</h3>

          <div className="space-y-4">

            <div>

              <p className="text-sm text-muted-foreground mb-3">

                Bu işlem geri alınamaz ve tüm ürünlerin stok miktarlarını sıfırlar.

              </p>

              <Button

                variant="destructive"

                onClick={() => {

                  if (confirm("⚠️ UYARI: Bu işlem geri alınamaz ve bütün stok seviyeleri tamamen 0 olacaktır!\n\nDevam etmek istediğinizden emin misiniz?")) {

                    if (confirm("🛑 SON UYARI: Bu işlem GERİ ALINAMAZ!\n\nTüm ürünlerin stok miktarları 0 olacak. Gerçekten devam etmek istiyor musunuz?")) {

                      resetAllToZero();

                    }

                  }

                }}

              >

                Tüm Stoğu Sıfırla

              </Button>

            </div>

          </div>

        </Card>

      </div>

    );

  };



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

            onClick={() => setCurrentPage('history')}

            className={`flex-1 py-2 px-2 sm:px-4 rounded transition-colors text-sm sm:text-base ${

              currentPage === 'history' 

                ? 'bg-primary text-primary-foreground' 

                : 'hover:bg-muted'

            }`}

          >

            <span className="hidden sm:inline">{t('nav.history')}</span>

            <span className="sm:hidden">{t('nav.history')}</span>

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



        {currentPage === 'history' ? (

          <StockHistoryPage />

        ) : currentPage === 'settings' ? (

          <SettingsPage />

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

                  <span className="sm:hidden">Uygula</span>

                  <span className="hidden sm:inline">Değişiklikleri Uygula</span>

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

              const countedValue = typeof countedValues[item.id] === 'number' ? countedValues[item.id] : null;

              const addedValue = typeof addedValues[item.id] === 'number' ? addedValues[item.id] : 0;

              const totalAfterCount = countedValue !== null ? countedValue + addedValue : item.count + addedValue;

              const countDiff = countedValue !== null ? countedValue - item.count : null;

              const enteredPrice = typeof priceValues[item.id] === 'number' ? priceValues[item.id] : null;

              const currentPrice = typeof item.price === 'number' ? item.price : null;

              const cost = typeof item.cost === 'number' ? item.cost : null;

              const enteredPreviousPrice = typeof previousPriceValues[item.id] === 'number' ? previousPriceValues[item.id] : null;

              const previousPrice = enteredPreviousPrice ?? (typeof item.previousPrice === 'number' ? item.previousPrice : null);

              const enteredNextPrice = typeof nextPriceValues[item.id] === 'number' ? nextPriceValues[item.id] : null;

              const nextPrice = enteredNextPrice ?? (typeof item.nextPrice === 'number' ? item.nextPrice : null);

              const priceDiff = enteredPrice !== null && currentPrice !== null

                ? enteredPrice - currentPrice

                : enteredPrice !== null && currentPrice === null

                  ? enteredPrice

                  : null;

              const _priceChangeDiff = previousPrice !== null && nextPrice !== null

                ? nextPrice - previousPrice

                : null;

              const enteredCost = typeof costValues[item.id] === 'number' ? costValues[item.id] : null;

              const enteredPreviousCost = typeof previousCostValues[item.id] === 'number' ? previousCostValues[item.id] : null;

              const previousCost = enteredPreviousCost ?? (typeof item.previousCost === 'number' ? item.previousCost : null);

              const enteredNextCost = typeof nextCostValues[item.id] === 'number' ? nextCostValues[item.id] : null;

              const nextCost = enteredNextCost ?? (typeof item.nextCost === 'number' ? item.nextCost : null);

              return (

              <div key={item.id} className="bg-card border rounded-lg p-3 sm:p-4">

                {/* Mobile Layout */}

                <div className="sm:hidden space-y-3">

                  <div className="flex gap-3">

                    {/* Product Image - Mobile */}

                    <div className="w-16 h-16 flex-shrink-0">

                      {item.imageUrl || productImages[item.id] ? (

                        <ImageWithFallback

                          src={item.imageUrl || productImages[item.id]}

                          alt={item.name}

                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"

                          onClick={() => setEnlargedImage({

                            url: item.imageUrl || productImages[item.id],

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

                      <p className="text-xs text-muted-foreground">Ürün</p>

                      <p className="font-medium text-sm break-words">{item.name}</p>

                      <p className="text-xs text-muted-foreground">ID: {item.id}</p>

                      <div className="flex items-center gap-2 mt-1">

                        <p className="text-xs text-muted-foreground">Barkod:</p>

                        <Input

                          value={barcodeValues[item.id] ?? item.barcode}

                          onChange={(e) => handleBarcodeChange(item.id, e.target.value)}

                          placeholder={item.barcode}

                          className="text-xs h-6 px-2"

                        />

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

                        value={countedValues[item.id] || ''}

                        onChange={(value) => handleCountedChange(item.id, value)}

                        placeholder="0"

                        defaultValue={item.count}

                        className="text-xs"

                      />

                    </div>

                    <div>

                      <p className="text-xs text-muted-foreground mb-1">Eklenen</p>

                      <NumpadInput

                        value={addedValues[item.id] || ''}

                        onChange={(value) => handleAddedChange(item.id, value)}

                        placeholder="0"

                        className="text-xs"

                      />

                    </div>

                    <div className="text-center">

                      <p className="text-xs text-muted-foreground mb-1">Fark</p>

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

                      {item.imageUrl || productImages[item.id] ? (

                        <ImageWithFallback

                          src={item.imageUrl || productImages[item.id]}

                          alt={item.name}

                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"

                          onClick={() => setEnlargedImage({

                            url: item.imageUrl || productImages[item.id],

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

                      <p className="text-sm text-muted-foreground">Ürün</p>

                      <p className="break-words">{item.name}</p>

                      <p className="text-sm text-muted-foreground">ID: {item.id}</p>

                      <div className="flex items-center gap-2 mt-1">

                        <p className="text-sm text-muted-foreground">Barkod:</p>

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

                      <p className="text-muted-foreground min-w-[50px]">Fiyat:</p>

                      <p className="bg-muted px-2 py-1 rounded min-w-[60px]">{formatPrice(currentPrice)}</p>

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[40px]">Yeni:</p>

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

                      <p className="text-muted-foreground min-w-[40px]">Yeni:</p>

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

                        value={countedValues[item.id] || ''}

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

                      <p className="text-muted-foreground min-w-[50px]">Eklenen:</p>

                      <NumpadInput

                        value={addedValues[item.id] || ''}

                        onChange={(value) => handleAddedChange(item.id, value)}

                        placeholder="0"

                        className="w-20"

                      />

                    </div>

                    <div className="flex items-center gap-2">

                      <p className="text-muted-foreground min-w-[50px]">Toplam:</p>

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
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Undo2 className="h-4 w-4 mr-1" />
                        Geri Al
                      </Button>
                      <Button
                        onClick={async () => {
                          // Apply changes for this single item
                          const today = new Date().toLocaleDateString('tr-TR');

                          const countedValue = typeof countedValues[item.id] === 'number' ? countedValues[item.id] : null;
                          const addedValue = typeof addedValues[item.id] === 'number' ? addedValues[item.id] : 0;
                          const pendingPrice = typeof priceValues[item.id] === 'number' ? priceValues[item.id] : null;
                          const pendingCost = typeof costValues[item.id] === 'number' ? costValues[item.id] : null;
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

                            // Build change reason
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
                            } else if (costChanged) {
                              reason = 'Maliyet';
                            } else if (barcodeChanged) {
                              reason = 'Barkod';
                            }

                            const changeValue = stockChanged ? finalCount - item.count : 0;
                            const computedPriceChange = priceChanged
                              ? (previousPrice !== undefined ? (pendingPrice as number) - previousPrice : pendingPrice as number)
                              : undefined;
                            const computedCostChange = costChanged
                              ? (previousCost !== undefined ? (pendingCost as number) - previousCost : pendingCost as number)
                              : undefined;

                            // Add to stock changes history
                            setStockChanges(prev => [...prev, {
                              id: item.id,
                              date: today,
                              productName: item.name,
                              change: changeValue,
                              reason,
                              previousCount: item.count,
                              countedValue: countedValue ?? undefined,
                              addedValue: addedValue as number,
                              finalCount: finalCount,
                              previousPrice,
                              newPrice: priceChanged ? (pendingPrice as number) : previousPrice,
                              priceChange: computedPriceChange,
                              previousCost,
                              newCost: costChanged ? (pendingCost as number) : previousCost,
                              costChange: computedCostChange,
                              previousBarcode: barcodeChanged ? item.barcode : undefined,
                              newBarcode: barcodeChanged ? (pendingBarcode as string) : undefined,
                            }]);

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

                            addLog('success', 'APPLY', `Değişiklikler uygulandı: ${item.name}`);
                          } catch (error) {
                            addLog('error', 'APPLY', `Hata: ${item.name} güncellenemedi`, error);
                            alert(`Guncelleme sirasinda hata olustu!\n\nÜrün: ${item.name}\nDetay: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}\n\nLutfen tekrar deneyin.`);
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

                Dokunarak kapat

              </div>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}



