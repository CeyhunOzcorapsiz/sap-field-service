'use client';

import { useCallback, useMemo } from 'react';
import { useApi, useMutation } from './useApi';
import { SAPServiceCall } from '@/types/sap';

interface ServiceCallsResponse {
  value: SAPServiceCall[];
}

interface ServiceCallFilters {
  status?: string;
  search?: string;
  top?: number;
  skip?: number;
  technicianCode?: number;
}

export function useServiceCalls(filters: ServiceCallFilters = {}) {
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.top) params.set('top', String(filters.top));
    if (filters.skip) params.set('skip', String(filters.skip));
    if (filters.technicianCode) params.set('technicianCode', String(filters.technicianCode));
    const qs = params.toString();
    return `/api/sap/service-calls${qs ? `?${qs}` : ''}`;
  }, [filters.status, filters.search, filters.top, filters.skip, filters.technicianCode]);

  const { data, loading, error, refetch } = useApi<ServiceCallsResponse>(url);

  return {
    serviceCalls: data?.value ?? [],
    loading,
    error,
    refetch,
  };
}

export function useServiceCall(id: number | string | null) {
  const url = id ? `/api/sap/service-calls/${id}` : null;
  const { data, loading, error, refetch } = useApi<SAPServiceCall>(url);

  return {
    serviceCall: data,
    loading,
    error,
    refetch,
  };
}

export function useCreateServiceCall() {
  return useMutation<Partial<SAPServiceCall>, SAPServiceCall>(
    '/api/sap/service-calls',
    'POST',
  );
}

export function useUpdateServiceCall(id: number | string) {
  return useMutation<Partial<SAPServiceCall>, SAPServiceCall>(
    `/api/sap/service-calls/${id}`,
    'PATCH',
  );
}
