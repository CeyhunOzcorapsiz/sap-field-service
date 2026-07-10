import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';
import { SAPServiceCall } from '@/types/sap';
import { setImza } from '@/lib/server/imza-store';

/**
 * POST - Servise dosya ekler (imza / fotograf).
 * Body: { fileName, mimeType, dataBase64, kind: 'signature-tech'|'signature-customer'|'photo' }
 *
 * Akis:
 *  1. Dosya SAP Attachments2'ye yuklenir -> AbsoluteEntry
 *  2. Servisin AttachmentEntry'si yoksa atanir, varsa yeni satir eklenir
 *  3. Imza ise U_ImzaEkiNo UDF'i de denenir (yoksa sessizce gecilir)
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
    const { fileName, mimeType, dataBase64, kind } = body;

    if (!fileName || !mimeType || !dataBase64) {
      return NextResponse.json({ message: 'Dosya bilgisi eksik' }, { status: 400 });
    }

    // base64 -> Buffer (data URL prefix'i varsa temizle)
    const base64 = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json({ message: 'Dosya 8MB sınırını aşıyor' }, { status: 413 });
    }

    const sap = getSAPClient();

    // Servisin mevcut attachment durumunu al
    const servis = await sap.get<SAPServiceCall & { AttachmentEntry?: number }>(
      `${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`,
    );

    let absoluteEntry: number;
    if (servis.AttachmentEntry && servis.AttachmentEntry > 0) {
      // Mevcut attachment'a yeni satir ekle
      const res = await sap.appendAttachmentLine(
        servis.AttachmentEntry,
        fileName,
        buffer,
        mimeType,
      );
      absoluteEntry = res.AbsoluteEntry;
    } else {
      // Yeni attachment olustur ve servise bagla
      const res = await sap.uploadAttachment(fileName, buffer, mimeType);
      absoluteEntry = res.AbsoluteEntry;
      await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
        AttachmentEntry: absoluteEntry,
      });
    }

    // İmzayı forma basmak için data URL'i yerel store'a da kaydet
    if (kind === 'signature-tech') {
      await setImza(parseInt(id), 'tech', dataBase64).catch(() => {});
    } else if (kind === 'signature-customer') {
      await setImza(parseInt(id), 'customer', dataBase64).catch(() => {});
    }

    // Teknisyen imzasi ise U_ImzaEkiNo UDF'ine referans yaz (varsa)
    if (kind === 'signature-tech') {
      try {
        await sap.patch(`${SAP_ENDPOINTS.SERVICE_CALLS}(${id})`, {
          U_ImzaEkiNo: absoluteEntry,
        });
      } catch {
        // UDF tanimli degil - attachment yine de bagli, sorun yok
      }
    }

    return NextResponse.json({ AbsoluteEntry: absoluteEntry, kind });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
