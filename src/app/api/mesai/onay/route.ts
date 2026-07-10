import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types/auth';
import { getHaftaOnaylari, getOnay, setOnay, MesaiOnayKaydi } from '@/lib/server/mesai-onay-store';
import { haftaninPazartesisi } from '@/lib/utils/timesheet';

/**
 * GET - Haftanin onay durumlari. Query: start=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const baz = startParam ? new Date(`${startParam}T00:00:00`) : new Date();
    const hafta = haftaninPazartesisi(isNaN(baz.getTime()) ? new Date() : baz);

    const onaylar = await getHaftaOnaylari(hafta);
    return NextResponse.json({ value: onaylar });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Sunucu hatasi' },
      { status: 500 },
    );
  }
}

/**
 * POST - Onay aksiyonu.
 * Body: { haftaBaslangic, employeeId, aksiyon: 'gonder' | 'onayla' | 'reddet', not? }
 * gonder: teknisyen kendi haftasini onaya yollar
 * onayla/reddet: BOLGE_SORUMLUSU veya YONETIM
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { haftaBaslangic, employeeId, aksiyon, not } = body;

    if (!haftaBaslangic || !employeeId || !aksiyon) {
      return NextResponse.json({ message: 'Eksik parametre' }, { status: 400 });
    }

    const simdi = new Date().toISOString();
    const mevcut = await getOnay(haftaBaslangic, Number(employeeId));

    if (aksiyon === 'gonder') {
      if (mevcut?.durum === 'ONAYLANDI') {
        return NextResponse.json(
          { message: 'Onaylanmış hafta tekrar gönderilemez' },
          { status: 409 },
        );
      }
      const kayit: MesaiOnayKaydi = {
        haftaBaslangic,
        employeeId: Number(employeeId),
        durum: 'ONAYA_GONDERILDI',
        gonderen: user.fullName,
        gonderiTarihi: simdi,
      };
      return NextResponse.json(await setOnay(kayit));
    }

    if (aksiyon === 'onayla' || aksiyon === 'reddet') {
      const yetkili =
        user.role === UserRole.BOLGE_SORUMLUSU || user.role === UserRole.YONETIM;
      if (!yetkili) {
        return NextResponse.json(
          { message: 'Bu işlem için yetkiniz yok' },
          { status: 403 },
        );
      }
      const kayit: MesaiOnayKaydi = {
        haftaBaslangic,
        employeeId: Number(employeeId),
        durum: aksiyon === 'onayla' ? 'ONAYLANDI' : 'REDDEDILDI',
        gonderen: mevcut?.gonderen,
        gonderiTarihi: mevcut?.gonderiTarihi,
        onaylayan: user.fullName,
        onayTarihi: simdi,
        not: not || undefined,
      };
      return NextResponse.json(await setOnay(kayit));
    }

    return NextResponse.json({ message: 'Geçersiz aksiyon' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Sunucu hatasi' },
      { status: 500 },
    );
  }
}
