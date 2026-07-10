import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SIPARIS_IS_BIRIMI, SIPARIS_BOLGE } from '@/lib/sap/stok-config';

interface SiparisSatir {
  itemCode: string;
  quantity: number;
  unitPrice?: number;
}

function bugun(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * POST - Servis çağrısından SATIŞ SİPARİŞİ (Order) oluşturur.
 * Müşteriye faturalanacak ürün/hizmetler. Müşteri çağrıdan gelir; fiyat
 * verilmezse SAP müşterinin fiyat listesinden doldurur.
 * Boyutlar (İş Birimi/Bölge) zorunlu — sabit varsayılan ([[stok-config]]).
 * Body: { lines: [{ itemCode, quantity, unitPrice? }] }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromToken(request);
    if (!user) return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;
    const { lines } = (await request.json()) as { lines?: SiparisSatir[] };
    if (!lines || lines.length === 0) {
      return NextResponse.json({ message: 'En az bir kalem ekleyin' }, { status: 400 });
    }
    if (lines.some((l) => !l.itemCode || !l.quantity || l.quantity <= 0)) {
      return NextResponse.json({ message: 'Her kalemde ürün ve geçerli miktar olmalı' }, { status: 400 });
    }

    const sap = getSAPClient();
    const sc = await sap.get<{ CustomerCode: string }>(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`,
      { $select: 'CustomerCode' },
    );

    const payload = {
      CardCode: sc.CustomerCode,
      DocDueDate: bugun(),
      U_HIZMET_CAGRISI: id, // belgeyi hizmet çağrısına bağlar (raporlama)
      DocumentLines: lines.map((l) => {
        const satir: Record<string, unknown> = {
          ItemCode: l.itemCode,
          Quantity: Number(l.quantity),
          CostingCode: SIPARIS_IS_BIRIMI, // Dim1 İş Birimi
          CostingCode5: SIPARIS_BOLGE, // Dim5 Bölge
        };
        // Fiyat verildiyse kullan; verilmezse SAP fiyat listesinden doldurur.
        if (l.unitPrice != null && !Number.isNaN(l.unitPrice)) {
          satir.UnitPrice = Number(l.unitPrice);
        }
        return satir;
      }),
    };

    const result = await sap.post<{ DocEntry: number; DocNum: number }>(
      SAP_ENDPOINTS.ORDERS,
      payload,
    );

    // SAP servis çağrısının "Giderler / İlgili Belgeler"ine bağla (mevcut
    // satırları koruyup ekle). Böylece sipariş SAP'de çağrıya bağlı görünür.
    try {
      const sc2 = await sap.get<{
        ServiceCallInventoryExpenses?: Array<{
          LineNum?: number;
          DocumentType?: string;
          DocEntry?: number;
          DocumentNumber?: number;
        }>;
      }>(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, { $select: 'ServiceCallInventoryExpenses' });
      const mevcut = (sc2.ServiceCallInventoryExpenses ?? []).map((e) => ({
        LineNum: e.LineNum,
        DocumentType: e.DocumentType,
        DocEntry: e.DocEntry,
        DocumentNumber: e.DocumentNumber,
      }));
      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
        ServiceCallInventoryExpenses: [
          ...mevcut,
          { DocumentType: 'edt_Order', DocEntry: result.DocEntry, DocumentNumber: result.DocNum },
        ],
      });
    } catch {
      /* bağlama başarısız olsa bile sipariş oluştu (U_HIZMET_CAGRISI ile de bağlı) */
    }

    return NextResponse.json(
      { docEntry: result.DocEntry, docNum: result.DocNum, message: `Satış siparişi #${result.DocNum} oluşturuldu` },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
