import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const filters: string[] = [];
    // Department, SAP'de sayisal (Edm.Int32) bir alan; tirnak ile sorgu
    // "not a NUMBER" hatasi verir, bu yuzden tirnaksiz ve sayi dogrulamali.
    if (department && /^-?\d+$/.test(department)) {
      filters.push(`Department eq ${department}`);
    }
    if (activeOnly) {
      filters.push("Active eq 'tYES'");
    }

    const sap = getSAPClient();
    // getListAll: SAP varsayilan 20'lik sayfayi asip tum calisanlari ceker
    // (atama dropdown'lari, isim cozumleme vb. icin tam liste sart).
    const employees = await sap.getListAll(SAP_ENDPOINTS.EMPLOYEES, {
      $select: 'EmployeeID,FirstName,LastName,Department,Position,MobilePhone,eMail,ApplicationUserID',
      $filter: filters.length > 0 ? filters.join(' and ') : undefined,
      $orderby: 'FirstName asc',
    });

    return NextResponse.json({ value: employees });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
