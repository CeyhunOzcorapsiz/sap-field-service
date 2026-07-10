# SAP Field Service Management

A web application integrated with SAP Business One (SAP B1) Service Layer that digitizes all workflows of field technical service teams. Technicians use it on-site via mobile devices while management monitors operations from the office.

> This repository serves as the project's showcase and documentation page. The source code is maintained in a private repository.

---

## About the Project

Built to eliminate paper forms, phone-based coordination, and manual reporting in technical service operations. All data resides in SAP Business One; the application acts as a proxy to the SAP Service Layer API.

### Problems Solved

- Inability to create, update, and close service calls from the field
- Manual technician assignment and weekly scheduling
- Delayed inventory tracking of parts used during service
- Customer signatures collected on paper forms with risk of loss
- Performance and overtime reports prepared manually in Excel

---

## Features

### Service Call Management
Create, update, and close service calls through the SAP B1 Service Calls module. Service types (fault/maintenance/installation), problem types, and subtypes are dynamically fetched from SAP. Call history, performed activities, and expenses are tracked from a single screen.

### Technician Assignment & Scheduling
One or more technicians can be assigned to each service call. A weekly planning screen provides visual schedule management. Technicians view their assigned jobs from a dedicated panel.

### Inventory & Goods Issue
Spare parts used during service can be issued from SAP inventory (Goods Issue). Sales order creation and approval workflows are also available. Pricing is fetched live from SAP.

### Customer Equipment Tracking
SAP Customer Equipment Card integration links customer-owned equipment (serial number, model, etc.) to service calls.

### Digital Signature
Both customer and technician can sign digitally (canvas-based). Signatures are stored on the server and included in the printed service form.

### Print / PDF
The service form is rendered with a print-optimized layout. All details, activities, parts, and signatures fit on a single page.

### Reporting
- **Performance Report**: Per-technician service call statistics
- **Timesheet (Weekly Schedule)**: Per-technician weekly work schedule with Excel export
- **Monthly Summary**: Period-based overview report
- **Overtime Tracking**: Overtime approval status and reporting

### Order Approval Workflow
Sales orders can be created and approved by authorized roles.

### Role-Based Access Control
Four distinct user roles:
- **Technician**: Views assigned services, logs work/parts, collects signatures
- **Regional Supervisor**: Manages all services in their region, views reports
- **Management**: Full system access, approvals, report viewing
- **Order Management**: Sales orders and inventory operations

Roles are automatically derived from the UDF or department code on SAP EmployeesInfo.

### Authentication
Phone number + 4-digit PIN login. PIN is set on first login. JWT-based session management (access + refresh tokens). Routes protected via middleware.

### Mobile-Friendly (PWA)
Runs as a Progressive Web App. Responsive design for comfortable field use on phones and tablets.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless, no separate backend) |
| ERP Integration | SAP Business One Service Layer (OData v2, REST) |
| Database | SAP HANA (via SAP B1, no separate DB) |
| Authentication | JWT (access + refresh tokens), bcrypt PIN hashing |
| Excel Export | ExcelJS |
| PDF Generation | pdf-lib |
| Charts | Recharts |
| Digital Signature | react-signature-canvas |
| Icons | Lucide React |
| Language | TypeScript (strict mode) |

---

## Architecture

- **Single app, two layers**: Next.js App Router serves both frontend and backend in one project. API routes act as a proxy to SAP Service Layer; the client never accesses SAP directly from the browser.
- **SAP Service Layer client**: Singleton session management with automatic login/cookie handling and error processing. All SAP requests go through a centralized client.
- **File-based stores**: Data not stored in SAP (PINs, signatures, active job status) is persisted in server-side JSON files — lightweight, no additional database required.
- **Role mapping**: Application roles are automatically derived from SAP department codes or UDF values. Route protection is enforced at the middleware level.

---

## Project Structure (Overview)

```
app/
  (auth)/         → Login screen (phone + PIN)
  (dashboard)/    → Home, service management, inventory, reports, scheduling, settings
  (print)/        → Printable service form
  api/
    auth/         → Login, PIN, session endpoints
    sap/          → SAP Service Layer proxy (service calls, items, warehouses, etc.)
    rapor/        → Reporting (timesheet, performance, monthly)
    mesai/        → Overtime approval
    plan/         → Weekly scheduling

components/
  layout/         → Header, Sidebar, MobileNav
  servis/         → SignaturePad, PhotoUploader
  ui/             → Button, Input, Card, Modal, Badge, Toast, Select, LoadingSpinner

lib/
  auth/           → JWT utilities, role mapping
  sap/            → SAP client, endpoint definitions, query helpers
  server/         → Server-side stores (PIN, signature, timesheet, active job)
  hooks/          → React hooks (useServiceCalls, useItems, useBusinessPartners, etc.)
  contexts/       → AuthContext (session state)
  utils/          → Formatting, validation, time, phone helpers
```

---

## SAP B1 Integration Details

The application communicates with SAP Business One Service Layer (typically port 50000). Key SAP modules and entities used:

- **ServiceCalls**: Service call CRUD + closure
- **ServiceCallSchedulings (SCL6)**: Technician assignment and scheduling
- **ServiceCallActivities**: Call activities
- **BusinessPartners**: Customer information
- **Items**: Product/part catalog
- **CustomerEquipmentCards**: Customer equipment cards
- **EmployeesInfo**: Employee information, department, role UDF
- **Orders / DeliveryNotes**: Sales orders and goods issue
- **Warehouses**: Warehouse information

### User Defined Fields (UDFs)
- `EmployeesInfo.U_ROL` — Role assignment
- `EmployeesInfo.U_TELEFON` — Phone number for login
- `DocumentLines.U_HIZMET_CAGRISI` — Document-to-service-call relation

---

## License

MIT
