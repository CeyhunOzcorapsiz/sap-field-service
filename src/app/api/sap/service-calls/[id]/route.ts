import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

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
    const serviceCall = await sap.get(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`,
    );

    return NextResponse.json(serviceCall);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const sap = getSAPClient();
    await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, body);

    // SAP PATCH 204 dondurur, guncel kaydi tekrar cek
    const updated = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
