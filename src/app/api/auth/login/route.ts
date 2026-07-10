import { NextRequest, NextResponse } from 'next/server';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth/jwt';
import { findEmployeeByPhone } from '@/lib/server/employee-auth';
import { hasPin, setPin, verifyPin } from '@/lib/server/pin-store';
import { LoginRequest } from '@/types/auth';

const PIN_REGEX = /^\d{4}$/;

function issueTokens(payload: {
  userId: number;
  userName: string;
  fullName: string;
  role: import('@/types/auth').UserRole;
  region: string;
  email?: string;
  applicationUserId?: number | null;
}) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({
    userId: payload.userId,
    userName: payload.userName,
  });

  const user = {
    id: payload.userId,
    userName: payload.userName,
    fullName: payload.fullName,
    role: payload.role,
    region: payload.region,
    email: payload.email ?? '',
  };

  const response = NextResponse.json({ user, accessToken });

  response.cookies.set('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 gün
    path: '/',
  });
  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60, // 60 gün
    path: '/',
  });

  return response;
}

/**
 * Telefon + PIN ile giris.
 *
 * Akis:
 *  1. Telefonla SAP EmployeesInfo'dan aktif calisani bul (gercek EmployeeID).
 *  2. PIN tanimli degilse -> { needsPinSetup: true } don (ekran PIN olusturma
 *     adimina gecer). Istemci newPin gonderirse PIN'i kaydet ve giris yaptir.
 *  3. PIN tanimliysa -> pin'i dogrula, giris yaptir.
 *
 * JWT'deki userId = SAP EmployeeID; boylece mesai/aktivite dogru teknisyene
 * yazilir.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequest;
    const { phone, pin, newPin } = body;

    if (!phone || phone.trim().length === 0) {
      return NextResponse.json({ message: 'Telefon numarası gerekli' }, { status: 400 });
    }

    const eslesme = await findEmployeeByPhone(phone);

    if (eslesme === null) {
      return NextResponse.json(
        { message: 'Bu numarayla kayıtlı aktif çalışan bulunamadı' },
        { status: 401 },
      );
    }
    if ('ambiguous' in eslesme) {
      return NextResponse.json(
        { message: 'Bu numara birden fazla çalışana tanımlı. Yöneticinizle görüşün.' },
        { status: 409 },
      );
    }

    const employee = eslesme;
    const pinTanimli = await hasPin(employee.employeeId);

    // Ilk giris / sifirlama sonrasi: PIN olusturma
    if (!pinTanimli) {
      if (!newPin) {
        return NextResponse.json({ needsPinSetup: true, fullName: employee.fullName });
      }
      if (!PIN_REGEX.test(newPin)) {
        return NextResponse.json({ message: 'PIN 4 haneli olmalı' }, { status: 400 });
      }
      await setPin(employee.employeeId, newPin);
      return issueTokens({
        userId: employee.employeeId,
        userName: employee.email || String(employee.employeeId),
        fullName: employee.fullName,
        role: employee.role,
        region: employee.region,
        email: employee.email,
        applicationUserId: employee.applicationUserId,
      });
    }

    // Normal giris: PIN dogrulama
    if (!pin) {
      return NextResponse.json({ message: 'PIN gerekli' }, { status: 400 });
    }
    const dogru = await verifyPin(employee.employeeId, pin);
    if (!dogru) {
      return NextResponse.json({ message: 'PIN hatalı' }, { status: 401 });
    }

    return issueTokens({
      userId: employee.employeeId,
      userName: employee.email || String(employee.employeeId),
      fullName: employee.fullName,
      role: employee.role,
      region: employee.region,
      email: employee.email,
      applicationUserId: employee.applicationUserId,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ message: 'Çıkış yapıldı' });
  response.cookies.delete('accessToken');
  response.cookies.delete('refreshToken');
  return response;
}
