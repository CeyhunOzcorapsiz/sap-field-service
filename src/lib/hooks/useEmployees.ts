'use client';

import { useMemo } from 'react';
import { useApi } from './useApi';
import { SAPEmployee } from '@/types/sap';

interface EmployeeResponse {
  value: SAPEmployee[];
}

export function useEmployees(department?: string) {
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    return `/api/sap/employees?${params.toString()}`;
  }, [department]);

  const { data, loading, error, refetch } = useApi<EmployeeResponse>(url);

  return {
    employees: data?.value ?? [],
    loading,
    error,
    refetch,
  };
}
