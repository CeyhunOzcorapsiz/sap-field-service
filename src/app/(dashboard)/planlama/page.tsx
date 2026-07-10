'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, AlertTriangle,
  CalendarDays, Eye, EyeOff, Search,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { FullPageLoading } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { SAPActivity, SAPEmployee, SAPBusinessPartner } from '@/types/sap';
import { GUN_KISA, haftaninPazartesisi, tarihEkle } from '@/lib/utils/timesheet';

// Is turu kodlari - Gerceklesen Haftalik Program Excel'indeki lejant
const IS_TURLERI: Record<string, { label: string; renk: string }> = {
  PR: { label: 'Periyodik Bakım', renk: 'bg-blue-100 text-blue-700' },
  SU: { label: 'Devreye Alma', renk: 'bg-purple-100 text-purple-700' },
  CJ: { label: 'Garanti', renk: 'bg-indigo-100 text-indigo-700' },
  WS: { label: 'Arıza', renk: 'bg-red-100 text-red-700' },
  CV: { label: 'Müşteri Ziyareti', renk: 'bg-teal-100 text-teal-700' },
  ST: { label: 'Eğitim', renk: 'bg-cyan-100 text-cyan-700' },
  NOBET: { label: 'Nöbetçi', renk: 'bg-amber-100 text-amber-700' },
  IZIN: { label: 'İzin', renk: 'bg-gray-200 text-gray-600' },
  OFIS: { label: 'Ofis', renk: 'bg-gray-100 text-gray-600' },
};

interface PlanVerisi {
  haftaBaslangic: string;
  planlar: SAPActivity[];
  gerceklesen: SAPActivity[];
  bpAdlari: Record<string, string>;
}

function formatTarihKisa(t: string): string {
  return `${t.slice(8, 10)}.${t.slice(5, 7)}`;
}

