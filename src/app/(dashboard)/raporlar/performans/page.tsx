'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Award, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { TVS_SEVIYE_LABELS, TVSSeviye } from '@/types/report';

interface PerformansSatir {
  employeeId: number;
  teknisyenAdi: string;
  tamamlanan: number;
  memnuniyet: number;
  puanVar: boolean;
  zamaninda: number;
  normalSaat: number;
  mesaiSaat: number;
  mesaiOrani: number;
  tvs: number;
  seviye: TVSSeviye;
}

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function getTVSBadge(seviye: TVSSeviye) {
  const map: Record<TVSSeviye, 'success' | 'info' | 'warning' | 'danger'> = {
    [TVSSeviye.MUKEMMEL]: 'success',
    [TVSSeviye.IYI]: 'info',
    [TVSSeviye.ORTA]: 'warning',
    [TVSSeviye.GELISIM_GEREKLI]: 'danger',
  };
  return <Badge variant={map[seviye]}>{TVS_SEVIYE_LABELS[seviye]}</Badge>;
}

export default function PerformansPage() {
  const simdi = new Date();
  const [year, setYear] = useState(simdi.getFullYear());
  const [month, setMonth] = useState(simdi.getMonth() + 1);
  const [performans, setPerformans] = useState<PerformansSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const oncekiAy = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  };
  const sonrakiAy = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  };

  const fetchPerformans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rapor/performans?year=${year}&month=${month}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Rapor yüklenemedi' }));
        throw new Error(err.message);
      }
      const data = await res.json();
      setPerformans(data.performans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi');
      setPerformans([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchPerformans();
  }, [fetchPerformans]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/raporlar" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teknisyen Performansı</h1>
          <p className="text-sm text-gray-500 mt-0.5">TVS Skor Tablosu</p>
        </div>
      </div>

      {/* Ay secici */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <button onClick={oncekiAy} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <p className="text-base font-bold text-gray-900">{AY_ADLARI[month - 1]} {year}</p>
          <button onClick={sonrakiAy} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </Card>

      {loading ? (
        <FullPageLoading />
      ) : error ? (
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        </Card>
      ) : performans.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Bu dönemde performans verisi yok</p>
            <p className="text-sm mt-1">Tamamlanan servis ve iş kaydı oldukça hesaplanır</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobil kartlar */}
          <div className="lg:hidden space-y-3">
            {performans.map((p) => (
              <Card key={p.employeeId}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{p.teknisyenAdi}</p>
                    <p className="text-xs text-gray-500">{AY_ADLARI[month - 1]} {year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{p.tvs}</p>
                    {getTVSBadge(p.seviye)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Tamamlanan</p>
                    <p className="font-bold text-gray-900">{p.tamamlanan}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Memnuniyet</p>
                    <p className="font-bold text-gray-900">{p.memnuniyet}/5{!p.puanVar && ' *'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Zamanında</p>
                    <p className="font-bold text-gray-900">%{(p.zamaninda * 100).toFixed(0)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500">Mesai Oranı</p>
                    <p className="font-bold text-gray-900">%{(p.mesaiOrani * 100).toFixed(0)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Masaustu tablo */}
          <div className="hidden lg:block">
            <Card padding={false}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Teknisyen</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Tamamlanan</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Memnuniyet</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Zamanında %</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Mesai Saat</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Normal Saat</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Mesai Oranı</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">TVS</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Seviye</th>
                  </tr>
                </thead>
                <tbody>
                  {performans.map((p) => (
                    <tr key={p.employeeId} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.teknisyenAdi}</td>
                      <td className="px-4 py-3 text-center">{p.tamamlanan}</td>
                      <td className="px-4 py-3 text-center">{p.memnuniyet}{!p.puanVar && ' *'}</td>
                      <td className="px-4 py-3 text-center">%{(p.zamaninda * 100).toFixed(0)}</td>
                      <td className="px-4 py-3 text-center text-amber-600">{p.mesaiSaat}</td>
                      <td className="px-4 py-3 text-center">{p.normalSaat}</td>
                      <td className="px-4 py-3 text-center">%{(p.mesaiOrani * 100).toFixed(0)}</td>
                      <td className="px-4 py-3 text-center font-bold text-lg">{p.tvs}</td>
                      <td className="px-4 py-3 text-center">{getTVSBadge(p.seviye)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <p className="text-xs text-gray-400">
            * Müşteri puanı (U_MusteriPuani UDF) bulunmayan teknisyenlerde varsayılan 4.0 kullanılır.
          </p>
        </>
      )}

      {/* TVS Formul Aciklamasi */}
      <Card>
        <CardHeader>
          <CardTitle>TVS Skor Hesaplama</CardTitle>
        </CardHeader>
        <div className="text-sm text-gray-600 space-y-2">
          <p className="font-mono bg-gray-50 p-3 rounded-lg text-xs">
            TVS = (Tamamlanan Servis × 40) + (Müşteri Memnuniyeti × 30) + (Zamanında Tamamlama × 20) − (Mesai Oranı × 20)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <div className="p-2 bg-blue-50 rounded text-center">
              <p className="font-bold text-blue-900">90+</p>
              <p className="text-xs text-blue-800">Mükemmel</p>
            </div>
            <div className="p-2 bg-blue-50 rounded text-center">
              <p className="font-bold text-blue-700">80-89</p>
              <p className="text-xs text-blue-600">İyi</p>
            </div>
            <div className="p-2 bg-yellow-50 rounded text-center">
              <p className="font-bold text-yellow-700">70-79</p>
              <p className="text-xs text-yellow-600">Orta</p>
            </div>
            <div className="p-2 bg-red-50 rounded text-center">
              <p className="font-bold text-red-700">&lt;70</p>
              <p className="text-xs text-red-600">Gelişim Gerekli</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
