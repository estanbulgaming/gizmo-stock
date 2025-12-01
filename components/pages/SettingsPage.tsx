import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { RefreshCw, Eye, EyeOff, Filter, Terminal, Trash2, Copy, ChevronDown } from 'lucide-react';
import { setLang, availableLanguages, languageNames, Lang } from '../../i18n';
import { ApiConfig } from '../../hooks/useApiConfig';
import { ProductGroup, SystemLogEntry } from '../../types/stock';

interface SettingsPageProps {
  apiConfig: ApiConfig;
  setApiConfig: React.Dispatch<React.SetStateAction<ApiConfig>>;
  systemLogs: SystemLogEntry[];
  setSystemLogs: React.Dispatch<React.SetStateAction<SystemLogEntry[]>>;
  addLog: (level: 'info' | 'success' | 'warning' | 'error', category: string, message: string, details?: unknown) => void;
  currentLanguage: Lang;
  setCurrentLanguage: React.Dispatch<React.SetStateAction<Lang>>;
  productGroups: ProductGroup[];
  fetchProductGroups: () => Promise<void>;
  selectedProductGroups: number[];
  setSelectedProductGroups: React.Dispatch<React.SetStateAction<number[]>>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  resetAllToZero: () => void;
  t: (key: string) => string;
}

export function SettingsPage({
  apiConfig,
  setApiConfig,
  systemLogs,
  setSystemLogs,
  addLog,
  currentLanguage,
  setCurrentLanguage,
  productGroups,
  fetchProductGroups,
  selectedProductGroups,
  setSelectedProductGroups,
  showPassword,
  setShowPassword,
  resetAllToZero,
  t,
}: SettingsPageProps) {
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [showApiUrls, setShowApiUrls] = useState(false);
  const [apiUrlTests, setApiUrlTests] = useState<{[key: string]: boolean}>({});
  const [editableUrls, setEditableUrls] = useState({
    productsUrl: `curl -u ${apiConfig.username}:${apiConfig.password} "http://${apiConfig.serverIP}/api${apiConfig.endpoint}?${apiConfig.includeDeleted ? 'IsDeleted=true' : 'IsDeleted=false'}&${apiConfig.baseParams}&Pagination.Limit=${apiConfig.paginationLimit}"`,
    categoriesUrl: `curl -u ${apiConfig.username}:${apiConfig.password} "http://${apiConfig.serverIP}/api${apiConfig.groupsEndpoint}"`,
    stockUpdateUrl: `curl -u ${apiConfig.username}:${apiConfig.password} -X POST "http://${apiConfig.serverIP}/api/stock/[PRODUCT_ID]/[NEW_STOCK_COUNT]"`,
    priceUpdateUrl: `curl -H "Content-Type: application/json" -u ${apiConfig.username}:${apiConfig.password} -X PUT "http://${apiConfig.serverIP}/api/v2.0/products" -d '{"id": [PRODUCT_ID], "productType": [PRODUCT_TYPE], "guid": "[PRODUCT_GUID]", "productGroupId": [PRODUCT_GROUP_ID], "name": "[PRODUCT_NAME]", "price": [NEW_PRICE], "cost": [NEW_COST], "barcode": "[BARCODE]"}'`
  });

  const filteredLogs = systemLogs.filter(log =>
    logFilter === 'all' || log.level === logFilter
  );

  const testApiUrl = async (urlKey: string, curlCommand: string): Promise<void> => {
    setApiUrlTests(prev => ({ ...prev, [urlKey]: true }));
    addLog('info', 'API_TEST', `Test başlatıldı`, { command: curlCommand });

    try {
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
    if (confirm(t('settings.logs.clear.confirm'))) {
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
        <h2>{t('settings.title')}</h2>
        <p className="text-muted-foreground">{t('settings.description')}</p>
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
        <h3 className="mb-4">{t('settings.api.title')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serverIP">{t('settings.api.serverIP')}</Label>
              <Input
                id="serverIP"
                value={apiConfig.serverIP}
                onChange={(e) => setApiConfig(prev => ({ ...prev, serverIP: e.target.value }))}
                placeholder="192.168.1.5"
              />
            </div>
            <div>
              <Label htmlFor="endpoint">{t('settings.api.endpoint')}</Label>
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
              <Label htmlFor="username">{t('settings.api.username')}</Label>
              <Input
                id="username"
                value={apiConfig.username}
                onChange={(e) => setApiConfig(prev => ({ ...prev, username: e.target.value }))}
                placeholder="kullanıcı adı"
              />
            </div>
            <div>
              <Label htmlFor="password">{t('settings.api.password')}</Label>
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
            <Label htmlFor="paginationLimit">{t('settings.api.paginationLimit')}</Label>
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
                {t('settings.api.includeDeleted')}
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
                {t('settings.api.showImages')}
              </Label>
            </div>

            <div>
              <Label htmlFor="baseParams">{t('settings.api.baseParams')}</Label>
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
          <h3>{t('settings.categories.title')}</h3>
          <Button
            onClick={fetchProductGroups}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('settings.categories.load')}
          </Button>
        </div>

        {productGroups.length > 0 ? (
          <div className="space-y-4">
            <div>
              <Label>{t('settings.categories.filter')}</Label>
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
                <p className="text-sm font-medium mb-2">{t('settings.categories.selected')}:</p>
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
            <p>{t('settings.categories.notFound')}</p>
            <p className="text-sm mt-2">{t('settings.categories.hint')}</p>
          </div>
        )}
      </Card>

      {/* Current API URL Preview - Collapsible */}
      <Card className="p-4">
        <button
          onClick={() => setShowApiUrls(!showApiUrls)}
          className="w-full flex items-center justify-between text-left"
        >
          <h4>{t('settings.urls.title')}</h4>
          <ChevronDown className={`h-5 w-5 transition-transform ${showApiUrls ? 'rotate-180' : ''}`} />
        </button>

        {showApiUrls && (
          <div className="space-y-3 mt-4">
            <div>
              <p className="text-sm font-medium mb-1">{t('settings.urls.products')}:</p>
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
                  {apiUrlTests.productsUrl ? t('settings.urls.sending') : t('settings.urls.send')}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">{t('settings.urls.categories')}:</p>
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
                  {apiUrlTests.categoriesUrl ? t('settings.urls.sending') : t('settings.urls.send')}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">{t('settings.urls.stockUpdate')}:</p>
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
                  {apiUrlTests.stockUpdateUrl ? t('settings.urls.sending') : t('settings.urls.send')}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">{t('settings.urls.priceUpdate')}:</p>
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
                  {apiUrlTests.priceUpdateUrl ? t('settings.urls.sending') : t('settings.urls.send')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* System Logs */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <h3>{t('settings.logs.title')}</h3>
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
                    {log.details !== undefined && log.details !== null && (
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
                if (confirm(t('danger.resetAll.warning'))) {
                  resetAllToZero();
                }
              }}
            >
              {t('danger.resetAll')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
