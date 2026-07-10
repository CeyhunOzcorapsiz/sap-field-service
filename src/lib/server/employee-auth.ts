import { getSAPClient } from '@/lib/sap/client';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { normalizePhone } from '@/lib/utils/phone';
import { departmentToRole, departmentToRegion } from '@/lib/auth/role-mapping';
import { UserRole } from '@/types/auth';

interface SAPEmployee {
  EmployeeID: number;
  FirstName: string | null;
  LastName: string | null;
  MobilePhone: string | null;
  eMail: string | null;
  Department: number | null;
  Active: string; // "tYES" | "tNO"
  ApplicationUserID: number | null; // dolu ise calisan ayni zamanda SAP kullanicisi
}

export interface AuthEmployee {
  employeeId: number;
  fullName: string;
  email: string;
  role: UserRole;
  region: string;
  /** SAP kullanici InternalKey'i (OUSR). null ise calisanin SAP kullanicisi yok. */
  applicationUserId: number | null;
}

function toAuthEmployee(e: SAPEmployee): AuthEmployee {
  const ad = [e.FirstName, e.LastName].filter(Boolean).join(' ').trim();
  return {
    employeeId: e.EmployeeID,
    fullName: ad || `Çalışan #${e.EmployeeID}`,
    email: e.eMail ?? '',
    role: departmentToRole(e.Department),
    region: departmentToRegion(e.Department),
    applicationUserId: e.ApplicationUserID ?? null,
  };
}

/**
 * Telefon numarasiyla aktif calisani bulur.
 *
 * SAP'deki telefon bicimi tutarsiz olabildiginden filtreleme OData'da degil,
 * normalize edilmis bicim uzerinden JS tarafinda yapilir (~30 kayit, ucuz).
 *
 * Donus:
 *  - null            -> eslesme yok
 *  - { ambiguous }   -> birden fazla calisan ayni numaraya sahip
 *  - AuthEmployee    -> tek eslesme
 */
export async function findEmployeeByPhone(
  phone: string,
): Promise<AuthEmployee | { ambiguous: true } | null> {
  const hedef = normalizePhone(phone);
  if (!hedef) return null;

  const sap = getSAPClient();
  const BASE_SELECT = 'EmployeeID,FirstName,LastName,MobilePhone,eMail,Department,Active,ApplicationUserID';

  const employees = await sap.getListAll<SAPEmployee>(SAP_ENDPOINTS.EMPLOYEES, {
    $select: BASE_SELECT,
    $filter: "Active eq 'tYES'",
  });

  const eslesenler = employees.filter((e) => normalizePhone(e.MobilePhone) === hedef);

  if (eslesenler.length === 0) return null;
  if (eslesenler.length > 1) return { ambiguous: true };
  return toAuthEmployee(eslesenler[0]);
}
