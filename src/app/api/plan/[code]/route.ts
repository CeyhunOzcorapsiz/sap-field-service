import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types/auth';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

/**
 * DELETE - Plan kaydini siler (SAP Activity Cancel).
 * Sadece BOLGE_SORUMLUSU ve YONETIM.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }
    if (user.role !== UserRole.BOLGE_SORUMLUSU && user.role !== UserRole.YONETIM) {
      return NextResponse.json({ message: 'Yetkiniz yok' }, { status: 403 });
    }

    const { code } = await params;
    const sap = getSAPClient();

    // SAP'de Activity silinemez; Cancel servisiyle iptal edilir
    try {
      await sap.post(`${SAP_ENDPOINTS.ACTIVITIES}(${code})/Cancel`, {});
    } catch {
      // Cancel servisi yoksa Closed olarak isaretle
      await sap.patch(`${SAP_ENDPOINTS.ACTIVITIES}(${code})`, { Closed: 'tYES' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
