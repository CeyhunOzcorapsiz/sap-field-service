import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

/**
 * GET - Bu hizmet çağrısına bağlı belgeler (U_HIZMET_CAGRISI UDF'i ile):
 * satış siparişleri ve mal çıkışları. Detay ekranındaki "Bu çağrının
 * belgeleri" bölümü + raporlama için.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const callId = parseInt(id);
    const sap = getSAPClient();

    // U_HIZMET_CAGRISI sayısal UDF -> tırnaksız filtre.
    const [orders, goodsIssues] = await Promise.all([
      sap
        .getList<{ DocEntry: number; DocNum: number; DocTotal: number; DocDate: string; Cancelled: string }>(
          SAP_ENDPOINTS.ORDERS,
          {
            $filter: `U_HIZMET_CAGRISI eq ${callId}`,
            $select: 'DocEntry,DocNum,DocTotal,DocDate,Cancelled',
            $orderby: 'DocEntry desc',
          },
        )
        .catch(() => []),
      sap
        .getList<{
          DocEntry: number;
          DocNum: number;
          DocDate: string;
          Comments: string;
          Cancelled: string;
          DocumentLines?: Array<{ ItemCode: string; ItemDescription: string; Quantity: number }>;
        }>(SAP_ENDPOINTS.INVENTORY_GEN_EXITS, {
          $filter: `U_HIZMET_CAGRISI eq ${callId}`,
          $select: 'DocEntry,DocNum,DocDate,Comments,Cancelled,DocumentLines',
          $orderby: 'DocEntry desc',
        })
        .catch(() => []),
    ]);

    return NextResponse.json({ orders, goodsIssues });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
