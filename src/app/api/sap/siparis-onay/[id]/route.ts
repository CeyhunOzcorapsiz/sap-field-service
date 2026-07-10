import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types/auth';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPServiceCallStatus } from '@/types/sap';

/**
 * POST - Onay aksiyonu.
 * Body: { aksiyon: 'onayla' | 'reddet', not?, krediNotuNo? }
 *  onayla  -> Status: Acik (-3), is akisina devam
 *  reddet  -> Status: Kapali (-1), Resolution'a red notu
 * krediNotuNo: garanti servisinde eslestirilen kredi notu (U_GarantiKrediNotuNo UDF)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }
    if (user.role !== UserRole.SIPARIS_YONETIMI && user.role !== UserRole.YONETIM) {
      return NextResponse.json({ message: 'Onay yetkiniz yok' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { aksiyon, not, krediNotuNo } = body;

    const sap = getSAPClient();

    if (aksiyon === 'onayla') {
      const payload: Record<string, unknown> = { Status: SAPServiceCallStatus.OPEN };

      // Garanti kredi notu eslestirmesi (UDF varsa)
      if (krediNotuNo) {
        try {
          await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
            ...payload,
            U_GarantiKrediNotuNo: Number(krediNotuNo),
          });
          const guncel = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
          return NextResponse.json(guncel);
        } catch {
          // UDF yok - kredi notunu Resolution'a not duserek devam et
          payload.Resolution = `Onaylandı (${user.fullName}). Garanti Kredi Notu: ${krediNotuNo}`;
        }
      }

      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, payload);
      const guncel = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
      return NextResponse.json(guncel);
    }

    if (aksiyon === 'reddet') {
      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
        Status: SAPServiceCallStatus.CLOSED,
        CloseDate: new Date().toISOString().split('T')[0],
        Resolution: `Reddedildi (${user.fullName})${not ? `: ${not}` : ''}`,
      });
      const guncel = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
      return NextResponse.json(guncel);
    }

    return NextResponse.json({ message: 'Geçersiz aksiyon' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
