'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, Send,
  CheckCircle, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import {
  HaftalikTimeSheet,
  TeknisyenTimeSheet,
  GUN_KISA,
  haftaninPazartesisi,
  tarihEkle,
} from '@/lib/utils/timesheet';

type OnayDurumu = 'TASLAK' | 'ONAYA_GONDERILDI' | 'ONAYLANDI' | 'REDDEDILDI';
interface OnayKaydi {
  haftaBaslangic: string;
  employeeId: number;
  durum: OnayDurumu;
  gonderen?: string;
  onaylayan?: string;
  not?: string;
}

const DURUM_GORUNUM: Record<OnayDurumu, { label: string; variant: 'default' | 'info' | 'success' | 'danger' }> = {
  TASLAK: { label: 'Taslak', variant: 'default' },
  ONAYA_GONDERILDI: { label: 'Onay Bekliyor', variant: 'info' },
  ONAYLANDI: { label: 'Onaylandı', variant: 'success' },
  REDDEDILDI: { label: 'Reddedildi', variant: 'danger' },
};

function formatTarihKisa(t: string): string {
  return `${t.slice(8, 10)}.${t.slice(5, 7)}`;
}

export default function MesaiRaporuPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [hafta, setHafta] = useState(() => haftaninPazartesisi(new Date()));
  const [timesheet, setTimesheet] = useState<HaftalikTimeSheet | null>(null);
  const [onaylar, setOnaylar] = useState<OnayKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aksiyonYukleniyor, setAksiyonYukleniyor] = useState<string | null>(null);

  const yonetici = user?.role === UserRole.BOLGE_SORUMLUSU || user?.role === UserRole.YONETIM;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tsRes, onayRes] = await Promise.all([
        fetch(`/api/rapor/timesheet?start=${hafta}`),
        fetch(`/api/mesai/onay?start=${hafta}`),
      ]);
      if (!tsRes.ok) {
        const err = await tsRes.json().catch(() => ({ message: 'Veri yüklenemedi' }));
        throw new Error(err.message);
      }
      setTimesheet(await tsRes.json());
      if (onayRes.ok) {
        const onayData = await onayRes.json();
        setOnaylar(onayData.value || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
      setTimesheet(null);
    } finally {
      setLoading(false);
    }
  }, [hafta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getOnay = (employeeId: number): OnayKaydi | undefined =>
    onaylar.find((o) => o.employeeId === employeeId);

  const handleAksiyon = async (employeeId: number, aksiyon: 'gonder' | 'onayla' | 'reddet') => {
    setAksiyonYukleniyor(`${employeeId}-${aksiyon}`);
    try {
      const res = await fetch('/api/mesai/onay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ haftaBaslangic: hafta, employeeId, aksiyon }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'İşlem başarısız' }));
        throw new Error(err.message);
      }
      const mesaj =
        aksiyon === 'gonder' ? 'Onaya gönderildi' : aksiyon === 'onayla' ? 'Hafta onaylandı' : 'Hafta reddedildi';
      showToast('success', mesaj);
      // Onay listesini yenile
      const onayRes = await fetch(`/api/mesai/onay?start=${hafta}`);
      if (onayRes.ok) {
        const onayData = await onayRes.json();
        setOnaylar(onayData.value || []);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setAksiyonYukleniyor(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/raporlar" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Haftalık Çalışma Saati Formu</h1>
          <p className="text-sm text-gray-500 mt-0.5">İş kayıtlarından otomatik üretilen time sheet</p>
        </div>
        <a href={`/api/rapor/timesheet/export?start=${hafta}`} download>
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Excel İndir
          </Button>
        </a>
      </div>

      {/* Hafta secici */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setHafta(tarihEkle(hafta, -7))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">
              {formatTarihKisa(hafta)} - {formatTarihKisa(tarihEkle(hafta, 6))}
              <span className="text-gray-400 font-normal ml-2">{hafta.slice(0, 4)}</span>
            </p>
            <button
              className="text-xs text-blue-800 hover:underline"
              onClick={() => setHafta(haftaninPazartesisi(new Date()))}
            >
              Bu haftaya dön
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setHafta(tarihEkle(hafta, 7))}>
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
            <Button variant="secondary" className="mt-4" onClick={fetchData}>
              Tekrar Dene
            </Button>
          </div>
        </Card>
      ) : !timesheet || timesheet.teknisyenler.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Bu haftada kayıtlı çalışma yok</p>
            <p className="text-sm mt-1">Teknisyenler işe başla/bitir kullandıkça burada görünür</p>
          </div>
        </Card>
      ) : (
        timesheet.teknisyenler.map((tek) => (
          <TeknisyenKarti
            key={tek.employeeId}
            tek={tek}
            onay={getOnay(tek.employeeId)}
            kendiHaftasi={user?.id === tek.employeeId}
            yonetici={yonetici}
            aksiyonYukleniyor={aksiyonYukleniyor}
            onAksiyon={handleAksiyon}
          />
        ))
      )}
    </div>
  );
}

