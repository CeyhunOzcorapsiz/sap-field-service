'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SAPServiceCall, SAPEmployee } from '@/types/sap';
import { formatSAPDate } from '@/lib/utils/sap-helpers';

/**
 * Müşteri Servis Formu - "Müşteri Servis Formu_13062026.pdf" şablonunun
 * dijital karşılığı. Tarayıcıdan Yazdır -> PDF olarak kaydet ile çıktı alınır.
 */

const PROBLEM_LABELS: Record<number, string> = {
  1: 'ARIZA',
  2: 'BAKIM',
  3: 'MONTAJ',
  4: 'GARANTİ',
  5: 'DEVREYE ALMA',
};

function parseKapanis(resolution: string, alan: string): string {
  const m = resolution?.match(new RegExp(`${alan}:\\s*(.+)`));
  return m ? m[1].trim() : '';
}
function saat(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

interface ParcaSatir {
  ItemCode: string;
  ItemDescription: string;
  Quantity: number;
}
interface CalismaSaat {
  technicianId: number;
  baslangic: string | null;
  bitis: string | null;
}

export default function ServisFormuPage() {
  const params = useParams();
  const id = params.id as string;

  const [servis, setServis] = useState<SAPServiceCall | null>(null);
  const [employees, setEmployees] = useState<SAPEmployee[]>([]);
  const [musteri, setMusteri] = useState<{ Address?: string; City?: string } | null>(null);
  const [parcalar, setParcalar] = useState<ParcaSatir[]>([]);
  const [calisma, setCalisma] = useState<CalismaSaat[]>([]);
  const [imzalar, setImzalar] = useState<{ tech: string | null; customer: string | null }>({ tech: null, customer: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, eRes, belRes, calRes, imzaRes] = await Promise.all([
        fetch(`/api/sap/service-calls/${id}`),
        fetch('/api/sap/employees'),
        fetch(`/api/sap/service-calls/${id}/belgeler`),
        fetch(`/api/sap/service-calls/${id}/calisma`),
        fetch(`/api/sap/service-calls/${id}/imzalar`),
      ]);
      if (!sRes.ok) throw new Error('Servis yüklenemedi');
      const s = await sRes.json();
      setServis(s);
      if (eRes.ok) setEmployees((await eRes.json()).value || []);
      if (belRes.ok) {
        const bel = await belRes.json();
        const satirlar: ParcaSatir[] = [];
        for (const gi of bel.goodsIssues || []) {
          if (gi.Cancelled === 'tYES') continue;
          for (const l of gi.DocumentLines || []) {
            satirlar.push({
              ItemCode: l.ItemCode,
              ItemDescription: l.ItemDescription,
              Quantity: l.Quantity,
            });
          }
        }
        setParcalar(satirlar);
      }
      if (calRes.ok) setCalisma((await calRes.json()).value || []);
      if (imzaRes.ok) setImzalar(await imzaRes.json());
      if (s.CustomerCode) {
        const bpRes = await fetch(
          `/api/sap/business-partners?search=${encodeURIComponent(s.CustomerCode)}&top=1`,
        );
        if (bpRes.ok) {
          const bp = ((await bpRes.json()).value || [])[0];
          if (bp) setMusteri(bp);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Form hazırlanıyor...
      </div>
    );
  }
  if (error || !servis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-red-600">{error || 'Servis bulunamadı'}</p>
        <Link href={`/servis/${id}`} className="text-blue-800 hover:underline text-sm">
          Servise dön
        </Link>
      </div>
    );
  }

  const teknisyenAdi = (() => {
    const emp = employees.find((e) => e.EmployeeID === servis.TechnicianCode);
    return emp ? `${emp.FirstName} ${emp.LastName}` : '';
  })();

  // Servis yetkilisinin gerçek başla/bitiş saatleri (U_BASLANGIC/U_BITIS)
  const teknSaat =
    calisma.find((c) => c.technicianId === servis.TechnicianCode) ?? calisma[0] ?? null;

  const sonuc = parseKapanis(servis.Resolution, 'Servis Sonucu') || parseKapanis(servis.Resolution, 'Sonuç');
  const islemMetni = (servis.Resolution || '').split('--- Servis Kapanış ---')[0].trim() || servis.Description || '';
  const parcaSatirSayisi = Math.max(6, parcalar.length);
  const adres = [musteri?.Address, musteri?.City].filter(Boolean).join(', ');

  return (
    <div className="max-w-[210mm] mx-auto bg-white">
      {/* Ekran ust cubugu - yazdirmada gizlenir */}
      <div className="print:hidden flex items-center justify-between px-4 py-3 border-b bg-gray-50 sticky top-0 z-10">
        <Link href={`/servis/${id}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Servise Dön
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <Printer className="w-4 h-4" />
          Yazdır / PDF Kaydet
        </button>
      </div>

      {/* FORM */}
      <div className="p-5 print:p-3 text-[11px] leading-snug text-gray-900">
        <div className="border border-gray-800">
          {/* Baslik: logo | baslik | No */}
          <div className="flex items-stretch border-b border-gray-800">
            <div className="w-1/3 p-3 flex items-center border-r border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Field Service Co." className="h-12 w-auto object-contain" />
            </div>
            <div className="flex-1 flex items-center justify-center border-r border-gray-800">
              <p className="text-base font-bold">MÜŞTERİ SERVİS FORMU</p>
            </div>
            <div className="w-1/4 p-3 flex items-center justify-center">
              <p className="text-lg font-bold">No: {servis.DocNum}</p>
            </div>
          </div>

          {/* Firma bilgileri — kendi şirket bilgilerinizle değiştirin */}
          <div className="border-b border-gray-800 px-3 py-1.5 text-[8px] text-gray-700 leading-tight">
            <p className="font-bold text-[9px] text-gray-900">
              FIELD SERVICE CO. — Şirket Unvanınız
            </p>
            <p>Adres bilgilerinizi buraya ekleyin</p>
          </div>

          {/* Musteri + ekipman */}
          <div className="grid grid-cols-2 border-b border-gray-800">
            <div className="p-2 border-r border-gray-800 space-y-1">
              <div className="flex"><span className="w-32 font-bold">İsim/Şirket Kodu</span><span>: {servis.CustomerCode}</span></div>
              <div className="flex"><span className="w-32 font-bold">İsim/Şirket Adı</span><span className="flex-1">: {servis.CustomerName}</span></div>
              <div className="flex"><span className="w-32 font-bold">Adres</span><span className="flex-1">: {adres}</span></div>
              <div className="flex"><span className="w-32 font-bold">Servis Talebi Nedeni</span><span>: {PROBLEM_LABELS[Number(servis.ProblemType)] || ''}</span></div>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex"><span className="w-24 font-bold">Ekipman Kod</span><span>: {servis.ItemCode || ''}</span></div>
              <div className="flex"><span className="w-24 font-bold">Ekipman Adı</span><span className="flex-1">: {servis.ItemDescription || ''}</span></div>
              <div className="flex"><span className="w-24 font-bold">Seri No</span><span>: {servis.InternalSerialNum || ''}</span></div>
            </div>
          </div>

          {/* Yapilan Islem */}
          <div className="border-b border-gray-800 p-2 min-h-[70px]">
            <p className="font-bold mb-1">Yapılan İşlem:</p>
            <p className="whitespace-pre-wrap">{islemMetni}</p>
          </div>

          {/* Degisen parcalar */}
          <div className="border-b border-gray-800">
            <p className="text-center font-bold bg-blue-800 text-white py-1">Servis Kapsamında Değişen Parçalar</p>
            <table className="w-full">
              <thead>
                <tr className="bg-blue-50 border-b border-gray-400 text-left">
                  <th className="border-r border-gray-300 px-2 py-1 w-32">Parça Kodu</th>
                  <th className="border-r border-gray-300 px-2 py-1">Açıklama</th>
                  <th className="px-2 py-1 w-16 text-right">Miktar</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: parcaSatirSayisi }, (_, i) => {
                  const p = parcalar[i];
                  return (
                    <tr key={i} className="border-b border-gray-200 h-5">
                      <td className="border-r border-gray-300 px-2">{p?.ItemCode || ''}</td>
                      <td className="border-r border-gray-300 px-2">{p?.ItemDescription || ''}</td>
                      <td className="px-2 text-right">{p?.Quantity ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sonuc + Servis Sonucu */}
          <div className="grid grid-cols-2 border-b border-gray-800">
            <div className="p-2 border-r border-gray-800"><span className="font-bold">Sonuç:</span> {sonuc && !['Çalışır Durumda','Müdahale Gerekli','Acil Müdahale Gerekli'].includes(sonuc) ? sonuc : ''}</div>
            <div className="p-2 flex items-center gap-2"><span className="font-bold">Servis Sonucu :</span> <span>{sonuc}</span></div>
          </div>

          {/* Tarih / saat */}
          <div className="grid grid-cols-2 border-b border-gray-800">
            <div className="p-2 border-r border-gray-800 space-y-1">
              <div className="flex"><span className="w-40 font-bold">Servis Başlangıç Tarihi :</span><span>{formatSAPDate(servis.CreateDate)}</span></div>
              <div className="flex"><span className="w-40 font-bold">Servis Başlangıç Saat :</span><span>{saat(teknSaat?.baslangic)}</span></div>
              <div className="flex"><span className="w-40 font-bold">Konum :</span><span></span></div>
            </div>
            <div className="p-2 space-y-1">
              <div className="flex"><span className="w-36 font-bold">Servis Bitiş Tarihi :</span><span>{formatSAPDate(servis.CreateDate)}</span></div>
              <div className="flex"><span className="w-36 font-bold">Servis Bitiş Saati :</span><span>{saat(teknSaat?.bitis)}</span></div>
            </div>
          </div>

          {/* Imza alani */}
          <div className="grid grid-cols-2 border-b border-gray-800">
            <div className="p-3 border-r border-gray-800">
              <p><span className="font-bold">Servis Yetkilisi :</span> {teknisyenAdi}</p>
              <p className="mt-1 text-gray-400">İmza:</p>
              <div className="mt-1 h-16 flex items-center">
                {imzalar.tech ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imzalar.tech} alt="Teknisyen imzası" className="h-16 object-contain" />
                ) : null}
              </div>
            </div>
            <div className="p-3">
              <p><span className="font-bold">Müşteri Yetkilisi :</span></p>
              <p className="mt-1 text-gray-400">İmza:</p>
              <div className="mt-1 h-16 flex items-center">
                {imzalar.customer ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imzalar.customer} alt="Müşteri imzası" className="h-16 object-contain" />
                ) : null}
              </div>
            </div>
          </div>

          {/* Hukuki metin — kendi sözleşme metninizle değiştirin */}
          <div className="px-3 py-2 text-[8px] text-gray-600 leading-tight">
            Servis sözleşme metninizi buraya ekleyin.
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
