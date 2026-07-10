import { MesaiHesaplama } from '@/types/service';

const MESAI_BASLANGIC_SAAT = 8;
const MESAI_BASLANGIC_DAKIKA = 30;
const MESAI_BITIS_SAAT = 17;
const MESAI_BITIS_DAKIKA = 30;

export function hesaplaMesai(baslangic: Date, bitis: Date): MesaiHesaplama {
  const toplamMs = bitis.getTime() - baslangic.getTime();
  const toplamSure = toplamMs / (1000 * 60 * 60);

  const mesaiBaslangic = new Date(baslangic);
  mesaiBaslangic.setHours(MESAI_BASLANGIC_SAAT, MESAI_BASLANGIC_DAKIKA, 0, 0);

  const mesaiBitis = new Date(baslangic);
  mesaiBitis.setHours(MESAI_BITIS_SAAT, MESAI_BITIS_DAKIKA, 0, 0);

  const efektifBaslangic = new Date(Math.max(baslangic.getTime(), mesaiBaslangic.getTime()));
  const efektifBitis = new Date(Math.min(bitis.getTime(), mesaiBitis.getTime()));

  let normalSaat = 0;
  if (efektifBaslangic < efektifBitis) {
    normalSaat = (efektifBitis.getTime() - efektifBaslangic.getTime()) / (1000 * 60 * 60);
  }

  const mesaiSaat = Math.max(0, toplamSure - normalSaat);
  const mesaiOrani = toplamSure > 0 ? mesaiSaat / toplamSure : 0;

  return {
    toplamSure: Math.round(toplamSure * 100) / 100,
    normalSaat: Math.round(normalSaat * 100) / 100,
    mesaiSaat: Math.round(mesaiSaat * 100) / 100,
    mesaiOrani: Math.round(mesaiOrani * 100) / 100,
  };
}

export function formatSure(saat: number): string {
  const tam = Math.floor(saat);
  const dakika = Math.round((saat - tam) * 60);
  if (dakika === 0) return `${tam} saat`;
  return `${tam} saat ${dakika} dk`;
}

export function formatSaat(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function formatTarih(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTarihSaat(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
