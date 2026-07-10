import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity, SAPServiceCallStatus } from '@/types/sap';
import { ServisSonucu, SERVIS_SONUCU_LABELS } from '@/types/service';

const SERVICE_CALL_OBJECT_TYPE = '191';

/**
 * POST - Servis kapatma (kagit formdaki zorunlu alanlarla).
 * Body: { resolution, sonuc (1|2|3), toplamKm?, vakumPompSaati? }
 *
 * Excel #16: Eksik alan varsa kapanmamali.
 * UDF'ler (U_ServisSonucu, U_ToplamKm, U_VakumPompSaati) SAP'de tanimliysa
 * oraya yazilir; degilse Resolution icine yapilandirilmis blok olarak gomulur.
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

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Zorunlu alan kontrolu (Excel #16)
    const eksikler: string[] = [];
    if (!body.resolution?.trim()) eksikler.push('İşlem notu');
    const sonuc = Number(body.sonuc) as ServisSonucu;
    if (!SERVIS_SONUCU_LABELS[sonuc]) eksikler.push('Servis sonucu');
    if (eksikler.length > 0) {
      return NextResponse.json(
        { message: `Eksik alanlar: ${eksikler.join(', ')}. Servis kapatılamaz.` },
        { status: 400 },
      );
    }

    const sap = getSAPClient();

    // Devam eden is kontrolu (server-side)
    const acikAktiviteler = await sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
      $filter: `ParentObjectId eq '${id}' and ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}' and EndTime eq null`,
      $top: 1,
    });
    if (acikAktiviteler.length > 0) {
      return NextResponse.json(
        { message: 'Devam eden iş var — kapatmadan önce tüm işler bitirilmeli' },
        { status: 409 },
      );
    }

    // Musteri puani (1-5) opsiyonel
    const musteriPuani =
      body.musteriPuani && Number(body.musteriPuani) >= 1 && Number(body.musteriPuani) <= 5
        ? Number(body.musteriPuani)
        : null;

    // Kapanis blogu: UDF'ler yoksa Resolution'a gomulur
    const kapanisBlogu = [
      body.resolution.trim(),
      '',
      '--- Servis Kapanış ---',
      `Sonuç: ${SERVIS_SONUCU_LABELS[sonuc]}`,
      body.toplamKm ? `Toplam Servis Km: ${body.toplamKm}` : null,
      body.vakumPompSaati ? `Vakum Pomp Saati: ${body.vakumPompSaati}` : null,
      musteriPuani ? `Müşteri Puanı: ${musteriPuani}/5` : null,
      `Kapatan: ${user.fullName}`,
    ]
      .filter((s) => s !== null)
      .join('\n');

    const basePayload = {
      Status: SAPServiceCallStatus.CLOSED,
      CloseDate: new Date().toISOString().split('T')[0],
    };

    // Once UDF'lerle dene
    const udfPayload: Record<string, unknown> = {
      ...basePayload,
      Resolution: body.resolution.trim(),
      U_ServisSonucu: sonuc,
    };
    if (body.toplamKm) udfPayload.U_ToplamKm = Number(body.toplamKm);
    if (body.vakumPompSaati) udfPayload.U_VakumPompSaati = Number(body.vakumPompSaati);
    if (musteriPuani) udfPayload.U_MusteriPuani = musteriPuani;

    try {
      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, udfPayload);
    } catch {
      // UDF'ler tanimli degil - bilgileri Resolution'a gomerek kapat
      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
        ...basePayload,
        Resolution: kapanisBlogu,
      });
    }

    const updated = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
