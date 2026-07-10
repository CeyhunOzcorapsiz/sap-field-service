'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ImzaPadProps {
  label: string;
  onKaydetBase64: (dataUrl: string) => void;
  yukleniyor?: boolean;
}

/**
 * Canvas tabanli imza alani - dokunmatik ve fare destekli.
 * Temiz PNG (beyaz zemin) base64 dondurur.
 */
export default function ImzaPad({ label, onKaydetBase64, yukleniyor }: ImzaPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cizimRef = useRef(false);
  const sonNoktaRef = useRef<{ x: number; y: number } | null>(null);
  const [bos, setBos] = useState(true);

  // Canvas'i HiDPI icin olcekle ve beyaz zeminle baslat
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    setupCanvas();
    const handle = () => setupCanvas();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [setupCanvas]);

  const noktaAl = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const basla = (e: React.PointerEvent) => {
    e.preventDefault();
    cizimRef.current = true;
    sonNoktaRef.current = noktaAl(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const ciz = (e: React.PointerEvent) => {
    if (!cizimRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !sonNoktaRef.current) return;
    const nokta = noktaAl(e);
    ctx.beginPath();
    ctx.moveTo(sonNoktaRef.current.x, sonNoktaRef.current.y);
    ctx.lineTo(nokta.x, nokta.y);
    ctx.stroke();
    sonNoktaRef.current = nokta;
    if (bos) setBos(false);
  };

  const bitir = (e: React.PointerEvent) => {
    cizimRef.current = false;
    sonNoktaRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const temizle = () => {
    setupCanvas();
    setBos(true);
  };

  const kaydet = () => {
    const canvas = canvasRef.current;
    if (!canvas || bos) return;
    onKaydetBase64(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={temizle}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Eraser className="w-3.5 h-3.5" />
          Temizle
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg touch-none bg-white cursor-crosshair"
        onPointerDown={basla}
        onPointerMove={ciz}
        onPointerUp={bitir}
        onPointerLeave={bitir}
      />
      <Button fullWidth onClick={kaydet} disabled={bos} loading={yukleniyor}>
        <Check className="w-4 h-4 mr-1.5" />
        İmzayı Kaydet
      </Button>
    </div>
  );
}
