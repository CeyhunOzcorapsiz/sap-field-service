import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  const payload = getUserFromToken(request);

  if (!payload) {
    return NextResponse.json({ message: 'Oturum bulunamadı' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: payload.userId,
      userName: payload.userName,
      fullName: payload.fullName,
      role: payload.role,
      region: payload.region,
      email: payload.email ?? '',
    },
  });
}
