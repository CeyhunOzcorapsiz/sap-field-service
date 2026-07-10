import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity, SAPEmployee, SAPBusinessPartner } from '@/types/sap';
import { hesaplaMesai } from '@/lib/utils/time';
import { activityKm } from '@/lib/utils/timesheet';

const SERVICE_CALL_OBJECT_TYPE = '191';

interface AylikTeknisyenOzet {
  employeeId: number;
  teknisyenAdi: string;
  toplamCalisma: number; // saha normal saat
  toplamMesai: number;
  toplamKm: number;
  servisSayisi: number; // benzersiz servis (aktivite bazli is)
  musteriler: Array<{ musteriAdi: string; normal: number; mesai: number }>;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GET - Aylik mesai ozeti ("Haziran Mesai Formu"nun dijital karsiligi).
 * Query: year=YYYY&month=1-12
 * Teknisyen bazli: musteri dagilimli normal/mesai saatleri + toplamlar.
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

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json({ message: 'Geçersiz dönem' }, { status: 400 });
    }

    const ayBaslangic = `${year}-${String(month).padStart(2, '0')}-01`;
    const sonGun = new Date(year, month, 0).getDate();
    const ayBitis = `${year}-${String(month).padStart(2, '0')}-${String(sonGun).padStart(2, '0')}`;

    const sap = getSAPClient();

    const [activities, employees] = await Promise.all([
      sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
        $filter: `StartDate ge '${ayBaslangic}' and StartDate le '${ayBitis}' and ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}'`,
        $orderby: 'StartDate asc',
        $top: 2000,
      }),
      sap
        .getList<SAPEmployee>(SAP_ENDPOINTS.EMPLOYEES, {
          $select: 'EmployeeID,FirstName,LastName',
        })
        .catch(() => [] as SAPEmployee[]),
    ]);

    // Musteri adlari
    const cardCodes = Array.from(new Set(activities.map((a) => a.CardCode).filter(Boolean)));
    const bpAdlari: Record<string, string> = {};
    if (cardCodes.length > 0) {
      const partners = await sap
        .getList<SAPBusinessPartner>(SAP_ENDPOINTS.BUSINESS_PARTNERS, {
          $select: 'CardCode,CardName',
          $filter: cardCodes.map((c) => `CardCode eq '${c}'`).join(' or '),
        })
        .catch(() => [] as SAPBusinessPartner[]);
      for (const bp of partners) bpAdlari[bp.CardCode] = bp.CardName;
    }

    const ozetMap = new Map<number, AylikTeknisyenOzet>();
    const servisSetleri = new Map<number, Set<string>>();

    for (const act of activities) {
      if (!act.StartDate || !act.StartTime || !act.EndTime) continue;
      const tarih = act.StartDate.split('T')[0];
      const bitisTarih = (act.EndDueDate || act.StartDate).split('T')[0];
      const start = new Date(`${tarih}T${act.StartTime.slice(0, 5)}:00`);
      const end = new Date(`${bitisTarih}T${act.EndTime.slice(0, 5)}:00`);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue;

      const empId = act.HandledByEmployee;
      if (!ozetMap.has(empId)) {
        const emp = employees.find((e) => e.EmployeeID === empId);
        ozetMap.set(empId, {
          employeeId: empId,
          teknisyenAdi: emp ? `${emp.FirstName} ${emp.LastName}` : `Teknisyen #${empId}`,
          toplamCalisma: 0,
          toplamMesai: 0,
          toplamKm: 0,
          servisSayisi: 0,
          musteriler: [],
        });
        servisSetleri.set(empId, new Set());
      }
      const ozet = ozetMap.get(empId)!;

      const m = hesaplaMesai(start, end);
      ozet.toplamCalisma = r2(ozet.toplamCalisma + m.normalSaat);
      ozet.toplamMesai = r2(ozet.toplamMesai + m.mesaiSaat);
      ozet.toplamKm = r2(ozet.toplamKm + activityKm(act));
      if (act.ParentObjectId) servisSetleri.get(empId)!.add(act.ParentObjectId);

      const musteriAdi = act.CardCode ? bpAdlari[act.CardCode] || act.CardCode : 'GENEL OFİS';
      let mk = ozet.musteriler.find((x) => x.musteriAdi === musteriAdi);
      if (!mk) {
        mk = { musteriAdi, normal: 0, mesai: 0 };
        ozet.musteriler.push(mk);
      }
      mk.normal = r2(mk.normal + m.normalSaat);
      mk.mesai = r2(mk.mesai + m.mesaiSaat);
    }

    for (const [empId, ozet] of ozetMap) {
      ozet.servisSayisi = servisSetleri.get(empId)?.size ?? 0;
      ozet.musteriler.sort((a, b) => b.normal + b.mesai - (a.normal + a.mesai));
    }

    const teknisyenler = Array.from(ozetMap.values()).sort((a, b) =>
      a.teknisyenAdi.localeCompare(b.teknisyenAdi, 'tr'),
    );

    return NextResponse.json({
      year,
      month,
      teknisyenler,
      toplamlar: {
        calisma: r2(teknisyenler.reduce((a, t) => a + t.toplamCalisma, 0)),
        mesai: r2(teknisyenler.reduce((a, t) => a + t.toplamMesai, 0)),
        km: r2(teknisyenler.reduce((a, t) => a + t.toplamKm, 0)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
