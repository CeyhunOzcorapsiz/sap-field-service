import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const sap = getSAPClient();
    const warehouses = await sap.getList(SAP_ENDPOINTS.WAREHOUSES, {
      $select: 'WarehouseCode,WarehouseName,City,Country',
      $orderby: 'WarehouseName asc',
    });

    return NextResponse.json({ value: warehouses });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
