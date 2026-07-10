import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, requireRole } from '@/lib/auth/jwt';
import { resetPin } from '@/lib/server/pin-store';
import { UserRole } from '@/types/auth';

/**
 * Admin PIN sifirlama.
 *
 * Yonetim / Bolge Sorumlusu, PIN'ini unutan teknisyenin kaydini siler;
 * teknisyen sonraki giriste yeni PIN belirler. Ayarlar ekranindan cagrilir.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    try {
      requireRole(user, UserRole.YONETIM, UserRole.BOLGE_SORUMLUSU);
    } catch (e) {
      return NextResponse.json(
        { message: e instanceof Error ? e.message : 'Yetkisiz' },
        { status: 403 },
      );
    }

    const { employeeId } = (await request.json()) as { employeeId?: number };
    if (!employeeId || Number.isNaN(Number(employeeId))) {
      return NextResponse.json({ message: 'Geçerli bir EmployeeID gerekli' }, { status: 400 });
    }

    await resetPin(Number(employeeId));
    return NextResponse.json({ message: 'PIN sıfırlandı. Teknisyen sonraki girişte yeni PIN belirleyecek.' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    );
  }
}
