export function formatPara(tutar: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(tutar);
}

export function formatSayi(sayi: number): string {
  return new Intl.NumberFormat('tr-TR').format(sayi);
}

export function formatYuzde(oran: number): string {
  return `%${(oran * 100).toFixed(1)}`;
}

export function kisalt(metin: string, maxUzunluk: number): string {
  if (metin.length <= maxUzunluk) return metin;
  return metin.slice(0, maxUzunluk - 3) + '...';
}
