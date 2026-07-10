import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types/auth';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity, SAPBusinessPartner } from '@/types/sap';
import { haftaninPazartesisi, tarihEkle } from '@/lib/utils/timesheet';

/**
 * Haftalik planlama - "Planlanan Haftalik Program" Excel'inin dijital karsiligi.
 * Plan kayitlari SAP'ye cn_Task tipli Activity olarak yazilir
 * (gercek is kayitlari cn_Other + ParentObjectId'li, karismaz).
 *
 * Is turu kodu Details alaninda tutulur: "PR|SU|CJ|WS|CV|ST" veya
 * ozel durumlar: "NOBET", "IZIN", "OFIS".
 */

const SERVICE_CALL_OBJECT_TYPE = '191';

/**
 * GET - Haftanin plan kayitlari + gerceklesen isler (kiyas icin).
 * Query: start=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const baz = startParam ? new Date(`${startParam}T00:00:00`) : new Date();
    const hafta = haftaninPazartesisi(isNaN(baz.getTime()) ? new Date() : baz);
    const haftaSon = tarihEkle(hafta, 6);

    const sap = getSAPClient();

    const [planlar, gerceklesen] = await Promise.all([
      // Plan kayitlari: cn_Task
      sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
        $filter: `ActivityDate ge '${hafta}' and ActivityDate le '${haftaSon}' and Activity eq 'cn_Task'`,
        $orderby: 'ActivityDate asc',
        $top: 500,
      }),
      // Gerceklesen isler: servis bagli aktiviteler
      sap
        .getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
          $filter: `StartDate ge '${hafta}' and StartDate le '${haftaSon}' and ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}'`,
          $orderby: 'StartDate asc',
          $top: 500,
        })
        .catch(() => [] as SAPActivity[]),
    ]);

    // Musteri adlarini coz
    const cardCodes = Array.from(
      new Set([...planlar, ...gerceklesen].map((a) => a.CardCode).filter(Boolean)),
    );
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

    return NextResponse.json({
      haftaBaslangic: hafta,
      planlar,
      gerceklesen,
      bpAdlari,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

/**
 * POST - Yeni plan kaydi.
 * Body: { tarih, employeeId, isTuru (PR|SU|CJ|WS|CV|ST|NOBET|IZIN|OFIS), cardCode?, not? }
 * Sadece BOLGE_SORUMLUSU ve YONETIM plan yapabilir.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }
    if (user.role !== UserRole.BOLGE_SORUMLUSU && user.role !== UserRole.YONETIM) {
      return NextResponse.json({ message: 'Plan yapma yetkiniz yok' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { tarih, employeeId, isTuru, cardCode, not } = body;

    if (!tarih || !employeeId || !isTuru) {
      return NextResponse.json({ message: 'Tarih, teknisyen ve iş türü zorunlu' }, { status: 400 });
    }

    const sap = getSAPClient();
    const payload: Record<string, unknown> = {
      Activity: 'cn_Task',
      ActivityDate: tarih,
      StartDate: tarih,
      HandledByEmployee: Number(employeeId),
      Details: isTuru,
      Notes: not || undefined,
    };
    if (cardCode) payload.CardCode = cardCode;

    const result = await sap.post<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
