'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wrench, Clock, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { SAPServiceCall, SAPServiceCallStatus, SAPEmployee } from '@/types/sap';
import {
  sapStatusToLabel,
  sapStatusToBadge,
  sapCallTypeToLabel,
  formatSAPDate,
} from '@/lib/utils/sap-helpers';

function getDurumBadge(status: number) {
  return <Badge variant={sapStatusToBadge(status)}>{sapStatusToLabel(status)}</Badge>;
}

interface AylikOzet {
  toplamlar: { calisma: number; mesai: number; km: number };
  teknisyenler: Array<{ teknisyenAdi: string; toplamCalisma: number; toplamMesai: number }>;
}

export default function DashboardPage() {
  const [servisler, setServisler] = useState<SAPServiceCall[]>([]);
  const [employees, setEmployees] = useState<SAPEmployee[]>([]);
  const [aylikOzet, setAylikOzet] = useState<AylikOzet | null>(null);
  const [loading, setLoading] = useState(true);

  const getTeknisyenAdi = (code: number) => {
    const emp = employees.find((e) => e.EmployeeID === code);
    return emp ? `${emp.FirstName} ${emp.LastName}` : `#${code}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const simdi = new Date();
      const [servisRes, empRes, aylikRes] = await Promise.all([
        fetch('/api/sap/service-calls?top=20'),
        fetch('/api/sap/employees'),
        fetch(`/api/rapor/aylik?year=${simdi.getFullYear()}&month=${simdi.getMonth() + 1}`),
      ]);
      if (servisRes.ok) {
        const data = await servisRes.json();
        setServisler(data.value || []);
      }
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.value || []);
      }
      if (aylikRes.ok) {
        setAylikOzet(await aylikRes.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // KPI hesaplama
  const acikServisler = servisler.filter((s) => s.Status === SAPServiceCallStatus.OPEN);
  const bekleyenServisler = servisler.filter((s) => s.Status === SAPServiceCallStatus.PENDING);
  const kapaliServisler = servisler.filter((s) => s.Status === SAPServiceCallStatus.CLOSED);
  const sonServisler = servisler.slice(0, 5);

  // Teknisyen bazli servis sayilari
  const teknisyenDurumlari = employees.map((emp) => {
    const aktifServisler = servisler.filter(
      (s) => s.TechnicianCode === emp.EmployeeID && s.Status !== SAPServiceCallStatus.CLOSED,
    );
    return {
      ad: `${emp.FirstName} ${emp.LastName}`,
      bolge: emp.U_BolgeKodu || '',
      aktifServis: aktifServisler.length,
      durum: aktifServisler.length > 0 ? 'Sahada' : 'Müsait',
    };
  });

  const kpiCards = [
    { label: 'Açık Servisler', value: acikServisler.length, icon: Wrench, color: 'text-red-600 bg-red-50' },
    { label: 'Tamamlanan', value: kapaliServisler.length, icon: CheckCircle, color: 'text-blue-800 bg-blue-50' },
    { label: 'Beklemede', value: bekleyenServisler.length, icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'Toplam', value: servisler.length, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Teknik servis operasyonlarına genel bakış</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Son Servis Kayıtları</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {sonServisler.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Henüz servis kaydı yok</p>
            ) : (
              sonServisler.map((servis) => (
                <Link
                  key={servis.ServiceCallID}
                  href={`/servis/${servis.ServiceCallID}`}
                  className="block"
                >
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-2 -mx-2 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">S-{servis.ServiceCallID}</span>
                        {getDurumBadge(servis.Status)}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{servis.CustomerName} - {servis.Subject}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500">{getTeknisyenAdi(servis.TechnicianCode)}</p>
                      <p className="text-xs text-gray-400">{formatSAPDate(servis.CreateDate)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          {servisler.length > 5 && (
            <Link href="/servis" className="block text-center mt-3 text-sm text-blue-800 hover:text-blue-900 font-medium">
              Tüm servisleri gör →
            </Link>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teknisyen Durumu</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {teknisyenDurumlari.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Teknisyen bilgisi yükleniyor...</p>
            ) : (
              teknisyenDurumlari.map((tek) => (
                <div
                  key={tek.ad}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-900">{tek.ad.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tek.ad}</p>
                      <p className="text-xs text-gray-500">{tek.bolge}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={tek.durum === 'Müsait' ? 'success' : 'warning'}>
                      {tek.durum}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">{tek.aktifServis} aktif servis</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Bu Ay Mesai Ozeti */}
      {aylikOzet && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                <span>Bu Ay Mesai Özeti</span>
                <Link href="/raporlar/mesai" className="text-sm font-normal text-blue-800 hover:underline">
                  Detay →
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{aylikOzet.toplamlar.calisma}</p>
              <p className="text-xs text-gray-500 mt-1">Normal Çalışma (saat)</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{aylikOzet.toplamlar.mesai}</p>
              <p className="text-xs text-amber-600/70 mt-1">Mesai (saat)</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{aylikOzet.toplamlar.km}</p>
              <p className="text-xs text-gray-500 mt-1">Toplam Yol (km)</p>
            </div>
          </div>
          {aylikOzet.teknisyenler.length > 0 && (
            <div className="space-y-2">
              {aylikOzet.teknisyenler.slice(0, 5).map((t) => {
                const toplam = t.toplamCalisma + t.toplamMesai;
                const oran = toplam > 0 ? (t.toplamMesai / toplam) * 100 : 0;
                return (
                  <div key={t.teknisyenAdi} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-32 truncate">{t.teknisyenAdi}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="bg-blue-700 h-full" style={{ width: `${toplam > 0 ? (t.toplamCalisma / toplam) * 100 : 0}%` }} />
                      <div className="bg-amber-500 h-full" style={{ width: `${oran}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-20 text-right">
                      {toplam}s
                      {t.toplamMesai > 0 && <span className="text-amber-600"> (%{oran.toFixed(0)})</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
