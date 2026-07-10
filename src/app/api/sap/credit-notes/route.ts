import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

interface SAPCreditNote {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocTotal: number;
  Comments: string;
}

/**
 * GET - Tedarikci kredi notlari (garanti eslestirmesi icin).
 * Excel #17: "Tedarikcinin gonderdigi kredi notu ve servis formu eslesmeli."
 * Query: cardCode? (tedarikci), search? (DocNum/aciklama)
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardCode = searchParams.get('cardCode');
    const search = searchParams.get('search');

    const filters: string[] = [];
    if (cardCode) filters.push(`CardCode eq '${cardCode}'`);
    if (search) {
      const n = parseInt(search);
      if (!isNaN(n)) filters.push(`DocNum eq ${n}`);
      else filters.push(`contains(CardName,'${search}')`);
    }

    const sap = getSAPClient();
    const krediNotlari = await sap.getList<SAPCreditNote>(SAP_ENDPOINTS.CREDIT_NOTES, {
      $select: 'DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal,Comments',
      $filter: filters.length > 0 ? filters.join(' and ') : undefined,
      $orderby: 'DocDate desc',
      $top: 20,
    });

    return NextResponse.json({ value: krediNotlari });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
