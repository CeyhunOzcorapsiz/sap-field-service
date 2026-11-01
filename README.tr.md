# SAP Saha Servis Yönetimi

[English](README.md) | **Türkçe**

> **Kurumsal Vitrin Deposu:** **SAP Business One HANA / SQL** ile tam entegre çalışan, saha servis ekipleri için geliştirilmiş modern Progressive Web App (PWA). Saha teknisyenleri mobil cihazlarından servis çağrılarını yönetir, araç/depo stoğundan yedek parça düşer, müşteri cihaz seri numaralarını sorgular ve sahada dijital müşteri imzası alır. Üretim kaynak kodları kurumsal özel depoda korunmaktadır.

---

## 📱 Ekran Görüntüleri

| Masaüstü / Tablet Arayüzü | Mobil PWA Arayüzü |
|:---:|:---:|
| ![Giriş ekranı](docs/img/login.png) | ![Telefonda giriş](docs/img/login-mobile.png) |
| *Masaüstü sevkiyatçı ve yönetici portalı* | *Saha teknisyeni mobil operasyon ekranı* |

---

## 🏗️ Mimari ve SAP Service Layer Entegrasyonu

`mermaid
flowchart TD
    subgraph Istemci ["İstemci Katmanı (PWA)"]
        TechMobile["📱 Saha Teknisyeni (Mobil PWA)"]
        ManagerWeb["💻 Servis Koordinatörü & Yönetici"]
    end

    subgraph Uygulama ["Uygulama Katmanı (Next.js 16 + React 19)"]
        NextServer["Next.js Server Actions & API Rotaları"]
        AuthModule["JWT + PIN Kimlik Doğrulama & Rol Kontrolü"]
        OfflineSync["Service Worker & Çevrimdışı Önbellek"]
        DocEngine["PDF (pdf-lib) & ExcelJS Motoru"]
    end

    subgraph SAPERP ["SAP Business One ERP"]
        ServiceLayer["SAP B1 Service Layer (OData / REST)"]
        SAPServiceCalls["Servis Çağrıları (OSCL) & Aktiviteler"]
        SAPInventory["Depo & Yedek Parça Stoğu (OITM / OWHS)"]
        SAPEquipment["Müşteri Ekipman Kartları (OINS)"]
        SAPOrders["Satış Siparişleri & İrsaliyeler (ORDR)"]
    end

    TechMobile -->|HTTPS / Offline First| OfflineSync
    OfflineSync --> NextServer
    ManagerWeb --> NextServer
    NextServer --> AuthModule
    AuthModule --> ServiceLayer
    NextServer --> DocEngine
    ServiceLayer --> SAPServiceCalls
    ServiceLayer --> SAPInventory
    ServiceLayer --> SAPEquipment
    ServiceLayer --> SAPOrders
`

---

## ⚡ Temel Modüller ve Özellikler

- **Saha Servis Çağrısı Yönetimi:** SAP B1 Servis Çağrıları (OSCL) ile anlık çift yönlü senkronizasyon. Durum yönetimi, arıza kategorizasyonu ve teknisyen iş takibi.
- **Ekipman ve Makine Takibi:** Müşteri Ekipman Kartı (OINS) üzerinden seri numarası tarama, garanti sorgulama ve geçmiş servis müdahaleleri dökümü.
- **Yedek Parça ve Depo Entegrasyonu:** Teknisyen araç deposundan anlık parça düşümü, güncel fiyat listesi sorgulama ve SAP B1 üzerinde otomatik Satış Siparişi/İrsaliye taslağı oluşturma.
- **Dijital İmza ve Anında Servis Formu:** HTML5 Canvas ile sahada müşteri ıslak imzası alma, tek sayfalık kurumsal PDF servis teslim formu üretimi (pdf-lib).
- **Haftalık Planlama ve Takvim:** Koordinatörler için sürükle-bırak teknisyen iş atama, rota çizelgesi ve anlık durum panosu.
- **Performans ve Puantaj Raporlaması:** Teknisyen çalışma süreleri, fazla mesai onayı ve Excel'e tek tıkla aktarılabilir haftalık/aylık hakediş çizelgeleri.
- **Hızlı ve Güvenli PIN Girişi:** Sahada kolay kullanım için telefon numarası ve 4 haneli PIN ile hızlı oturum, SAP B1 Çalışan Kartı rol yetkilendirmesi ve JWT mimarisi.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknolojiler |
|:---|:---|
| **Ön Yüz** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PWA Service Workers |
| **Sunucu / API** | Next.js Server Components / Actions, RESTful Service Layer Entegrasyonu |
| **Kurumsal ERP** | SAP Business One (HANA / SQL) Service Layer API (v2) |
| **Belge ve İmza** | pdf-lib (Servis Formu PDF üretimi), exceljs (Puantaj), eact-signature-canvas |
| **Veri Görselleştirme** | echarts (Teknisyen SLA ve KPI grafikleri) |
| **Güvenlik** | Durumsuz JWT token mimarisi, bcrypt PIN şifreleme, SAP B1 rol tabanlı yetki kontrolü |

---

> 🔒 *Not: Bu depo teknik bir vitrin ve mimari portföyüdür. Gerçek üretim kaynak kodları ve şirket bağlantı bilgileri özel kurumsal depoda saklanmaktadır.*