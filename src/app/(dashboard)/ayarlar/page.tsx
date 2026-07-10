'use client';

import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { UserRole } from '@/types/auth';
import { LogOut, User, Bell, KeyRound, Search } from 'lucide-react';

interface Teknisyen {
  EmployeeID: number;
  FirstName: string | null;
  LastName: string | null;
  MobilePhone: string | null;
}

export default function AyarlarPage() {
  const { user, logout } = useAuth();
  const isAdmin =
    user?.role === UserRole.YONETIM || user?.role === UserRole.BOLGE_SORUMLUSU;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Ayarlar</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profil Bilgileri
            </div>
          </CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Ad Soyad</span>
            <span className="font-medium text-gray-900">{user?.fullName || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Kullanıcı Adı</span>
            <span className="font-medium text-gray-900">{user?.userName || '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Rol</span>
            <span className="font-medium text-gray-900">{user ? ROLE_LABELS[user.role] : '-'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Bölge</span>
            <span className="font-medium text-gray-900">{user?.region || '-'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">E-posta</span>
            <span className="font-medium text-gray-900">{user?.email || '-'}</span>
          </div>
        </div>
      </Card>

      {isAdmin && <TeknisyenPinYonetimi />}

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Bildirim Tercihleri
            </div>
          </CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between py-2">
            <span className="text-gray-700">Yeni servis ataması</span>
            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-800 focus:ring-blue-700" />
          </label>
          <label className="flex items-center justify-between py-2">
            <span className="text-gray-700">Onay talepleri</span>
            <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-800 focus:ring-blue-700" />
          </label>
          <label className="flex items-center justify-between py-2">
            <span className="text-gray-700">E-posta bildirimleri</span>
            <input type="checkbox" className="rounded border-gray-300 text-blue-800 focus:ring-blue-700" />
          </label>
        </div>
      </Card>

      <Card>
        <Button variant="danger" fullWidth onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Çıkış Yap
        </Button>
      </Card>
    </div>
  );
}

/**
 * Admin PIN sifirlama paneli. Teknik Servis (departman 9) calisanlarini
 * listeler; PIN'ini unutan teknisyenin kaydi sifirlanir, sonraki giriste
 * yeni PIN belirler.
 */
function TeknisyenPinYonetimi() {
  const [teknisyenler, setTeknisyenler] = useState<Teknisyen[]>([]);
  const [loading, setLoading] = useState(true);
  const [arama, setArama] = useState('');
  const [islemId, setIslemId] = useState<number | null>(null);
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'err'; metin: string } | null>(null);

  useEffect(() => {
    async function fetchTeknisyenler() {
      try {
        const res = await fetch('/api/sap/employees?department=9&activeOnly=true');
        if (res.ok) {
          const data = await res.json();
          setTeknisyenler(data.value || []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    fetchTeknisyenler();
  }, []);

  const sifirla = useCallback(async (t: Teknisyen) => {
    const ad = [t.FirstName, t.LastName].filter(Boolean).join(' ');
    if (!window.confirm(`${ad} adlı teknisyenin PIN'i sıfırlansın mı?`)) return;
    setIslemId(t.EmployeeID);
    setMesaj(null);
    try {
      const res = await fetch('/api/auth/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: t.EmployeeID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sıfırlanamadı');
      setMesaj({ tip: 'ok', metin: `${ad}: ${data.message}` });
    } catch (err) {
      setMesaj({ tip: 'err', metin: err instanceof Error ? err.message : 'Hata' });
    } finally {
      setIslemId(null);
    }
  }, []);

  const filtrelenmis = teknisyenler.filter((t) => {
    const ad = `${t.FirstName ?? ''} ${t.LastName ?? ''}`.toLowerCase();
    return ad.includes(arama.toLowerCase());
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Teknisyen PIN Yönetimi
          </div>
        </CardTitle>
      </CardHeader>

      <p className="text-sm text-gray-500 mb-3">
        PIN’ini unutan teknisyeni sıfırlayın; sonraki girişte yeni PIN belirler.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Teknisyen ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="pl-9"
        />
      </div>

      {mesaj && (
        <div
          className={`p-3 rounded-lg mb-3 text-sm ${
            mesaj.tip === 'ok'
              ? 'bg-blue-50 border border-blue-200 text-blue-900'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {mesaj.metin}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 py-4 text-center">Yükleniyor...</p>
      ) : filtrelenmis.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">Teknisyen bulunamadı</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtrelenmis.map((t) => (
            <div key={t.EmployeeID} className="flex items-center justify-between py-2.5 gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {[t.FirstName, t.LastName].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-gray-400">#{t.EmployeeID}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={islemId === t.EmployeeID}
                onClick={() => sifirla(t)}
              >
                PIN Sıfırla
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
