import { promises as fs } from 'fs';
import path from 'path';

/**
 * "Aktif is" (devam eden saha calismasi) isaret deposu - dosya tabanli.
 *
 * SAP aktiviteleri "acik" (EndTime bos) kalamadigi icin (SAP otomatik son
 * verir), bir aktivitenin hala devam edip etmedigini SAP'den anlayamayiz.
 * Bu yuzden "Ise Basla"da olusturulan aktivitenin devam ettigi bilgisini
 * burada tutariz; "Isi Bitir"de temizlenir. Ayni desen: [[mesai-onay-store]].
 */

export interface AktifIs {
  serviceCallId: number;
  activityCode: number;
  baslangic: string; // gercek baslama ISO zamani
  assigneeType: 'user' | 'employee';
  assigneeId: number; // ApplicationUserID (user) veya EmployeeID (employee)
  fullName: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'aktif-is.json');

type Store = Record<string, AktifIs>;

function anahtar(serviceCallId: number, assigneeType: string, assigneeId: number): string {
  return `${serviceCallId}:${assigneeType}:${assigneeId}`;
}

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

/** Belirli kisinin bu cagrida devam eden isi (yoksa null). */
export async function getAktifIs(
  serviceCallId: number,
  assigneeType: 'user' | 'employee',
  assigneeId: number,
): Promise<AktifIs | null> {
  const store = await readStore();
  return store[anahtar(serviceCallId, assigneeType, assigneeId)] ?? null;
}

/** Bu cagrida devam eden tum isler (birden fazla teknisyen olabilir). */
export async function getCagriAktifIsleri(serviceCallId: number): Promise<AktifIs[]> {
  const store = await readStore();
  return Object.values(store).filter((k) => k.serviceCallId === serviceCallId);
}

export async function setAktifIs(kayit: AktifIs): Promise<void> {
  const store = await readStore();
  store[anahtar(kayit.serviceCallId, kayit.assigneeType, kayit.assigneeId)] = kayit;
  await writeStore(store);
}

/** Isi bitirince isareti temizler (activityCode ile bulur). */
export async function clearAktifIsByActivity(activityCode: number): Promise<void> {
  const store = await readStore();
  let degisti = false;
  for (const [k, v] of Object.entries(store)) {
    if (v.activityCode === activityCode) {
      delete store[k];
      degisti = true;
    }
  }
  if (degisti) await writeStore(store);
}
