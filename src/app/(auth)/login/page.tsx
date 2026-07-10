'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Adim = 'telefon' | 'pin' | 'pin-olustur';

// Giris ekrani (auth) grubunda; AuthProvider yalnizca (dashboard)'i sardigi
// icin burada useAuth kullanilmaz, dogrudan API'ye istek atilir.
async function girisYap(body: { phone: string; pin?: string; newPin?: string }) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Giriş başarısız');
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [adim, setAdim] = useState<Adim>('telefon');
  const [telefon, setTelefon] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [pin, setPin] = useState('');
  const [pinTekrar, setPinTekrar] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setAdim('telefon');
    setPin('');
    setPinTekrar('');
    setError('');
    setAdSoyad('');
  }

  // 1. Adim: telefonu dogrula, PIN var/yok ayrimina gore ilerle
  const handleTelefon = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: telefon }),
      });
      const data = await res.json();
      if (!data.found) {
        setError('Bu numarayla kayıtlı aktif çalışan bulunamadı');
        return;
      }
      setAdSoyad(data.fullName || '');
      setAdim(data.hasPin ? 'pin' : 'pin-olustur');
    } catch {
      setError('Bağlantı hatası, tekrar deneyin');
    } finally {
      setLoading(false);
    }
  };

  // 2a. Adim: mevcut PIN ile giris
  const handlePin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN 4 haneli olmalı');
      return;
    }
    setLoading(true);
    try {
      await girisYap({ phone: telefon, pin });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // 2b. Adim: ilk giris - yeni PIN belirle
  const handlePinOlustur = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN 4 haneli olmalı');
      return;
    }
    if (pin !== pinTekrar) {
      setError('PIN’ler eşleşmiyor');
      return;
    }
    setLoading(true);
    try {
      await girisYap({ phone: telefon, newPin: pin });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm">
        
        {/* LOGO ALANI */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Field Service Co. Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">Teknik Servis Yönetim Sistemi</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* 1. ADIM: TELEFON */}
          {adim === 'telefon' && (
            <form onSubmit={handleTelefon} className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Telefon ile giriş</span>
              </div>
              <Input
                label="Cep Telefonu"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                placeholder="05XX XXX XX XX"
                required
                autoFocus
              />
              {error && <ErrorBox>{error}</ErrorBox>}
              <Button type="submit" fullWidth loading={loading} size="lg">
                Devam
              </Button>
            </form>
          )}

          {/* 2a. ADIM: PIN GIR */}
          {adim === 'pin' && (
            <form onSubmit={handlePin} className="space-y-4">
              <BackBtn onClick={reset} />
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">Hoş geldin</p>
                <p className="font-semibold text-gray-900">{adSoyad}</p>
              </div>
              <PinInput label="PIN" value={pin} onChange={setPin} autoFocus />
              {error && <ErrorBox>{error}</ErrorBox>}
              <Button type="submit" fullWidth loading={loading} size="lg">
                Giriş Yap
              </Button>
            </form>
          )}

          {/* 2b. ADIM: PIN OLUSTUR (ilk giris) */}
          {adim === 'pin-olustur' && (
            <form onSubmit={handlePinOlustur} className="space-y-4">
              <BackBtn onClick={reset} />
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">İlk giriş — {adSoyad}</p>
                <p className="font-semibold text-gray-900">4 haneli PIN belirle</p>
              </div>
              <PinInput label="Yeni PIN" value={pin} onChange={setPin} autoFocus />
              <PinInput label="PIN Tekrar" value={pinTekrar} onChange={setPinTekrar} />
              {error && <ErrorBox>{error}</ErrorBox>}
              <Button type="submit" fullWidth loading={loading} size="lg">
                Kaydet ve Giriş Yap
              </Button>
            </form>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          PIN’ini unuttuysan bölge sorumluna / yönetime başvur.
        </p>
      </div>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
      <p className="text-sm text-red-700">{children}</p>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <ArrowLeft className="w-4 h-4" />
      Numarayı değiştir
    </button>
  );
}

function PinInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Input
      label={label}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      placeholder="••••"
      className="text-center tracking-[0.5em] text-lg"
      autoFocus={autoFocus}
      required
    />
  );
}