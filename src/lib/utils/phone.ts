/**
 * Telefon numarasi normalizasyonu.
 *
 * SAP EmployeesInfo.MobilePhone alanindaki giris bicimi tutarsiz olabilir
 * (0532..., +90532..., 532..., bosluk/tire icerebilir). Girisleri ayni
 * kanonik bicime indirgeyip karsilastiririz.
 *
 * Kural: sadece rakamlari al, basindaki Turkiye kodunu (90) ve govde 0'ini
 * temizle, en fazla son 10 haneyi dondur. Boylece "05324440011",
 * "+90 532 444 00 11" ve "532 444 00 11" hepsi "5324440011" olur.
 *
 * NOT: Test DB'sinde MobilePhone 4 haneli kisa kodlarla dolu olabilir;
 * bu durumda da rakamlar oldugu gibi kalir ve kendi icinde tutarli eslesir.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  // Ulke kodu (90) bas kismi
  if (digits.length > 10 && digits.startsWith('90')) {
    digits = digits.slice(2);
  }
  // Govde basindaki 0
  if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  // En fazla son 10 hane (gercek cep no icin)
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

/**
 * Iki telefon numarasinin (ham bicimde) ayni kisiye ait olup olmadigi.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length > 0 && na === nb;
}
