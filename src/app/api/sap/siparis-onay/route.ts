import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPServiceCall, SAPServiceCallStatus } from '@/types/sap';

/**
 * GET - Onay bekleyen servisler (Status = Beklemede / -2).
 * Excel #18: Siparis Yonetimi onay ekrani.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const sap = getSAPClient();
    const bekleyenler = await sap.getList<SAPServiceCall>(SAP_ENDPOINTS.SERVICE_CALLS, {
      $filter: `Status eq ${SAPServiceCallStatus.PENDING}`,
      $orderby: 'CreateDate desc',
      $top: 100,
    });

    return NextResponse.json({ value: bekleyenler });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
