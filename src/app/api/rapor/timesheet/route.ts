import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';
import { getWeeklyTimeSheet } from '@/lib/server/timesheet-data';
import { haftaninPazartesisi } from '@/lib/utils/timesheet';

/**
 * GET - Haftalik time sheet (JSON).
 * Query: start=YYYY-MM-DD (haftanin herhangi bir gunu; pazartesiye yuvarlanir),
 *        employeeId (opsiyonel, tek teknisyen)
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const employeeId = searchParams.get('employeeId');

    const baz = startParam ? new Date(`${startParam}T00:00:00`) : new Date();
    if (isNaN(baz.getTime())) {
      return NextResponse.json({ message: 'Geçersiz tarih' }, { status: 400 });
    }
    const haftaBaslangic = haftaninPazartesisi(baz);

    const timesheet = await getWeeklyTimeSheet(
      haftaBaslangic,
      employeeId ? parseInt(employeeId) : undefined,
    );

    return NextResponse.json(timesheet);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
