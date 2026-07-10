import { promises as fs } from 'fs';
import path from 'path';

/**
 * İmza deposu - imza görselleri (data URL) servis formuna basılmak üzere
 * burada tutulur. İmza ayrıca SAP Attachments2'ye de yüklenir (kayıt için);
 * bu store yalnızca formda hızlı/güvenilir gösterim içindir.
 * Anahtar = `${serviceCallId}:${kind}` (kind: tech | customer).
 */

type Store = Record<string, string>; // dataURL

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'imzalar.json');

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(STORE_PATH, 'utf-8')) as Store;
  } catch {
    return {};
  }
}
async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export async function setImza(
  serviceCallId: number,
  kind: 'tech' | 'customer',
  dataUrl: string,
): Promise<void> {
  const store = await readStore();
  store[`${serviceCallId}:${kind}`] = dataUrl;
  await writeStore(store);
}

export async function getImzalar(
  serviceCallId: number,
): Promise<{ tech: string | null; customer: string | null }> {
  const store = await readStore();
  return {
    tech: store[`${serviceCallId}:tech`] ?? null,
    customer: store[`${serviceCallId}:customer`] ?? null,
  };
}
