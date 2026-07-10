import { TVSSeviye } from '@/types/report';

export interface TVSGirdi {
  tamamlananServis: number;
  musteriMemnuniyeti: number;
  zamandaTamamlamaOrani: number;
  mesaiOrani: number;
  maxServis?: number;
}

export function hesaplaTVS(girdi: TVSGirdi): number {
  const maxServis = girdi.maxServis || 50;
  const normalizeServis = Math.min(girdi.tamamlananServis / maxServis, 1);
  const normalizeMemnuniyet = girdi.musteriMemnuniyeti / 5;
  const normalizeZamanda = girdi.zamandaTamamlamaOrani;
  const normalizeMesai = girdi.mesaiOrani;

  const skor =
    normalizeServis * 40 +
    normalizeMemnuniyet * 30 +
    normalizeZamanda * 20 -
    normalizeMesai * 20;

  return Math.round(Math.max(0, Math.min(100, skor)) * 10) / 10;
}

export function getTVSSeviye(skor: number): TVSSeviye {
  if (skor >= 90) return TVSSeviye.MUKEMMEL;
  if (skor >= 80) return TVSSeviye.IYI;
  if (skor >= 70) return TVSSeviye.ORTA;
  return TVSSeviye.GELISIM_GEREKLI;
}
