'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Clock, Wrench, RefreshCw, Plus } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { SAPServiceCall, SAPServiceCallStatus } from '@/types/sap';
import {
  sapStatusToLabel,
  sapStatusToBadge,
  sapPriorityToLabel,
  sapPriorityToBadge,
  formatSAPDate,
} from '@/lib/utils/sap-helpers';

export default function TeknisyenPage() {
  const { user } = useAuth();
  const [servisler, setServisler] = useState<SAPServiceCall[]>([]);
  const [loading, setLoading] = useState(true);

  // TEKNISYEN sadece kendi servislerini gorur; diger roller tumunu
  const sadeceKendi = user?.role === UserRole.TEKNISYEN;

  const fetchServisler = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ top: '50' });
      if (user.role === UserRole.TEKNISYEN) {
        params.set('technicianCode', String(user.id));
      }
      const res = await fetch(`/api/sap/service-calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Sadece acik ve beklemede olanlar
        const aktif = (data.value || []).filter(
          (sc: SAPServiceCall) => sc.Status !== SAPServiceCallStatus.CLOSED,
        );
        setServisler(aktif);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchServisler();
  }, [fetchServisler]);

  if (loading) return <FullPageLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {sadeceKendi ? 'Servislerim' : 'Aktif Servisler'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {servisler.length} aktif servis
            {sadeceKendi && user ? ` — ${user.fullName}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchServisler}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Link href="/servis/yeni" className="block">
        <Button fullWidth size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Çağrı Aç
        </Button>
      </Link>

      {servisler.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Atanmış servisiniz yok</p>
            <p className="text-sm mt-1">Yeni servis ataması yapıldığında burada görünecek</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {servisler.map((servis) => (
            <Link key={servis.ServiceCallID} href={`/servis/${servis.ServiceCallID}`}>
              <Card hover className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-900">S-{servis.DocNum}</span>
                    <Badge variant={sapPriorityToBadge(servis.Priority)}>
                      {sapPriorityToLabel(servis.Priority)}
                    </Badge>
                  </div>
                  <Badge variant={sapStatusToBadge(servis.Status)}>
                    {sapStatusToLabel(servis.Status)}
                  </Badge>
                </div>

                <p className="text-sm font-medium text-gray-900">{servis.CustomerName}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{servis.Subject}</p>

                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                  {servis.ItemDescription && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      {servis.ItemDescription}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatSAPDate(servis.CreateDate)}
                  </span>
                </div>

                {servis.Status === SAPServiceCallStatus.OPEN && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800">
                      Detay ve İşe Başla →
                    </span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
