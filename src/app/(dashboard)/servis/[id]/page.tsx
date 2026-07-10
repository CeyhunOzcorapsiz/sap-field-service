'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Play, Square, Camera, PenTool, Package,
  FileText, CheckCircle, AlertTriangle, RefreshCw, Printer, History, Star, Users,
} from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { HAZIR_ISLEM_NOTLARI, ServisSonucu, SERVIS_SONUCU_LABELS } from '@/types/service';
import ImzaPad from '@/components/servis/ImzaPad';
import FotografYukleyici from '@/components/servis/FotografYukleyici';
import { SAPServiceCall, SAPServiceCallStatus, SAPEmployee } from '@/types/sap';
import {
  sapStatusToLabel,
  sapStatusToBadge,
  sapPriorityToLabel,
  sapPriorityToBadge,
  sapCallTypeToLabel,
  formatSAPDate,
} from '@/lib/utils/sap-helpers';
import { formatSure } from '@/lib/utils/time';

interface CihazGecmisi {
  value: SAPServiceCall[];
  kronik: boolean;
  kronikSayi: number;
  eslesmeTuru: string | null;
  cihaz?: { itemCode: string; itemDescription: string; serialNum: string };
}

// Gerçek çalışma saatleri (SCL6 UDF U_BASLANGIC/U_BITIS - değiştirilemez)
interface CalismaKaydiClient {
  technicianId: number;
  baslangic: string | null; // "HH:mm:ss"
  bitis: string | null; // "HH:mm:ss"
}
// SCL6 çizelge satırı (atanan teknisyen + düzenlenebilir süre)
interface SchedulingItem {
  lineNum: number;
  technicianId: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string;
  endTime: string;
  actualDakika: number;
}
interface CizelgeGuncelle {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  actualDakika?: number;
}

// Edm.Time "HH:mm:ss" -> "HH:mm"
function saatGoster(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '—';
}

