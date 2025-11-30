import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface ApiConfig {
  serverIP: string;
  username: string;
  password: string;
  endpoint: string;
  groupsEndpoint: string;
  paginationLimit: number;
  baseParams: string;
  includeDeleted: boolean;
  showProductImages: boolean;
}

export const API_CONFIG_STORAGE_KEY = 'apiConfig';

export const DEFAULT_API_CONFIG: ApiConfig = {
  serverIP: '',
  username: '',
  password: '',
  endpoint: '/v2.0/products',
  groupsEndpoint: '/v2.0/productgroups',
  paginationLimit: 500,
  baseParams: 'EnableStock=true&Pagination.IsScroll=true',
  includeDeleted: false,
  showProductImages: true,
};

type UseApiConfigReturn = [ApiConfig, Dispatch<SetStateAction<ApiConfig>>];

const getStoredConfig = (fallback: ApiConfig): ApiConfig => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(API_CONFIG_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<ApiConfig>;
    return { ...fallback, ...parsed };
  } catch (error) {
    console.warn('apiConfig load failed', error);
    return fallback;
  }
};

export function useApiConfig(initialConfig: ApiConfig = DEFAULT_API_CONFIG): UseApiConfigReturn {
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => getStoredConfig(initialConfig));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(apiConfig));
    } catch (error) {
      console.warn('apiConfig save failed', error);
    }
  }, [apiConfig]);

  return [apiConfig, setApiConfig];
}
