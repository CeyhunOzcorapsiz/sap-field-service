import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPServiceCall, SAPActivity, SAPEmployee, SAPServiceCallStatus } from '@/types/sap';
import { hesaplaMesai } from '@/lib/utils/time';
import { hesaplaTVS, getTVSSeviye } from '@/lib/utils/tvs';

const SERVICE_CALL_OBJECT_TYPE = '191';

/**
 * GET - Teknisyen performans raporu, TVS skorlari gercek veriden.
 * Query: year=YYYY&month=1-12
 *
 * Veri kaynaklari:
 *  - Tamamlanan servis: donemde kapatilan (Status=-1) ServiceCalls, TechnicianCode bazli
 *  - Mesai orani: donem Activity'lerinden normal/mesai saat hesabi
 *  - Musteri memnuniyeti: U_MusteriPuani UDF (yoksa varsayilan 4.0)
 *  - Zamaninda tamamlama: kapanis tarihi olan / toplam (basit gosterge)
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const simdi = new Date();
    const year = parseInt(searchParams.get('year') || String(simdi.getFullYear()));
    const month = parseInt(searchParams.get('month') || String(simdi.getMonth() + 1));

    const ayBaslangic = `${year}-${String(month).padStart(2, '0')}-01`;
    const sonGun = new Date(year, month, 0).getDate();
    const ayBitis = `${year}-${String(month).padStart(2, '0')}-${String(sonGun).padStart(2, '0')}`;

    const sap = getSAPClient();

    const [kapananlar, activities, employees] = await Promise.all([
      // Donemde kapatilan servisler
      sap.getList<SAPServiceCall & { U_MusteriPuani?: number }>(SAP_ENDPOINTS.SERVICE_CALLS, {
        $filter: `Status eq ${SAPServiceCallStatus.CLOSED} and CloseDate ge '${ayBaslangic}' and CloseDate le '${ayBitis}'`,
        $select: 'ServiceCallID,TechnicianCode,CloseDate,CreateDate,U_MusteriPuani',
        $top: 2000,
      }),
      // Donem aktiviteleri (mesai hesabi)
      sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
        $filter: `StartDate ge '${ayBaslangic}' and StartDate le '${ayBitis}' and ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}'`,
        $top: 3000,
      }),
      sap
        .getList<SAPEmployee>(SAP_ENDPOINTS.EMPLOYEES, {
          $select: 'EmployeeID,FirstName,LastName,Department',
        })
        .catch(() => [] as SAPEmployee[]),
    ]);

    // Teknisyen bazli aggregasyon
    interface Agg {
      employeeId: number;
      tamamlanan: number;
      puanToplam: number;
      puanSayisi: number;
      zamanindaSayisi: number;
      normalSaat: number;
      mesaiSaat: number;
    }
    const aggMap = new Map<number, Agg>();

    const getAgg = (empId: number): Agg => {
      if (!aggMap.has(empId)) {
        aggMap.set(empId, {
          employeeId: empId,
          tamamlanan: 0,
          puanToplam: 0,
          puanSayisi: 0,
          zamanindaSayisi: 0,
          normalSaat: 0,
          mesaiSaat: 0,
        });
      }
      return aggMap.get(empId)!;
    };

    for (const sc of kapananlar) {
      if (!sc.TechnicianCode) continue;
      const agg = getAgg(sc.TechnicianCode);
      agg.tamamlanan += 1;
      if (typeof sc.U_MusteriPuani === 'number' && sc.U_MusteriPuani > 0) {
        agg.puanToplam += sc.U_MusteriPuani;
        agg.puanSayisi += 1;
      }
      // Zamaninda: ayni gun veya ertesi gun kapanmissa (basit gosterge)
      if (sc.CreateDate && sc.CloseDate) {
        const fark =
          (new Date(sc.CloseDate).getTime() - new Date(sc.CreateDate).getTime()) / 86400000;
        if (fark <= 3) agg.zamanindaSayisi += 1;
      }
    }

    for (const act of activities) {
      if (!act.HandledByEmployee || !act.StartDate || !act.StartTime || !act.EndTime) continue;
      const tarih = act.StartDate.split('T')[0];
      const bitisTarih = (act.EndDueDate || act.StartDate).split('T')[0];
      const start = new Date(`${tarih}T${act.StartTime.slice(0, 5)}:00`);
      const end = new Date(`${bitisTarih}T${act.EndTime.slice(0, 5)}:00`);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue;
      const m = hesaplaMesai(start, end);
      const agg = getAgg(act.HandledByEmployee);
      agg.normalSaat += m.normalSaat;
      agg.mesaiSaat += m.mesaiSaat;
    }

    const performans = Array.from(aggMap.values())
      .map((agg) => {
        const emp = employees.find((e) => e.EmployeeID === agg.employeeId);
        const toplamSaat = agg.normalSaat + agg.mesaiSaat;
        const mesaiOrani = toplamSaat > 0 ? agg.mesaiSaat / toplamSaat : 0;
        const memnuniyet = agg.puanSayisi > 0 ? agg.puanToplam / agg.puanSayisi : 4.0;
        const zamaninda = agg.tamamlanan > 0 ? agg.zamanindaSayisi / agg.tamamlanan : 0;

        const tvs = hesaplaTVS({
          tamamlananServis: agg.tamamlanan,
          musteriMemnuniyeti: memnuniyet,
          zamandaTamamlamaOrani: zamaninda,
          mesaiOrani,
        });

        return {
          employeeId: agg.employeeId,
          teknisyenAdi: emp ? `${emp.FirstName} ${emp.LastName}` : `Teknisyen #${agg.employeeId}`,
          tamamlanan: agg.tamamlanan,
          memnuniyet: Math.round(memnuniyet * 10) / 10,
          puanVar: agg.puanSayisi > 0,
          zamaninda: Math.round(zamaninda * 100) / 100,
          normalSaat: Math.round(agg.normalSaat * 10) / 10,
          mesaiSaat: Math.round(agg.mesaiSaat * 10) / 10,
          mesaiOrani: Math.round(mesaiOrani * 100) / 100,
          tvs,
          seviye: getTVSSeviye(tvs),
        };
      })
      .sort((a, b) => b.tvs - a.tvs);

    return NextResponse.json({ year, month, performans });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
