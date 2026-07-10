import { getSAPClient } from '@/lib/sap/client';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

/**
 * SCL6 = ServiceCallSchedulings yardımcıları (çağrıya atanan teknisyenler +
 * çizelge süresi). PATCH upsert yapar (atlanan satırı silmez); her satıra tüm
 * zorunlu alanlar gerekir. SCL6 Duration DAKİKA cinsindedir (DurationType
 * "du_Minuts").
 */

export interface SchedulingLine {
  LineNum?: number;
  Technician: number | null;
  StartDate?: string | null;
  StartTime?: string | null;
  EndDate?: string | null;
  EndTime?: string | null;
  Duration?: number | null; // planlanan süre
  DurationType?: string | null;
  ActualDuration?: number | null; // fiili süre
  ActualDurationType?: string | null;
  DisplayInCalendar?: string | null;
  U_BASLANGIC?: string | null; // gerçek işe başlama saati (Edm.Time "HH:mm:ss") - değiştirilemez
  U_BITIS?: string | null; // gerçek işi bitirme saati (Edm.Time) - değiştirilemez
}

export function bugunISO(): string {
  return new Date().toISOString().split('T')[0] + 'T00:00:00Z';
}
export function suAnSaat(): string {
  return new Date().toTimeString().slice(0, 8); // HH:mm:ss
}

/** PATCH için satırı zorunlu/temiz alan setine indirger (mevcut değerleri korur). */
export function cleanLine(l: SchedulingLine): SchedulingLine {
  const c: SchedulingLine = {
    Technician: l.Technician,
    StartDate: l.StartDate ?? bugunISO(),
    StartTime: l.StartTime ?? suAnSaat(),
    EndDate: l.EndDate ?? bugunISO(),
    EndTime: l.EndTime ?? suAnSaat(),
    Duration: l.Duration ?? 0,
    DurationType: l.DurationType ?? 'du_Minuts',
    DisplayInCalendar: l.DisplayInCalendar ?? 'tYES',
  };
  if (l.LineNum != null) c.LineNum = l.LineNum;
  if (l.ActualDuration != null) c.ActualDuration = l.ActualDuration;
  if (l.ActualDurationType != null) c.ActualDurationType = l.ActualDurationType;
  // Gerçek başla/bitiş UDF'leri korunur (kullanıcı asla değiştiremez)
  if (l.U_BASLANGIC != null) c.U_BASLANGIC = l.U_BASLANGIC;
  if (l.U_BITIS != null) c.U_BITIS = l.U_BITIS;
  return c;
}

/** SCL6 satır süresini dakikaya normalize eder (DurationType'a göre).
 *  SAP enum: du_Seconds, du_Minuts, du_Hours, du_Days. SAP süreyi otomatik
 *  normalize eder (örn. 300 dk -> 5.0 du_Hours), bu yüzden hepsini ele alıyoruz. */
export function durToDakika(d: number | null | undefined, type: string | null | undefined): number {
  const v = d ?? 0;
  switch (type) {
    case 'du_Seconds':
      return Math.round(v / 60);
    case 'du_Hours':
      return Math.round(v * 60);
    case 'du_Days':
      return Math.round(v * 1440);
    default:
      return Math.round(v); // du_Minuts
  }
}
export function lineDakika(l: SchedulingLine): number {
  return durToDakika(l.Duration, l.DurationType);
}

export async function getLines(callId: number): Promise<SchedulingLine[]> {
  const sap = getSAPClient();
  const sc = await sap.get<{ ServiceCallSchedulings?: SchedulingLine[] }>(
    `${SAP_ENDPOINTS.SERVICE_CALLS}(${callId})`,
    { $select: 'ServiceCallSchedulings' },
  );
  return sc.ServiceCallSchedulings ?? [];
}

export async function patchLines(callId: number, lines: SchedulingLine[]): Promise<void> {
  const sap = getSAPClient();
  await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${callId})`, {
    ServiceCallSchedulings: lines.map(cleanLine),
  });
}

/** Teknisyen yeni satır olarak çizelgeye eklenir (yoksa). */
export function yeniSatir(technicianId: number): SchedulingLine {
  return {
    Technician: technicianId,
    StartDate: bugunISO(),
    StartTime: suAnSaat(),
    EndDate: bugunISO(),
    EndTime: suAnSaat(),
    Duration: 0,
    DurationType: 'du_Minuts',
    DisplayInCalendar: 'tYES',
  };
}

/** Teknisyenin çizelgede satırı yoksa ekler. */
export async function ensureTechnician(callId: number, technicianId: number): Promise<void> {
  const lines = await getLines(callId);
  if (lines.some((l) => l.Technician === technicianId)) return;
  await patchLines(callId, [...lines, yeniSatir(technicianId)]);
}

/**
 * Teknisyenin SCL6 satırına GERÇEK başla/bitiş saatini yazar (değiştirilemez
 * UDF: U_BASLANGIC / U_BITIS). Satır yoksa oluşturur. Bu saatler SCL6
 * süresinden (Duration) bağımsızdır — kullanıcı süreyi değiştirebilir ama
 * bu UDF'ler sadece İşe Başla/İşi Bitir ile yazılır.
 */
export async function setTechnicianTime(
  callId: number,
  technicianId: number,
  alan: 'U_BASLANGIC' | 'U_BITIS',
  saat: string,
): Promise<void> {
  const lines = await getLines(callId);
  const varMi = lines.some((l) => l.Technician === technicianId);
  const base = varMi ? lines : [...lines, yeniSatir(technicianId)];
  const yeni = base.map((l) =>
    l.Technician === technicianId ? { ...l, [alan]: saat } : l,
  );
  await patchLines(callId, yeni);
}