export default function PlanlamaPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [hafta, setHafta] = useState(() => haftaninPazartesisi(new Date()));
  const [veri, setVeri] = useState<PlanVerisi | null>(null);
  const [employees, setEmployees] = useState<SAPEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gerceklesenGoster, setGerceklesenGoster] = useState(false);

  // Plan ekleme modali
  const [planModal, setPlanModal] = useState<{ tarih: string; employeeId: number } | null>(null);

  const planlamaYetkisi =
    user?.role === UserRole.BOLGE_SORUMLUSU || user?.role === UserRole.YONETIM;

  const fetchVeri = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, empRes] = await Promise.all([
        fetch(`/api/plan?start=${hafta}`),
        fetch('/api/sap/employees'),
      ]);
      if (!planRes.ok) {
        const err = await planRes.json().catch(() => ({ message: 'Plan yüklenemedi' }));
        throw new Error(err.message);
      }
      setVeri(await planRes.json());
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.value || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan yüklenemedi');
      setVeri(null);
    } finally {
      setLoading(false);
    }
  }, [hafta]);

  useEffect(() => {
    fetchVeri();
  }, [fetchVeri]);

  // Plan haritasi: "employeeId:gunIdx" -> planlar
  const planMap = useMemo(() => {
    const map = new Map<string, SAPActivity[]>();
    if (!veri) return map;
    for (const plan of veri.planlar) {
      const tarih = (plan.ActivityDate || plan.StartDate || '').split('T')[0];
      const gunIdx = Math.round(
        (new Date(`${tarih}T00:00:00`).getTime() - new Date(`${hafta}T00:00:00`).getTime()) / 86400000,
      );
      if (gunIdx < 0 || gunIdx > 6) continue;
      const key = `${plan.HandledByEmployee}:${gunIdx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(plan);
    }
    return map;
  }, [veri, hafta]);

  // Gerceklesen haritasi
  const gerceklesenMap = useMemo(() => {
    const map = new Map<string, SAPActivity[]>();
    if (!veri) return map;
    for (const act of veri.gerceklesen) {
      const tarih = (act.StartDate || '').split('T')[0];
      const gunIdx = Math.round(
        (new Date(`${tarih}T00:00:00`).getTime() - new Date(`${hafta}T00:00:00`).getTime()) / 86400000,
      );
      if (gunIdx < 0 || gunIdx > 6) continue;
      const key = `${act.HandledByEmployee}:${gunIdx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(act);
    }
    return map;
  }, [veri, hafta]);

  const handlePlanSil = async (activityCode: number) => {
    try {
      const res = await fetch(`/api/plan/${activityCode}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Silinemedi' }));
        throw new Error(err.message);
      }
      showToast('success', 'Plan silindi');
      fetchVeri();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  if (loading && !veri) return <FullPageLoading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Haftalık Plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {planlamaYetkisi ? 'Hücreye tıklayarak görev atayın' : 'Haftalık görev planınız'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setGerceklesenGoster(!gerceklesenGoster)}
        >
          {gerceklesenGoster ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
          {gerceklesenGoster ? 'Gerçekleşeni Gizle' : 'Gerçekleşeni Göster'}
        </Button>
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

      {error ? (
        <Card>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchVeri}>
              Tekrar Dene
            </Button>
          </div>
        </Card>
      ) : employees.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Teknisyen listesi yüklenemedi</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Plan grid */}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 min-w-[130px] sticky left-0 bg-gray-50">
                      Teknisyen
                    </th>
                    {GUN_KISA.map((g, i) => (
                      <th key={g} className="text-center px-2 py-2.5 font-medium text-gray-500 min-w-[110px]">
                        {g}
                        <span className="block text-[10px] text-gray-400 font-normal">
                          {formatTarihKisa(tarihEkle(hafta, i))}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.EmployeeID} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                        {emp.FirstName} {emp.LastName}
                      </td>
                      {Array.from({ length: 7 }, (_, gunIdx) => {
                        const planlar = planMap.get(`${emp.EmployeeID}:${gunIdx}`) || [];
                        const gercekler = gerceklesenGoster
                          ? gerceklesenMap.get(`${emp.EmployeeID}:${gunIdx}`) || []
                          : [];
                        return (
                          <td
                            key={gunIdx}
                            className={`px-1.5 py-1.5 align-top ${planlamaYetkisi ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                            onClick={() =>
                              planlamaYetkisi &&
                              setPlanModal({ tarih: tarihEkle(hafta, gunIdx), employeeId: emp.EmployeeID })
                            }
                          >
                            <div className="space-y-1 min-h-[28px]">
                              {planlar.map((plan) => {
                                const tur = IS_TURLERI[plan.Details] || {
                                  label: plan.Details,
                                  renk: 'bg-gray-100 text-gray-600',
                                };
                                const musteri = plan.CardCode
                                  ? veri?.bpAdlari[plan.CardCode] || plan.CardCode
                                  : '';
                                return (
                                  <div
                                    key={plan.ActivityCode}
                                    className={`group relative rounded px-1.5 py-1 ${tur.renk}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="font-semibold text-[10px] leading-tight">{tur.label}</p>
                                    {musteri && <p className="text-[10px] leading-tight truncate">{musteri}</p>}
                                    {planlamaYetkisi && (
                                      <button
                                        onClick={() => handlePlanSil(plan.ActivityCode)}
                                        className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Gerceklesen kiyas: yesil cizgili chip */}
                              {gercekler.map((act) => {
                                const musteri = act.CardCode
                                  ? veri?.bpAdlari[act.CardCode] || act.CardCode
                                  : 'Saha';
                                return (
                                  <div
                                    key={`g-${act.ActivityCode}`}
                                    className="rounded px-1.5 py-1 bg-blue-50 border border-dashed border-blue-600"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="font-semibold text-[10px] text-blue-900 leading-tight">✓ Gerçekleşen</p>
                                    <p className="text-[10px] text-blue-800 leading-tight truncate">{musteri}</p>
                                  </div>
                                );
                              })}
                              {planlamaYetkisi && planlar.length === 0 && gercekler.length === 0 && (
                                <div className="flex items-center justify-center h-7 opacity-0 hover:opacity-100">
                                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Lejant */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(IS_TURLERI).map(([kod, tur]) => (
              <span key={kod} className={`text-xs px-2 py-1 rounded ${tur.renk}`}>
                {kod} — {tur.label}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Plan ekleme modali */}
      {planModal && (
        <PlanEkleModal
          tarih={planModal.tarih}
          employeeId={planModal.employeeId}
          employeeAdi={(() => {
            const e = employees.find((x) => x.EmployeeID === planModal.employeeId);
            return e ? `${e.FirstName} ${e.LastName}` : '';
          })()}
          onClose={() => setPlanModal(null)}
          onSuccess={() => {
            setPlanModal(null);
            fetchVeri();
            showToast('success', 'Plan eklendi');
          }}
        />
      )}
    </div>
  );
}

function PlanEkleModal({
  tarih,
  employeeId,
  employeeAdi,
  onClose,
  onSuccess,
}: {
  tarih: string;
  employeeId: number;
  employeeAdi: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [isTuru, setIsTuru] = useState('');
  const [musteriArama, setMusteriArama] = useState('');
  const [musteriler, setMusteriler] = useState<SAPBusinessPartner[]>([]);
  const [secilenMusteri, setSecilenMusteri] = useState<SAPBusinessPartner | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const ozelDurum = ['NOBET', 'IZIN', 'OFIS'].includes(isTuru);

  useEffect(() => {
    if (musteriArama.length < 2 || ozelDurum) {
      setMusteriler([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sap/business-partners?search=${encodeURIComponent(musteriArama)}&top=8`);
        if (res.ok) {
          const data = await res.json();
          setMusteriler(data.value || []);
        }
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [musteriArama, ozelDurum]);

  const handleKaydet = async () => {
    if (!isTuru) {
      showToast('error', 'İş türü seçin');
      return;
    }
    if (!ozelDurum && !secilenMusteri) {
      showToast('error', 'Müşteri seçin');
      return;
    }

    setYukleniyor(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarih,
          employeeId,
          isTuru,
          cardCode: secilenMusteri?.CardCode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Plan eklenemedi' }));
        throw new Error(err.message);
      }
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Plan eklenemedi');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Plan Ekle" size="md">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
          <p className="font-medium text-gray-900">{employeeAdi}</p>
          <p className="text-gray-500">{formatTarihKisa(tarih)} {tarih.slice(0, 4)}</p>
        </div>

        <Select
          label="İş Türü *"
          options={Object.entries(IS_TURLERI).map(([kod, tur]) => ({
            value: kod,
            label: `${kod} — ${tur.label}`,
          }))}
          placeholder="İş türü seçin"
          value={isTuru}
          onChange={(e) => {
            setIsTuru(e.target.value);
            if (['NOBET', 'IZIN', 'OFIS'].includes(e.target.value)) {
              setSecilenMusteri(null);
              setMusteriArama('');
            }
          }}
        />

        {!ozelDurum && isTuru && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Müşteri ara..."
                value={secilenMusteri ? secilenMusteri.CardName : musteriArama}
                onChange={(e) => {
                  setSecilenMusteri(null);
                  setMusteriArama(e.target.value);
                }}
                className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
              />
            </div>
            {!secilenMusteri && musteriler.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {musteriler.map((bp) => (
                  <button
                    key={bp.CardCode}
                    type="button"
                    onClick={() => setSecilenMusteri(bp)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{bp.CardName}</p>
                    <p className="text-xs text-gray-500">{bp.CardCode}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={handleKaydet} loading={yukleniyor}>
            <Plus className="w-4 h-4 mr-1.5" />
            Plan Ekle
          </Button>
        </div>
      </div>
    </Modal>
  );
}