function TeknisyenKarti({
  tek,
  onay,
  kendiHaftasi,
  yonetici,
  aksiyonYukleniyor,
  onAksiyon,
}: {
  tek: TeknisyenTimeSheet;
  onay?: OnayKaydi;
  kendiHaftasi: boolean;
  yonetici: boolean;
  aksiyonYukleniyor: string | null;
  onAksiyon: (employeeId: number, aksiyon: 'gonder' | 'onayla' | 'reddet') => void;
}) {
  const durum: OnayDurumu = onay?.durum ?? 'TASLAK';
  const gorunum = DURUM_GORUNUM[durum];

  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-bold text-blue-900">{tek.teknisyenAdi.charAt(0)}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{tek.teknisyenAdi}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Badge variant={gorunum.variant}>{gorunum.label}</Badge>
              {onay?.onaylayan && <span>• {onay.onaylayan}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Teknisyen kendi haftasini gonderir */}
          {kendiHaftasi && durum !== 'ONAYLANDI' && durum !== 'ONAYA_GONDERILDI' && (
            <Button
              size="sm"
              onClick={() => onAksiyon(tek.employeeId, 'gonder')}
              loading={aksiyonYukleniyor === `${tek.employeeId}-gonder`}
            >
              <Send className="w-4 h-4 mr-1.5" />
              Onaya Gönder
            </Button>
          )}
          {/* Yonetici onaylar/reddeder */}
          {yonetici && durum === 'ONAYA_GONDERILDI' && (
            <>
              <Button
                size="sm"
                onClick={() => onAksiyon(tek.employeeId, 'onayla')}
                loading={aksiyonYukleniyor === `${tek.employeeId}-onayla`}
                className="!bg-blue-800 !text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Onayla
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onAksiyon(tek.employeeId, 'reddet')}
                loading={aksiyonYukleniyor === `${tek.employeeId}-reddet`}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Reddet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Masaustu: tam matris */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-medium text-gray-500 min-w-[140px]">Müşteri</th>
              {GUN_KISA.map((g) => (
                <th key={g} colSpan={3} className="text-center px-1 py-2 font-medium text-gray-500 border-l border-gray-100">
                  {g}
                </th>
              ))}
              <th colSpan={3} className="text-center px-1 py-2 font-bold text-gray-600 border-l border-gray-200">
                Toplam
              </th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px]">
              <th></th>
              {GUN_KISA.map((g) => (
                <Fragment key={g}>
                  <th className="text-center px-1 pb-1 text-gray-400 font-normal border-l border-gray-100">N</th>
                  <th className="text-center px-1 pb-1 text-amber-500 font-normal">M</th>
                  <th className="text-center px-1 pb-1 text-gray-400 font-normal">KM</th>
                </Fragment>
              ))}
              <th className="text-center px-1 pb-1 text-gray-500 font-medium border-l border-gray-200">N</th>
              <th className="text-center px-1 pb-1 text-amber-600 font-medium">M</th>
              <th className="text-center px-1 pb-1 text-gray-500 font-medium">KM</th>
            </tr>
          </thead>
          <tbody>
            {tek.satirlar.map((satir, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{satir.musteriAdi}</td>
                {satir.gunler.map((gun, gi) => (
                  <Fragment key={gi}>
                    <td className="text-center px-1 py-2 text-gray-700 border-l border-gray-50">
                      {gun.normal || ''}
                    </td>
                    <td className="text-center px-1 py-2 text-amber-600">{gun.mesai || ''}</td>
                    <td className="text-center px-1 py-2 text-gray-400">{gun.km || ''}</td>
                  </Fragment>
                ))}
                <td className="text-center px-1 py-2 font-bold text-gray-900 border-l border-gray-200">
                  {satir.toplamNormal || 0}
                </td>
                <td className="text-center px-1 py-2 font-bold text-amber-600">{satir.toplamMesai || 0}</td>
                <td className="text-center px-1 py-2 text-gray-500">{satir.toplamKm || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil: ozet kart */}
      <div className="lg:hidden px-4 py-3 space-y-2">
        {tek.satirlar.map((satir, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
            <span className="font-medium text-gray-900">{satir.musteriAdi}</span>
            <span className="text-gray-600">
              {satir.toplamNormal}s
              {satir.toplamMesai > 0 && <span className="text-amber-600"> +{satir.toplamMesai}s mesai</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Haftalik toplam */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-500">Normal Çalışma</p>
          <p className="text-lg font-bold text-gray-900">{tek.haftalikNormal} saat</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Mesai</p>
          <p className="text-lg font-bold text-amber-600">{tek.haftalikMesai} saat</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Toplam</p>
          <p className="text-lg font-bold text-blue-900">{tek.haftalikToplam} saat</p>
        </div>
      </div>
    </Card>
  );
}

