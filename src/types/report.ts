export interface AylikRapor {
  ay: string;
  yil: number;
  toplamServis: number;
  toplamMesai: number;
  mesaiOrani: number;
  enYogunTeknisyen: string;
}

export interface TeknisyenPerformans {
  teknisyenId: number;
  teknisyenAdi: string;
  donem: string;
  tamamlananServis: number;
  musteriMemnuniyeti: number;
  zamandaTamamlamaOrani: number;
  toplamMesaiSaat: number;
  toplamCalismaSaat: number;
  mesaiOrani: number;
  tvsSkoru: number;
  tvsSeviye: TVSSeviye;
}

export enum TVSSeviye {
  MUKEMMEL = 'MUKEMMEL',
  IYI = 'IYI',
  ORTA = 'ORTA',
  GELISIM_GEREKLI = 'GELISIM_GEREKLI',
}

export const TVS_SEVIYE_LABELS: Record<TVSSeviye, string> = {
  [TVSSeviye.MUKEMMEL]: 'Mükemmel',
  [TVSSeviye.IYI]: 'İyi',
  [TVSSeviye.ORTA]: 'Orta',
  [TVSSeviye.GELISIM_GEREKLI]: 'Gelişim Gerekli',
};

export const TVS_SEVIYE_RENK: Record<TVSSeviye, string> = {
  [TVSSeviye.MUKEMMEL]: 'text-green-600 bg-green-50',
  [TVSSeviye.IYI]: 'text-blue-600 bg-blue-50',
  [TVSSeviye.ORTA]: 'text-yellow-600 bg-yellow-50',
  [TVSSeviye.GELISIM_GEREKLI]: 'text-red-600 bg-red-50',
};

export interface DashboardKPI {
  bugunAcikServis: number;
  bugunTamamlanan: number;
  haftalikToplam: number;
  aylikToplam: number;
  ortalamaCozumSuresi: number;
  bekleyenOnay: number;
}

export interface MesaiKaydi {
  servisNo: string;
  teknisyen: string;
  musteri: string;
  isBaslangic: string;
  isBitis: string;
  toplamSure: number;
  normalSaat: number;
  mesaiSaat: number;
  aciklama: string;
}
