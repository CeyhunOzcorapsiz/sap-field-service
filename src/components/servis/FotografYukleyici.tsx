'use client';

import { useRef, useState } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

interface FotografYukleyiciProps {
  onYukle: (fileName: string, mimeType: string, dataUrl: string) => Promise<void>;
}

const MAX_BOYUT = 1600; // px - uzun kenar

/**
 * Kamera/galeri fotograf secimi + client-side yeniden boyutlandirma.
 * SAP'ye yuklemeden once dosyayi kuculterek bant genisligi tasarrufu saglar.
 */
export default function FotografYukleyici({ onYukle }: FotografYukleyiciProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const dosyaSecildi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Olcekle
        let { width, height } = img;
        if (width > height && width > MAX_BOYUT) {
          height = Math.round((height * MAX_BOYUT) / width);
          width = MAX_BOYUT;
        } else if (height > MAX_BOYUT) {
          width = Math.round((width * MAX_BOYUT) / height);
          height = MAX_BOYUT;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setOnizleme(dataUrl);
        setDosyaAdi(file.name.replace(/\.[^.]+$/, '') + '.jpg');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const iptal = () => {
    setOnizleme(null);
    setDosyaAdi('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const yukle = async () => {
    if (!onizleme) return;
    setYukleniyor(true);
    try {
      await onYukle(dosyaAdi || `foto-${Date.now()}.jpg`, 'image/jpeg', onizleme);
      iptal();
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={dosyaSecildi}
        className="hidden"
      />

      {!onizleme ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-8 text-gray-500 hover:border-blue-600 hover:text-blue-800 transition-colors"
        >
          <Camera className="w-8 h-8" />
          <span className="text-sm font-medium">Fotoğraf çek veya seç</span>
          <span className="text-xs text-gray-400">JPG/PNG — otomatik küçültülür</span>
        </button>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={onizleme} alt="Önizleme" className="w-full max-h-64 object-contain rounded-lg border border-gray-200" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={iptal} className="flex-1">
              <X className="w-4 h-4 mr-1.5" />
              İptal
            </Button>
            <Button onClick={yukle} loading={yukleniyor} className="flex-1">
              <Upload className="w-4 h-4 mr-1.5" />
              SAP'ye Yükle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
