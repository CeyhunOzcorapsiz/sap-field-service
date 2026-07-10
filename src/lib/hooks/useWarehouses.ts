'use client';

import { useApi } from './useApi';
import { SAPWarehouse } from '@/types/sap';

interface WarehouseResponse {
  value: SAPWarehouse[];
}

export function useWarehouses() {
  const { data, loading, error, refetch } = useApi<WarehouseResponse>('/api/sap/warehouses');

  return {
    warehouses: data?.value ?? [],
    loading,
    error,
    refetch,
  };
}
