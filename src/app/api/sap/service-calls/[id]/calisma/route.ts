import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';
import { getLines, setTechnicianTime, suAnSaat } from '@/lib/server/scl6';

/**
 * Gerçek çalışma saatleri (İşe Başla / İşi Bitir).
 * - SCL6 satırındaki DEĞİŞTİRİLEMEZ UDF'lere yazılır: U_BASLANGIC / U_BITIS
 *   (Edm.Time "HH:mm:ss"). Sadece bu uçlarla set edilir; kullanıcı düzenleyemez.
 * - SCL6 süresinden (Duration) ve fiili sürelerden BAĞIMSIZDIR.
 * Teknisyen = giriş yapan kullanıcı (EmployeeID = token.userId).
 * "Devam eden iş" = U_BASLANGIC dolu, U_BITIS boş.
 */

/** GET - çağrıdaki teknisyenlerin gerçek başla/bitiş saatleri (SCL6 UDF'lerinden). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const lines = await getLines(parseInt(id));
    return NextResponse.json({
      value: lines
        .filter((l) => l.Technician != null)
        .map((l) => ({
          technicianId: l.Technician,
          baslangic: l.U_BASLANGIC ?? null,
          bitis: l.U_BITIS ?? null,
        })),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Hata' },
      { status: 500 },
    );
  }
}

/** POST - İşe Başla: U_BASLANGIC = şu anki saat (bir kez, değiştirilemez). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const callId = parseInt(id);

    const lines = await getLines(callId);
    const line = lines.find((l) => l.Technician === user.userId);
    if (line?.U_BASLANGIC) {
      return NextResponse.json(
        { message: line.U_BITIS ? 'Bu çağrıda işi zaten tamamladınız' : 'Zaten devam eden bir işiniz var' },
        { status: 409 },
      );
    }

    await setTechnicianTime(callId, user.userId, 'U_BASLANGIC', suAnSaat());
    return NextResponse.json({ message: 'İş başlatıldı' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Hata' },
      { status: 500 },
    );
  }
}

/** PATCH - İşi Bitir: U_BITIS = şu anki saat (bir kez, değiştirilemez). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const callId = parseInt(id);

    const lines = await getLines(callId);
    const line = lines.find((l) => l.Technician === user.userId);
    if (!line?.U_BASLANGIC) {
      return NextResponse.json({ message: 'Önce işe başlamalısınız' }, { status: 409 });
    }
    if (line.U_BITIS) {
      return NextResponse.json({ message: 'İş zaten bitirilmiş' }, { status: 409 });
    }

    await setTechnicianTime(callId, user.userId, 'U_BITIS', suAnSaat());
    return NextResponse.json({ message: 'İş bitirildi' });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Hata' },
      { status: 500 },
    );
  }
}
