import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getUserFromToken } from '@/lib/auth/jwt';
import { getWeeklyTimeSheet } from '@/lib/server/timesheet-data';
import { haftaninPazartesisi, tarihEkle, GUN_ADLARI, TeknisyenTimeSheet } from '@/lib/utils/timesheet';

/**
 * GET - Haftalik time sheet Excel ciktisi.
 * "Gerceklesen Haftalik Program" WEEK sayfasi formatinda:
 * is tipi lejanti, musteri x gun (Normal/Mesai/KM), haftalik toplamlar,
 * Duzenleyen/Onaylayan imza satiri. Her teknisyen ayri sayfa.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const baz = startParam ? new Date(`${startParam}T00:00:00`) : new Date();
    const haftaBaslangic = haftaninPazartesisi(isNaN(baz.getTime()) ? new Date() : baz);

    const timesheet = await getWeeklyTimeSheet(haftaBaslangic);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Field Service Co.';

    if (timesheet.teknisyenler.length === 0) {
      const ws = wb.addWorksheet('Bos');
      ws.getCell('A1').value = 'Bu haftada kayıtlı çalışma bulunamadı';
    }

    for (const tek of timesheet.teknisyenler) {
      buildSheet(wb, tek, haftaBaslangic);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const dosyaAdi = `Haftalik_Calisma_${haftaBaslangic}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${dosyaAdi}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

const IS_TIPLERI = [
  ['Periyodik Bakım / Maintenance', 'PR'],
  ['Devreye Alma / Start-Up', 'SU'],
  ['Garanti / Claim', 'CJ'],
  ['Arıza / Malfunction', 'WS'],
  ['Müşteri Ziyareti / Cust. Visit', 'CV'],
  ['Eğitim / Training', 'ST'],
];

function buildSheet(wb: ExcelJS.Workbook, tek: TeknisyenTimeSheet, haftaBaslangic: string) {
  // Sayfa adi: gecersiz karakterleri temizle, 31 karakter siniri
  const sayfaAdi = tek.teknisyenAdi.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || `Tek-${tek.employeeId}`;
  const ws = wb.addWorksheet(sayfaAdi);

  const border: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };
  const griDolgu: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

  // Baslik
  ws.mergeCells('A1:X1');
  const baslik = ws.getCell('A1');
  baslik.value = 'HAFTALIK ÇALIŞMA SAATİ FORMU / WEEKLY TIME SHEET';
  baslik.font = { name: 'Arial', bold: true, size: 14 };
  baslik.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  // Teknisyen + hafta bilgisi
  ws.mergeCells('A2:X2');
  const altBaslik = ws.getCell('A2');
  altBaslik.value = `${tek.teknisyenAdi}  |  ${haftaBaslangic} - ${tarihEkle(haftaBaslangic, 6)}`;
  altBaslik.font = { name: 'Arial', bold: true, size: 11 };
  altBaslik.alignment = { horizontal: 'center' };

  // Is tipi lejanti (satir 4-9)
  IS_TIPLERI.forEach(([ad, kod], i) => {
    const r = 4 + i;
    ws.getCell(r, 1).value = ad;
    ws.getCell(r, 1).font = { name: 'Arial', size: 9 };
    ws.getCell(r, 3).value = kod;
    ws.getCell(r, 3).font = { name: 'Arial', bold: true, size: 9 };
  });

  // Gun basliklari (satir 11-12): her gun 3 kolon (Normal/Mesai/KM)
  const headRow1 = 11;
  const headRow2 = 12;
  ws.getCell(headRow1, 1).value = 'Müşteri / Customer';
  ws.mergeCells(headRow1, 1, headRow2, 1);

  for (let g = 0; g < 7; g++) {
    const c = 2 + g * 3;
    const tarih = tarihEkle(haftaBaslangic, g);
    ws.mergeCells(headRow1, c, headRow1, c + 2);
    const gh = ws.getCell(headRow1, c);
    gh.value = `${GUN_ADLARI[g]} ${tarih.slice(8, 10)}.${tarih.slice(5, 7)}`;
    gh.alignment = { horizontal: 'center' };
    gh.font = { name: 'Arial', bold: true, size: 9 };
    gh.fill = griDolgu;

    ws.getCell(headRow2, c).value = 'Normal';
    ws.getCell(headRow2, c + 1).value = 'Mesai';
    ws.getCell(headRow2, c + 2).value = 'KM';
  }
  // Toplam kolonlari
  const topC = 2 + 7 * 3; // 23
  ws.mergeCells(headRow1, topC, headRow1, topC + 2);
  const th = ws.getCell(headRow1, topC);
  th.value = 'TOPLAM';
  th.alignment = { horizontal: 'center' };
  th.font = { name: 'Arial', bold: true, size: 9 };
  th.fill = griDolgu;
  ws.getCell(headRow2, topC).value = 'Normal';
  ws.getCell(headRow2, topC + 1).value = 'Mesai';
  ws.getCell(headRow2, topC + 2).value = 'KM';

  for (let c = 1; c <= topC + 2; c++) {
    for (const r of [headRow1, headRow2]) {
      const cell = ws.getCell(r, c);
      cell.border = border;
      if (r === headRow2) {
        cell.font = { name: 'Arial', size: 8 };
        cell.alignment = { horizontal: 'center' };
        cell.fill = griDolgu;
      }
    }
  }

  // Musteri satirlari
  let r = headRow2 + 1;
  for (const satir of tek.satirlar) {
    ws.getCell(r, 1).value = satir.musteriAdi;
    ws.getCell(r, 1).font = { name: 'Arial', size: 9 };
    for (let g = 0; g < 7; g++) {
      const c = 2 + g * 3;
      const gun = satir.gunler[g];
      if (gun.normal) ws.getCell(r, c).value = gun.normal;
      if (gun.mesai) ws.getCell(r, c + 1).value = gun.mesai;
      if (gun.km) ws.getCell(r, c + 2).value = gun.km;
    }
    ws.getCell(r, topC).value = satir.toplamNormal || 0;
    ws.getCell(r, topC + 1).value = satir.toplamMesai || 0;
    ws.getCell(r, topC + 2).value = satir.toplamKm || 0;

    for (let c = 1; c <= topC + 2; c++) {
      const cell = ws.getCell(r, c);
      cell.border = border;
      if (c > 1) {
        cell.alignment = { horizontal: 'center' };
        cell.font = { name: 'Arial', size: 9 };
      }
    }
    r++;
  }

  // Haftalik toplam satiri
  ws.getCell(r, 1).value = 'HAFTALIK TOPLAM';
  ws.getCell(r, 1).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(r, topC).value = tek.haftalikNormal;
  ws.getCell(r, topC + 1).value = tek.haftalikMesai;
  ws.getCell(r, topC + 2).value = tek.haftalikKm;
  for (let c = 1; c <= topC + 2; c++) {
    const cell = ws.getCell(r, c);
    cell.border = border;
    cell.fill = griDolgu;
    if (c > 1) {
      cell.font = { name: 'Arial', bold: true, size: 9 };
      cell.alignment = { horizontal: 'center' };
    }
  }
  r += 2;

  // Ozet
  ws.getCell(r, 1).value = `Haftalık Normal Çalışma: ${tek.haftalikNormal} saat`;
  ws.getCell(r + 1, 1).value = `Haftalık Mesaili Çalışma: ${tek.haftalikMesai} saat`;
  ws.getCell(r + 2, 1).value = `Haftalık Toplam Çalışma: ${tek.haftalikToplam} saat`;
  for (let i = 0; i < 3; i++) {
    ws.getCell(r + i, 1).font = { name: 'Arial', bold: true, size: 10 };
  }
  r += 4;

  // Imza satiri
  ws.getCell(r, 1).value = 'Düzenleyen / Tarih, İmza';
  ws.getCell(r, 10).value = 'Onaylayan / Tarih, İmza';
  ws.getCell(r, 1).font = { name: 'Arial', size: 9 };
  ws.getCell(r, 10).font = { name: 'Arial', size: 9 };

  // Kolon genislikleri
  ws.getColumn(1).width = 28;
  for (let c = 2; c <= topC + 2; c++) {
    ws.getColumn(c).width = 7;
  }
}
