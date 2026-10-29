# SAP Field Service

**English** | [Türkçe](README.tr.md)

A web app for field service teams that works on top of SAP Business One. Technicians open, update
and close service calls from their phones, log the parts they used, and get the customer's
signature on screen. Managers plan the week and see reports. All data stays in SAP; the app talks
to it through the Service Layer API. Built for a real company; names and settings in this copy are
replaced with examples.

| Sign in with phone and PIN | On a phone |
|---|---|
| ![Sign-in screen](docs/img/login.png) | ![Sign-in on a phone](docs/img/login-mobile.png) |

## Features

- **Service calls:** create, update and close SAP service calls; service and problem types come
  from SAP; history, activities and expenses on one screen.
- **Planning:** assign one or more technicians and plan the week on a calendar.
- **Parts and stock:** issue spare parts from SAP stock, create and approve sales orders, with
  live prices.
- **Customer equipment:** link the customer's machine (serial number, model) to the call.
- **Signatures and print:** customer and technician sign on screen; the service form prints on one
  page with all details.
- **Reports:** technician performance, weekly timesheet with Excel export, monthly summary,
  overtime approval.
- **Roles:** technician, regional supervisor, management and order management, taken from the
  employee's record in SAP.
- **Sign-in:** phone number and a 4-digit PIN set on first sign-in; JWT sessions.
- **Works on phones** as a Progressive Web App.

## Technology

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SAP Business One Service Layer,
JWT and bcrypt, ExcelJS, pdf-lib, Recharts, react-signature-canvas.

> This repository describes the project. The source code is kept in a private repository.
