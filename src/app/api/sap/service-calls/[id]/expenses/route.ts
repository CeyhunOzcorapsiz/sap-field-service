import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

interface ExpenseLine {
  LineNum?: number;
  ItemCode?: string;
  ItemName?: string;
  Quantity?: number;
  WarehouseCode?: string;
  [key: string]: unknown;
}

interface ServiceCallWithExpenses {
  ServiceCallInventoryExpenses?: ExpenseLine[];
}

/**
 * POST - Servise kullanilan urun (parca) ekler.
 * Excel #7: "Kullanilan Urunler — hazir urun listesi".
 *
 * ServiceCallInventoryExpenses bir alt-koleksiyon. SAP B1 Service Layer'da
 * koleksiyona satir eklemek icin mevcut satirlar + yeni satir birlikte
 * PATCH edilir (PATCH koleksiyonu komple degistirir).
 *
 * NOT - Stok dusumu: Inventory Expenses sadece "kullanildi" kaydidir,
 * fiili stok dusumu Teslimat/InventoryGenExit belgesi + yetki gerektirir.
 * Bu route stogu OTOMATIK DUSMEZ (guvenli taraf); ayri bir adim olarak
 * ele alinmali (Excel'deki "stok otomatik dusmeli?" sorusu da belirsizdi).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { itemCode, itemName, quantity, warehouseCode } = body;

    if (!itemCode || !quantity || quantity <= 0) {
      return NextResponse.json(
        { message: 'Ürün kodu ve geçerli miktar zorunlu' },
        { status: 400 },
      );
    }

    const sap = getSAPClient();

    // Mevcut satirlari al
    const servis = await sap.get<ServiceCallWithExpenses>(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`,
    );
    const mevcutSatirlar = servis.ServiceCallInventoryExpenses || [];

    // Yeni satir
    const yeniSatir: ExpenseLine = {
      ItemCode: itemCode,
      Quantity: Number(quantity),
    };
    if (itemName) yeniSatir.ItemName = itemName;
    if (warehouseCode) yeniSatir.WarehouseCode = warehouseCode;

    // Mevcut + yeni satirlari birlikte PATCH et
    await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
      ServiceCallInventoryExpenses: [...mevcutSatirlar, yeniSatir],
    });

    const guncel = await sap.get(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`);
    return NextResponse.json(guncel, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
