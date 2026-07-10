import { promises as fs } from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

/**
 * Teknisyen PIN deposu - dosya tabanli (data/teknisyen-pin.json).
 *
 * Teknisyenlerin SAP kullanici hesabi yok; kimlik SAP EmployeesInfo'daki
 * telefon ile dogrulanir, PIN ise burada bcrypt hash olarak saklanir.
 * Anahtar = SAP EmployeeID.
 *
 * NOT: Kalici cozumde bu store SAP UDT @TEKNISYEN_PIN'e tasinabilir.
 * Disari sadece asenkron fonksiyonlar acildigindan tasima saydam olur.
 * Ayni desen: [[mesai-onay-store]].
 */

interface PinKaydi {
  hash: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
}

type Store = Record<string, PinKaydi>;

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'teknisyen-pin.json');
const SALT_ROUNDS = 10;

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/** Bu calisanin tanimli bir PIN'i var mi? (ilk giris ayrimi icin) */
export async function hasPin(employeeId: number): Promise<boolean> {
  const store = await readStore();
  return Boolean(store[String(employeeId)]);
}

/** Ilk giriste veya admin sifirlamasi sonrasi PIN belirler. */
export async function setPin(employeeId: number, pin: string): Promise<void> {
  const store = await readStore();
  const key = String(employeeId);
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  store[key] = {
    hash,
    olusturmaTarihi: store[key]?.olusturmaTarihi ?? now,
    guncellemeTarihi: now,
  };
  await writeStore(store);
}

/** Girilen PIN dogru mu? */
export async function verifyPin(employeeId: number, pin: string): Promise<boolean> {
  const store = await readStore();
  const kayit = store[String(employeeId)];
  if (!kayit) return false;
  return bcrypt.compare(pin, kayit.hash);
}

/**
 * Admin PIN sifirlama: kaydi siler, boylece teknisyen sonraki giriste
 * yeniden PIN olusturur.
 */
export async function resetPin(employeeId: number): Promise<void> {
  const store = await readStore();
  delete store[String(employeeId)];
  await writeStore(store);
}
