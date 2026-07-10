import { UserRole } from '@/types/auth';

/**
 * SAP EmployeesInfo.Department (sayisal kod) -> uygulama rolu eslemesi.
 *
 * SAP departman kodlari:
 *   1 Genel | 2 Depo | 3 Yonetim Kurulu | 4 IT | 5 Ithalat/Ihracat
 *   6 Lojistik | 7 Mali Isler | 8 Satis & Pazarlama | 9 Teknik Servis
 *
 * Karar (kullanici onayli):
 *   9 -> TEKNISYEN, 3 -> YONETIM, 2 -> SIPARIS_YONETIMI, digeri -> TEKNISYEN.
 *
 * BOLGE_SORUMLUSU departmandan turetilemiyor; ileride elle atanir
 * (config/UDT). Bu yuzden burada uretilmez.
 */
const DEPARTMENT_ROLE_MAP: Record<number, UserRole> = {
  9: UserRole.TEKNISYEN,
  3: UserRole.YONETIM,
  2: UserRole.SIPARIS_YONETIMI,
};

export function departmentToRole(department: number | null | undefined): UserRole {
  if (department == null) return UserRole.TEKNISYEN;
  return DEPARTMENT_ROLE_MAP[department] ?? UserRole.TEKNISYEN;
}

/**
 * SAP EmployeesInfo'daki U_ROL UDF'inden uygulama rolü. İK her çalışana rolü
 * buradan seçer; boş/tanımsızsa departmana göre varsayılan kullanılır.
 * Kabul edilen değerler (büyük/küçük harf duyarsız) - hem kısa hem tam form:
 *   TEKNISYEN | BOLGE / BOLGE_SORUMLUSU | YONETIM | SIPARIS / SIPARIS_YONETIMI
 */
const UDF_ROLE_MAP: Record<string, UserRole> = {
  TEKNISYEN: UserRole.TEKNISYEN,
  BOLGE: UserRole.BOLGE_SORUMLUSU,
  BOLGE_SORUMLUSU: UserRole.BOLGE_SORUMLUSU,
  YONETIM: UserRole.YONETIM,
  SIPARIS: UserRole.SIPARIS_YONETIMI,
  SIPARIS_YONETIMI: UserRole.SIPARIS_YONETIMI,
};

export function resolveRole(
  udfRol: string | null | undefined,
  department: number | null | undefined,
): UserRole {
  const key = (udfRol ?? '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '_');
  return UDF_ROLE_MAP[key] ?? departmentToRole(department);
}

/**
 * EmployeesInfo'da bolge bilgisi yok. Simdilik departman adini bolge yerine
 * gosteriyoruz; gercek bolge eslemesi netlesince burasi guncellenir.
 */
const DEPARTMENT_NAMES: Record<number, string> = {
  1: 'Genel',
  2: 'Depo',
  3: 'Yönetim Kurulu',
  4: 'IT',
  5: 'İthalat ve İhracat',
  6: 'Lojistik',
  7: 'Mali İşler',
  8: 'Satış & Pazarlama',
  9: 'Teknik Servis',
};

export function departmentToRegion(department: number | null | undefined): string {
  if (department == null) return 'Genel';
  return DEPARTMENT_NAMES[department] ?? 'Genel';
}
