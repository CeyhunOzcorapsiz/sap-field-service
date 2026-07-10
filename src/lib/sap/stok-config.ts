/**
 * Stok belgeleri (Satış Siparişi / Mal Çıkışı) sabit varsayılanları.
 * Kullanıcı kararı (sonradan değiştirilebilir):
 *  - Mal Çıkışı satır hesabı (G/L) = 800.01.01.05
 *  - Satış Siparişi boyutları: İş Birimi (Dim1) = HZM, Bölge (Dim5) = GNL
 *
 * SAP'de boyut alanları DocumentLine üzerinde CostingCode (Dim1) ...
 * CostingCode5 (Dim5) olarak geçer.
 */
export const MAL_CIKIS_HESAP_KODU = '800.01.01.05';
export const SIPARIS_IS_BIRIMI = 'HZM'; // Dimension 1 - İş Birimi
export const SIPARIS_BOLGE = 'GNL'; // Dimension 5 - Bölge
