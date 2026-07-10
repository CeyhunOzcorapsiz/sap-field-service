import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

/**
 * GET - Bir musterinin ekipman/seri kartlari (CustomerEquipmentCards).
 * Yeni hizmet cagrisi ekraninda kalem + seri numarasi secimi icin kullanilir.
 * ?customer=CardCode zorunlu.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customer = searchParams.get('customer');
    if (!customer) {
      return NextResponse.json({ value: [] });
    }

    const sap = getSAPClient();
    const cards = await sap.getListAll(SAP_ENDPOINTS.EQUIPMENT_CARDS, {
      $select:
        'EquipmentCardNum,ItemCode,ItemDescription,InternalSerialNum,ManufacturerSerialNum,StatusOfSerialNumber',
      $filter: `CustomerCode eq '${customer}'`,
      $orderby: 'ItemDescription asc',
    });

    return NextResponse.json({ value: cards });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
