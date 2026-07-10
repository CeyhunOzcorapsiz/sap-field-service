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
    const search = searchParams.get('search');
    const top = searchParams.get('top') || '20';

    const filters = ["CardType eq 'C'"];
    if (search) {
      // SAP contains() büyük/küçük harfe DUYARLI ve kart adları büyük harf;
      // toupper() Service Layer'da yok. Bu yüzden terimi Türkçe locale ile
      // büyük harfe çevirip arıyoruz (ad + kod). Tek tırnak kaçışı.
      const q = search.toLocaleUpperCase('tr-TR').replace(/'/g, "''");
      filters.push(`(contains(CardName,'${q}') or contains(CardCode,'${q}'))`);
    }

    const sap = getSAPClient();
    const partners = await sap.getList(SAP_ENDPOINTS.BUSINESS_PARTNERS, {
      $top: parseInt(top),
      $select: 'CardCode,CardName,Phone1,Phone2,EmailAddress,Address,City',
      $filter: filters.join(' and '),
      $orderby: 'CardName asc',
    });

    return NextResponse.json({ value: partners });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
