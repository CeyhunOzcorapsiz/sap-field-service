import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { MAL_CIKIS_HESAP_KODU } from '@/lib/sap/stok-config';

interface CikisSatir {
  itemCode: string;
  quantity: number;
  warehouseCode: string;
}

/**
 * POST - Servis sırasında kullanılan malzemeleri stoktan düşer: MAL ÇIKIŞI
 * (InventoryGenExit). Kalem + miktar + depo. Karşı G/L hesabı sabit
 * ([[stok-config]] - şimdilik 800.01.01.05).
 * Body: { lines: [{ itemCode, quantity, warehouseCode }] }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const { lines } = (await request.json()) as { lines?: CikisSatir[] };
    if (!lines || lines.length === 0) {
      return NextResponse.json({ message: 'En az bir kalem ekleyin' }, { status: 400 });
    }
    if (lines.some((l) => !l.itemCode || !l.quantity || l.quantity <= 0 || !l.warehouseCode)) {
      return NextResponse.json(
        { message: 'Her kalemde ürün, geçerli miktar ve depo olmalı' },
        { status: 400 },
      );
    }

    const sap = getSAPClient();
    const payload = {
      Comments: `Servis S-${id} - kullanılan malzeme`,
      U_HIZMET_CAGRISI: id, // belgeyi hizmet çağrısına bağlar (raporlama)
      DocumentLines: lines.map((l) => ({
        ItemCode: l.itemCode,
        Quantity: Number(l.quantity),
        WarehouseCode: l.warehouseCode,
        AccountCode: MAL_CIKIS_HESAP_KODU,
      })),
    };

    const result = await sap.post<{ DocEntry: number; DocNum: number }>(
      SAP_ENDPOINTS.INVENTORY_GEN_EXITS,
      payload,
    );
    return NextResponse.json(
      { docEntry: result.DocEntry, docNum: result.DocNum, message: `Mal çıkışı #${result.DocNum} oluşturuldu` },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
