'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, RefreshCw } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  sapStatusToLabel,
  sapStatusToBadge,
  sapPriorityToLabel,
  sapPriorityToBadge,
  sapCallTypeToLabel,
  formatSAPDate,
} from '@/lib/utils/sap-helpers';
import { SAPEmployee } from '@/types/sap';
import { SAPServiceCall, SAPServiceCallStatus } from '@/types/sap';

function getDurumBadge(status: number) {
  return <Badge variant={sapStatusToBadge(status)}>{sapStatusToLabel(status)}</Badge>;
}

export default function ServisListePage() {
  const { hasPermission } = useAuth();
  const [servisler, setServisler] = useState<SAPServiceCall[]>([]);
  const [employees, setEmployees] = useState<SAPEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arama, setArama] = useState('');
  const [aramaDebounced, setAramaDebounced] = useState('');
  const [turFiltre, setTurFiltre] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('');

  // Teknisyen adi helper
  const getTeknisyenAdi = (code: number) => {
    const emp = employees.find((e) => e.EmployeeID === code);
    return emp ? `${emp.FirstName} ${emp.LastName}` : `#${code}`;
  };

  // Debounce arama
  useEffect(() => {
    const timer = setTimeout(() => setAramaDebounced(arama), 400);
    return () => clearTimeout(timer);
  }, [arama]);

  // Calisanlari bir kez yukle
  useEffect(() => {
    fetch('/api/sap/employees')
      .then((r) => r.ok ? r.json() : { value: [] })
      .then((d) => setEmployees(d.value || []))
      .catch(() => {});
  }, []);

  const fetchServisler = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (durumFiltre) params.set('status', durumFiltre);
      if (aramaDebounced) params.set('search', aramaDebounced);
      params.set('top', '50');

      const res = await fetch(`/api/sap/service-calls?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Bir hata oluştu' }));
        throw new Error(err.message);
      }
      const data = await res.json();
      setServisler(data.value || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [durumFiltre, aramaDebounced]);

  useEffect(() => {
    fetchServisler();
  }, [fetchServisler]);

  // Client-side tur filtresi (SAP OData CallType filtresi karmasik olabilir)
  const filtrelenmis = turFiltre
    ? servisler.filter((s) => String(s.CallType) === turFiltre)
    : servisler;

  const canCreate = hasPermission('service:create');

  if (loading && servisler.length === 0) {
    return <FullPageLoading />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Servis Kayıtları</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{filtrelenmis.length} kayıt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchServisler} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <Link href="/servis/yeni">
              <Button size="md">
                <Plus className="w-4 h-4 mr-1.5" />
                Yeni Servis
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Servis no veya müşteri ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Tüm Türler' },
              { value: '1', label: 'Arıza' },
              { value: '2', label: 'Bakım' },
              { value: '3', label: 'Montaj' },
              { value: '4', label: 'Garanti' },
              { value: '5', label: 'Devreye Alma' },
            ]}
            value={turFiltre}
            onChange={(e) => setTurFiltre(e.target.value)}
          />
          <Select
            options={[
              { value: '', label: 'Tüm Durumlar' },
              { value: String(SAPServiceCallStatus.OPEN), label: 'Açık' },
              { value: String(SAPServiceCallStatus.PENDING), label: 'Beklemede' },
              { value: String(SAPServiceCallStatus.CLOSED), label: 'Kapalı' },
            ]}
            value={durumFiltre}
            onChange={(e) => setDurumFiltre(e.target.value)}
          />
        </div>
      </Card>

      {filtrelenmis.length === 0 && !loading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">Servis kaydı bulunamadı</p>
            <p className="text-sm mt-1">Filtrelerinizi değiştirmeyi deneyin</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobil: Kart goruntuleme */}
          <div className="lg:hidden space-y-3">
            {filtrelenmis.map((servis) => (
              <Link key={servis.ServiceCallID} href={`/servis/${servis.ServiceCallID}`}>
                <Card hover className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-sm font-bold text-gray-900">S-{servis.DocNum}</span>
                      <span className="ml-2 text-xs text-gray-500">{sapCallTypeToLabel(servis.CallType)}</span>
                    </div>
                    {getDurumBadge(servis.Status)}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{servis.CustomerName || servis.Subject}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{servis.Subject}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{getTeknisyenAdi(servis.TechnicianCode)}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={sapPriorityToBadge(servis.Priority)} className="!text-[10px]">
                        {sapPriorityToLabel(servis.Priority)}
                      </Badge>
                      <span>{formatSAPDate(servis.CreateDate)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Masaustu: Tablo goruntuleme */}
          <div className="hidden lg:block">
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Servis No</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Müşteri</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Konu</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Tür</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Durum</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Teknisyen</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Öncelik</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrelenmis.map((servis) => (
                      <tr key={servis.ServiceCallID} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3">
                          <Link href={`/servis/${servis.ServiceCallID}`} className="font-medium text-blue-900 hover:underline">
                            S-{servis.DocNum}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{servis.CustomerName}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{servis.Subject}</td>
                        <td className="px-4 py-3 text-gray-600">{sapCallTypeToLabel(servis.CallType)}</td>
                        <td className="px-4 py-3">{getDurumBadge(servis.Status)}</td>
                        <td className="px-4 py-3 text-gray-600">{getTeknisyenAdi(servis.TechnicianCode)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={sapPriorityToBadge(servis.Priority)}>
                            {sapPriorityToLabel(servis.Priority)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatSAPDate(servis.CreateDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
