# NEU Library Management System v2

A full-stack web application for New Era University built with **React 18 + Vite**, **Tailwind CSS**, and **Firebase** (Auth + Firestore).

---

## What Changed in v2

| Area | v1 | v2 |
|------|----|----|
| Sign-up | Email + long profile form (CompleteProfilePage) | ID Number + name + course only |
| Login | Email/password or ID number | ID Number + password |
| QR Code | Not present | Generated at sign-up; shown on dashboard |
| Logger check-in | Manual via web app | Staff webcam scans student QR code |
| Auth email | `@neu.edu.ph` user email | Synthetic internal email (hidden) |
| Invite codes | Required for staff/admin | Removed — use admin UI |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| Routing | React Router v6 |
| QR Generation | qrcode.react |
| QR Scanning | html5-qrcode |
| Charts | Recharts |

---

## Roles

| Role | Access |
|------|--------|
| Student | Dashboard with QR code, Book Catalog, My Borrows, Library Logger |
| Staff | All student access + QR Scanner station, Borrowing management, Student Records |
| Admin | All staff access + User Management, Reports |

---

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your Firebase config
npm run dev
```

See **DEPLOY.md** for full setup, migration, and deployment instructions.

---

## New User Schema

```js
{
  uid:           string,   // Firebase Auth UID
  idNumber:      string,   // "22-12345-123"
  lastName:      string,
  firstName:     string,
  middleInitial: string,   // single letter, no period
  college:       string,
  course:        string,
  role:          "student" | "staff" | "admin",
  createdAt:     Timestamp,
}
```

---

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles and roles |
| `books` | Book catalog |
| `borrows` | Borrow transactions |
| `logger` | Library check-in/out sessions |
| `notifications` | Staff-to-student call-to-counter messages |
| `roleChangeLogs` | Immutable audit trail for role changes |
| `bookLogs` | Catalog add/edit/delete activity log |
| `emailQueue` | Queued email reminders |

---

*New Era University — Library Management System*
