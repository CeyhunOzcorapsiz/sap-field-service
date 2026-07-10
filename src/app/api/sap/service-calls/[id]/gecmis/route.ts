import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPServiceCall } from '@/types/sap';

/**
 * GET - Bu servisin cihazinin (seri no / ekipman) gecmis servis kayitlari.
 * Excel #19: "Ayni cihaz gecmisi gorunmeli, kronik sorunlar tespit edilmeli."
 *
 * Eslestirme onceligi: InternalSerialNum > ManufacturerSerialNum > (ItemCode + CustomerCode)
 * Kronik uyari: son 6 ayda 2+ ariza (CallType=1) kaydi.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { id } = await params;
    const sap = getSAPClient();

    const servis = await sap.get<SAPServiceCall & { ManufacturerSerialNum?: string }>(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`,
    );

    // Eslestirme filtresi kur
    let filter = '';
    let eslesmeTuru = '';
    if (servis.InternalSerialNum) {
      filter = `InternalSerialNum eq '${servis.InternalSerialNum}'`;
      eslesmeTuru = 'Dahili Seri No';
    } else if (servis.ManufacturerSerialNum) {
      filter = `ManufacturerSerialNum eq '${servis.ManufacturerSerialNum}'`;
      eslesmeTuru = 'Üretici Seri No';
    } else if (servis.ItemCode && servis.CustomerCode) {
      filter = `ItemCode eq '${servis.ItemCode}' and CustomerCode eq '${servis.CustomerCode}'`;
      eslesmeTuru = 'Ürün + Müşteri';
    } else {
      // Eslestirilecek cihaz bilgisi yok
      return NextResponse.json({ value: [], kronik: false, eslesmeTuru: null });
    }

    const gecmis = await sap.getList<SAPServiceCall>(SAP_ENDPOINTS.SERVICE_CALLS, {
      $filter: filter,
      $select: 'ServiceCallID,Subject,CallType,Status,Priority,CreateDate,CloseDate,Resolution,ProblemType',
      $orderby: 'CreateDate desc',
      $top: 50,
    });

    // Bu servisin kendisini cikar
    const digerKayitlar = gecmis.filter((g) => String(g.ServiceCallID) !== String(id));

    // Kronik kontrol: son 6 ayda ariza (CallType=1) sayisi
    const altiAyOnce = new Date();
    altiAyOnce.setMonth(altiAyOnce.getMonth() - 6);
    const sonArizalar = digerKayitlar.filter((g) => {
      if (g.CallType !== 1) return false;
      const tarih = new Date(g.CreateDate);
      return !isNaN(tarih.getTime()) && tarih >= altiAyOnce;
    });
    const kronik = sonArizalar.length >= 2;

    return NextResponse.json({
      value: digerKayitlar,
      kronik,
      kronikSayi: sonArizalar.length,
      eslesmeTuru,
      cihaz: {
        itemCode: servis.ItemCode,
        itemDescription: servis.ItemDescription,
        serialNum: servis.InternalSerialNum || servis.ManufacturerSerialNum || '',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
