'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  Wrench,
  Hammer,
  ShieldCheck,
  Power,
  Check,
  type LucideIcon,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { SAPBusinessPartner, SAPEmployee, SAPCustomerEquipment } from '@/types/sap';

// Servis tipleri = SAP ProblemType (CallType DEGIL; o tablo bos).
const FALLBACK_TIPLER = [
  { ProblemTypeID: 1, Name: 'ARIZA' },
  { ProblemTypeID: 2, Name: 'BAKIM' },
  { ProblemTypeID: 3, Name: 'MONTAJ' },
  { ProblemTypeID: 4, Name: 'GARANTİ' },
  { ProblemTypeID: 5, Name: 'DEVREYE ALMA' },
];

const TIP_IKON: Record<number, LucideIcon> = {
  1: AlertTriangle, // Ariza
  2: Wrench, // Bakim
  3: Hammer, // Montaj
  4: ShieldCheck, // Garanti
  5: Power, // Devreye Alma
};

const ONCELIKLER = [
  { value: 'scp_Low', label: 'Düşük' },
  { value: 'scp_Medium', label: 'Orta' },
  { value: 'scp_High', label: 'Yüksek' },
];

export default function YeniServisPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isTeknisyen = user?.role === UserRole.TEKNISYEN;

  const [loading, setLoading] = useState(false);

  // Musteri arama
  const [musteriArama, setMusteriArama] = useState('');
  const [musteriler, setMusteriler] = useState<SAPBusinessPartner[]>([]);
  const [musteriYukleniyor, setMusteriYukleniyor] = useState(false);
  const [musteriListeAcik, setMusteriListeAcik] = useState(false);

  // SAP'den dinamik servis tipleri (ProblemTypes) + admin icin teknisyenler
  const [tipler, setTipler] = useState(FALLBACK_TIPLER);
  const [teknisyenler, setTeknisyenler] = useState<SAPEmployee[]>([]);

  // Secilen musterinin ekipman/seri kartlari (kalem + seri secimi)
  const [ekipmanlar, setEkipmanlar] = useState<SAPCustomerEquipment[]>([]);
  const [ekipmanYukleniyor, setEkipmanYukleniyor] = useState(false);
  const [secilenEkipman, setSecilenEkipman] = useState('');

  const [form, setForm] = useState({
    musteriKodu: '',
    musteriAdi: '',
    problemTuru: '',
    oncelik: 'scp_Medium',
    konu: '',
    aciklama: '',
    teknisyenId: '',
  });

  // Musteri secimi sonrasi listenin yeniden acilmasini engellemek icin
  const musteriSecildiRef = useRef(false);
  // Konu kullanici tarafindan elle degistirildi mi (degistiyse tip degisince ezilmez)
  const konuManuelRef = useRef(false);

  // Musteri arama debounce
  useEffect(() => {
    // Secim yapildiysa (input adla doldu) tekrar arama/liste acma
    if (musteriSecildiRef.current) {
      musteriSecildiRef.current = false;
      return;
    }
    if (musteriArama.length < 2) {
      setMusteriler([]);
      setMusteriListeAcik(false);
      return;
    }
    const timer = setTimeout(async () => {
      setMusteriYukleniyor(true);
      try {
        const res = await fetch(
          `/api/sap/business-partners?search=${encodeURIComponent(musteriArama)}&top=10`,
        );
        if (res.ok) {
          const data = await res.json();
          setMusteriler(data.value || []);
          setMusteriListeAcik(true);
        }
      } catch {
        /* ignore */
      } finally {
        setMusteriYukleniyor(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [musteriArama]);

  // Servis tipleri ve (admin ise) teknisyen listesi
  useEffect(() => {
    async function fetchSetup() {
      try {
        const setupRes = await fetch('/api/sap/service-call-setup');
        if (setupRes.ok) {
          const setup = await setupRes.json();
          if (setup.problemTypes?.length > 0) setTipler(setup.problemTypes);
        }
      } catch {
        /* fallback listesi kullanilir */
      }
      // Teknisyen ataması yalnizca bolge/yonetim icin; teknisyen kendine atar
      if (!isTeknisyen) {
        try {
          const empRes = await fetch('/api/sap/employees?department=9&activeOnly=true');
          if (empRes.ok) {
            const data = await empRes.json();
            setTeknisyenler(data.value || []);
          }
        } catch {
          /* ignore */
        }
      }
    }
    fetchSetup();
  }, [isTeknisyen]);

  // Musteri secilince ekipman/seri kartlarini yukle
  useEffect(() => {
    if (!form.musteriKodu) {
      setEkipmanlar([]);
      setSecilenEkipman('');
      return;
    }
    let iptal = false;
    setEkipmanYukleniyor(true);
    setSecilenEkipman('');
    fetch(`/api/sap/customer-equipment?customer=${encodeURIComponent(form.musteriKodu)}`)
      .then((r) => (r.ok ? r.json() : { value: [] }))
      .then((d) => {
        if (!iptal) setEkipmanlar(d.value || []);
      })
      .catch(() => {
        if (!iptal) setEkipmanlar([]);
      })
      .finally(() => {
        if (!iptal) setEkipmanYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [form.musteriKodu]);

  const handleMusteriSec = (bp: SAPBusinessPartner) => {
    musteriSecildiRef.current = true; // sonraki effect aramayi/listeyi atlasin
    setForm((prev) => ({ ...prev, musteriKodu: bp.CardCode, musteriAdi: bp.CardName }));
    setMusteriArama(bp.CardName);
    setMusteriler([]);
    setMusteriListeAcik(false);
  };

  const handleTipSec = (tip: { ProblemTypeID: number; Name: string }) => {
    setForm((prev) => ({
      ...prev,
      problemTuru: String(tip.ProblemTypeID),
      // Konu elle degistirilmediyse servis tipiyle (yeniden) doldur
      konu: konuManuelRef.current ? prev.konu : tip.Name,
    }));
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.musteriKodu) return showToast('error', 'Müşteri seçimi zorunlu');
    if (!form.problemTuru) return showToast('error', 'Servis tipi seçin');
    if (!form.konu.trim()) return showToast('error', 'Konu zorunlu');

    setLoading(true);
    try {
      // Teknisyen kendi cagrisini acarsa kendine atanir; admin secebilir.
      const technicianCode = isTeknisyen
        ? user?.id
        : form.teknisyenId
          ? parseInt(form.teknisyenId)
          : undefined;

      // Cagriyi acan/atanan teknisyen SCL6 (ServiceCallSchedulings) cizelgesine
      // de yazilir; boylece cizelgeleme/takvim ekraninda gorunur.
      const bugun = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const scheduling = technicianCode
        ? [{ Technician: technicianCode, StartDate: bugun, DisplayInCalendar: 'tYES' }]
        : undefined;

      // Secilen ekipman karti -> kalem + seri numaralari
      const ekipman = ekipmanlar.find((e) => String(e.EquipmentCardNum) === secilenEkipman);

      const sapPayload = {
        CustomerCode: form.musteriKodu,
        Subject: form.konu.trim(),
        ProblemType: parseInt(form.problemTuru),
        Priority: form.oncelik,
        Status: -3, // Acik
        TechnicianCode: technicianCode,
        ServiceCallSchedulings: scheduling,
        Description: form.aciklama || undefined,
        ItemCode: ekipman?.ItemCode || undefined,
        InternalSerialNum: ekipman?.InternalSerialNum || undefined,
        ManufacturerSerialNum: ekipman?.ManufacturerSerialNum || undefined,
      };

      const res = await fetch('/api/sap/service-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sapPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Oluşturma başarısız' }));
        throw new Error(err.message);
      }

      const result = await res.json();
      showToast('success', `Servis #${result.DocNum} oluşturuldu`);
      router.push(isTeknisyen ? '/teknisyen' : '/servis');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Link href={isTeknisyen ? '/teknisyen' : '/servis'} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Yeni Hizmet Çağrısı</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* MUSTERI */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Müşteri adı ile arayın..."
              value={musteriArama}
              onChange={(e) => {
                setMusteriArama(e.target.value);
                if (form.musteriKodu) setForm((prev) => ({ ...prev, musteriKodu: '', musteriAdi: '' }));
              }}
              onFocus={() => musteriler.length > 0 && setMusteriListeAcik(true)}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
            />
            {musteriYukleniyor && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
            )}
            {form.musteriKodu && !musteriYukleniyor && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-800" />
            )}
            {musteriListeAcik && musteriler.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {musteriler.map((bp) => (
                  <button
                    key={bp.CardCode}
                    type="button"
                    onClick={() => handleMusteriSec(bp)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{bp.CardName}</p>
                    <p className="text-xs text-gray-500">
                      {bp.CardCode}
                      {bp.City ? ` · ${bp.City}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.musteriKodu && (
            <p className="text-xs text-blue-800 mt-1.5">Seçildi: {form.musteriAdi}</p>
          )}
        </Card>

        {/* SERVIS TIPI (ProblemType) - buyuk dokunmatik butonlar */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-2">Servis Tipi *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tipler.map((tip) => {
              const Ikon = TIP_IKON[tip.ProblemTypeID] ?? Wrench;
              const secili = form.problemTuru === String(tip.ProblemTypeID);
              return (
                <button
                  key={tip.ProblemTypeID}
                  type="button"
                  onClick={() => handleTipSec(tip)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 min-h-[80px] transition-colors ${
                    secili
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Ikon className="w-6 h-6" />
                  <span className="text-xs font-medium text-center leading-tight">{tip.Name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ONCELIK - segment */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-2">Öncelik</label>
          <div className="grid grid-cols-3 gap-2">
            {ONCELIKLER.map((o) => {
              const secili = form.oncelik === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => updateForm('oncelik', o.value)}
                  className={`rounded-lg border-2 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                    secili
                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* KONU + ACIKLAMA */}
        <Card className="space-y-4">
          <Input
            label="Konu *"
            placeholder="Kısa başlık"
            value={form.konu}
            onChange={(e) => {
              konuManuelRef.current = true;
              updateForm('konu', e.target.value);
            }}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 min-h-[100px]"
              placeholder="Arıza / iş detayını yazın (opsiyonel)"
              value={form.aciklama}
              onChange={(e) => updateForm('aciklama', e.target.value)}
            />
          </div>
        </Card>

        {/* TEKNISYEN ATAMASI */}
        <Card>
          {isTeknisyen ? (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-blue-800 flex-shrink-0" />
              <span className="text-gray-600">
                Bu çağrı size atanacak: <span className="font-medium text-gray-900">{user?.fullName}</span>
              </span>
            </div>
          ) : (
            <Select
              label="Teknisyen Ataması"
              options={teknisyenler.map((emp) => ({
                value: String(emp.EmployeeID),
                label: `${emp.FirstName} ${emp.LastName}`,
              }))}
              placeholder="Teknisyen seçin (opsiyonel)"
              value={form.teknisyenId}
              onChange={(e) => updateForm('teknisyenId', e.target.value)}
            />
          )}
        </Card>

        {/* KALEM / SERI - musterinin ekipman kartlarindan secim */}
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kalem / Seri No <span className="text-gray-400 font-normal">(opsiyonel)</span>
          </label>
          {!form.musteriKodu ? (
            <p className="text-sm text-gray-400">Önce müşteri seçin</p>
          ) : ekipmanYukleniyor ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              Ekipman yükleniyor...
            </div>
          ) : ekipmanlar.length === 0 ? (
            <p className="text-sm text-gray-400">Bu müşteriye tanımlı ekipman yok</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {ekipmanlar.map((eq) => {
                const secili = secilenEkipman === String(eq.EquipmentCardNum);
                return (
                  <button
                    key={eq.EquipmentCardNum}
                    type="button"
                    onClick={() => setSecilenEkipman(secili ? '' : String(eq.EquipmentCardNum))}
                    className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                      secili ? 'border-blue-700 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{eq.ItemDescription}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {eq.ItemCode}
                          {eq.InternalSerialNum ? ` · Seri: ${eq.InternalSerialNum}` : ''}
                        </p>
                      </div>
                      {secili && <Check className="w-5 h-5 text-blue-800 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="flex gap-3">
          <Link href={isTeknisyen ? '/teknisyen' : '/servis'} className="flex-1">
            <Button variant="secondary" type="button" fullWidth>
              İptal
            </Button>
          </Link>
          <Button type="submit" loading={loading} fullWidth className="flex-1">
            Çağrıyı Oluştur
          </Button>
        </div>
      </form>
    </div>
  );
}
