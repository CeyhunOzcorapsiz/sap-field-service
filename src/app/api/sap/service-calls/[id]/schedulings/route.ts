import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';
import { getLines, patchLines, yeniSatir, durToDakika } from '@/lib/server/scl6';

const ymd = (s: string | null | undefined) => (s ? s.split('T')[0] : '');
const hm = (s: string | null | undefined) => (s ? s.slice(0, 5) : '');

/**
 * Servis çağrısının SCL6 çizelgesi = atanan teknisyenler + düzenlenebilir süre
 * (ServiceCallSchedulings). Birden fazla teknisyen atanabilir. Ekleme,
 * yeniden atama ve SÜRE düzenleme desteklenir; silme SAP Service Layer ile
 * mümkün değil. Yardımcılar: [[scl6]].
 */

/** GET - atanan teknisyenler (id + dakika cinsi süre). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const lines = await getLines(parseInt(id));
    return NextResponse.json({
      value: lines.map((l) => ({
        lineNum: l.LineNum,
        technicianId: l.Technician,
        startDate: ymd(l.StartDate), // YYYY-MM-DD
        startTime: hm(l.StartTime), // HH:mm
        endDate: ymd(l.EndDate),
        endTime: hm(l.EndTime),
        actualDakika: durToDakika(l.ActualDuration, l.ActualDurationType),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

/** POST - teknisyen ata (yeni SCL6 satırı). Body: { technicianId } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const callId = parseInt(id);
    const { technicianId } = (await request.json()) as { technicianId?: number };
    if (!technicianId) {
      return NextResponse.json({ message: 'Teknisyen seçilmedi' }, { status: 400 });
    }

    const lines = await getLines(callId);
    if (lines.some((l) => l.Technician === technicianId)) {
      return NextResponse.json({ message: 'Bu teknisyen zaten atanmış' }, { status: 409 });
    }

    await patchLines(callId, [...lines, yeniSatir(technicianId)]);
    return NextResponse.json({ message: 'Teknisyen atandı' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

/**
 * PATCH - satır güncelle. İki mod:
 *  - Yeniden atama:  { lineNum, technicianId }
 *  - Çizelge düzenleme: { lineNum, startDate, startTime, endDate, endTime, actualDakika }
 *    (SAP standart alanları; U_BASLANGIC/U_BITIS'e DOKUNULMAZ — cleanLine korur)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const callId = parseInt(id);
    const body = (await request.json()) as {
      lineNum?: number;
      technicianId?: number;
      startDate?: string; // YYYY-MM-DD
      startTime?: string; // HH:mm
      endDate?: string;
      endTime?: string;
      actualDakika?: number;
    };
    if (body.lineNum == null) {
      return NextResponse.json({ message: 'Satır belirtilmedi' }, { status: 400 });
    }

    const lines = await getLines(callId);

    // Çizelge alanları düzenleme (StartDate/StartTime/EndDate/EndTime/ActualDuration)
    const cizelgeDuzenleme =
      body.startDate != null ||
      body.startTime != null ||
      body.endDate != null ||
      body.endTime != null ||
      body.actualDakika != null;
    if (cizelgeDuzenleme) {
      const yeni = lines.map((l) => {
        if (l.LineNum !== body.lineNum) return l;
        const g = { ...l };
        if (body.startDate) g.StartDate = `${body.startDate}T00:00:00Z`;
        if (body.startTime) g.StartTime = `${body.startTime}:00`;
        if (body.endDate) g.EndDate = `${body.endDate}T00:00:00Z`;
        if (body.endTime) g.EndTime = `${body.endTime}:00`;
        if (body.actualDakika != null) {
          g.ActualDuration = Math.max(0, Math.round(body.actualDakika));
          g.ActualDurationType = 'du_Minuts';
        }
        // SAP: planlanan Duration, start/end zamanıyla uyuşmalı
        const sdt = new Date(`${(g.StartDate || '').split('T')[0]}T${g.StartTime || '00:00:00'}`);
        const edt = new Date(`${(g.EndDate || '').split('T')[0]}T${g.EndTime || '00:00:00'}`);
        if (!Number.isNaN(sdt.getTime()) && !Number.isNaN(edt.getTime()) && edt > sdt) {
          g.Duration = Math.round((edt.getTime() - sdt.getTime()) / 60000);
          g.DurationType = 'du_Minuts';
        }
        return g;
      });
      await patchLines(callId, yeni);
      return NextResponse.json({ message: 'Çizelge güncellendi' });
    }

    // Yeniden atama
    if (body.technicianId != null) {
      if (lines.some((l) => l.Technician === body.technicianId && l.LineNum !== body.lineNum)) {
        return NextResponse.json({ message: 'Bu teknisyen zaten atanmış' }, { status: 409 });
      }
      const yeni = lines.map((l) =>
        l.LineNum === body.lineNum ? { ...l, Technician: body.technicianId! } : l,
      );
      await patchLines(callId, yeni);
      return NextResponse.json({ message: 'Atama güncellendi' });
    }

    return NextResponse.json({ message: 'Geçersiz istek' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
