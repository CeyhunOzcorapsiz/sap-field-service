import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity } from '@/types/sap';
import { getAktifIs, setAktifIs } from '@/lib/server/aktif-is-store';

// SAP Object Type: 191 = ServiceCall
const SERVICE_CALL_OBJECT_TYPE = '191';

function bugunTarih(): string {
  return new Date().toISOString().split('T')[0];
}
function suAnSaat(): string {
  return new Date().toTimeString().slice(0, 5); // "HH:mm"
}

// Giris yapan teknisyenin SAP atama kimligi.
// SAP kullanicisi -> ('user', ApplicationUserID); degilse -> ('employee', EmployeeID).
function assigneeOf(user: { applicationUserId?: number | null; userId: number }) {
  return user.applicationUserId != null
    ? { type: 'user' as const, id: user.applicationUserId }
    : { type: 'employee' as const, id: user.userId };
}

/**
 * GET - Servise bagli aktiviteleri ve giris yapan kisinin "devam eden isi"ni
 * (aktif isaret) dondurur. SAP aktiviteleri acik kalamadigi icin "devam eden"
 * bilgisi dosya tabanli isaret store'undan gelir ([[aktif-is-store]]).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { id } = await params;
    const sap = getSAPClient();

    // ParentObjectId SAYISAL (Edm.Int32) -> tirnaksiz; ParentObjectType string.
    const activities = await sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
      $filter: `ParentObjectId eq ${parseInt(id)} and ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}'`,
      $orderby: 'ActivityCode desc',
    });

    const a = assigneeOf(user);
    const aktif = await getAktifIs(parseInt(id), a.type, a.id);

    return NextResponse.json({ value: activities, aktif });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

/**
 * POST - "Ise Basla": aktiviteyi olusturur, servis cagrisina baglar ve
 * "devam ediyor" isaretini store'a yazar. (Aktivite SAP'de hemen olusur;
 * EndTime'i SAP otomatik doldurur, Isi Bitir'de gercek degerle guncellenir.)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { id } = await params;
    const callId = parseInt(id);
    const body = await request.json().catch(() => ({}));
    const sap = getSAPClient();
    const a = assigneeOf(user);

    // Zaten devam eden isi var mi? (isaret store'undan)
    const mevcut = await getAktifIs(callId, a.type, a.id);
    if (mevcut) {
      return NextResponse.json(
        { message: 'Bu serviste zaten devam eden bir işiniz var', aktif: mevcut },
        { status: 409 },
      );
    }

    // 1) Aktiviteyi olustur (atama: kullanici -> HandledBy, degilse HandledByEmployee)
    const payload: Record<string, unknown> = {
      Activity: 'cn_Other',
      ActivityDate: bugunTarih(),
      StartDate: bugunTarih(),
      StartTime: suAnSaat(),
      Details: `S-${callId} saha çalışması`,
      Notes: body.notes || `İşe başlandı - ${user.fullName}`,
    };
    if (body.cardCode) payload.CardCode = body.cardCode;
    if (a.type === 'user') payload.HandledBy = a.id;
    else payload.HandledByEmployee = a.id;

    const result = await sap.post<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, payload);

    // 2) Aktiviteyi servis cagrisina bagla (ServiceCallActivities koleksiyonu).
    //    PATCH koleksiyonu komple degistirdiginden mevcutlari koruyup ekliyoruz.
    const sc = await sap.get<{ ServiceCallActivities?: { ActivityCode: number }[] }>(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${callId})`,
      { $select: 'ServiceCallActivities' },
    );
    const mevcutSatirlar = (sc.ServiceCallActivities ?? []).map((x) => ({ ActivityCode: x.ActivityCode }));
    await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${callId})`, {
      ServiceCallActivities: [...mevcutSatirlar, { ActivityCode: result.ActivityCode }],
    });

    // 3) "Devam ediyor" isaretini yaz
    await setAktifIs({
      serviceCallId: callId,
      activityCode: result.ActivityCode,
      baslangic: new Date().toISOString(),
      assigneeType: a.type,
      assigneeId: a.id,
      fullName: user.fullName,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
