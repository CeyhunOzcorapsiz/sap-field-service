export enum UserRole {
  TEKNISYEN = 'TEKNISYEN',
  BOLGE_SORUMLUSU = 'BOLGE_SORUMLUSU',
  YONETIM = 'YONETIM',
  SIPARIS_YONETIMI = 'SIPARIS_YONETIMI',
}

export interface User {
  id: number;
  userName: string;
  fullName: string;
  role: UserRole;
  region: string;
  email: string;
}

export interface JWTPayload {
  userId: number;
  userName: string;
  fullName: string;
  role: UserRole;
  region: string;
  email?: string;
  /** SAP kullanici InternalKey'i (OUSR). null ise teknisyenin SAP kullanicisi yok. */
  applicationUserId?: number | null;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  /** Teknisyenin cep telefonu (SAP EmployeesInfo.MobilePhone ile eslesir) */
  phone: string;
  /** Mevcut PIN (normal giris) */
  pin?: string;
  /** Ilk giriste / sifirlama sonrasi belirlenen yeni PIN */
  newPin?: string;
}

/** /api/auth/check-phone yaniti - giris ekraninin adim secimi icin */
export interface CheckPhoneResponse {
  found: boolean;
  hasPin: boolean;
  fullName?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Permission {
  resource: string;
  actions: string[];
}
