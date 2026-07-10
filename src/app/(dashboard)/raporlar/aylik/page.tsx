'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, AlertTriangle, Briefcase } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';

interface AylikTeknisyen {
  employeeId: number;
  teknisyenAdi: string;
  toplamCalisma: number;
  toplamMesai: number;
  toplamKm: number;
  servisSayisi: number;
  musteriler: Array<{ musteriAdi: string; normal: number; mesai: number }>;
}

interface AylikRapor {
  year: number;
  month: number;
  teknisyenler: AylikTeknisyen[];
  toplamlar: { calisma: number; mesai: number; km: number };
}

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export default function AylikRaporPage() {
  const simdi = new Date();
  const [year, setYear] = useState(simdi.getFullYear());
  const [month, setMonth] = useState(simdi.getMonth() + 1);
  const [rapor, setRapor] = useState<AylikRapor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acikTeknisyen, setAcikTeknisyen] = useState<number | null>(null);

  const oncekiAy = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const sonrakiAy = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const fetchRapor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rapor/aylik?year=${year}&month=${month}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Rapor yüklenemedi' }));
        throw new Error(err.message);
      }
      setRapor(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor yüklenemedi');
      setRapor(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchRapor();
  }, [fetchRapor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/raporlar" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aylık Mesai Raporu</h1>
          <p className="text-sm text-gray-500 mt-0.5">Teknisyen bazlı çalışma ve mesai özeti</p>
        </div>
      </div>

      {/* Ay secici */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={oncekiAy}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <p className="text-base font-bold text-gray-900">
            {AY_ADLARI[month - 1]} {year}
          </p>
          <Button variant="ghost" size="sm" onClick={sonrakiAy}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      {loading ? (
        <FullPageLoading />
      ) : error ? (
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchRapor}>
              Tekrar Dene
            </Button>
          </div>
        </Card>
      ) : !rapor || rapor.teknisyenler.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Bu ayda kayıtlı çalışma yok</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Ay toplamlari */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <p className="text-xs text-gray-500">Toplam Çalışma</p>
              <p className="text-xl font-bold text-gray-900">{rapor.toplamlar.calisma} saat</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-gray-500">Toplam Mesai</p>
              <p className="text-xl font-bold text-amber-600">{rapor.toplamlar.mesai} saat</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-gray-500">Toplam Yol</p>
              <p className="text-xl font-bold text-gray-900">{rapor.toplamlar.km} km</p>
            </Card>
          </div>

          {/* Teknisyen tablosu */}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Teknisyen</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Servis</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Normal (saat)</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Mesai (saat)</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Mesai %</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">KM</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.teknisyenler.map((tek) => {
                    const toplam = tek.toplamCalisma + tek.toplamMesai;
                    const oran = toplam > 0 ? Math.round((tek.toplamMesai / toplam) * 100) : 0;
                    const acik = acikTeknisyen === tek.employeeId;
                    return (
                      <Fragment key={tek.employeeId}>
                        <tr
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setAcikTeknisyen(acik ? null : tek.employeeId)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{tek.teknisyenAdi}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{tek.servisSayisi}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{tek.toplamCalisma}</td>
                          <td className="px-4 py-3 text-right font-medium text-amber-600">{tek.toplamMesai}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                oran > 25
                                  ? 'bg-red-50 text-red-600'
                                  : oran > 15
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-blue-50 text-blue-800'
                              }`}
                            >
                              %{oran}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{tek.toplamKm}</td>
                        </tr>
                        {acik && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={6} className="px-4 py-2">
                              <div className="text-xs space-y-1">
                                <p className="font-medium text-gray-500 flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5" />
                                  Müşteri Dağılımı
                                </p>
                                {tek.musteriler.map((m, i) => (
                                  <div key={i} className="flex justify-between text-gray-600 pl-5">
                                    <span>{m.musteriAdi}</span>
                                    <span>
                                      {m.normal}s
                                      {m.mesai > 0 && <span className="text-amber-600"> +{m.mesai}s mesai</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-gray-400">Satıra tıklayarak müşteri dağılımını görebilirsiniz</p>
        </>
      )}
    </div>
  );
}

