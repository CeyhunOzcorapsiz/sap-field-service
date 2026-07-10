import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity } from '@/types/sap';
import { clearAktifIsByActivity } from '@/lib/server/aktif-is-store';

/**
 * GET - Tek aktivite detayi.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { code } = await params;
    const sap = getSAPClient();
    const activity = await sap.get<SAPActivity>(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`);

    return NextResponse.json(activity);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

/**
 * PATCH - "Isi Bitir": Acik aktiviteyi kapatir (EndTime yazar).
 * Body: { endTime?, notes?, km? }
 * KM bilgisi: U_Km UDF'i SAP'de tanimliysa oraya yazilir,
 * tanimli degilse Notes icine eklenir (fallback).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { code } = await params;
    const body = await request.json().catch(() => ({}));

    const sap = getSAPClient();

    const simdi = new Date();
    const endTime: string = body.endTime || simdi.toTimeString().slice(0, 5);
    const endDate: string = body.endDate || simdi.toISOString().split('T')[0];

    let notes: string | undefined = body.notes;
    if (body.km !== undefined && body.km !== null && body.km !== '') {
      notes = `${notes ? `${notes} | ` : ''}Yol: ${body.km} km`;
    }

    const payload: Record<string, unknown> = {
      EndDueDate: endDate,
      EndTime: endTime,
    };
    if (notes) payload.Notes = notes;

    // U_Km UDF'i SAP'de tanimliysa once onunla dene; degilse UDF'siz tekrarla
    if (body.km !== undefined && body.km !== null && body.km !== '') {
      try {
        await sap.patch(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`, {
          ...payload,
          U_Km: Number(body.km),
        });
        await clearAktifIsByActivity(parseInt(code));
        const updated = await sap.get<SAPActivity>(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`);
        return NextResponse.json(updated);
      } catch {
        // UDF tanimli degil - KM zaten Notes'a yazildi, UDF'siz devam et
      }
    }

    await sap.patch(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`, payload);
    await clearAktifIsByActivity(parseInt(code));
    const updated = await sap.get<SAPActivity>(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`);

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
