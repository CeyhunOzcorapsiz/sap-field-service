import { promises as fs } from 'fs';
import path from 'path';

/**
 * Mesai onay durumu deposu - dosya tabanli (data/mesai-onay.json).
 * Time sheet'teki "Duzenleyen / Onaylayan" akisinin dijital karsiligi.
 *
 * NOT: SAP tarafinda kalici cozum icin @MESAI_ONAY UserTable (UDT)
 * tanimlanip bu store SAP'ye tasinabilir. Su an dosya tabanli calisir,
 * SAP'de hicbir hazirlik gerektirmez.
 */

export type OnayDurumu = 'TASLAK' | 'ONAYA_GONDERILDI' | 'ONAYLANDI' | 'REDDEDILDI';

export interface MesaiOnayKaydi {
  haftaBaslangic: string;
  employeeId: number;
  durum: OnayDurumu;
  gonderen?: string;
  gonderiTarihi?: string;
  onaylayan?: string;
  onayTarihi?: string;
  not?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'mesai-onay.json');

type Store = Record<string, MesaiOnayKaydi>;

function anahtar(haftaBaslangic: string, employeeId: number): string {
  return `${haftaBaslangic}:${employeeId}`;
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

export async function getHaftaOnaylari(haftaBaslangic: string): Promise<MesaiOnayKaydi[]> {
  const store = await readStore();
  return Object.values(store).filter((k) => k.haftaBaslangic === haftaBaslangic);
}

export async function getOnay(
  haftaBaslangic: string,
  employeeId: number,
): Promise<MesaiOnayKaydi | null> {
  const store = await readStore();
  return store[anahtar(haftaBaslangic, employeeId)] ?? null;
}

export async function setOnay(kayit: MesaiOnayKaydi): Promise<MesaiOnayKaydi> {
  const store = await readStore();
  store[anahtar(kayit.haftaBaslangic, kayit.employeeId)] = kayit;
  await writeStore(store);
  return kayit;
}
