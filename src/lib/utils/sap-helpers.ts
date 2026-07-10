/**
 * SAP veri donusturme yardimci fonksiyonlari
 */

// Oncelik cevirici
export function sapPriorityToLabel(priority: string): string {
  switch (priority) {
    case 'scp_High': return 'Yüksek';
    case 'scp_Medium': return 'Orta';
    case 'scp_Low': return 'Düşük';
    default: return 'Orta';
  }
}

export function sapPriorityToBadge(priority: string): 'danger' | 'warning' | 'default' {
  switch (priority) {
    case 'scp_High': return 'danger';
    case 'scp_Medium': return 'warning';
    case 'scp_Low': return 'default';
    default: return 'warning';
  }
}

// Durum cevirici
export function sapStatusToLabel(status: number): string {
  switch (status) {
    case -3: return 'Açık';
    case -2: return 'Beklemede';
    case -1: return 'Kapalı';
    default: return 'Bilinmiyor';
  }
}

export function sapStatusToBadge(status: number): 'danger' | 'warning' | 'success' | 'info' {
  switch (status) {
    case -3: return 'danger';
    case -2: return 'warning';
    case -1: return 'success';
    default: return 'info';
  }
}

// CallType cevirici
export function sapCallTypeToLabel(callType: number): string {
  switch (callType) {
    case 1: return 'Arıza';
    case 2: return 'Bakım';
    case 3: return 'Montaj';
    case 4: return 'Garanti';
    case 5: return 'Devreye Alma';
    default: return 'Diğer';
  }
}

// Tarih formatlayici
export function formatSAPDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Teknisyen adi (SAPEmployee array'den)
export function buildTeknisyenAdi(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}
