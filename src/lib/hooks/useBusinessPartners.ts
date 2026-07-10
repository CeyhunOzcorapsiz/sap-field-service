'use client';

import { useMemo } from 'react';
import { useApi } from './useApi';
import { SAPBusinessPartner } from '@/types/sap';

interface BPResponse {
  value: SAPBusinessPartner[];
}

export function useBusinessPartners(search?: string, top = 20) {
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('top', String(top));
    return `/api/sap/business-partners?${params.toString()}`;
  }, [search, top]);

  const { data, loading, error, refetch } = useApi<BPResponse>(url);

  return {
    partners: data?.value ?? [],
    loading,
    error,
    refetch,
  };
}
