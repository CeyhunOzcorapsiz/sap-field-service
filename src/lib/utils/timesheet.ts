import { SAPActivity, SAPEmployee } from '@/types/sap';
import { hesaplaMesai } from './time';

/**
 * Haftalik Time Sheet hesaplama - "Gerceklesen Haftalik Program" Excel formatinin
 * dijital karsiligi. SAP Activity kayitlarindan teknisyen bazli
 * musteri x gun (Normal / Mesai / KM) matrisi uretir.
 */

export interface TimeSheetGun {
  normal: number;
  mesai: number;
  km: number;
}

export interface TimeSheetSatir {
  musteriKodu: string;
  musteriAdi: string;
  gunler: TimeSheetGun[]; // 7 gun: Pzt(0) - Paz(6)
  toplamNormal: number;
  toplamMesai: number;
  toplamKm: number;
}

export interface TeknisyenTimeSheet {
  employeeId: number;
  teknisyenAdi: string;
  satirlar: TimeSheetSatir[];
  haftalikNormal: number;
  haftalikMesai: number;
  haftalikToplam: number;
  haftalikKm: number;
}

export interface HaftalikTimeSheet {
  haftaBaslangic: string; // Pazartesi YYYY-MM-DD
  haftaBitis: string; // Pazar YYYY-MM-DD
  teknisyenler: TeknisyenTimeSheet[];
}

export const GUN_ADLARI = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'];

/** Verilen tarihin haftasinin pazartesi gununu dondurur (YYYY-MM-DD) */
export function haftaninPazartesisi(tarih: Date): string {
  const d = new Date(tarih);
  const gun = d.getDay(); // 0=Pazar
  const fark = gun === 0 ? -6 : 1 - gun;
  d.setDate(d.getDate() + fark);
  return d.toISOString().split('T')[0];
}

export function tarihEkle(tarihStr: string, gun: number): string {
  const d = new Date(`${tarihStr}T00:00:00`);
  d.setDate(d.getDate() + gun);
  return d.toISOString().split('T')[0];
}

/** Aktivitenin hafta icindeki gun indeksi (0=Pzt ... 6=Paz), hafta disindaysa -1 */
function gunIndeksi(tarihStr: string, haftaBaslangic: string): number {
  const t = new Date(`${tarihStr.split('T')[0]}T00:00:00`);
  const h = new Date(`${haftaBaslangic}T00:00:00`);
  const fark = Math.round((t.getTime() - h.getTime()) / 86400000);
  return fark >= 0 && fark <= 6 ? fark : -1;
}

