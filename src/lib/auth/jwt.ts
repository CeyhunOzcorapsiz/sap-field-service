import jwt from 'jsonwebtoken';
import { JWTPayload, UserRole } from '@/types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '30d';
const REFRESH_TOKEN_EXPIRY = '60d';

export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: Pick<JWTPayload, 'userId' | 'userName'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): Pick<JWTPayload, 'userId' | 'userName'> | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as Pick<JWTPayload, 'userId' | 'userName'>;
  } catch {
    return null;
  }
}

export function getUserFromToken(request: Request): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    const cookie = request.headers.get('cookie');
    const token = cookie
      ?.split(';')
      .find((c) => c.trim().startsWith('accessToken='))
      ?.split('=')[1];
    if (!token) return null;
    return verifyAccessToken(token);
  }
  return verifyAccessToken(authHeader.slice(7));
}

export function requireRole(user: JWTPayload | null, ...roles: UserRole[]): JWTPayload {
  if (!user) {
    throw new Error('Oturum açmanız gerekiyor');
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new Error('Bu işlem için yetkiniz yok');
  }
  return user;
}
