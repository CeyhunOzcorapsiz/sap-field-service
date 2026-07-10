'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, RefreshCw, ClipboardCheck, Shield, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { SAPServiceCall } from '@/types/sap';
import { sapCallTypeToLabel, sapPriorityToLabel, sapPriorityToBadge, formatSAPDate } from '@/lib/utils/sap-helpers';

interface KrediNotu {
  DocEntry: number;
  DocNum: number;
  CardName: string;
  DocDate: string;
  DocTotal: number;
}

export default function SiparisPage() {
  const { showToast } = useToast();
  const [bekleyenler, setBekleyenler] = useState<SAPServiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [islemYukleniyor, setIslemYukleniyor] = useState<string | null>(null);

  // Garanti onay modali
  const [garantiModal, setGarantiModal] = useState<SAPServiceCall | null>(null);

  const fetchBekleyenler = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sap/siparis-onay');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Yüklenemedi' }));
        throw new Error(err.message);
      }
      const data = await res.json();
      setBekleyenler(data.value || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBekleyenler();
  }, [fetchBekleyenler]);

  const handleAksiyon = async (servis: SAPServiceCall, aksiyon: 'onayla' | 'reddet', krediNotuNo?: number) => {
    setIslemYukleniyor(`${servis.ServiceCallID}-${aksiyon}`);
    try {
      const res = await fetch(`/api/sap/siparis-onay/${servis.ServiceCallID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksiyon, krediNotuNo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'İşlem başarısız' }));
        throw new Error(err.message);
      }
      showToast('success', aksiyon === 'onayla' ? 'Servis onaylandı' : 'Servis reddedildi');
      setGarantiModal(null);
      setBekleyenler((prev) => prev.filter((s) => s.ServiceCallID !== servis.ServiceCallID));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setIslemYukleniyor(null);
    }
  };

  // Garanti (CallType=4) ise kredi notu eslestirme modali ac, degilse direkt onayla
  const onayaTikla = (servis: SAPServiceCall) => {
    if (servis.CallType === 4) {
      setGarantiModal(servis);
    } else {
      handleAksiyon(servis, 'onayla');
    }
  };

  if (loading) return <FullPageLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sipariş Onay</h1>
          <p className="text-sm text-gray-500 mt-1">{bekleyenler.length} onay bekleyen servis</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchBekleyenler}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {bekleyenler.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Onay bekleyen servis yok</p>
            <p className="text-sm mt-1">Beklemedeki servisler burada görünür</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {bekleyenler.map((servis) => {
            const garanti = servis.CallType === 4;
            return (
              <Card key={servis.ServiceCallID}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/servis/${servis.ServiceCallID}`} className="text-base font-bold text-blue-900 hover:underline">
                        S-{servis.ServiceCallID}
                      </Link>
                      <Badge variant="warning">Onay Bekliyor</Badge>
                      <Badge variant={garanti ? 'info' : 'default'}>
                        {garanti && <Shield className="w-3 h-3 mr-1 inline" />}
                        {sapCallTypeToLabel(servis.CallType)}
                      </Badge>
                      <Badge variant={sapPriorityToBadge(servis.Priority)}>
                        {sapPriorityToLabel(servis.Priority)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 font-medium">{servis.CustomerName}</p>
                  </div>
                  <p className="text-xs text-gray-400 ml-3 flex-shrink-0">{formatSAPDate(servis.CreateDate)}</p>
                </div>

                <p className="text-sm text-gray-600 mb-3">{servis.Subject}</p>
                {servis.Description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{servis.Description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {garanti ? 'Garanti — kredi notu eşleştirme gerekli' : 'Standart onay'}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleAksiyon(servis, 'reddet')}
                      loading={islemYukleniyor === `${servis.ServiceCallID}-reddet`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reddet
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onayaTikla(servis)}
                      loading={islemYukleniyor === `${servis.ServiceCallID}-onayla`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Onayla
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Garanti kredi notu eslestirme modali */}
      {garantiModal && (
        <GarantiOnayModal
          servis={garantiModal}
          yukleniyor={islemYukleniyor === `${garantiModal.ServiceCallID}-onayla`}
          onClose={() => setGarantiModal(null)}
          onOnayla={(krediNotuNo) => handleAksiyon(garantiModal, 'onayla', krediNotuNo)}
        />
      )}
    </div>
  );
}

function GarantiOnayModal({
  servis,
  yukleniyor,
  onClose,
  onOnayla,
}: {
  servis: SAPServiceCall;
  yukleniyor: boolean;
  onClose: () => void;
  onOnayla: (krediNotuNo?: number) => void;
}) {
  const [arama, setArama] = useState('');
  const [krediNotlari, setKrediNotlari] = useState<KrediNotu[]>([]);
  const [secilen, setSecilen] = useState<KrediNotu | null>(null);
  const [araniyor, setAraniyor] = useState(false);

  useEffect(() => {
    if (arama.length < 2) {
      setKrediNotlari([]);
      return;
    }
    const timer = setTimeout(async () => {
      setAraniyor(true);
      try {
        const res = await fetch(`/api/sap/credit-notes?search=${encodeURIComponent(arama)}`);
        if (res.ok) {
          const data = await res.json();
          setKrediNotlari(data.value || []);
        }
      } catch {
        /* ignore */
      } finally {
        setAraniyor(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [arama]);

  return (
    <Modal open onClose={onClose} title="Garanti Onayı — Kredi Notu Eşleştirme" size="md">
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
          <p className="font-medium text-blue-900">S-{servis.ServiceCallID} — {servis.CustomerName}</p>
          <p className="text-blue-600 text-xs mt-0.5">{servis.Subject}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tedarikçi Kredi Notu (opsiyonel)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Belge no veya tedarikçi adı..."
              value={arama}
              onChange={(e) => {
                setArama(e.target.value);
                setSecilen(null);
              }}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
            />
          </div>
          {araniyor && <p className="text-xs text-gray-400 mt-1">Aranıyor...</p>}
        </div>

        {krediNotlari.length > 0 && !secilen && (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {krediNotlari.map((kn) => (
              <button
                key={kn.DocEntry}
                onClick={() => setSecilen(kn)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-blue-50 border border-gray-100"
              >
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Kredi Notu #{kn.DocNum}</span>
                  <span className="text-gray-600">₺{kn.DocTotal?.toLocaleString('tr-TR')}</span>
                </div>
                <p className="text-xs text-gray-500">{kn.CardName} • {formatSAPDate(kn.DocDate)}</p>
              </button>
            ))}
          </div>
        )}

        {secilen && (
          <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-950">Kredi Notu #{secilen.DocNum}</p>
              <p className="text-xs text-blue-800">{secilen.CardName}</p>
            </div>
            <button onClick={() => setSecilen(null)} className="text-xs text-gray-500 hover:text-gray-700">
              Değiştir
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="secondary" onClick={onClose}>İptal</Button>
          <Button onClick={() => onOnayla(secilen?.DocNum)} loading={yukleniyor}>
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {secilen ? 'Eşleştir ve Onayla' : 'Eşleştirmeden Onayla'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
