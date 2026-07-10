import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';
import { getImzalar } from '@/lib/server/imza-store';

/**
 * GET - Servisin teknisyen + müşteri imzaları (data URL). Servis formuna basmak için.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(await getImzalar(parseInt(id)));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Hata' },
      { status: 500 },
    );
  }
}
