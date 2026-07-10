# SAP Field Service Management

SAP Business One (SAP B1) Service Layer ile entegre calisan, saha teknik servis ekiplerinin tum is sureclerini dijitallestirir. Teknisyenlerin sahadan mobil cihazla kullandigi, yonetimin ofisten takip ettigi web tabanli bir uygulamadir.

> Bu repo projenin tanitim ve dokumantasyon sayfasidir. Kaynak kod private repoda tutulmaktadir.

---

## Proje Hakkinda

Teknik servis operasyonlarinda kagit formlar, telefon ile koordinasyon ve manuel raporlama sureclerini ortadan kaldirmak icin gelistirilmistir. Tum veri SAP Business One uzerinde tutulur; uygulama SAP Service Layer API'sine proxy gorevi gorur.

### Cozulen Problemler

- Servis cagrilarinin acilmasi, guncellenmesi ve kapatilmasi sahadan yapilamamasi
- Teknisyen atamasi ve haftalik planlamanin manuel yurutulmesi
- Servis sirasinda kullanilan parcalarin stok takibinin gec yapilmasi
- Musteri imzasinin kagit formla alinmasi ve kaybolma riski
- Performans ve mesai raporlarinin Excel'de elle hazirlanmasi

---

## Ozellikler

### Servis Cagrisi Yonetimi
SAP B1 Service Calls modulu uzerinden servis cagrisi acma, guncelleme, kapatma. Ariza/bakim/kurulum gibi servis tipleri, problem turleri ve alt turleri SAP'den dinamik olarak cekilir. Cagri gecmisi, yapilan calismalar ve harcamalar tek ekrandan takip edilir.

### Teknisyen Atama ve Cizelge
Her servis cagrisina bir veya birden fazla teknisyen atanabilir. Haftalik planlama ekrani ile teknisyenlerin programi gorsel olarak yonetilir. Teknisyen kendi atanan islerini ayri bir panelden gorur.

### Stok ve Mal Cikisi
Servis sirasinda kullanilan yedek parcalar SAP uzerinden stoktan dusulebilir (Goods Issue). Satis siparisi olusturma ve onay akisi da sistemde mevcuttur. Fiyat bilgisi SAP'den canli cekilir.

### Musteri Ekipman Takibi
SAP Customer Equipment Card entegrasyonu ile musterinin sahip oldugu ekipmanlar (seri no, model vb.) servis cagrisina baglanir.

### Dijital Imza
Musteri ve teknisyen dijital imza atar (canvas tabanli). Imzalar sunucuda saklanir ve yazdirilan servis formuna eklenir.

### Yazdirma / PDF
Servis formu, yazdirmaya optimize edilmis ayri bir layout ile render edilir. Tum detaylar, calismalar, parcalar ve imzalar tek sayfada yer alir.

### Raporlama
- **Performans Raporu**: Teknisyen bazli servis cagrisi istatistikleri
- **Timesheet (Haftalik Program)**: Teknisyen bazli haftalik calisma cizelgesi, Excel export destegi
- **Aylik Ozet**: Donem bazli genel rapor
- **Mesai Takibi**: Mesai onay durumu ve raporlama

### Siparis Onay Akisi
Satis siparisleri olusturulabilir ve yetkili roller tarafindan onaylanabilir.

### Rol Tabanli Erisim Kontrolu
Dort farkli kullanici rolu tanimlidir:
- **Teknisyen**: Atanan servisleri gorur, calisma/parca kaydeder, imza alir
- **Bolge Sorumlusu**: Bolgesindeki tum servisleri yonetir, raporlari gorur
- **Yonetim**: Tum sisteme erisir, onay verir, raporlari gorur
- **Siparis Yonetimi**: Satis siparisi ve stok islemleri

Roller SAP EmployeesInfo uzerindeki UDF'den veya departman kodundan otomatik turetilir.

### Kimlik Dogrulama
Telefon numarasi + 4 haneli PIN ile giris. PIN ilk giriste belirlenir. JWT (access + refresh token) tabanli oturum yonetimi. Middleware ile korunan route'lar.