export default function ServisDetayPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const id = params.id as string;

  const [servis, setServis] = useState<SAPServiceCall | null>(null);
  const [employees, setEmployees] = useState<SAPEmployee[]>([]);
  const [calismaKayitlari, setCalismaKayitlari] = useState<CalismaKaydiClient[]>([]);
  const [schedulings, setSchedulings] = useState<SchedulingItem[]>([]);
  const [atamaYukleniyor, setAtamaYukleniyor] = useState(false);
  const [belgeler, setBelgeler] = useState<{
    orders: Array<{ DocEntry: number; DocNum: number; DocTotal: number; DocDate: string; Cancelled: string }>;
    goodsIssues: Array<{ DocEntry: number; DocNum: number; DocDate: string; Comments: string; Cancelled: string }>;
  }>({ orders: [], goodsIssues: [] });
  const [gecmis, setGecmis] = useState<CihazGecmisi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTeknisyenAdi = (code: number) => {
    const emp = employees.find((e) => e.EmployeeID === code);
    return emp ? `${emp.FirstName} ${emp.LastName}` : `#${code}`;
  };

  // Bir teknisyenin gerçek çalışma kaydı (varsa)
  const calismaOf = (technicianId: number) =>
    calismaKayitlari.find((k) => k.technicianId === technicianId) ?? null;

  // "Devam eden iş" = giriş yapan kullanıcının başlamış ama bitmemiş kaydı
  const aktifIs = useMemo(
    () => calismaKayitlari.find((k) => k.technicianId === user?.id && k.baslangic && !k.bitis) ?? null,
    [calismaKayitlari, user],
  );
  // Canlı sayaç için: bugünün tarihi + U_BASLANGIC saati
  const isBaslangic = useMemo(() => {
    if (!aktifIs?.baslangic) return null;
    const gun = new Date().toISOString().split('T')[0];
    const d = new Date(`${gun}T${aktifIs.baslangic}`);
    return isNaN(d.getTime()) ? null : d;
  }, [aktifIs]);
  const [gecenSure, setGecenSure] = useState('00:00:00');
  const [isBaslatYukleniyor, setIsBaslatYukleniyor] = useState(false);
  const [bitirYukleniyor, setBitirYukleniyor] = useState(false);

  // Islem notu (servis cozumu)
  const [islemNotu, setIslemNotu] = useState('');
  const [seciliNot, setSeciliNot] = useState('');

  // Kapatma modal - kagit formdaki alanlar
  const [kapatmaModal, setKapatmaModal] = useState(false);
  const [kapatmaYukleniyor, setKapatmaYukleniyor] = useState(false);
  const [servisSonucu, setServisSonucu] = useState<ServisSonucu | null>(null);
  const [toplamKm, setToplamKm] = useState('');
  const [vakumPompSaati, setVakumPompSaati] = useState('');
  const [musteriPuani, setMusteriPuani] = useState(0);

  // Urun ekleme modal
  // Stok belgeleri: satis siparisi + mal cikisi
  const [siparisModal, setSiparisModal] = useState(false);
  const [cikisModal, setCikisModal] = useState(false);

  // Imza + fotograf modallari
  const [imzaModal, setImzaModal] = useState(false);
  const [fotoModal, setFotoModal] = useState(false);
  const [imzaYukleniyor, setImzaYukleniyor] = useState<string | null>(null);

  const fetchCalisma = useCallback(async () => {
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/calisma`);
      if (res.ok) setCalismaKayitlari((await res.json()).value || []);
    } catch {
      /* calisma kayitlari yuklenemezse sayfa yine calisir */
    }
  }, [id]);

  const fetchSchedulings = useCallback(async () => {
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/schedulings`);
      if (res.ok) setSchedulings((await res.json()).value || []);
    } catch {
      /* cizelge yuklenemezse sayfa yine calisir */
    }
  }, [id]);

  const fetchBelgeler = useCallback(async () => {
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/belgeler`);
      if (res.ok) setBelgeler(await res.json());
    } catch {
      /* belgeler yuklenemezse sayfa yine calisir */
    }
  }, [id]);

  const fetchGecmis = useCallback(async () => {
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/gecmis`);
      if (res.ok) {
        setGecmis(await res.json());
      }
    } catch {
      /* gecmis yuklenemezse sayfa yine calisir */
    }
  }, [id]);

  const fetchServis = useCallback(async () => {
    setLoading(true);
    try {
      const [servisRes, empRes] = await Promise.all([
        fetch(`/api/sap/service-calls/${id}`),
        fetch('/api/sap/employees'),
      ]);
      if (!servisRes.ok) {
        const err = await servisRes.json().catch(() => ({ message: 'Bir hata oluştu' }));
        throw new Error(err.message);
      }
      const data = await servisRes.json();
      setServis(data);
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.value || []);
      }
      await Promise.all([fetchCalisma(), fetchGecmis(), fetchSchedulings(), fetchBelgeler()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Servis yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [id, fetchCalisma, fetchGecmis, fetchSchedulings, fetchBelgeler]);

  useEffect(() => {
    fetchServis();
  }, [fetchServis]);

  // Gecen sure sayaci - acik aktiviteden devam eder
  useEffect(() => {
    if (!isBaslangic) {
      setGecenSure('00:00:00');
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Date.now() - isBaslangic.getTime());
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setGecenSure(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isBaslangic]);

  // İşe Başla - gerçek başlangıç saatini (değiştirilemez) kaydeder
  const handleIsBasla = async () => {
    if (!servis) return;
    setIsBaslatYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/calisma`, { method: 'POST' });
      if (res.status === 409) {
        const data = await res.json();
        showToast('info', data.message);
        await fetchCalisma();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'İş başlatılamadı' }));
        throw new Error(err.message);
      }
      await Promise.all([fetchCalisma(), fetchSchedulings()]);
      showToast('success', 'İş başlatıldı');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İş başlatılamadı');
    } finally {
      setIsBaslatYukleniyor(false);
    }
  };

  // İşi Bitir - gerçek bitişi kaydeder, SCL6 süresini otomatik doldurur
  const handleIsBitir = async () => {
    setBitirYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/calisma`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'İş bitirilemedi' }));
        throw new Error(err.message);
      }
      await Promise.all([fetchCalisma(), fetchSchedulings()]);
      showToast('success', 'İş bitirildi');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İş bitirilemedi');
    } finally {
      setBitirYukleniyor(false);
    }
  };

  // Teknisyen atama (SCL6 cizelge): ekle / guncelle
  const handleTeknisyenEkle = async (technicianId: number) => {
    setAtamaYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/schedulings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('success', data.message || 'Teknisyen atandı');
      await fetchSchedulings();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Atama başarısız');
    } finally {
      setAtamaYukleniyor(false);
    }
  };

  const handleTeknisyenGuncelle = async (lineNum: number, technicianId: number) => {
    setAtamaYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/schedulings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineNum, technicianId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('success', data.message || 'Atama güncellendi');
      await fetchSchedulings();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Güncelleme başarısız');
    } finally {
      setAtamaYukleniyor(false);
    }
  };

  // Atanabilir teknisyenler (Teknik Servis = dep 9), zaten atanmislar haric
  const atanmisIds = new Set(schedulings.map((s) => s.technicianId));
  const teknisyenAdaylari = employees.filter((e) => Number(e.Department) === 9);
  const eklenebilirTeknisyenler = teknisyenAdaylari.filter((e) => !atanmisIds.has(e.EmployeeID));

  // SCL6 çizelge alanlarını düzenle (StartDate/StartTime/EndDate/EndTime/ActualDuration)
  // U_BASLANGIC/U_BITIS'e dokunulmaz. SAP'ye yansır.
  const handleCizelgeGuncelle = async (lineNum: number, alanlar: CizelgeGuncelle) => {
    setAtamaYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/schedulings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineNum, ...alanlar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('success', data.message || 'Çizelge güncellendi');
      await fetchSchedulings();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Güncellenemedi');
    } finally {
      setAtamaYukleniyor(false);
    }
  };

  const handleKaydet = async () => {
    if (!islemNotu.trim()) {
      showToast('error', 'İşlem notu boş olamaz');
      return;
    }

    try {
      const res = await fetch(`/api/sap/service-calls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Resolution: islemNotu,
        }),
      });

      if (!res.ok) throw new Error('Kaydetme başarısız');

      const updated = await res.json();
      setServis(updated);
      showToast('success', 'İşlem notu kaydedildi');
    } catch {
      showToast('error', 'Kaydetme başarısız');
    }
  };

  // Imza kaydet (teknisyen veya musteri)
  const handleImzaKaydet = async (dataUrl: string, kind: 'signature-tech' | 'signature-customer') => {
    setImzaYukleniyor(kind);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `imza-${kind}-S${id}.png`,
          mimeType: 'image/png',
          dataBase64: dataUrl,
          kind,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'İmza yüklenemedi' }));
        throw new Error(err.message);
      }
      showToast('success', kind === 'signature-tech' ? 'Teknisyen imzası kaydedildi' : 'Müşteri imzası kaydedildi');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İmza yüklenemedi');
    } finally {
      setImzaYukleniyor(null);
    }
  };

  // Fotograf yukle
  const handleFotoYukle = async (fileName: string, mimeType: string, dataUrl: string) => {
    const res = await fetch(`/api/sap/service-calls/${id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, mimeType, dataBase64: dataUrl, kind: 'photo' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Fotoğraf yüklenemedi' }));
      throw new Error(err.message);
    }
    showToast('success', 'Fotoğraf SAP\'ye yüklendi');
    setFotoModal(false);
  };

  const handleServisKapat = async () => {
    if (!islemNotu.trim()) {
      showToast('error', 'Servisi kapatmak için işlem notu zorunludur');
      return;
    }
    if (!servisSonucu) {
      showToast('error', 'Servis sonucu seçimi zorunludur');
      return;
    }
    if (aktifIs) {
      showToast('error', 'Devam eden iş var — önce işi bitirmelisiniz');
      return;
    }

    setKapatmaYukleniyor(true);
    try {
      const res = await fetch(`/api/sap/service-calls/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: islemNotu,
          sonuc: servisSonucu,
          toplamKm: toplamKm || undefined,
          vakumPompSaati: vakumPompSaati || undefined,
          musteriPuani: musteriPuani || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Kapatma başarısız' }));
        throw new Error(err.message);
      }

      showToast('success', 'Servis başarıyla kapatıldı');
      setKapatmaModal(false);
      router.push('/servis');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Servis kapatılamadı');
    } finally {
      setKapatmaYukleniyor(false);
    }
  };

  if (loading) return <FullPageLoading />;
  if (error || !servis) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/servis" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Servis Detayı</h1>
        </div>
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error || 'Servis bulunamadı'}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchServis}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tekrar Dene
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isClosed = servis.Status === SAPServiceCallStatus.CLOSED;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/servis" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">S-{servis.DocNum}</h1>
            <Badge variant={sapStatusToBadge(servis.Status)}>{sapStatusToLabel(servis.Status)}</Badge>
            <Badge variant="info">{sapCallTypeToLabel(servis.CallType)}</Badge>
            <Badge variant={sapPriorityToBadge(servis.Priority)}>{sapPriorityToLabel(servis.Priority)}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{servis.Subject}</p>
        </div>
        <Link href={`/servis-formu/${servis.ServiceCallID}`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Servis Formu</span>
          </Button>
        </Link>
      </div>

      {/* Kronik ariza uyarisi - Excel #19 */}
      {gecmis?.kronik && (
        <Card className="!bg-red-50 !border-red-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Kronik Arıza Uyarısı</p>
              <p className="text-sm text-red-600 mt-0.5">
                Bu cihaz son 6 ayda <strong>{gecmis.kronikSayi} kez</strong> arıza kaydı aldı.
                Kalıcı çözüm veya değişim değerlendirilmeli.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Is Baslat/Bitir - sadece acik servisler icin */}
      {!isClosed && (
        <Card className="!p-3">
          <div className="flex gap-3">
            {!aktifIs ? (
              <Button
                size="lg"
                fullWidth
                onClick={handleIsBasla}
                loading={isBaslatYukleniyor}
                className="!bg-blue-800 !text-white"
              >
                <Play className="w-5 h-5 mr-2" />
                İşe Başla
              </Button>
            ) : (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 bg-blue-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-blue-800 font-medium">İş Devam Ediyor</p>
                  <p className="text-2xl font-bold text-blue-900 font-mono">{gecenSure}</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Başlangıç: {saatGoster(aktifIs.baslangic)} — {user?.fullName}
                  </p>
                </div>
                <Button size="lg" variant="danger" onClick={handleIsBitir} loading={bitirYukleniyor}>
                  <Square className="w-5 h-5 mr-2" />
                  İşi Bitir
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Atanan Teknisyenler (SCL6 cizelge) - acik servisler icin */}
      {!isClosed && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Atanan Teknisyenler</h3>
          </div>

          {schedulings.length === 0 ? (
            <p className="text-sm text-gray-400 mb-3">Henüz teknisyen atanmadı</p>
          ) : (
            <div className="divide-y divide-gray-100 mb-3">
              {schedulings.map((s) => (
                <AtananTeknisyenSatiri
                  key={s.lineNum}
                  isim={getTeknisyenAdi(s.technicianId)}
                  cizelge={s}
                  calisma={calismaOf(s.technicianId)}
                  secenekler={teknisyenAdaylari.filter(
                    (e) => e.EmployeeID === s.technicianId || !atanmisIds.has(e.EmployeeID),
                  )}
                  atamaYukleniyor={atamaYukleniyor}
                  onYenidenAta={(tid) => handleTeknisyenGuncelle(s.lineNum, tid)}
                  onCizelgeGuncelle={(alanlar) => handleCizelgeGuncelle(s.lineNum, alanlar)}
                />
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-gray-100">
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
              value=""
              disabled={atamaYukleniyor || eklenebilirTeknisyenler.length === 0}
              onChange={(e) => e.target.value && handleTeknisyenEkle(parseInt(e.target.value))}
            >
              <option value="">
                {eklenebilirTeknisyenler.length === 0
                  ? 'Eklenebilecek teknisyen yok'
                  : '+ Teknisyen Ekle'}
              </option>
              {eklenebilirTeknisyenler.map((e) => (
                <option key={e.EmployeeID} value={e.EmployeeID}>
                  {e.FirstName} {e.LastName}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Kapali servis bilgisi */}
      {isClosed && (
        <Card className="!bg-blue-50 !border-blue-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-blue-800 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900">Bu servis kapatılmış</p>
              <p className="text-sm text-blue-800">Kapatılma: {formatSAPDate(servis.CloseDate)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Servis Bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle>Servis Bilgileri</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Müşteri</p>
            <p className="font-medium text-gray-900">{servis.CustomerName}</p>
          </div>
          <div>
            <p className="text-gray-500">Müşteri Kodu</p>
            <p className="font-medium text-gray-900">{servis.CustomerCode}</p>
          </div>
          <div>
            <p className="text-gray-500">Ürün / Ekipman</p>
            <p className="font-medium text-gray-900">{servis.ItemDescription || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Seri No</p>
            <p className="font-medium text-gray-900">{servis.InternalSerialNum || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Teknisyen</p>
            <p className="font-medium text-gray-900">{getTeknisyenAdi(servis.TechnicianCode)}</p>
          </div>
          <div>
            <p className="text-gray-500">Oluşturma Tarihi</p>
            <p className="font-medium text-gray-900">{formatSAPDate(servis.CreateDate)}</p>
          </div>
        </div>
        {servis.Description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-500 text-sm">Açıklama</p>
            <p className="text-sm text-gray-900 mt-1">{servis.Description}</p>
          </div>
        )}
        {servis.Resolution && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-500 text-sm">Çözüm</p>
            <p className="text-sm text-gray-900 mt-1">{servis.Resolution}</p>
          </div>
        )}
      </Card>

      {/* Kullanilan Urunler */}
      {servis.ServiceCallInventoryExpenses && servis.ServiceCallInventoryExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Kullanılan Ürünler
              </div>
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {servis.ServiceCallInventoryExpenses.map((expense, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{expense.ItemDescription}</p>
                  <p className="text-xs text-gray-500">{expense.ItemCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{expense.Quantity} adet</p>
                  <p className="text-xs text-gray-500">₺{expense.LineTotal.toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cihaz Gecmisi - Excel #19: tekrar ariza takibi */}
      {gecmis && gecmis.value.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Cihaz Geçmişi
                </div>
                <span className="text-xs font-normal text-gray-400">
                  {gecmis.eslesmeTuru} ile eşleşti
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <p className="text-xs text-gray-500 mb-3">
            {gecmis.cihaz?.itemDescription}
            {gecmis.cihaz?.serialNum && ` • ${gecmis.cihaz.serialNum}`} — {gecmis.value.length} geçmiş kayıt
          </p>
          <div className="space-y-2">
            {gecmis.value.slice(0, 8).map((g) => (
              <Link key={g.ServiceCallID} href={`/servis/${g.ServiceCallID}`} className="block">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-2 -mx-2 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-900">S-{g.ServiceCallID}</span>
                      <Badge variant="info" className="!text-[10px]">{sapCallTypeToLabel(g.CallType)}</Badge>
                      <Badge variant={sapStatusToBadge(g.Status)} className="!text-[10px]">
                        {sapStatusToLabel(g.Status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{g.Subject}</p>
                  </div>
                  <p className="text-xs text-gray-400 ml-3 flex-shrink-0">{formatSAPDate(g.CreateDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Islem Notu - sadece acik servisler icin */}
      {!isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                İşlem Notu
              </div>
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Select
              options={HAZIR_ISLEM_NOTLARI.map((n) => ({ value: n, label: n }))}
              placeholder="Hazır not seçin veya aşağıya yazın..."
              value={seciliNot}
              onChange={(e) => {
                setSeciliNot(e.target.value);
                if (e.target.value) {
                  setIslemNotu((prev) => (prev ? `${prev}\n${e.target.value}` : e.target.value));
                }
              }}
            />
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 min-h-[100px]"
              placeholder="Yapılan işlem hakkında not ekleyin..."
              value={islemNotu}
              onChange={(e) => setIslemNotu(e.target.value)}
            />
          </div>
        </Card>
      )}

      {/* Stok / Faturalama belgeleri - sadece acik servisler icin */}
      {!isClosed && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Stok / Faturalama</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="flex-col !py-4 !gap-2" onClick={() => setSiparisModal(true)}>
              <FileText className="w-6 h-6 text-blue-800" />
              <span className="text-xs">Satış Siparişi</span>
            </Button>
            <Button variant="secondary" className="flex-col !py-4 !gap-2" onClick={() => setCikisModal(true)}>
              <Package className="w-6 h-6 text-amber-600" />
              <span className="text-xs">Mal Çıkışı</span>
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Satış siparişi: müşteriye faturalanacak kalemler · Mal çıkışı: kullanılan malzeme stoktan düşülür
          </p>
        </Card>
      )}

      {/* Bu cagriya bagli belgeler (U_HIZMET_CAGRISI) */}
      {(belgeler.orders.length > 0 || belgeler.goodsIssues.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Bu Çağrının Belgeleri</h3>
          </div>

          {belgeler.orders.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Satış Siparişleri</p>
              <div className="divide-y divide-gray-100">
                {belgeler.orders.map((o) => (
                  <div key={o.DocEntry} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900">Sipariş #{o.DocNum}</span>
                      {o.Cancelled === 'tYES' && <Badge variant="danger">İptal</Badge>}
                      <span className="text-xs text-gray-400">{formatSAPDate(o.DocDate)}</span>
                    </span>
                    <span className="font-semibold text-gray-900 flex-shrink-0">{o.DocTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {belgeler.goodsIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Mal Çıkışları</p>
              <div className="divide-y divide-gray-100">
                {belgeler.goodsIssues.map((g) => (
                  <div key={g.DocEntry} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900">Çıkış #{g.DocNum}</span>
                      {g.Cancelled === 'tYES' && <Badge variant="danger">İptal</Badge>}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatSAPDate(g.DocDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Hizli Islemler - sadece acik servisler icin */}
      {!isClosed && (
        <div className="grid grid-cols-3 gap-3">
          <Button variant="secondary" className="flex-col !py-4 !gap-2" onClick={() => setFotoModal(true)}>
            <Camera className="w-6 h-6" />
            <span className="text-xs">Fotoğraf</span>
          </Button>
          <Button variant="secondary" className="flex-col !py-4 !gap-2" onClick={() => setImzaModal(true)}>
            <PenTool className="w-6 h-6" />
            <span className="text-xs">İmza Al</span>
          </Button>
          <Link href={`/servis-formu/${id}`} target="_blank" className="contents">
            <Button variant="secondary" className="flex-col !py-4 !gap-2 w-full">
              <Printer className="w-6 h-6" />
              <span className="text-xs">Form / PDF</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Alt Butonlar */}
      {!isClosed && (
        <Card>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleKaydet}>
              Kaydet
            </Button>
            <Button variant="danger" onClick={() => setKapatmaModal(true)}>
              Servisi Kapat
            </Button>
          </div>
        </Card>
      )}

      {/* Kapatma Onay Modali - kagit formdaki kapanis alanlari */}
      <Modal
        open={kapatmaModal}
        onClose={() => setKapatmaModal(false)}
        title="Servisi Kapat"
        size="md"
      >
        <div className="space-y-4">
          {/* Servis Sonucu - kagit formdaki 3'lu secim */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Servis Sonucu *</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(SERVIS_SONUCU_LABELS) as [string, string][]).map(([deger, etiket]) => {
                const d = Number(deger) as ServisSonucu;
                const secili = servisSonucu === d;
                const renk =
                  d === ServisSonucu.CALISIR_DURUMDA
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : d === ServisSonucu.MUDAHALE_GEREKLI
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-red-500 bg-red-50 text-red-800';
                return (
                  <button
                    key={deger}
                    type="button"
                    onClick={() => setServisSonucu(d)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      secili ? renk : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        secili ? 'border-current' : 'border-gray-300'
                      }`}
                    >
                      {secili && <span className="w-2 h-2 rounded-full bg-current" />}
                    </span>
                    {etiket}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Km + Vakum Pomp Saati - kagit formdaki alanlar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Toplam Servis Km</label>
              <input
                type="number"
                min={0}
                placeholder="Örn: 120"
                value={toplamKm}
                onChange={(e) => setToplamKm(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vakum Pomp Saati</label>
              <input
                type="number"
                min={0}
                placeholder="Örn: 4520"
                value={vakumPompSaati}
                onChange={(e) => setVakumPompSaati(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
              />
            </div>
          </div>

          {/* Musteri memnuniyet puani - TVS skoru icin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Müşteri Memnuniyeti
              <span className="text-gray-400 font-normal ml-1">(opsiyonel — performans skoruna yansır)</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((puan) => (
                <button
                  key={puan}
                  type="button"
                  onClick={() => setMusteriPuani(musteriPuani === puan ? 0 : puan)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${puan} yıldız`}
                >
                  <Star
                    className={`w-7 h-7 ${
                      puan <= musteriPuani ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {musteriPuani > 0 && (
                <span className="ml-2 text-sm font-medium text-gray-700">{musteriPuani}/5</span>
              )}
            </div>
          </div>

          <div className="bg-amber-50 text-amber-700 px-4 py-3 rounded-lg text-sm">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Servis kapatıldıktan sonra değişiklik yapılamaz.</p>
            </div>
          </div>

          {!islemNotu.trim() && (
            <p className="text-red-600 text-sm">İşlem notu zorunludur — ana sayfadaki İşlem Notu alanını doldurun.</p>
          )}
          {aktifIs && (
            <p className="text-red-600 text-sm">Devam eden iş var — kapatmadan önce işi bitirin.</p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="secondary" onClick={() => setKapatmaModal(false)}>
              İptal
            </Button>
            <Button
              variant="danger"
              onClick={handleServisKapat}
              loading={kapatmaYukleniyor}
              disabled={!islemNotu.trim() || !servisSonucu || !!aktifIs}
            >
              Evet, Servisi Kapat
            </Button>
          </div>
        </div>
      </Modal>

      {/* Satis Siparisi Modali */}
      <Modal open={siparisModal} onClose={() => setSiparisModal(false)} title="Satış Siparişi" size="md">
        <SatisSiparisiModal
          servisId={id}
          cardCode={servis.CustomerCode}
          onClose={() => setSiparisModal(false)}
          onSuccess={(msg) => {
            setSiparisModal(false);
            showToast('success', msg);
            fetchBelgeler();
          }}
          onError={(mesaj) => showToast('error', mesaj)}
        />
      </Modal>

      {/* Mal Cikisi Modali */}
      <Modal open={cikisModal} onClose={() => setCikisModal(false)} title="Mal Çıkışı (Stok Düşümü)" size="md">
        <MalCikisiModal
          servisId={id}
          onClose={() => setCikisModal(false)}
          onSuccess={(msg) => {
            setCikisModal(false);
            showToast('success', msg);
            fetchBelgeler();
          }}
          onError={(mesaj) => showToast('error', mesaj)}
        />
      </Modal>

      {/* Imza Modali - cift imza (teknisyen + musteri) */}
      <Modal open={imzaModal} onClose={() => setImzaModal(false)} title="Dijital İmza" size="md">
        <div className="space-y-5">
          <ImzaPad
            label="Servis Yetkilisi (Teknisyen) İmzası"
            onKaydetBase64={(d) => handleImzaKaydet(d, 'signature-tech')}
            yukleniyor={imzaYukleniyor === 'signature-tech'}
          />
          <div className="border-t border-gray-100" />
          <ImzaPad
            label="Müşteri Yetkilisi İmzası"
            onKaydetBase64={(d) => handleImzaKaydet(d, 'signature-customer')}
            yukleniyor={imzaYukleniyor === 'signature-customer'}
          />
          <p className="text-xs text-gray-400">
            İmzalar PNG olarak SAP servis kaydına (Attachments2) eklenir.
          </p>
        </div>
      </Modal>

      {/* Fotograf Modali */}
      <Modal open={fotoModal} onClose={() => setFotoModal(false)} title="Fotoğraf Yükle" size="md">
        <FotografYukleyici onYukle={handleFotoYukle} />
      </Modal>
    </div>
  );
}

// Atanan teknisyen satırı: ad + yeniden ata + gerçek saatler (U_BASLANGIC/
// U_BITIS, salt-okunur) + düzenlenebilir SCL6 çizelge alanları (mobil).
function AtananTeknisyenSatiri({
  isim,
  cizelge,
  calisma,
  secenekler,
  atamaYukleniyor,
  onYenidenAta,
  onCizelgeGuncelle,
}: {
  isim: string;
  cizelge: SchedulingItem;
  calisma: CalismaKaydiClient | null;
  secenekler: SAPEmployee[];
  atamaYukleniyor: boolean;
  onYenidenAta: (technicianId: number) => void;
  onCizelgeGuncelle: (alanlar: CizelgeGuncelle) => void;
}) {
  const [duzenle, setDuzenle] = useState(false);
  const [sd, setSd] = useState(cizelge.startDate);
  const [st, setSt] = useState(cizelge.startTime);
  const [ed, setEd] = useState(cizelge.endDate);
  const [et, setEt] = useState(cizelge.endTime);
  const [ad, setAd] = useState(String(cizelge.actualDakika));

  const gercek = calisma?.baslangic
    ? calisma.bitis
      ? `${saatGoster(calisma.baslangic)} → ${saatGoster(calisma.bitis)}`
      : `${saatGoster(calisma.baslangic)} → devam ediyor`
    : '—';

  const kaydet = () => {
    onCizelgeGuncelle({
      startDate: sd || undefined,
      startTime: st || undefined,
      endDate: ed || undefined,
      endTime: et || undefined,
      actualDakika: parseInt(ad) || 0,
    });
    setDuzenle(false);
  };

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">{isim}</span>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 max-w-[150px]"
          value=""
          disabled={atamaYukleniyor}
          onChange={(e) => e.target.value && onYenidenAta(parseInt(e.target.value))}
        >
          <option value="">Değiştir…</option>
          {secenekler.map((e) => (
            <option key={e.EmployeeID} value={e.EmployeeID}>
              {e.FirstName} {e.LastName}
            </option>
          ))}
        </select>
      </div>

      {/* Gerçek başla/bitiş (değiştirilemez) */}
      <p className="mt-1 text-xs text-gray-500">Gerçek: {gercek}</p>

      {/* Çizelge (düzenlenebilir) */}
      {!duzenle ? (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            Çizelge: {cizelge.startTime || '--:--'}–{cizelge.endTime || '--:--'} · Fiili: {formatSure(cizelge.actualDakika / 60)}
          </span>
          <button type="button" onClick={() => setDuzenle(true)} className="text-xs font-medium text-blue-900 whitespace-nowrap">
            Düzenle
          </button>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1.5 bg-gray-50 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16">Başlangıç</span>
            <input type="date" value={sd} onChange={(e) => setSd(e.target.value)} className="text-xs border border-gray-300 rounded px-1.5 py-1" />
            <input type="time" value={st} onChange={(e) => setSt(e.target.value)} className="text-xs border border-gray-300 rounded px-1.5 py-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16">Bitiş</span>
            <input type="date" value={ed} onChange={(e) => setEd(e.target.value)} className="text-xs border border-gray-300 rounded px-1.5 py-1" />
            <input type="time" value={et} onChange={(e) => setEt(e.target.value)} className="text-xs border border-gray-300 rounded px-1.5 py-1" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16">Fiili (dk)</span>
            <input type="number" min={0} inputMode="numeric" value={ad} onChange={(e) => setAd(e.target.value)} className="w-20 text-xs border border-gray-300 rounded px-1.5 py-1 text-center" />
            <div className="ml-auto flex gap-1">
              <button type="button" onClick={kaydet} disabled={atamaYukleniyor} className="text-xs bg-blue-800 text-white rounded px-2 py-1">Kaydet</button>
              <button type="button" onClick={() => setDuzenle(false)} className="text-xs text-gray-500 px-2 py-1">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Kalem arama kutusu (satış siparişi + mal çıkışı modallarında ortak)
function KalemArama({
  inStockOnly,
  onSec,
}: {
  inStockOnly?: boolean;
  onSec: (u: { ItemCode: string; ItemName: string }) => void;
}) {
  const [arama, setArama] = useState('');
  const [urunler, setUrunler] = useState<Array<{ ItemCode: string; ItemName: string }>>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (arama.length < 2) {
      setUrunler([]);
      return;
    }
    const t = setTimeout(async () => {
      setYukleniyor(true);
      try {
        const r = await fetch(
          `/api/sap/items?search=${encodeURIComponent(arama)}${inStockOnly ? '&inStock=true' : ''}&top=10`,
        );
        if (r.ok) setUrunler((await r.json()).value || []);
      } catch {
        /* ignore */
      } finally {
        setYukleniyor(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [arama, inStockOnly]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Kalem kodu/adı ile ara ve ekle..."
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
      />
      {yukleniyor && <p className="text-xs text-gray-400 mt-1">Aranıyor...</p>}
      {urunler.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {urunler.map((u) => (
            <button
              key={u.ItemCode}
              type="button"
              onClick={() => {
                onSec(u);
                setArama('');
                setUrunler([]);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
            >
              <p className="font-medium text-gray-900">{u.ItemName}</p>
              <p className="text-xs text-gray-500">{u.ItemCode}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// SATIŞ SİPARİŞİ: müşteriye faturalanacak kalemler (kalem + miktar + fiyat).
function SatisSiparisiModal({
  servisId,
  cardCode,
  onClose,
  onSuccess,
  onError,
}: {
  servisId: string;
  cardCode: string;
  onClose: () => void;
  onSuccess: (mesaj: string) => void;
  onError: (mesaj: string) => void;
}) {
  const [satirlar, setSatirlar] = useState<
    Array<{ itemCode: string; itemName: string; quantity: number; unitPrice: number }>
  >([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ekle = async (u: { ItemCode: string; ItemName: string }) => {
    if (satirlar.some((s) => s.itemCode === u.ItemCode)) return;
    let fiyat = 0;
    try {
      const r = await fetch(
        `/api/sap/item-price?itemCode=${encodeURIComponent(u.ItemCode)}&cardCode=${encodeURIComponent(cardCode)}`,
      );
      if (r.ok) fiyat = (await r.json()).price || 0;
    } catch {
      /* fiyat alınamazsa 0 */
    }
    setSatirlar((p) => [...p, { itemCode: u.ItemCode, itemName: u.ItemName, quantity: 1, unitPrice: fiyat }]);
  };
  const guncelle = (i: number, alan: 'quantity' | 'unitPrice', deger: number) =>
    setSatirlar((p) => p.map((s, idx) => (idx === i ? { ...s, [alan]: deger } : s)));
  const sil = (i: number) => setSatirlar((p) => p.filter((_, idx) => idx !== i));
  const toplam = satirlar.reduce((t, s) => t + s.quantity * s.unitPrice, 0);

  const olustur = async () => {
    if (satirlar.length === 0) return;
    setKaydediliyor(true);
    try {
      const r = await fetch(`/api/sap/service-calls/${servisId}/sales-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: satirlar.map((s) => ({ itemCode: s.itemCode, quantity: s.quantity, unitPrice: s.unitPrice })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onSuccess(d.message || 'Satış siparişi oluşturuldu');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Satış siparişi oluşturulamadı');
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="space-y-4">
      <KalemArama onSec={ekle} />
      {satirlar.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Kalem ekleyin (fiyat listesinden gelir, değiştirilebilir)</p>
      ) : (
        <div className="space-y-2">
          {satirlar.map((s, i) => (
            <div key={s.itemCode} className="border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.itemName}</p>
                  <p className="text-xs text-gray-500">{s.itemCode}</p>
                </div>
                <button type="button" onClick={() => sil(i)} className="text-red-500 text-sm px-1">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-500">Miktar</label>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={s.quantity}
                  onChange={(e) => guncelle(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                />
                <label className="text-xs text-gray-500 ml-2">Fiyat</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={s.unitPrice}
                  onChange={(e) => guncelle(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                />
                <span className="text-xs text-gray-400 ml-auto">{(s.quantity * s.unitPrice).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1">
            <span>Toplam (KDV hariç)</span>
            <span>{toplam.toFixed(2)}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="secondary" onClick={onClose}>
          İptal
        </Button>
        <Button onClick={olustur} disabled={satirlar.length === 0} loading={kaydediliyor}>
          Sipariş Oluştur
        </Button>
      </div>
    </div>
  );
}

// MAL ÇIKIŞI: kullanılan malzeme stoktan düşülür (kalem + miktar + depo).
function MalCikisiModal({
  servisId,
  onClose,
  onSuccess,
  onError,
}: {
  servisId: string;
  onClose: () => void;
  onSuccess: (mesaj: string) => void;
  onError: (mesaj: string) => void;
}) {
  const [depolar, setDepolar] = useState<Array<{ WarehouseCode: string; WarehouseName: string }>>([]);
  const [satirlar, setSatirlar] = useState<
    Array<{ itemCode: string; itemName: string; quantity: number; warehouseCode: string }>
  >([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    fetch('/api/sap/warehouses')
      .then((r) => (r.ok ? r.json() : { value: [] }))
      .then((d) => setDepolar(d.value || []))
      .catch(() => setDepolar([]));
  }, []);

  const ekle = (u: { ItemCode: string; ItemName: string }) => {
    if (satirlar.some((s) => s.itemCode === u.ItemCode)) return;
    setSatirlar((p) => [
      ...p,
      { itemCode: u.ItemCode, itemName: u.ItemName, quantity: 1, warehouseCode: depolar[0]?.WarehouseCode ?? '' },
    ]);
  };
  const guncelleMiktar = (i: number, q: number) =>
    setSatirlar((p) => p.map((s, idx) => (idx === i ? { ...s, quantity: q } : s)));
  const guncelleDepo = (i: number, w: string) =>
    setSatirlar((p) => p.map((s, idx) => (idx === i ? { ...s, warehouseCode: w } : s)));
  const sil = (i: number) => setSatirlar((p) => p.filter((_, idx) => idx !== i));

  const olustur = async () => {
    if (satirlar.length === 0) return;
    if (satirlar.some((s) => !s.warehouseCode)) {
      onError('Her kalem için depo seçin');
      return;
    }
    setKaydediliyor(true);
    try {
      const r = await fetch(`/api/sap/service-calls/${servisId}/goods-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: satirlar }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onSuccess(d.message || 'Mal çıkışı oluşturuldu');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Mal çıkışı oluşturulamadı');
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="space-y-4">
      <KalemArama inStockOnly onSec={ekle} />
      {satirlar.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Stoktan düşülecek malzemeleri ekleyin</p>
      ) : (
        <div className="space-y-2">
          {satirlar.map((s, i) => (
            <div key={s.itemCode} className="border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.itemName}</p>
                  <p className="text-xs text-gray-500">{s.itemCode}</p>
                </div>
                <button type="button" onClick={() => sil(i)} className="text-red-500 text-sm px-1">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-500">Miktar</label>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={s.quantity}
                  onChange={(e) => guncelleMiktar(i, Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                />
                <select
                  value={s.warehouseCode}
                  onChange={(e) => guncelleDepo(i, e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">Depo seç...</option>
                  {depolar.map((d) => (
                    <option key={d.WarehouseCode} value={d.WarehouseCode}>
                      {d.WarehouseCode} - {d.WarehouseName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="secondary" onClick={onClose}>
          İptal
        </Button>
        <Button variant="danger" onClick={olustur} disabled={satirlar.length === 0} loading={kaydediliyor}>
          Stoktan Düş
        </Button>
      </div>
    </div>
  );
}