/** Activity'den KM cikar: U_Km UDF'i ya da Notes icindeki "Yol: 45 km" */
export function activityKm(act: SAPActivity): number {
  if (typeof act.U_Km === 'number') return act.U_Km;
  const m = (act.Notes || '').match(/Yol:\s*(\d+(?:[.,]\d+)?)\s*km/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** Activity'den baslangic/bitis Date'leri kur; bitmemis aktivite null doner */
function activityZamanlari(act: SAPActivity): { start: Date; end: Date } | null {
  if (!act.StartDate || !act.StartTime || !act.EndTime) return null;
  const tarih = act.StartDate.split('T')[0];
  const bitisTarih = (act.EndDueDate || act.StartDate).split('T')[0];
  const start = new Date(`${tarih}T${act.StartTime.slice(0, 5)}:00`);
  const end = new Date(`${bitisTarih}T${act.EndTime.slice(0, 5)}:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  return { start, end };
}

function bosGunler(): TimeSheetGun[] {
  return Array.from({ length: 7 }, () => ({ normal: 0, mesai: 0, km: 0 }));
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aktivitelerden haftalik time sheet uretir.
 * @param activities Hafta araligindaki SAP aktiviteleri (bitmis isler)
 * @param employees Calisan listesi (ad cozumleme)
 * @param bpAdlari CardCode -> musteri adi haritasi
 * @param haftaBaslangic Pazartesi (YYYY-MM-DD)
 */
export function buildTimeSheet(
  activities: SAPActivity[],
  employees: SAPEmployee[],
  bpAdlari: Record<string, string>,
  haftaBaslangic: string,
): HaftalikTimeSheet {
  const teknisyenMap = new Map<number, TeknisyenTimeSheet>();

  for (const act of activities) {
    const zaman = activityZamanlari(act);
    if (!zaman) continue; // bitmemis is

    const gIdx = gunIndeksi(act.StartDate, haftaBaslangic);
    if (gIdx < 0) continue;

    const empId = act.HandledByEmployee;
    if (!teknisyenMap.has(empId)) {
      const emp = employees.find((e) => e.EmployeeID === empId);
      teknisyenMap.set(empId, {
        employeeId: empId,
        teknisyenAdi: emp ? `${emp.FirstName} ${emp.LastName}` : `Teknisyen #${empId}`,
        satirlar: [],
        haftalikNormal: 0,
        haftalikMesai: 0,
        haftalikToplam: 0,
        haftalikKm: 0,
      });
    }
    const ts = teknisyenMap.get(empId)!;

    // Satir anahtari: musteri kodu; CardCode yoksa ozel satir (GENEL OFIS / IZIN vb)
    const kod = act.CardCode || '';
    const ad = kod
      ? bpAdlari[kod] || kod
      : (act.Details || 'GENEL OFİS').toUpperCase().includes('İZİN') || (act.Details || '').toUpperCase().includes('IZIN')
        ? 'İZİN'
        : 'GENEL OFİS';

    let satir = ts.satirlar.find((s) => s.musteriKodu === kod && s.musteriAdi === ad);
    if (!satir) {
      satir = {
        musteriKodu: kod,
        musteriAdi: ad,
        gunler: bosGunler(),
        toplamNormal: 0,
        toplamMesai: 0,
        toplamKm: 0,
      };
      ts.satirlar.push(satir);
    }

    const mesai = hesaplaMesai(zaman.start, zaman.end);
    const km = activityKm(act);

    satir.gunler[gIdx].normal = r2(satir.gunler[gIdx].normal + mesai.normalSaat);
    satir.gunler[gIdx].mesai = r2(satir.gunler[gIdx].mesai + mesai.mesaiSaat);
    satir.gunler[gIdx].km = r2(satir.gunler[gIdx].km + km);
  }

  // Toplamlar
  for (const ts of teknisyenMap.values()) {
    for (const satir of ts.satirlar) {
      satir.toplamNormal = r2(satir.gunler.reduce((a, g) => a + g.normal, 0));
      satir.toplamMesai = r2(satir.gunler.reduce((a, g) => a + g.mesai, 0));
      satir.toplamKm = r2(satir.gunler.reduce((a, g) => a + g.km, 0));
      ts.haftalikNormal = r2(ts.haftalikNormal + satir.toplamNormal);
      ts.haftalikMesai = r2(ts.haftalikMesai + satir.toplamMesai);
      ts.haftalikKm = r2(ts.haftalikKm + satir.toplamKm);
    }
    ts.haftalikToplam = r2(ts.haftalikNormal + ts.haftalikMesai);
    // Musteri satirlarini alfabetik sirala, ozel satirlar sona
    ts.satirlar.sort((a, b) => {
      if (!a.musteriKodu && b.musteriKodu) return 1;
      if (a.musteriKodu && !b.musteriKodu) return -1;
      return a.musteriAdi.localeCompare(b.musteriAdi, 'tr');
    });
  }

  return {
    haftaBaslangic,
    haftaBitis: tarihEkle(haftaBaslangic, 6),
    teknisyenler: Array.from(teknisyenMap.values()).sort((a, b) =>
      a.teknisyenAdi.localeCompare(b.teknisyenAdi, 'tr'),
    ),
  };
}
