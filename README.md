# NEU Library Visitor Log

**Technical Documentation & System Manual — v3.0**

Granado, Trixian Wackyll C — 2BSIT-5 — Academic Year 2025–2026

---

**Links:**
- [Live Web App](https://neu-library-v2.vercel.app/)
- [GitHub Repository](https://github.com/trixianwackyllgranado/neu-library)
- [Full Documentation (Detailed Word Manual)](https://docs.google.com/document/d/1BAP4Hs_O8H9dooD4hX2FuXTJp1h8HrrTj1rRERX4YJM/edit?usp=sharing)

> [!IMPORTANT]
> **Evaluation Instructions for Professor**
> - **Login Method:** Google OAuth only — use your `@neu.edu.ph` institutional Google account. There are no passwords.
> - **Test Visitor Account:** Sign in with any `@neu.edu.ph` Google account that has a registered profile, or use the pre-registered test visitor below.
> - **Role Switching (Prime Admin):** The prime admin account (`jcesperanza@neu.edu.ph`) has a **View as User** toggle in the sidebar to experience the visitor kiosk view without logging out.
> - **Book Catalog / Borrowing:** These modules are out of scope for v3 — the system is focused on the visitor log and library session tracking.

---

## Test Accounts

| Role | Email | Notes |
|------|-------|-------|
| Visitor (Student) | Any registered `@neu.edu.ph` account | Signs in via Google OAuth |
| Staff | Pre-invited staff account | Ask administrator for staff invite |
| Admin | `jcesperanza@neu.edu.ph` | Prime admin — full access + role switcher |

---

## What Changed from v2 to v3

| Area | v2 | v3 |
|------|----|----|
| Authentication | ID Number + Password (synthetic internal email) | Google OAuth — `@neu.edu.ph` only |
| User role name | Student | Visitor (students and faculty) |
| Visitor types | Student only | Student or Faculty/Professor |
| Staff invite | Hardcoded invite codes in `RegisterPage.jsx` | Admin-created `staffInvites` in Firestore; auto-detected on register |
| Visitor dashboard | Not present | Full-screen self-service `VisitorKioskPage` |
| Book Catalog | Present | Removed (visitor log focus) |
| Borrowing | Present | Removed (visitor log focus) |
| Block/Unblock users | Not present | Admin can block users; real-time enforcement via Firestore listener |
| Data snapshotting | Partial | All check-in paths write name/ID/course/college snapshots |
| Duplicate sessions | Not handled | Dedup on mount + atomic Firestore guard before write |
| Floating tutorials | Not present | Per-page guided tutorial bubble for all signed-in users |
| Prime admin | Not present | Special emails get role-switcher (admin ↔ visitor view) |
| Staff kiosk input | QR camera only | Unified: QR camera + manual ID/email input with smart formatting |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Project File Structure](#2-project-file-structure)
3. [Authentication System](#3-authentication-system)
4. [Application Layout & Navigation](#4-application-layout--navigation)
5. [Dashboard](#5-dashboard)
6. [Library Logger](#6-library-logger)
7. [Visitor Records](#7-visitor-records)
8. [User Management](#8-user-management-admin-only)
9. [Edit Requests](#9-edit-requests-admin-only)
10. [System Reports](#10-system-reports-admin-only)
11. [Data Integrity & Snapshotting](#11-data-integrity--snapshotting)
12. [Firestore Data Model](#12-firestore-data-model)
13. [Firestore Security Rules](#13-firestore-security-rules)
14. [Theming & UI Design](#14-theming--ui-design)
15. [Known Bugs Fixed](#15-known-bugs-fixed--debugging-log)
16. [Deployment](#16-deployment)
17. [Future Considerations](#17-future-considerations)

---

## 1. Introduction

The NEU Library Visitor Log is a full-stack web application developed for New Era University's library. It digitizes and automates core library operations including:

- Visitor check-in and check-out via QR code or ID number
- Real-time staff session monitoring and notifications
- User account management with role-based access control
- Administrative reporting and analytics

Built with React 18 on the frontend and Firebase (Firestore + Google Authentication) as the backend-as-a-service, deployed on Vercel. Supports three user roles — Visitor, Library Staff, and Administrator — each with a tailored interface and appropriate access permissions.

### 1.1 Technology Stack

| Technology | Role |
|-----------|------|
| React 18 (Vite) | Frontend UI framework. All pages are React functional components with hooks. |
| Firebase Authentication | Google OAuth login via `@neu.edu.ph` institutional accounts. |
| Cloud Firestore | NoSQL database for all app data — users, sessions, notifications, audit logs. |
| Vercel | Primary deployment target. Auto-deploys on every push to `main`. |
| Firebase Hosting | Secondary deployment target. |
| Tailwind CSS | Layout and spacing. CSS variables handle all theming. |
| React Router v6 | Client-side routing with role-based route guards. |
| Recharts | Bar and line charts in the Reports page. |
| html5-qrcode | QR code camera scanner in the Staff Kiosk. |
| qrcode.react | QR code generator for visitor QR codes. |

---

## 2. Project File Structure

### 2.1 Root

```
src/                  Main application source code
public/               Static assets (liblogo.png must be here)
package.json          Dependencies
firebase.json         Firestore rules/indexes deployment config
firestore.rules       Firestore security rules
firestore.indexes.json Composite indexes for compound queries
tailwind.config.js    Tailwind config (gold/amber primary palette)
vite.config.js        Vite build config
vercel.json           SPA rewrite rule (all routes → index.html)
.env.local            Firebase config (never committed)
```

### 2.2 `src/` Directory

```
src/main.jsx                          Entry point. Wraps App in ThemeProvider.
src/App.jsx                           Root router + DashboardRouter (routes visitors to kiosk).
src/firebase/config.js                Firebase init. Exports auth and db.
src/context/AuthContext.jsx           Google OAuth, registration, real-time block listener,
                                      prime admin role switching, online presence heartbeat.
src/context/ThemeContext.jsx          Dark/light mode toggle. Persisted in localStorage.
src/context/LibrarySessionContext.jsx Active session tracking, dedup, blocked-session cleanup.
src/context/TutorialContext.jsx       Floating tutorial system. Global toggle in Firestore.
src/data/colleges.js                  Static list of all NEU colleges and courses.
src/pages/VisitorKioskPage.jsx        Full-screen self-service kiosk for visitors.
src/pages/LoggerPage.jsx              Visit history and live session monitor (staff/admin).
src/pages/staff/StaffKioskPage.jsx    Staff check-in station (QR camera + manual ID input).
src/pages/staff/StudentRecordsPage.jsx Visitor records directory and profile view.
src/pages/admin/UserManagementPage.jsx User accounts, roles, block/unblock, audit log.
src/pages/admin/ReportsPage.jsx       Analytics and CSV exports.
src/pages/admin/EditRequestsPage.jsx  Visitor profile edit request queue.
src/components/admin/AdminDashboard.jsx Admin dashboard with stats and date filtering.
src/components/staff/StaffDashboard.jsx Staff dashboard with live occupancy.
src/components/visitor/VisitorKiosk.jsx Visitor check-in/check-out component with timer.
src/components/shared/AppLayout.jsx   Sidebar, mobile topbar, tutorial toggle, sign-out.
src/components/shared/RouteGuard.jsx  RequireAuth, RequireGuest, RequireRole guards.
src/components/shared/FloatingTutorial.jsx Per-page tutorial bubble.
```

---

## 3. Authentication System

Authentication uses Google OAuth via Firebase. Users sign in with their `@neu.edu.ph` institutional Google account. No passwords are required or managed.

### 3.1 Sign-In Flow

1. User clicks **Continue with Google** → Firebase opens a Google OAuth popup.
2. **Prime admin emails** (`jcesperanza@neu.edu.ph`, IT support) bypass domain checks and are auto-provisioned as admin.
3. **Non-NEU emails** are rejected immediately — user is signed out and shown an error modal.
4. **NEU emails with `blocked: true`** in Firestore are rejected with a "Your account has been blocked" error.
5. **NEU emails with a Firestore profile** are signed in directly.
6. **NEU emails with no profile** are redirected to `/register` to complete registration.

### 3.2 Real-Time Block Enforcement

`AuthContext` holds an `onSnapshot` listener on the signed-in user's Firestore document. The moment an admin writes `blocked: true`, the listener fires on all the user's active devices and calls `signOut()` immediately — no refresh needed.

`LibrarySessionContext` has a parallel listener that simultaneously force-closes any active library session with `forcedLogout: true`.

### 3.3 Prime Admin & Role Switching

Prime admin emails are defined in `PRIME_ADMIN_EMAILS` in `AuthContext.jsx`. These users get a **View as User** toggle in the sidebar that switches their `effectiveRole` between `admin` and `visitor`. `RequireRole` and `AppLayout` both read `effectiveRole` for routing and nav rendering.

### 3.4 Route Guards

| Guard | Behavior |
|-------|----------|
| `RequireGuest` | Redirects authenticated users away from `/login` and `/register` to `/dashboard`. |
| `RequireAuth` | Redirects unauthenticated users to `/login`. If `pendingGoogleUser` exists but no profile, redirects to `/register`. |
| `RequireRole` | Uses `effectiveRole` (not raw role) so prime admin view-switching works. Redirects wrong role to `/dashboard`. |

### 3.5 Registration (`/register`)

Only accessible when `pendingGoogleUser` is set (completed Google OAuth but has no Firestore profile). Email and name are pre-filled from Google.

**Visitor registration:**
- Visitor Type: Student or Faculty/Professor
- ID Number (auto-formatted to `YY-NNNNN-NNN`)
- Name fields (forced uppercase)
- Students: College + Course dropdowns
- Faculty: Department text field

**Staff/Admin registration (invite-detected):**
If the signed-in email matches a pending `staffInvites` document in Firestore, the form automatically detects the invite role and shows a confirmation banner. No code is typed — detection is automatic. On submit, the invite is marked `claimed`.

A `qrToken` (UUID) is generated and stored in Firestore for every account at registration time.

---

## 4. Application Layout & Navigation

Admin and staff pages render inside `AppLayout`. Visitors bypass `AppLayout` entirely and go directly to `VisitorKioskPage` (full-screen, no sidebar).

### 4.1 Sidebar Navigation

| Role | Navigation Items |
|------|-----------------|
| Visitor | None — uses VisitorKioskPage directly |
| Staff | Dashboard, Library Logger, Visitor Kiosk, Student Records |
| Admin | Dashboard, Library Logger, Visitor Kiosk, User Management, Student Records, Edit Requests *(with live badge count)*, Reports |

Collapsible to icon-only mode. State persists in `localStorage` under `neu-sidebar-collapsed`.

### 4.2 Floating Tutorial System

A floating **?** bubble appears on every page for all signed-in users. Per-page content is defined in `tutorialContent.js`.

- **Global on/off toggle:** persisted in Firestore under `tutorialPrefs/{uid}` — survives logout and device switches.
- **Per-page dismissal (Got it):** session-only React state — resets on reload or logout.
- Toggle button in sidebar footer shows **Guides: ON / Guides: OFF**.

### 4.3 Theme

Applied via `data-theme="dark"/"light"` on `<html>`. All components use CSS variables exclusively — no hardcoded colours. Preference stored in `localStorage` under `neu-theme`.

---

## 5. Dashboard

`/dashboard` is handled by `DashboardRouter` in `App.jsx`:

| Role | Renders |
|------|---------|
| `visitor` | `VisitorKioskPage` (full-screen, no sidebar) |
| `staff` | `StaffDashboard` inside `AppLayout` |
| `admin` | `AdminDashboard` inside `AppLayout` |

### 5.1 Visitor Kiosk (Visitor Dashboard)

Full-screen mobile-optimised self-service check-in. Shows:
- Welcome header with name and ID
- If not checked in: purpose selector + **Log In to Library** button
- If checked in: live `HH:MM` elapsed timer, entry time, purpose, **Log Out of Library** button

On check-in, a toast informs the visitor they can leave the screen on, close the app, or sign out — their session stays active until they check out.

Check-in uses an **atomic Firestore guard**: queries for any existing active session before writing. If one already exists (from another device), it aborts silently.

### 5.2 Staff Dashboard

- Live occupancy count (animated)
- Quick Actions: Library Logger, Visitor Kiosk
- Currently in Library live feed (visitor name pills)

### 5.3 Admin Dashboard

- Stats cards: Total Visitors, Total Log-ins, Currently In Library, Pending Edit Requests
- Date range filtering (Today / This Week / This Month / custom from–to)
- Quick Access: Visitor Records, Reports, User Management, Library Logger

---

## 6. Library Logger

### 6.1 Logger Page (`/logger`) — Staff/Admin Only

Visit history and live monitoring tool. **Not the check-in interface** — that is the Visitor Kiosk.

- **Live Sessions tab:** active sessions with name, ID, purpose, entry time, elapsed duration. Click row → navigates to Visitor Records profile.
- **Visit History tab:** paginated log with search (name, ID, purpose) and course filter.
- **Status badges:** `Exited` for normal exits, `Force-Exit` (compact, no wrap) for force-closed sessions.
- **Null guard:** entries with no live user doc AND no snapshot name are hidden automatically.

### 6.2 Staff Kiosk (`/staff/kiosk`) — Staff/Admin Only

Unified check-in station: QR camera scanner + manual ID/email input field.

**Smart ID/email input:**
- Typing digits → auto-formats to `YY-NNNNN-NNN`
- Typing any letter → appends `@neu.edu.ph` as a visual overlay (cursor never jumps — suffix is an absolutely-positioned `<span>`, not part of the input value)
- Typing `@` manually → left as-is for custom emails

**QR Camera Scanner:**
- Reads `qrToken` UUID from visitor's QR code
- Checks in or out based on current active session status
- Camera stops after each scan, restarts after toast clears
- Purpose modal appears for check-in; check-out is immediate

Every `addDoc` call writes **identity snapshot fields** (`studentName`, `studentIdNumber`, `studentCourse`, `studentCollege`) alongside `uid`.

> **Debug:** Camera kept running after a successful scan in early builds, causing confusing UX. Scanner now stops before showing the purpose modal and does not auto-restart after confirm.

> **Debug:** Firestore `logger` create rule originally required `uid == request.auth.uid`. Staff writing a doc with `uid: visitorUID` while logged in as `staffUID` caused the write to be rejected silently. Fixed by adding `isStaffOrAdmin()` to the create rule.

---

## 7. Visitor Records (`/staff/records`)

Searchable directory of all registered visitors (`role: visitor`). Previously named Student Records.

- Search by name, ID, course, college, or email
- Filter by course and college
- Sort by name, ID, or college
- Export as `visitors.csv`
- Visitor type badge shows `visitorType` field (student, faculty, etc.)

**Profile view:** personal info, visitor type, library visit history. Navigable from Logger page row clicks via React Router state (`openStudentId`).

---

## 8. User Management (`/admin/users`) — Admin Only

### 8.1 Tabs

Five tabs: **All, Visitors, Staff, Admins, Blocked**. Blocked users are hidden from all other tabs and only appear under Blocked.

### 8.2 Profile Panel Actions

**Role section:**
- Promote to Staff / Demote to Visitor — requires written reason (min 10 chars), logged in Audit Log

**Edit section:**
- Edit Profile (college/course) — logged in Audit Log
- Edit Name (last/first/middle) — requires reason, logged in Audit Log

**Danger Zone:**
- **Block Account** — sets `blocked: true` in Firestore, writes audit log entry, force-signs out user on all devices in real time, force-closes any active library session
- **Unblock Account** — sets `blocked: false`, user can log in and check in immediately

### 8.3 Audit Log

Immutable history of all admin actions. Activity types tracked:

| Type | Records |
|------|---------|
| `role_change` | Who changed whose role, from/to what, with reason |
| `edit_approved` | Which fields were changed, by whom |
| `name_change` | Old name → new name, admin, reason |
| `program_change` | Old college/course → new college/course |
| `block` | Who was blocked, by whom, timestamp |
| `unblock` | Who was unblocked, by whom, timestamp |
| `user_deletion` | Deleted user info, who requested/approved, reason, records snapshotted |

Firestore rules set `allow update, delete: if false` on `adminAuditLogs` — these records are immutable.

### 8.4 User Deletion Workflow

Two-step process to prevent accidental permanent deletions:
1. Admin clicks Delete → modal requires a reason (min 10 chars) → creates `deleteRequests` doc with `status: pending`
2. Admin approves → system snapshots all borrows and logger entries with `userDeleted: true` → hard-deletes `users/{uid}` → writes `user_deletion` audit log entry

---

## 9. Edit Requests (`/admin/edit-requests`) — Admin Only

When visitors submit profile update requests (name, ID, course, college), they appear here for admin review.

| Status | Description |
|--------|-------------|
| `pending` | Awaiting review — shows Approve / Reject buttons |
| `approved` | Change applied — shows approved-by name and timestamp |
| `rejected` | Shows rejection reason and rejected-by name |
| `reopened` | Re-opened for reconsideration |

Approving immediately updates the visitor's Firestore document and writes a `program_change` audit log entry.

---

## 10. System Reports (`/admin/reports`) — Admin Only

Uses one-time `getDocs` calls (not `onSnapshot` listeners) to avoid Firestore quota issues. Manual **Refresh Data** button re-fetches. Shows exact time of last fetch.

> **Debug:** An earlier version used 5 simultaneous `onSnapshot` listeners. Every database write triggered re-reads across all 5 collections on every connected client with Reports open. This caused the Firestore Spark plan (50,000 reads/day) to be exceeded. Switching to on-demand `getDocs` dropped the daily read count dramatically.

**Overview tab:** Library Log-Ins per Day (line chart), Visit Purpose Distribution (bar chart), Visitors by College (bar chart), total stats cards, CSV export.

**Visitor Activity tab:** searchable combo-box to select a visitor and view their full visit log. Exportable as CSV.

---

## 11. Data Integrity & Snapshotting

### 11.1 Identity Snapshots

Every `addDoc` call that creates a logger entry writes these fields alongside `uid`:

| Field | Notes |
|-------|-------|
| `studentName` | Full name at time of check-in |
| `studentIdNumber` | ID at time of check-in |
| `studentCourse` | Course at time of check-in |
| `studentCollege` | College at time of check-in |

This ensures visit records remain readable even if the user's account is deleted later.

### 11.2 Null Row Filtering

Entries with both no live user doc AND no snapshot name are filtered out of the Logger and Reports pages. This hides orphaned pre-snapshot legacy entries instead of showing blank rows.

### 11.3 Duplicate Session Prevention

Two layers:
1. **On mount:** `LibrarySessionContext` queries all active sessions for the current uid. If more than one exists, keeps the earliest and batch-closes the rest with `forcedLogout: true`.
2. **On check-in:** `checkIn()` performs an atomic `getDocs` query before writing. If an active session already exists, it aborts silently. Catches cross-device race conditions that frontend state debounce cannot.

---

## 12. Firestore Data Model

### 12.1 Collections

| Collection | Purpose |
|-----------|---------|
| `users` | One doc per registered user. Profile, role, `qrToken`, `blocked` flag. |
| `logger` | One doc per library visit. Session data + identity snapshot fields. |
| `notifications` | Notifications sent to visitors by staff. |
| `adminAuditLogs` | Immutable log of all admin actions. |
| `deleteRequests` | Pending user deletion requests. |
| `staffInvites` | Pre-created invite records for staff/admin. Auto-detected on register. |
| `editRequests` | Visitor-submitted profile edit requests. |
| `tutorialPrefs` | Per-user tutorial enabled/disabled preference. |
| `onlinePresence` | Per-user online status heartbeat (updated every 5 minutes). |

### 12.2 `users/{uid}` Schema

| Field | Type |
|-------|------|
| `uid` | string — Firebase Auth UID |
| `email` | string — `@neu.edu.ph` Google account email (lowercase) |
| `firstName`, `lastName`, `middleInitial` | string — UPPERCASE |
| `idNumber` | string — `YY-NNNNN-NNN` format |
| `qrToken` | string — UUID generated at registration |
| `role` | string — `"visitor"` \| `"staff"` \| `"admin"` |
| `visitorType` | string \| null — `"student"` \| `"faculty"` |
| `college`, `course`, `department` | string \| null |
| `blocked` | boolean |
| `blockedAt`, `blockedBy` | Timestamp \| null, string \| null |
| `isPrimeAdmin` | boolean — true for prime admin emails only |
| `createdAt` | Firestore Timestamp |

### 12.3 `logger/{sessionId}` Schema

| Field | Type |
|-------|------|
| `uid` | string |
| `purpose` | string |
| `entryTime`, `exitTime` | Timestamp |
| `active` | boolean |
| `forcedLogout`, `webSignedOut` | boolean |
| `studentName`, `studentIdNumber`, `studentCourse`, `studentCollege` | string — snapshot fields |

---

## 13. Firestore Security Rules

### Key Rules

| Collection | Rule Summary |
|-----------|-------------|
| `users` | Users read/update own doc. Admins update non-admin users (role can only be set to `"staff"` or `"visitor"` — never `"admin"`). |
| `logger` | Visitors read/create own entries. Staff/admin read all and create entries for any uid (required for kiosk check-in on behalf of visitor). |
| `notifications` | Visitors read own. Staff/admin create and update. Visitors can only update `acknowledged` / `acknowledgedAt` on their own. |
| `adminAuditLogs` | Admin read and create only. Update and delete blocked for everyone — immutable. |
| `deleteRequests` | Staff/admin create. Admin reads and updates (approve/reject). |

### No-Admin-Promotion Enforcement

The `users` rule explicitly checks that `role` can only be written as `"staff"` or `"visitor"` in any admin update. Even a raw Firestore API call attempting `role: "admin"` is rejected at the database level.

---

## 14. Theming & UI Design

### Typography

| Font | Usage |
|------|-------|
| Poppins | Primary body font. Labels, descriptions, button text. |
| Playfair Display | Display / serif. Page titles, modal headings, large numbers. |
| IBM Plex Mono | Monospace. ID numbers, timestamps, badge labels. |

### CSS Variables (key)

| Variable | Usage |
|----------|-------|
| `--gold` | Primary accent. Active nav items, headings, key borders. |
| `--green` / `--green-soft` | Active sessions, check-in confirmations, success states. |
| `--red` / `--red-soft` | Danger zone, blocked users, check-out, errors. |
| `--card` | Card background. |
| `--text-primary` / `--text-muted` | Main and secondary text. |
| `--row-hover-bg` | Table row hover. Subtle in dark mode. |

---

## 15. Known Bugs Fixed — Debugging Log

| Bug | Fix |
|-----|-----|
| Blank rows in visit history | All check-in paths now write snapshot fields. Null guard filters entries with no live user doc AND no snapshot name. |
| Cursor jumping when typing email in Staff Kiosk | `@neu.edu.ph` rendered as absolutely-positioned `<span>` overlay, not injected into input value. |
| Duplicate active library sessions from multi-device check-in | Atomic `getDocs` guard in `checkIn()` + dedup `useEffect` on mount. |
| Blocked user not kicked out in real time | `onSnapshot` listener in `AuthContext` calls `signOut()` immediately. Parallel listener in `LibrarySessionContext` force-closes active session. |
| Student Records empty (role mismatch) | Query was `where('role', '==', 'student')` but system uses `'visitor'`. Fixed. |
| Visitor tutorial bubble not showing | `VisitorKioskPage` renders outside `AppLayout`. Fixed by importing `FloatingTutorial` directly into `VisitorKioskPage`. |
| Tutorial icons rendering as raw SVG text | Changed render from `{content.icon}` to `dangerouslySetInnerHTML={{ __html: content.icon }}`. |
| Dark mode table row hover shows solid white | Replaced `hover:bg-gray-50` with CSS variable `var(--row-hover-bg)` via `log-row` class. |
| Firestore quota exceeded (50,000 reads/day) | Reports page converted from 5 `onSnapshot` listeners to one-time `getDocs` calls in `Promise.allSettled()`. |
| Scanner instantly re-checked-out visitor after check-in | `html5-qrcode` replayed buffered QR frame on scanner restart. Fixed by stopping scanner before purpose modal and not auto-restarting after confirm. |
| Staff kiosk write rejected by Firestore | `logger` create rule required `uid == request.auth.uid`. Fixed by adding `isStaffOrAdmin()` permission. |
| `adminAuditLogs` permission errors after collection created | Collection existed in code but not in `firestore.rules`. Fixed by adding explicit rule block. |

---

## 16. Deployment

### Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

### Environment Variables (`.env.local`)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### Vercel

Primary deployment target. Every push to `main` triggers an automatic build and deploy.
- Build command: `npm run build`
- Output directory: `dist`
- `vercel.json` rewrites all routes to `index.html` for React Router SPA navigation.

### Firebase

```bash
firebase deploy --only firestore:rules           # rules only
firebase deploy --only firestore:indexes         # indexes only
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy                                  # everything
```

---

## 17. Future Considerations

**Time-limited Staff Role with Auto-Expiry**
Add `roleExpiresAt` timestamp when promoting a visitor to staff. A Cloud Function (or login check) automatically demotes them when the date passes. Ideal for OJT students.

**Staff Permission Tiers**
Add `staffLevel` field: `"limited"` (kiosk + logger only) vs `"full"` (all access + exports). OJT students get `"limited"`.

**Extended Action Audit**
Log every time a staff member views a visitor's full profile or exports CSV. Flag OJT accounts in audit entries.

**Login Anomaly Alerts**
Store `lastLoginAt` and `lastUserAgent` per login. Alert admin via email if a staff account logs in from an unusual device.

**Firestore Blaze Plan**
With active usage, the Spark plan's 50,000 reads/day can be approached. Upgrading to Blaze (pay-as-you-go) applies the same free tier but bills fraction-of-a-cent rates for usage above it.

---

## Appendix — Navigation Map

| URL | Component | Access |
|-----|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public (requires pending Google OAuth) |
| `/dashboard` | `VisitorKioskPage` / `AdminDashboard` / `StaffDashboard` | All roles |
| `/logger` | `LoggerPage` | Staff + Admin |
| `/staff/kiosk` | `StaffKioskPage` | Staff + Admin |
| `/staff/records` | `StudentRecordsPage` (Visitor Records) | Staff + Admin |
| `/admin/users` | `UserManagementPage` | Admin only |
| `/admin/reports` | `ReportsPage` | Admin only |
| `/admin/edit-requests` | `EditRequestsPage` | Admin only |

---

*New Era University — Library Visitor Log — Technical Documentation v3.0*
