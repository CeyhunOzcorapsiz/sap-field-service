'use client';

import { useMemo } from 'react';
import { useApi } from './useApi';
import { SAPItem } from '@/types/sap';

interface ItemsResponse {
  value: SAPItem[];
}

export function useItems(search?: string, warehouse?: string, inStock = false, top = 50) {
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (warehouse) params.set('warehouse', warehouse);
    if (inStock) params.set('inStock', 'true');
    params.set('top', String(top));
    return `/api/sap/items?${params.toString()}`;
  }, [search, warehouse, inStock, top]);

  const { data, loading, error, refetch } = useApi<ItemsResponse>(url);

  return {
    items: data?.value ?? [],
    loading,
    error,
    refetch,
  };
}
