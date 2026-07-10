import { YeniServisForm } from '@/types/service';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateServisForm(form: Partial<YeniServisForm>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!form.musteriKodu) {
    errors.push({ field: 'musteriKodu', message: 'Müşteri seçimi zorunludur' });
  }
  if (!form.konu?.trim()) {
    errors.push({ field: 'konu', message: 'Konu alanı zorunludur' });
  }
  if (!form.tur) {
    errors.push({ field: 'tur', message: 'Servis türü seçimi zorunludur' });
  }
  if (!form.oncelik) {
    errors.push({ field: 'oncelik', message: 'Öncelik seçimi zorunludur' });
  }
  if (!form.teknisyenId) {
    errors.push({ field: 'teknisyenId', message: 'Teknisyen ataması zorunludur' });
  }

  return errors;
}

export function validateServisKapatma(servis: {
  cozum?: string;
  isBaslangic?: string | null;
  isBitis?: string | null;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!servis.cozum?.trim()) {
    errors.push({ field: 'cozum', message: 'Çözüm / işlem notu zorunludur' });
  }
  if (!servis.isBaslangic) {
    errors.push({ field: 'isBaslangic', message: 'İş başlangıç saati kaydedilmelidir' });
  }
  if (!servis.isBitis) {
    errors.push({ field: 'isBitis', message: 'İş bitiş saati kaydedilmelidir' });
  }

  return errors;
}