### Mobil Uyumlu (PWA)
Progressive Web App olarak calisir. Responsive tasarim ile telefon ve tabletten sahada rahatca kullanilabilir.

---

## Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (sunucusuz, ayri backend yok) |
| ERP Entegrasyonu | SAP Business One Service Layer (OData v2, REST) |
| Veritabani | SAP HANA (SAP B1 uzerinden, ayri DB yok) |
| Kimlik Dogrulama | JWT (access + refresh token), bcrypt ile PIN hashleme |
| Excel Export | ExcelJS |
| PDF Islemleri | pdf-lib |
| Grafikler | Recharts |
| Dijital Imza | react-signature-canvas |
| Ikon Seti | Lucide React |
| Dil | TypeScript (strict mode) |

---

## Mimari Yaklasim

- **Tek uygulama, iki katman**: Next.js App Router ile hem frontend hem backend tek projede. API route'lari SAP Service Layer'a proxy gorevi gorur; istemci tarayicidan dogrudan SAP'ye erismez.
- **SAP Service Layer client**: Tekil session yonetimi, otomatik login/cookie, hata isleme. Tum SAP istekleri merkezi bir client uzerinden yapilir.
- **Dosya tabanli store'lar**: PIN, imza, aktif is durumu gibi SAP'de tutulmayan veriler sunucu tarafinda JSON dosyalarinda saklanir (hafif, veritabanisiz).
- **Rol esleme**: SAP'deki departman kodu veya UDF degerinden uygulama rolu otomatik turetilir. Middleware seviyesinde route korumasi.

---

## Proje Yapisi (Genel Bakis)

```
app/
  (auth)/         → Giris ekrani (telefon + PIN)
  (dashboard)/    → Ana sayfa, servis yonetimi, stok, raporlar, planlama, ayarlar
  (print)/        → Yazdirilabilir servis formu
  api/
    auth/         → Giris, PIN, oturum endpoint'leri
    sap/          → SAP Service Layer proxy (service calls, items, warehouses, vb.)
    rapor/        → Raporlama (timesheet, performans, aylik)
    mesai/        → Mesai onay
    plan/         → Haftalik planlama

components/
  layout/         → Header, Sidebar, MobileNav
  servis/         → ImzaPad, FotografYukleyici
  ui/             → Button, Input, Card, Modal, Badge, Toast, Select, LoadingSpinner

lib/
  auth/           → JWT islemleri, rol esleme
  sap/            → SAP client, endpoint tanimlari, sorgu yardimcilari
  server/         → Sunucu tarafli store'lar (PIN, imza, timesheet, aktif is)
  hooks/          → React hook'lari (useServiceCalls, useItems, useBusinessPartners, vb.)
  contexts/       → AuthContext (oturum durumu)
  utils/          → Format, validasyon, zaman, telefon yardimcilari
```

---

## SAP B1 Entegrasyon Detaylari

Uygulama SAP Business One Service Layer (genellikle port 50000) uzerinden iletisim kurar. Kullanilan baslica SAP modulleri ve entity'ler:

- **ServiceCalls**: Servis cagrisi CRUD + kapatma
- **ServiceCallSchedulings (SCL6)**: Teknisyen atama ve cizelge
- **ServiceCallActivities**: Cagri aktiviteleri
- **BusinessPartners**: Musteri bilgileri
- **Items**: Urun/parca katalogu
- **CustomerEquipmentCards**: Musteri ekipman kartlari
- **EmployeesInfo**: Calisan bilgileri, departman, rol UDF
- **Orders / DeliveryNotes**: Satis siparisi ve mal cikisi
- **Warehouses**: Depo bilgileri

### Kullanilan UDF'ler (User Defined Fields)
- `EmployeesInfo.U_ROL` — Rol atamasi
- `EmployeesInfo.U_TELEFON` — Giris icin telefon numarasi
- `DocumentLines.U_HIZMET_CAGRISI` — Belge ile servis cagrisi iliskisi

---

## Ekran Goruntuleri

> Ekran goruntuleri ileride eklenecektir.

---

## Lisans

MIT
