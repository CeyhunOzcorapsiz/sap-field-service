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
    const top = searchParams.get('top') || '50';
    const inStock = searchParams.get('inStock');

    const filters: string[] = [];
    if (search) {
      // SAP contains() harfe DUYARLI ve toupper/tolower YOK; kalem adları
      // karışık harfle saklı ("Service-Kit"). Bu yüzden terimi birden çok
      // harf-varyantıyla (olduğu gibi + küçük + BÜYÜK + Baş Harf) ararız.
      const esc = (s: string) => s.replace(/'/g, "''");
      const lower = search.toLocaleLowerCase('tr-TR');
      const upper = search.toLocaleUpperCase('tr-TR');
      const title = search
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR') : w))
        .join(' ');
      const variants = Array.from(new Set([search, lower, upper, title]));
      const adKosul = variants.map((v) => `contains(ItemName,'${esc(v)}')`).join(' or ');
      const kodKosul = `contains(ItemCode,'${esc(upper)}')`;
      filters.push(`(${adKosul} or ${kodKosul})`);
    }
    if (inStock === 'true') {
      filters.push('QuantityOnStock gt 0');
    }

    const sap = getSAPClient();
    // ItemWarehouseInfoCollection $select ile inline gelir ($expand ile DEĞİL —
    // o "invalid navigation property" 400 verir). Depo bazlı stok kırılımı için.
    const items = await sap.getList(SAP_ENDPOINTS.ITEMS, {
      $top: parseInt(top),
      $select:
        'ItemCode,ItemName,QuantityOnStock,QuantityOrderedByCustomers,BarCode,ItemWarehouseInfoCollection',
      $filter: filters.length > 0 ? filters.join(' and ') : undefined,
      $orderby: 'ItemName asc',
    });

    return NextResponse.json({ value: items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
