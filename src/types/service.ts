export enum ServisTuru {
  ARIZA = 'ARIZA',
  BAKIM = 'BAKIM',
  MONTAJ = 'MONTAJ',
  GARANTI = 'GARANTI',
  DEVREYE_ALMA = 'DEVREYE_ALMA',
}

export const SERVIS_TURU_LABELS: Record<ServisTuru, string> = {
  [ServisTuru.ARIZA]: 'Arıza',
  [ServisTuru.BAKIM]: 'Bakım',
  [ServisTuru.MONTAJ]: 'Montaj',
  [ServisTuru.GARANTI]: 'Garanti',
  [ServisTuru.DEVREYE_ALMA]: 'Devreye Alma',
};

export const SERVIS_TURU_SAP_MAP: Record<ServisTuru, number> = {
  [ServisTuru.ARIZA]: 1,
  [ServisTuru.BAKIM]: 2,
  [ServisTuru.MONTAJ]: 3,
  [ServisTuru.GARANTI]: 4,
  [ServisTuru.DEVREYE_ALMA]: 5,
};

export enum ServisDurumu {
  ACIK = 'ACIK',
  BEKLEMEDE = 'BEKLEMEDE',
  KAPALI = 'KAPALI',
}

export const SERVIS_DURUMU_LABELS: Record<ServisDurumu, string> = {
  [ServisDurumu.ACIK]: 'Açık',
  [ServisDurumu.BEKLEMEDE]: 'Beklemede',
  [ServisDurumu.KAPALI]: 'Kapalı',
};

export enum ServisOnceligi {
  DUSUK = 'DUSUK',
  ORTA = 'ORTA',
  YUKSEK = 'YUKSEK',
}

export const SERVIS_ONCELIGI_LABELS: Record<ServisOnceligi, string> = {
  [ServisOnceligi.DUSUK]: 'Düşük',
  [ServisOnceligi.ORTA]: 'Orta',
  [ServisOnceligi.YUKSEK]: 'Yüksek',
};

export interface ServisKaydi {
  id: number;
  servisNo: string;
  konu: string;
  musteriKodu: string;
  musteriAdi: string;
  tur: ServisTuru;
  durum: ServisDurumu;
  oncelik: ServisOnceligi;
  teknisyenId: number;
  teknisyenAdi: string;
  aciklama: string;
  cozum: string;
  olusturmaTarihi: string;
  kapatmaTarihi: string | null;
  urunKodu: string;
  urunAdi: string;
  seriNo: string;
  isBaslangic: string | null;
  isBitis: string | null;
  toplamSure: number | null;
  normalSaat: number | null;
  mesaiSaat: number | null;
  yolMesafe: number | null;
  yolUcreti: number | null;
  musteriPuani: number | null;
  imzaEkNo: number | null;
  kullanilanUrunler: KullanilanUrun[];
  fotograflar: string[];
}

export interface KullanilanUrun {
  urunKodu: string;
  urunAdi: string;
  miktar: number;
  birimFiyat: number;
  toplamFiyat: number;
}

export interface YeniServisForm {
  musteriKodu: string;
  konu: string;
  tur: ServisTuru;
  oncelik: ServisOnceligi;
  teknisyenId: number;
  aciklama: string;
  urunKodu?: string;
  seriNo?: string;
}

export const HAZIR_ISLEM_NOTLARI = [
  'Arıza tespiti yapıldı, parça değişimi gerekli',
  'Periyodik bakım tamamlandı',
  'Filtre değişimi yapıldı',
  'Yağ değişimi yapıldı',
  'Kalibrasyon yapıldı',
  'Yazılım güncellendi',
  'Elektrik bağlantıları kontrol edildi',
  'Sızıntı tespit edildi ve giderildi',
  'Conta değişimi yapıldı',
  'Motor arızası giderildi',
  'Sensör değişimi yapıldı',
  'Genel kontrol yapıldı, sorun tespit edilmedi',
  'Devreye alma işlemi tamamlandı',
  'Montaj işlemi tamamlandı',
  'Garanti kapsamında parça değişimi yapıldı',
];

export interface MesaiHesaplama {
  toplamSure: number;
  normalSaat: number;
  mesaiSaat: number;
  mesaiOrani: number;
}

// Kagit servis formundaki "Servis Sonucu" alani
export enum ServisSonucu {
  CALISIR_DURUMDA = 1,
  MUDAHALE_GEREKLI = 2,
  ACIL_MUDAHALE_GEREKLI = 3,
}

export const SERVIS_SONUCU_LABELS: Record<ServisSonucu, string> = {
  [ServisSonucu.CALISIR_DURUMDA]: 'Çalışır Durumda',
  [ServisSonucu.MUDAHALE_GEREKLI]: 'Müdahale Gerekli',
  [ServisSonucu.ACIL_MUDAHALE_GEREKLI]: 'Acil Müdahale Gerekli',
};
