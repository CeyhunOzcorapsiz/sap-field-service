# SAP Field Service Management

SAP Business One Service Layer entegrasyonlu, saha teknik servis ekipleri icin web tabanli yonetim uygulamasi.

## Ne Yapar?

- **Servis Cagrisi Yonetimi** — SAP B1 Service Calls uzerinden acma, guncelleme, kapatma
- **Teknisyen Atama & Cizelge** — Haftalik planlama, teknisyen bazli is takibi
- **Stok & Mal Cikisi** — Servis sirasinda kullanilan parcalarin SAP uzerinden stok dusumu
- **Musteri Ekipman Takibi** — SAP Customer Equipment Card entegrasyonu
- **Dijital Imza** — Musteri ve teknisyen imzasi ile servis formu onaylama
- **Raporlama** — Performans, timesheet (Excel export), aylik ozet raporlari
- **Siparis Onay** — Satis siparisi olusturma ve onay akisi
- **Rol Tabanli Erisim** — Teknisyen, Bolge Sorumlusu, Yonetim, Siparis Yonetimi rolleri
- **Mobil Uyumlu PWA** — Sahada telefon/tabletten kullanim icin optimize

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (App Router) |
| ERP | SAP Business One Service Layer (OData v2) |
| Veritabani | SAP HANA (SAP B1 uzerinden) |
| Auth | JWT (access + refresh token), PIN tabanli giris |
| Export | ExcelJS, pdf-lib |
| Grafik | Recharts |

## Kurulum

```bash
# Bagimliliklar
npm install

# Ortam degiskenleri
cp .env.example .env.local
# .env.local dosyasini SAP baglanti bilgilerinizle doldurun

# Gelistirme sunucusu
npm run dev
```

Uygulama `http://localhost:3000` adresinde calisir.

## SAP B1 Gereksinimleri

- SAP Business One 10.0+ (Service Layer aktif)
- Service Calls modulu
- Asagidaki UDF'ler tanimlanmis olmali:
  - `EmployeesInfo.U_ROL` — Calisana rol atamasi
  - `EmployeesInfo.U_TELEFON` — Giris icin telefon numarasi
  - `DocumentLines.U_HIZMET_CAGRISI` — Belge-servis cagrisi iliskisi

## Proje Yapisi

```
src/
├── app/
│   ├── (auth)/          # Giris ekrani
│   ├── (dashboard)/     # Ana sayfa, servis, stok, raporlar, planlama
│   ├── (print)/         # Yazdirilabilir servis formu
│   └── api/             # API route'lari
│       ├── auth/        # Giris, PIN, oturum
│       ├── sap/         # SAP Service Layer proxy
│       ├── rapor/       # Raporlama endpoint'leri
│       ├── mesai/       # Mesai onay
│       └── plan/        # Haftalik planlama
├── components/
│   ├── layout/          # Header, Sidebar, MobileNav
│   ├── servis/          # ImzaPad, FotografYukleyici
│   └── ui/              # Button, Input, Card, Modal, Badge, Toast
├── lib/
│   ├── auth/            # JWT, rol esleme
│   ├── sap/             # SAP client, endpoint, sorgu
│   ├── server/          # Server-side store'lar (PIN, imza, timesheet)
│   ├── hooks/           # React hook'lari (useServiceCalls, useItems, vb.)
│   ├── contexts/        # AuthContext
│   └── utils/           # Yardimci fonksiyonlar
└── types/               # TypeScript tip tanimlari
```

## Ozellistirme

- `public/logo.png` — Sirket logonuzu buraya koyun
- `public/manifest.json` — PWA isim ve ikonlarini guncelleyin
- `src/app/(print)/servis-formu/` — Servis formu sablonunu kendi sirket bilgilerinizle duzenleyin
- `.env.local` — SAP baglanti ve JWT ayarlari

## Lisans

MIT
