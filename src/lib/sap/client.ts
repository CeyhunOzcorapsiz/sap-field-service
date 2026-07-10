import { SAPLoginResponse, SAPODataResponse } from '@/types/sap';
import { SAP_ENDPOINTS } from './endpoints';
import { ODataParams, buildODataQuery } from './queries';

class SAPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private sessionExpiry: number = 0;
  private loginPromise: Promise<void> | null = null;

  constructor() {
    this.baseUrl = process.env.SAP_SERVICE_LAYER_URL || '';
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId && Date.now() < this.sessionExpiry) {
      return;
    }
    if (this.loginPromise) {
      return this.loginPromise;
    }
    this.loginPromise = this.login();
    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  private async login(): Promise<void> {
    const response = await fetch(`${this.baseUrl}${SAP_ENDPOINTS.LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: process.env.SAP_COMPANY_DB,
        UserName: process.env.SAP_USER,
        Password: process.env.SAP_PASSWORD,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SAP Login failed: ${error}`);
    }

    const data: SAPLoginResponse = await response.json();
    this.sessionId = data.SessionId;
    this.sessionExpiry = Date.now() + (data.SessionTimeout - 60) * 1000;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    retried = false,
  ): Promise<T> {
    await this.ensureSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: `B1SESSION=${this.sessionId}`,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !retried) {
      this.sessionId = null;
      return this.request<T>(method, endpoint, body, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SAP API Error [${response.status}]: ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: ODataParams): Promise<T> {
    const query = params ? buildODataQuery(params) : '';
    return this.request<T>('GET', `${endpoint}${query}`);
  }

  async getList<T>(endpoint: string, params?: ODataParams): Promise<T[]> {
    const result = await this.get<SAPODataResponse<T>>(endpoint, params);
    return result.value;
  }

  /**
   * Tum sayfalari ceker (@odata.nextLink takip ederek).
   *
   * SAP Service Layer varsayilan sayfa boyutu 20'dir ve $top bu siniri
   * ASMAZ; tek istek 20 kayitla sinirli kalir. Tum sonucu garanti etmesi
   * gereken yerlerde (orn. telefonla calisan eslestirme) bunu kullan.
   */
  async getListAll<T>(endpoint: string, params?: ODataParams): Promise<T[]> {
    const all: T[] = [];
    let path = `${endpoint}${params ? buildODataQuery(params) : ''}`;
    for (;;) {
      const page: SAPODataResponse<T> = await this.get<SAPODataResponse<T>>(path);
      all.push(...page.value);
      const next = page['odata.nextLink'];
      if (!next) break;
      // nextLink govdeden gelir, basinda '/' olmaz; baseUrl'e gore '/' ekle
      path = `/${next}`;
    }
    return all;
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, body);
  }

  async delete(endpoint: string): Promise<void> {
    await this.request<void>('DELETE', endpoint);
  }

  /**
   * SAP Attachments2'ye dosya yukler (multipart/form-data).
   * Donen AbsoluteEntry, ServiceCall'un AttachmentEntry alanina baglanir.
   * Imza ve fotograf yuklemeleri icin kullanilir.
   */
  async uploadAttachment(
    fileName: string,
    data: Buffer | Uint8Array,
    mimeType: string,
    retried = false,
  ): Promise<{ AbsoluteEntry: number }> {
    await this.ensureSession();

    const form = new FormData();
    const blob = new Blob([data as unknown as BlobPart], { type: mimeType });
    form.append('files', blob, fileName);

    const response = await fetch(`${this.baseUrl}${SAP_ENDPOINTS.ATTACHMENTS}`, {
      method: 'POST',
      headers: { Cookie: `B1SESSION=${this.sessionId}` },
      body: form,
    });

    if (response.status === 401 && !retried) {
      this.sessionId = null;
      return this.uploadAttachment(fileName, data, mimeType, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SAP Attachment Error [${response.status}]: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Mevcut bir attachment kaydina yeni satir (dosya) ekler.
   * Servise birden fazla foto/imza eklerken AbsoluteEntry korunur.
   */
  async appendAttachmentLine(
    absoluteEntry: number,
    fileName: string,
    data: Buffer | Uint8Array,
    mimeType: string,
    retried = false,
  ): Promise<{ AbsoluteEntry: number }> {
    await this.ensureSession();

    const form = new FormData();
    const blob = new Blob([data as unknown as BlobPart], { type: mimeType });
    form.append('files', blob, fileName);

    const response = await fetch(
      `${this.baseUrl}${SAP_ENDPOINTS.ATTACHMENTS}(${absoluteEntry})`,
      {
        method: 'PATCH',
        headers: { Cookie: `B1SESSION=${this.sessionId}` },
        body: form,
      },
    );

    if (response.status === 401 && !retried) {
      this.sessionId = null;
      return this.appendAttachmentLine(absoluteEntry, fileName, data, mimeType, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SAP Attachment Error [${response.status}]: ${errorText}`);
    }

    if (response.status === 204) {
      return { AbsoluteEntry: absoluteEntry };
    }
    return response.json();
  }
}

let sapClientInstance: SAPClient | null = null;

export function getSAPClient(): SAPClient {
  if (!sapClientInstance) {
    sapClientInstance = new SAPClient();
  }
  return sapClientInstance;
}
