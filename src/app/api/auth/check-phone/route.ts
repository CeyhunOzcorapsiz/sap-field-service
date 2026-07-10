import { NextRequest, NextResponse } from 'next/server';
import { findEmployeeByPhone } from '@/lib/server/employee-auth';
import { hasPin } from '@/lib/server/pin-store';
import { CheckPhoneResponse } from '@/types/auth';

/**
 * Giris ekrani 1. adimi: telefon girilince calisan var mi ve PIN tanimli mi?
 * Ekran buna gore "PIN gir" veya "PIN olustur" adimini gosterir.
 * Public uctur (giris oncesi cagrilir).
 */
export async function POST(request: NextRequest) {
  try {
    const { phone } = (await request.json()) as { phone?: string };
    if (!phone) {
      return NextResponse.json({ found: false, hasPin: false } satisfies CheckPhoneResponse);
    }

    const eslesme = await findEmployeeByPhone(phone);

    if (eslesme === null || 'ambiguous' in eslesme) {
      return NextResponse.json({ found: false, hasPin: false } satisfies CheckPhoneResponse);
    }

    const pinVar = await hasPin(eslesme.employeeId);
    return NextResponse.json({
      found: true,
      hasPin: pinVar,
      fullName: eslesme.fullName,
    } satisfies CheckPhoneResponse);
  } catch {
    return NextResponse.json({ found: false, hasPin: false } satisfies CheckPhoneResponse);
  }
}
