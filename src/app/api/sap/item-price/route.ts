import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

interface ItemPrice {
  PriceList: number;
  Price: number;
  Currency: string | null;
}

/**
 * GET - Bir kalemin, müşterinin fiyat listesindeki birim fiyatı.
 * Satış siparişi ekranında fiyat ön-doldurması için.
 * ?itemCode=...&cardCode=...
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const itemCode = searchParams.get('itemCode');
    const cardCode = searchParams.get('cardCode');
    if (!itemCode) return NextResponse.json({ price: 0, currency: null });

    const sap = getSAPClient();

    // Müşterinin fiyat listesi (yoksa 1)
    let priceListNum = 1;
    if (cardCode) {
      const bps = await sap.getList<{ PriceListNum: number }>(SAP_ENDPOINTS.BUSINESS_PARTNERS, {
        $select: 'PriceListNum',
        $filter: `CardCode eq '${cardCode}'`,
        $top: 1,
      });
      if (bps[0]?.PriceListNum) priceListNum = bps[0].PriceListNum;
    }

    const items = await sap.getList<{ ItemPrices: ItemPrice[] }>(SAP_ENDPOINTS.ITEMS, {
      $select: 'ItemCode,ItemPrices',
      $filter: `ItemCode eq '${itemCode.replace(/'/g, "''")}'`,
      $top: 1,
    });
    const fiyatlar = items[0]?.ItemPrices ?? [];
    const eslesen = fiyatlar.find((p) => p.PriceList === priceListNum);

    return NextResponse.json({
      price: eslesen?.Price ?? 0,
      currency: eslesen?.Currency ?? null,
      priceListNum,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
