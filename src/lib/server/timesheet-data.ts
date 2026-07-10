import { getSAPClient } from '@/lib/sap/client';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPActivity, SAPEmployee, SAPBusinessPartner } from '@/types/sap';
import { buildTimeSheet, tarihEkle, HaftalikTimeSheet } from '@/lib/utils/timesheet';

const SERVICE_CALL_OBJECT_TYPE = '191';

/**
 * Bir haftanin time sheet verisini SAP'den toplar:
 * aktiviteler + calisanlar + musteri adlari -> hesaplanmis matris.
 */
export async function getWeeklyTimeSheet(
  haftaBaslangic: string,
  employeeId?: number,
): Promise<HaftalikTimeSheet> {
  const sap = getSAPClient();
  const haftaBitis = tarihEkle(haftaBaslangic, 6);

  const filters = [
    `StartDate ge '${haftaBaslangic}'`,
    `StartDate le '${haftaBitis}'`,
    `ParentObjectType eq '${SERVICE_CALL_OBJECT_TYPE}'`,
  ];
  if (employeeId) {
    filters.push(`HandledByEmployee eq ${employeeId}`);
  }

  const [activities, employees] = await Promise.all([
    sap.getList<SAPActivity>(SAP_ENDPOINTS.ACTIVITIES, {
      $filter: filters.join(' and '),
      $orderby: 'StartDate asc',
      $top: 500,
    }),
    sap
      .getList<SAPEmployee>(SAP_ENDPOINTS.EMPLOYEES, {
        $select: 'EmployeeID,FirstName,LastName,Department',
      })
      .catch(() => [] as SAPEmployee[]),
  ]);

  // Musteri adlarini coz
  const cardCodes = Array.from(new Set(activities.map((a) => a.CardCode).filter(Boolean)));
  const bpAdlari: Record<string, string> = {};
  if (cardCodes.length > 0) {
    const bpFilter = cardCodes.map((c) => `CardCode eq '${c}'`).join(' or ');
    const partners = await sap
      .getList<SAPBusinessPartner>(SAP_ENDPOINTS.BUSINESS_PARTNERS, {
        $select: 'CardCode,CardName',
        $filter: bpFilter,
      })
      .catch(() => [] as SAPBusinessPartner[]);
    for (const bp of partners) {
      bpAdlari[bp.CardCode] = bp.CardName;
    }
  }

  return buildTimeSheet(activities, employees, bpAdlari, haftaBaslangic);
}
