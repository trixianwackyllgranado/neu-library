# NEU Library Management System

**Technical Documentation & System Manual**

Granado, Trixian Wackyll C — 2BSIT-5 — Academic Year 2025–2026

---

**Links:**
- [Full Documentation (Google Docs — easier to navigate)](https://docs.google.com/document/d/1itbqZc4-17EsljgMnfr4uOMbAT7ww3SjBoMi5ls2tlc/edit?usp=sharing) *(replace with actual Docs link)*
- [Live Web App](https://neu-library-henna.vercel.app) 
- [GitHub Repository](https://github.com/trixianwackyllgranado/neu-library)

**Test Accounts:**

| Role    | ID Number     | Password    |
|---------|---------------|-------------|
| Student | 33-33333-333  | 123456789   |
| Staff   | 11-11111-111  | 123456789   |
| Admin   | 22-22222-222  | 123456789   |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Project File Structure](#2-project-file-structure)
3. [Authentication System](#3-authentication-system)
4. [Application Layout & Navigation](#4-application-layout--navigation)
5. [Dashboard](#5-dashboard)
6. [Book Catalog](#6-book-catalog)
7. [Borrowing & Circulation](#7-borrowing--circulation)
8. [Library Logger](#8-library-logger)
9. [Student Records](#9-student-records)
10. [User Management (Admin Only)](#10-user-management-admin-only)
11. [Shared Modals](#11-shared-modals)
12. [System Reports (Admin Only)](#12-system-reports-admin-only)
13. [Firestore Data Model](#13-firestore-data-model)
14. [Firestore Security Rules](#14-firestore-security-rules)
15. [Theming & UI Design](#15-theming--ui-design)
16. [Known Bugs Fixed — Debugging Log](#16-known-bugs-fixed--debugging-log)
17. [Deployment](#17-deployment)
18. [Future Considerations](#18-future-considerations)

---

## 1. Introduction

The NEU Library Management System (LMS) is a full-stack web application developed for New Era University's library. It digitizes and automates core library operations including:

- Student check-in and check-out via QR code
- Book borrowing and circulation management
- Real-time staff notifications
- User account management
- Administrative reporting

Built with React on the frontend and Firebase (Firestore + Authentication) as the backend-as-a-service, deployed on Vercel. Supports three user roles — Student, Library Staff, and Administrator — each with a tailored interface and appropriate access permissions.

### 1.1 Purpose of This Document

This document is a comprehensive technical and functional reference covering:

- System architecture and file structure
- All features and how they work, from the smallest detail to major workflows
- Authentication and role-based access control
- Firestore data model and security rules
- Debugging notes — problems encountered during development and how they were resolved
- Deployment configuration

### 1.2 Technology Stack

| Technology | Role / Purpose |
|---|---|
| React 18 (Vite) | Frontend UI framework. All pages and components are React functional components with hooks. |
| Firebase Authentication | Handles user login. Users authenticate with a derived email format (ID number + `@neu-lib.internal`) and a password. |
| Cloud Firestore | NoSQL document database for all application data — users, books, borrows, sessions, notifications, audit logs. |
| Firebase Hosting | One of two supported deployment targets. |
| Vercel | Primary deployment target. Automatic deploys on every GitHub push to `main`. |
| Tailwind CSS | Utility-first CSS framework for layout and spacing. CSS variables handle theming. |
| React Router v6 | Client-side routing with role-based route guards. |
| Recharts | Chart library used in the Reports page for bar, line, and pie charts. |
| html5-qrcode | QR code camera scanner used in the QR Logger page. |
| qrcode.react | QR code generator used to display each student's personal library QR code. |

### What Changed in v2

| Area | v1 | v2 |
|---|---|---|
| Sign-up | Email + long profile form (CompleteProfilePage) | ID Number + name + course only |
| Login | Email/password or ID number | ID Number + password |
| QR Code | Not present | Generated at sign-up; shown on dashboard |
| Logger check-in | Manual via web app | Staff webcam scans student QR code |
| Auth email | `@neu.edu.ph` user email | Synthetic internal email (hidden) |
| Invite codes | Required for staff/admin | Removed — use admin UI |

---

## 2. Project File Structure

### 2.1 Root Directory

| File / Directory | Purpose |
|---|---|
| `src/` | Main application source code (React components, pages, contexts, data). |
| `public/` | Static assets. `neu-logo.png` (the NEU library logo) must be placed here. |
| `tools/` | Utility scripts for database migrations. |
| `package.json` | Project dependencies: React, Firebase, Tailwind, Recharts, html5-qrcode, qrcode.react. |
| `firebase.json` | Firebase Hosting config and Firestore rules/indexes deployment pointers. |
| `firestore.rules` | Firestore security rules. Controls who can read/write each collection. |
| `firestore.indexes.json` | Composite Firestore indexes required for compound queries. |
| `tailwind.config.js` | Tailwind configuration. Primary color palette remapped to amber/gold. |
| `vite.config.js` | Vite build tool configuration. |
| `vercel.json` | Vercel deployment settings — rewrites all routes to `index.html` for SPA routing. |
| `.env.local` | Firebase API keys and project config. Never committed to version control. |

### 2.2 `src/` Directory

| Path | Contents |
|---|---|
| `src/main.jsx` | React entry point. Renders `App` inside `ThemeProvider`. |
| `src/App.jsx` | Root router. Defines all routes with `RequireAuth` / `RequireRole` guards. |
| `src/firebase/config.js` | Firebase initialization. Exports `auth` and `db` instances. |
| `src/context/AuthContext.jsx` | Authentication state, register, login, logout, profile fetch, password reset flag. |
| `src/context/ThemeContext.jsx` | Dark/light mode toggle. Persisted in localStorage. |
| `src/context/LibrarySessionContext.jsx` | Tracks active library check-in sessions for the logged-in student. |
| `src/data/colleges.js` | Static list of all NEU colleges and their courses. Used in registration dropdowns. |
| `src/pages/` | One component per page/route. |
| `src/components/admin/` | `AdminDashboard.jsx` — admin-specific dashboard view. |
| `src/components/staff/` | `StaffDashboard.jsx` — staff-specific dashboard view. |
| `src/components/student/` | `StudentDashboard.jsx` — student-specific dashboard view. |
| `src/components/shared/` | AppLayout, RouteGuard, NotificationBanner, modals — shared across roles. |

---

## 3. Authentication System

Authentication is handled entirely through Firebase Authentication using a custom email format derived from each user's ID number. No actual email addresses are required or collected.

### 3.1 ID Number to Email Conversion

Firebase Authentication requires an email address format, so the system converts each user's ID number to a synthetic internal email:

```
Formula:  {idNumber}@neu-lib.internal
Example:  22-12345-123  →  22-12345-123@neu-lib.internal
```

This is done automatically in `AuthContext.jsx` by the `idToEmail()` function and is never displayed to users. All user-facing interactions use the raw ID number only.

### 3.2 Route Guards

Three guard components in `RouteGuard.jsx` protect all routes:

| Guard | Behavior |
|---|---|
| `RequireGuest` | Redirects authenticated users away from `/login` and `/register` to `/dashboard`. |
| `RequireAuth` | Redirects unauthenticated users to `/login`. Shows a loading spinner while auth state resolves. |
| `RequireRole` | Redirects users without the required role back to `/dashboard`. Used on staff and admin routes. |

> **Debug Note:** Early builds allowed students to manually navigate to `/admin/users` by typing the URL. `RequireRole` was added to block this.

### 3.3 Login Page

Located at `/login`. Accessible to unauthenticated users only (`RequireGuest` wraps it).

Features:
- ID number field with auto-formatting — as the user types digits, dashes are inserted automatically in the `YY-NNNNN-NNN` pattern.
- Password field with show/hide toggle.
- Friendly Firebase error messages — all Firebase error codes are mapped to human-readable strings in `AuthContext.parseFirebaseError()`. For example, `auth/invalid-credential` shows "Incorrect ID number or password." instead of the raw Firebase message.
- NEU colour bar — a 3px decorative bar at the top of the page in red, orange, green, and blue matching NEU's official brand colours.

### 3.4 Registration Page

Located at `/register`. Accessible to unauthenticated users only.

**Mobile vs Desktop Behaviour**

The registration page detects screen width using a `window.innerWidth < 768` check with a resize event listener. On mobile:
- Only the Student account type button is shown.
- A small info notice appears: "Staff and Administrator registration is only available on desktop. Please use a computer to register a staff or admin account."
- If the user resizes from desktop to mobile while Staff or Admin is selected, the role automatically resets to Student.

**Student Registration**

The student form collects:
- **Student Number** — auto-formatted as `YY-NNNNN-NNN` using the same `formatId()` helper as the login page.
- **Last Name, First Name, Middle Initial** — all forced to uppercase on every keystroke. The `toUpperCase()` call is on `onChange`, so the user sees caps as they type. This is enforced again in `AuthContext.register()` before writing to Firestore.
- **College** — a dropdown populated from the `COLLEGES` array in `src/data/colleges.js`.
- **Course** — a second dropdown that dynamically populates based on the selected college. Colleges with no courses show no course field.
- **Password and Confirm Password** — minimum 8 characters.

**Staff / Administrator Registration**

On desktop, selecting Library Staff or Administrator shows an invitation code gate before the form is revealed:
- A gold-bordered card prompts for the invitation code.
- The codes are hardcoded in `RegisterPage.jsx`: `NEU-STAFF-2123` for staff, `NEU-ADMIN-2067` for admin.
- Wrong code shows a red error inline. Correct code shows a green "Invitation code verified" badge and unlocks the rest of the form.
- Switching roles resets the verification state.

Staff/Admin form differences from Student:
- The ID field label and placeholder change to "Staff ID".
- College and Course fields are removed entirely. The system automatically sets college to `"LIBRARY STAFF"` and course to the role name.

**After Successful Registration**

On successful registration, the form transitions to a success screen showing:
- The user's full name and ID number.
- A QR code for the student — generated as a UUID token stored in Firestore (`qrToken` field) and rendered using the `qrcode.react` library.
- Instructions on how to use the QR code.
- A "Proceed to Sign In" button.

Every account — including staff and admin — receives a `qrToken` at registration. If a staff account is ever demoted to Student, the QR code is already there and works immediately.

---

## 4. Application Layout & Navigation

Once logged in, all pages are rendered inside the `AppLayout` component (`src/components/shared/AppLayout.jsx`). This provides the sidebar navigation, mobile topbar, notification banner, and sign-out logic.

### 4.1 Sidebar

The sidebar is visible on desktop (≥768px) and hidden on mobile. It is collapsible — clicking the chevron button collapses it to icon-only mode.

Navigation items are role-specific:

| Role | Navigation Items |
|---|---|
| Student | Dashboard, Book Catalog, My Borrows, Library Log |
| Staff | Dashboard, Book Catalog, Borrowing, Library Logger, Student Records, QR Scanner |
| Admin | All Staff items + User Management + Reports |

The Borrowing nav item shows a live badge count of pending borrow requests for staff and admin — updated in real-time via an `onSnapshot` listener.

### 4.2 Mobile Navigation

On mobile, a topbar replaces the sidebar. It contains the NEU Library logo, system title, and a hamburger menu button. Tapping the hamburger opens the sidebar as a slide-in drawer with a blurred overlay backdrop.

### 4.3 Theme Toggle

The theme toggle button (sun/moon icon) appears in the sidebar footer on desktop and in the mobile topbar. Clicking it switches between light and dark mode. The preference is stored in localStorage under `"neu-theme"` and applied by setting a `data-theme` attribute on the document root element, which CSS variables read from.

> **Debug Note:** Early UI builds used hardcoded Tailwind color classes (`bg-white`, `bg-gray-50`, `text-gray-800`) which broke in dark mode. These were systematically replaced with CSS variables (`var(--card)`, `var(--text-primary)`, `var(--divider)`) across all components. Tables, modals, and hover states were the most frequent offenders.

### 4.4 Notification Banner

Rendered by `NotificationBanner.jsx` inside `AppLayout`, directly above the main page content. Only rendered for students with unacknowledged notifications.

The banner queries Firestore for notifications where `toUid` matches the current user, `resolved == false`, and `acknowledged == false`. Each notification shows the sender's name and the message. When acknowledged, a Firestore `updateDoc` sets `acknowledged: true` and `acknowledgedAt` to the server timestamp.

> **Debug Note:** An earlier version queried only `resolved == false`, which meant acknowledged notifications kept reappearing on every page refresh and login. Three stacked notifications were visible that could not be cleared. The fix was adding `acknowledged == false` to the Firestore query.

### 4.5 Sign-Out with Active Session

If a student attempts to sign out while checked into the library, the system intercepts the logout and shows a modal explaining they are still checked in. The user can sign out anyway (which marks `webSignedOut: true` on the session) or cancel and return to check out properly first.

---

## 5. Dashboard

The dashboard route (`/dashboard`) is handled by `DashboardPage.jsx`, which reads the user's role from `AuthContext` and renders the appropriate dashboard component.

### 5.1 Student Dashboard

Shows a personal overview for the logged-in student.

- **Greeting header** with the student's name, ID number, and course.
- **Stats row** — Active Borrows, Overdue count, Pending requests, Total borrows. Numbers update live from a Firestore `onSnapshot` listener.
- **QR Code card** — displays a small preview of the student's library QR code. Clicking it opens a full-size QR modal.
- **Library Session card** — shows whether the student is currently checked into the library, with a live elapsed time counter if they are. Has Check In / Check Out buttons.
- **Recent Borrows table** — last 6 borrows with book title, dates, and status badge.

**QR Code Save Feature**

The "Save as Image" button in the QR modal uses the browser's built-in `XMLSerializer` to serialize the SVG QR code, draws it onto a canvas element with a white background, converts it to a PNG using `canvas.toDataURL()`, and triggers a download named `QR-{idNumber}.png`. This works without any server-side processing or additional libraries.

### 5.2 Staff Dashboard

Shows operational stats relevant to library staff.

- **Live stat cards:** Pending Requests, Active Borrows, Overdue count, In Library Now.
- **Quick Actions grid:** QR Scanner, Borrowing, Student Records, Book Catalog.
- **Currently in Library panel** — shows a live list of active sessions with their visit purposes.

### 5.3 Admin Dashboard

Extends the staff view with user counts and system-wide access.

- **Users section:** Total Users, Students, Staff & Admins.
- **Borrowing section:** Books in Catalog, Pending Requests, Overdue.
- **Library section:** In Library Now.
- **Quick Access grid:** Reports, User Management, QR Scanner, Book Catalog.
- All stat cards are clickable and navigate to the relevant page.

---

## 6. Book Catalog

Available at `/catalog` for all authenticated users. The display and available actions differ by role.

### 6.1 Student View

Students see the full catalog with search and filter capabilities but can only request borrows, not manage books.

- **Search bar** — searches across title, author, ISBN, category, and publisher.
- **Filter panel** — category filter, shelf filter, availability toggle.
- Mobile card layout and desktop table layout.
- **Request Borrow button** — submits a borrow request with status `"pending"`.

**Overdue borrow block:** If a student has any book with Overdue status, the Request Borrow button is replaced with an "Overdue — Return First" badge and a toast message explains borrowing is disabled until they return overdue books.

### 6.2 Staff / Admin View

Staff and admin see all student features plus:

- **Add Book, Edit Book, Delete Book** controls.
- **Live Borrow Status indicator** on each book row — shows how many copies are currently borrowed.
- **Delete safeguard** — if a book has active or pending borrows, deletion is blocked. A modal shows: "Action Denied: You cannot delete this book because [X] copies are currently checked out."
- **Bulk import via CSV.**

---

## 7. Borrowing & Circulation

The Borrowing page (`/borrows`) is the central hub for circulation management. The interface adapts based on the user's role.

### 7.1 Tabs

| Tab | Who Sees It / What It Shows |
|---|---|
| Pending | Staff/Admin: all pending requests awaiting approval. Students: their own pending requests. |
| Active | All active borrows not yet overdue. |
| Overdue | Active borrows where the due date has passed. |
| Returned | Completed/returned borrows. Actions column is hidden on this tab. |

### 7.2 Staff/Admin Actions

| Action | Details |
|---|---|
| Approve | Opens an Approve modal where staff sets a due date (defaults to 7 days). On approval, the borrow status becomes `"active"` and the book's `availableCopies` is decremented. |
| Reject | Confirms and marks the borrow as `"rejected"`. |
| Mark Returned | Confirms and marks the borrow as `"returned"`, increments `availableCopies`. |
| Remind | Sends a real-time overdue notification to the student's Notification Banner. |
| Walk-Up Borrow | A form in the page header lets staff record an in-person borrow directly as `"active"` without going through the approval flow. |

**Remind Button Persistence**

The Remind button state persists across page refreshes and navigation. The system uses a live Firestore `onSnapshot` listener that queries existing `overdue_reminder` notifications and builds a `Set` of `borrowIds` that already have active reminders. If a `borrowId` is in this set, the button shows "Reminded" and is disabled.

> **Debug Note:** The original `emailSent` state was a plain React `useState({})` object. Every time staff navigated away and back, or refreshed the page, the Remind buttons all reset to "Remind" even for borrows that had already been reminded. The fix was replacing it with a live Firestore query that persists across sessions.

### 7.3 Clickable Rows

For staff and admin, clicking any row in the Borrowing table navigates to that student's profile in the Student Records page. If the associated student has been permanently deleted, clicking the row opens a modal explaining the account no longer exists. The borrow record still shows the student's snapshotted name and ID number.

---

## 8. Library Logger

The library logger records student check-ins and check-outs. There are two logger interfaces: the self-service Logger page and the staff-operated QR Scanner page.

### 8.1 Self-Service Logger (`/logger`)

Students use this page to check themselves in or out.

- **If not checked in:** shows a form with a purpose selector (Study/Review, Borrow/Return Books, Research, Use Computer, Group Study, Other) and a Check In button.
- **If checked in:** shows a live elapsed time counter and a Check Out button.

Check-in creates a document in the `logger` Firestore collection with `uid`, `purpose`, `entryTime`, and `active: true`. Check-out updates that document with `exitTime` and `active: false`.

### 8.2 QR Scanner (`/staff/qr-logger`) — Staff/Admin Only

The QR Scanner page uses the device camera to scan student QR codes and log their library visits without requiring students to interact with a computer.

**Workflow:**

1. Staff opens the QR Scanner page.
2. The camera activates and shows a live feed with a scan overlay.
3. Student presents their QR code (from the Student Dashboard, printed, or saved as an image).
4. The system reads the `qrToken` from the QR code, looks up the corresponding user in Firestore, and either checks them in or checks them out depending on their current status.
5. A confirmation toast shows the student's name and action. For check-in, a purpose modal appears for staff to select the visit purpose.

The active session table below the scanner shows all currently checked-in students with their name, purpose, entry time, elapsed duration, and notification controls.

**Notification System (Call / Follow Up / Resolve)**

From the active session table, staff can send notifications to students:
- **Call button** — sends an immediate notification to the student's Notification Banner.
- **Follow Up button** — appears on notifications the student has acknowledged. Sends a follow-up message.
- **Resolve button** — marks the notification as resolved, hidden from both the student's banner and the staff's session table.

> **Debug Note:** Camera continued running after a successful QR scan in early builds. The scanner now stops the camera and shows a confirmation state after each successful scan before re-enabling for the next student.

---

## 9. Student Records

Available to staff and admin at `/staff/students`. Provides a searchable, filterable directory of all registered students with drill-down into individual profiles.

### 9.1 List View

- Search by name, ID number, course, or college.
- Filter by college.
- Sort by name, ID, or college.
- Export All as CSV button (admin only).

### 9.2 Profile View

Clicking a student row expands their full profile inline:

- **Personal info:** name, ID number, college, course.
- **Full Borrow History section** — all borrows with statuses and dates.
- **Library Visit History section** — all logger entries with purposes and durations.

> **Debug Note:** The Full Borrow History and Library Visit History panels were stuck in light mode (white backgrounds) in dark mode for several iterations. The root cause was hardcoded Tailwind classes like `bg-white` and `bg-gray-50`. These were replaced with CSS variable equivalents: `var(--card)`, `var(--thead-bg)`, and `var(--row-border)`.

---

## 10. User Management (Admin Only)

Available at `/admin/users`. The central control panel for all user accounts.

### 10.1 User Table

- Lists all registered users with name, ID number, college/course, and current role.
- Live search and role filter tabs (All / Students / Staff / Admins).
- Sort by name, role, or college.
- Export CSV exports the currently filtered list.

### 10.2 Per-User Actions

| Action | Details |
|---|---|
| Promote to Staff | Promotes a Student to Library Staff. Requires a written reason (minimum 10 characters). Recorded in the Audit Log. |
| Demote to Student | Demotes a Staff member back to Student. Same reason requirement. If the user has no `qrToken`, one is generated automatically on demotion. |
| Reset Password | Sets `adminPasswordReset: true` on the user's Firestore document. On next login, the user is prompted to change their password. |
| Edit Profile | Opens EditProfileModal — lets admin change the user's college and course. Logged in Audit Log. |
| Edit Name | Opens EditNameModal — lets admin correct last name, first name, and middle initial. Requires a reason. Logged in Audit Log. |
| Delete | Opens the Delete Request modal. See Section 10.4. |

**Role Promotion Rules**

- Admins can promote Students to Staff.
- Admins **cannot** promote Students to Admin.
- Staff **cannot** be promoted to Admin.
- Admin accounts are fully protected — no actions can be taken on them.

Firestore rules enforce the no-admin-promotion restriction server-side, so even a crafted direct API call cannot promote a user to admin.

### 10.3 Audit Log

The Audit Log modal shows a complete history of all administrative actions. Accessible via the "Audit Log (N)" button in the page header.

| Activity Type | What It Records |
|---|---|
| Role Change | Who changed whose role, from what to what, with reason. |
| Password Reset | Which admin reset which user's password. |
| Name Change | Old name → new name, admin who changed it, reason. |
| Program Change | Old college/course → new college/course. |
| User Deletion | Deleted user's name and ID, who requested it, who approved it, reason, how many borrow and logger records were snapshotted. |

All audit log entries are immutable — the Firestore rules set `allow update, delete: if false` on the `adminAuditLogs` collection.

### 10.4 User Deletion Workflow

User deletion is a two-step process to prevent accidental permanent deletions:

1. Staff (or Admin) clicks Delete on a user. A modal appears requiring a deletion reason (minimum 10 characters). Submitting creates a document in the `deleteRequests` Firestore collection with `status: "pending"`.
2. An Admin reviews pending requests via the "Delete Requests (N)" button in the User Management header.
3. Admin clicks Approve. The system:
   - Queries all borrows where `userId` matches and writes `studentName`, `studentId`, and `userDeleted: true` into each one.
   - Does the same for all logger entries.
   - Deletes the `users/{uid}` Firestore document (hard delete).
   - Marks the `deleteRequest` as approved.
   - Writes a `user_deletion` entry to `adminAuditLogs`.
4. Admin can also Reject a deletion request, which marks it as rejected without deleting anything.

After deletion, the user's historical borrow and logger records remain fully intact with their name and ID preserved.

---

## 11. Shared Modals

### 11.1 ChangePasswordModal

Available on all three dashboards (Student, Staff, Admin). Allows users to set a new password.

- Validates minimum 8 characters and matching confirmation.
- Password strength indicator — a 4-segment bar that fills and changes colour (red → gold → green) as the password grows stronger.
- Show/hide toggle on both fields.
- `adminReset` prop — when passed as `true`, shows a gold info banner explaining that an admin has reset the password.
- On success, shows a checkmark animation and closes automatically after 1.8 seconds.

### 11.2 EditProfileModal

Allows editing of college and course. Used both by students on their own profile and by admins editing other users.

- When admin edits another user (`targetUid` prop is passed), it writes a `program_change` audit log entry.
- When a student edits their own profile, `refreshProfile()` is called after save to update `AuthContext`.

### 11.3 EditNameModal

Admin-only. Edits a user's last name, first name, and middle initial.

- All name fields are forced uppercase.
- A reason field (minimum 5 characters) is required before saving.
- A warning banner explains the action is logged and cannot be edited after saving.
- Writes a `name_change` audit log entry with `oldName` and `newName`.

---

## 12. System Reports (Admin Only)

Available at `/admin/reports`. Provides analytics across three tabs: Overview, Book Catalog Activity, and User Activity.

### 12.1 Data Fetching Strategy

The Reports page originally used 5 simultaneous `onSnapshot` real-time listeners (users, books, borrows, logger, bookLogs). This caused the Firestore free tier (Spark plan, 50,000 reads/day) to be exceeded because every document change triggered re-reads across all 5 collections on every connected client with the Reports page open.

The fix was converting all 5 listeners to one-time `getDocs` calls using `Promise.allSettled()`. A Refresh Data button allows manual re-fetching. The page shows the exact time data was last fetched.

> **Debug Note:** Hitting the Firestore Spark plan daily quota (50,000 reads) caused "Quota exceeded" errors across the entire application. The Reports page with 5 live listeners was identified as the primary cause. After switching to on-demand fetching, the daily read count dropped significantly. The quota resets at midnight Pacific Time (UTC-8). Upgrading to the Blaze (pay-as-you-go) plan eliminates this issue.

### 12.2 Overview Tab

Shows stat cards for all key metrics (Users, Catalog, Borrowing, Logger) and four charts:

- **Borrows per Day** — bar chart, last 14 days.
- **Library Log-Ins per Day** — line chart, last 14 days.
- **Borrow Status Breakdown** — pie chart showing active/overdue/pending/returned/rejected proportions.
- **Visit Purpose Distribution** — horizontal bar chart.
- **Students by College** — horizontal bar chart.

All stat cards are clickable and navigate to the relevant management page. Export buttons generate CSV files for borrows and sessions.

### 12.3 Book Catalog Activity Tab

Shows a log of all catalog changes (books added, edited, deleted, bulk-imported) sourced from the `bookLogs` Firestore collection. Filterable by action type and searchable by title, ISBN, or staff member name.

### 12.4 User Activity Tab

Allows drilling into a specific student's full borrow history and library visit log. The student selection uses a searchable combo-box instead of a plain dropdown — staff can type a name, ID number, or course to filter the list.

> **Debug Note:** The original user selection was a `<select>` HTML element with all students as `<option>` elements. With hundreds of students, scrolling through the list is impractical. The combo-box was implemented as a controlled input with a dropdown overlay, filtering the `studentUsers` array on every keystroke.

---

## 13. Firestore Data Model

### 13.1 Collections Overview

| Collection | Purpose |
|---|---|
| `users` | One document per registered user. Stores profile, role, `qrToken`, and password reset flag. |
| `books` | One document per book in the catalog. |
| `borrows` | One document per borrow transaction. |
| `logger` | One document per library visit/session. |
| `notifications` | One document per notification sent to a student. |
| `adminAuditLogs` | Immutable log of all admin actions. |
| `bookLogs` | Log of all catalog additions, edits, deletions, and bulk imports. |
| `deleteRequests` | Pending user deletion requests submitted by staff for admin approval. |
| `roleChangeLogs` | Legacy collection. Kept for backward compatibility. |

### 13.2 Key Document Schemas

**`users/{uid}`**

| Field | Type / Notes |
|---|---|
| `uid` | string — Firebase Auth UID |
| `idNumber` | string — formatted as `YY-NNNNN-NNN` |
| `qrToken` | string — UUID used as QR code value |
| `lastName` | string — stored in UPPERCASE |
| `firstName` | string — stored in UPPERCASE |
| `middleInitial` | string — 1-2 chars, UPPERCASE, no trailing dot |
| `college` | string — UPPERCASE. `"LIBRARY STAFF"` for staff/admin. |
| `course` | string — UPPERCASE. Role name for staff/admin. |
| `role` | string — `"student"` \| `"staff"` \| `"admin"` |
| `createdAt` | Firestore Timestamp |
| `adminPasswordReset` | boolean — `true` when admin has requested a reset |

**`borrows/{borrowId}`**

| Field | Type / Notes |
|---|---|
| `userId` | string — UID of the borrowing student |
| `bookId` | string — document ID of the book |
| `bookTitle` | string — snapshotted at borrow time |
| `status` | string — `"pending"` \| `"active"` \| `"returned"` \| `"rejected"` \| `"cancelled"` |
| `borrowDate` | Timestamp |
| `dueDate` | Timestamp — set when approved |
| `returnDate` | Timestamp — set when returned |
| `walkUp` | boolean — `true` if recorded by staff at the desk |
| `studentName` | string — snapshotted when user is deleted |
| `studentId` | string — snapshotted when user is deleted |
| `userDeleted` | boolean — `true` when the associated user has been hard-deleted |

**`notifications/{notifId}`**

| Field | Type / Notes |
|---|---|
| `toUid` | string — UID of recipient student |
| `message` | string — notification text |
| `sentBy` | string — UID of sender (staff/admin) |
| `sentByName` | string — full name of sender |
| `sentAt` | Timestamp |
| `resolved` | boolean — set by staff when the case is closed |
| `acknowledged` | boolean — set by student when they tap Acknowledge |
| `followUp` | boolean — `true` if this is a follow-up message |
| `type` | string — `"call"` \| `"overdue_reminder"` |
| `borrowId` | string — for `overdue_reminder` type, links to the borrow record |

---

## 14. Firestore Security Rules

Firestore security rules enforce access control at the database level, independent of the UI. Even if someone crafts a direct API call, the rules block unauthorized access.

### 14.1 Key Rules

| Collection | Rule Summary |
|---|---|
| `users` | Users can read/update their own document. Admins can update non-admin users' roles (only to `"staff"` or `"student"` — never to `"admin"`). |
| `books` | All authenticated users can read. Staff and admin can create and update. Deletes require staff or admin. |
| `borrows` | Students can read their own borrows only. Students can create pending borrows for themselves. Staff/admin can read and update all borrows. Students can cancel their own pending borrows. |
| `logger` | Students can read their own entries. Staff/admin can read all. Staff/admin can create entries for any uid (for QR check-in on behalf of student). |
| `notifications` | Students can read their own. Staff/admin create and update. Students can only update `acknowledged` and `acknowledgedAt` fields on their own notifications. |
| `adminAuditLogs` | Admin read and create only. Update and delete are blocked for everyone — these records are immutable. |
| `deleteRequests` | Staff/admin can create. Admin reads all. Only admin can update (approve/reject). |

### 14.2 No-Admin-Promotion Enforcement

The Firestore rule on the `users` collection explicitly checks:

```
(!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']) ||
 request.resource.data.role in ['staff', 'student'])
```

This means even a raw Firestore write that attempts to set `role: "admin"` on a user document will be rejected by the database, regardless of what the UI shows.

---

## 15. Theming & UI Design

### 15.1 Light / Dark Mode

The application supports light and dark mode. `ThemeContext.jsx` provides a `dark` boolean and a `toggle` function. The current theme is stored in localStorage under `"neu-theme"`. On mount, the saved preference is loaded. Theme is applied by setting `data-theme="dark"` or `data-theme="light"` on the `<html>` element. CSS variables defined in `theme.css` and `index.css` change based on this attribute. All components use CSS variables exclusively for colours.

### 15.2 Typography

| Font | Usage |
|---|---|
| Poppins | Primary body font. Labels, descriptions, button text, nav items. |
| Playfair Display | Display / serif font. Page titles, modal headings, large numbers. |
| IBM Plex Mono | Monospace font. ID numbers, timestamps, badge labels, code-like UI elements. |

### 15.3 Colour System

The gold/amber palette is the primary brand colour throughout the application.

| Variable | Usage |
|---|---|
| `--gold` | Primary accent colour. Active nav items, headings, borders. |
| `--gold-soft` | Soft gold background for highlighted areas, active state fills. |
| `--gold-border` | Gold border colour. |
| `--card` | Card background. |
| `--card-border` | Card border. |
| `--input-bg` | Input field background. |
| `--text-primary` | Main text colour. |
| `--text-muted` | Secondary/muted text. |
| `--row-hover-bg` | Table row hover background. Subtle in dark mode, light grey in light mode. |

---

## 16. Known Bugs Fixed — Debugging Log

### Build / Compilation Errors

**`RegisterPage.jsx` — "Unexpected catch" build error**
The `try/catch/finally` block in `handleSubmit` had a duplicate block generated outside the `try`, leaving a dangling `catch` with no matching `try`. Fixed by removing the duplicate block and ensuring a single clean `try/catch/finally` wraps the registration call.

**`StudentRecordsPage.jsx` — "Expected ) but found {" build error**
A `<style>` tag was injected directly inside a `<div>` element's content rather than as a sibling element at the JSX root. JSX does not allow a `<style>` tag inside a div's props. Fixed by moving the `<style>` tag outside the div as a sibling.

**`UserManagementPage.jsx` — "Unexpected const" and "Unexpected }" errors**
Multiple editing passes left a duplicate complete copy of the old `AuditModal` body in the file. The duplicate made the parser think it was inside a function when it was at module scope. Fixed by removing the entire duplicate old `AuditModal` body.

### Runtime / Logic Bugs

**Remind button resets to "Remind" on page navigation**
`emailSent` state was a plain React `useState({})` object that reset to empty on every component mount. Fixed by replacing it with a Firestore-backed `onSnapshot` listener that queries existing `overdue_reminder` notifications by `borrowId` and builds a persistent `Set`.

**Notification banner shows stacked notifications that won't clear**
The `NotificationBanner` was querying only `resolved == false`, which returned all notifications including acknowledged ones. Fixed by adding `acknowledged == false` to the Firestore query. A local `dismissed` Set was also added for instant UI removal before the Firestore round-trip completes.

**Firestore quota exceeded (50,000 reads/day)**
The Reports page had 5 simultaneous `onSnapshot` listeners. Every document write anywhere in the database triggered re-reads across all 5 collections. Fixed by converting all 5 to one-time `getDocs` calls wrapped in `Promise.allSettled()`.

**Dark mode table row hover shows solid white**
Most tables used Tailwind class `hover:bg-gray-50` on table rows. In dark mode, `gray-50` resolves to near-white. Fixed by replacing with a `log-row` CSS class injecting `tr.log-row:hover td { background: var(--row-hover-bg) !important; }`.

**Role change modal reason textarea unreadable in dark mode**
The `UserManagementPage` role change modal used hardcoded Tailwind background classes (`bg-white`, `bg-gray-50`). In dark mode the textarea background was white with white text. Fixed by replacing all hardcoded classes with CSS variable equivalents.

**Student profile sections stuck in light mode**
The Full Borrow History and Library Visit History collapsible sections used hardcoded Tailwind colour classes. Fixed by replacing all instances with CSS variable equivalents.

**Admin could promote students to Admin role**
Early builds allowed unrestricted role assignment. Fixed by adding UI constraints (no promote-to-Admin button) and server-side Firestore rule enforcement.

**Audit log showed permission errors after `adminAuditLogs` collection created**
The `adminAuditLogs` collection was added to the codebase but not to `firestore.rules`. Firestore denies all reads and writes to collections with no matching rule by default. Fixed by adding an explicit rule block.

**Missing `resetPwId` state caused UserManagement blank page**
`handleResetPassword` called `setResetPwId()` but the state variable was never declared with `useState`. This caused a runtime crash that blanked the entire page. Fixed by adding `const [resetPwId, setResetPwId] = useState(null)` to the state declarations.

**QR check-in writes disappearing immediately after confirmation**
The Firestore `logger` collection `create` rule required `request.resource.data.uid == request.auth.uid`. When staff (logged in as `staffUID`) wrote a doc with `uid: studentUID`, Firestore rejected it. The optimistic local write made it flash on screen for a split second, then the server enforced the rule and deleted it. Fixed by updating the rule to also permit `isStaffOrAdmin()`.

**Scanner re-scanned immediately after check-in, causing instant check-out**
The `html5-qrcode` library keeps an internal frame buffer of the last decoded QR. When `startScanner()` was called after confirming a check-in, it immediately replayed the buffered result — finding the session just created and checking the student back out. Fixed by stopping the scanner entirely before showing the purpose modal, and not auto-restarting after confirm.

---

## 17. Deployment

### 17.1 Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your Firebase config
npm run dev
```

### 17.2 Environment Variables

The Firebase configuration is stored in `.env.local` (never committed to Git). Required variables:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### 17.3 Vercel Deployment

The primary deployment target. Connected to the GitHub repository (`neu-library`, `main` branch). Every push to `main` triggers an automatic build and deploy.

`vercel.json` contains a rewrite rule that sends all routes to `index.html`, enabling React Router client-side navigation to work correctly on direct URL access and page refreshes.

- Build command: `npm run build` (runs `vite build`)
- Output directory: `dist`

### 17.4 Firebase Deployment

Firestore rules and indexes must be deployed whenever they are changed:

```bash
# Deploy security rules only
firebase deploy --only firestore:rules

# Deploy indexes only
firebase deploy --only firestore:indexes

# Deploy rules and indexes together
firebase deploy --only firestore:rules,firestore:indexes

# Deploy everything including Firebase Hosting
firebase deploy
```

---

## 18. Future Considerations

The following features were identified during development as recommended future improvements, particularly for handling OJT (On-the-Job Training) students who temporarily assist as library staff.

### 18.1 Recommended Security Measures

**Time-limited Staff Role with Auto-Expiry**
Add a `roleExpiresAt` timestamp field when promoting a student to staff. A scheduled Cloud Function (or a check on login) automatically demotes them back to student when the date passes. OJTs get access for exactly their deployment period with zero manual cleanup.

**Staff Permission Tiers**
Instead of one monolithic staff role, add a `staffLevel` field: `"limited"` (can only operate the QR scanner and logger) vs `"full"` (can approve borrows, view all student records). OJT students get `staffLevel: "limited"`.

**Extended Action Audit**
Extend `adminAuditLogs` to log every time a staff member views a student's full profile, approves or rejects a borrow, or exports CSV. OJT accounts are flagged in the log so their activity during deployment can be reviewed afterward.

**Login Anomaly Alerts**
Store `lastLoginAt` and `lastUserAgent` on each login via a Firebase Auth trigger Cloud Function. If a staff account logs in from an unusual device, send an email alert to the admin.

---

## Appendix A — Navigation Map

| URL Path | Component / Access |
|---|---|
| `/login` | `LoginPage` — public, redirects to `/dashboard` if already logged in |
| `/register` | `RegisterPage` — public, redirects to `/dashboard` if already logged in |
| `/dashboard` | `DashboardPage` → `AdminDashboard` / `StaffDashboard` / `StudentDashboard` — all roles |
| `/catalog` | `CatalogPage` — all roles |
| `/borrows` | `BorrowingPage` — all roles (content filtered by role) |
| `/logger` | `LoggerPage` — all roles |
| `/staff/students` | `StudentRecordsPage` — staff and admin only |
| `/staff/qr-logger` | `QRLoggerPage` — staff and admin only |
| `/admin/users` | `UserManagementPage` — admin only |
| `/admin/reports` | `ReportsPage` — admin only |
| `/auth/action` | `AuthActionPage` — Firebase out-of-band handler (password reset emails) |

## Appendix B — Firestore Collections

| Collection | Key Fields |
|---|---|
| `users` | `uid`, `idNumber`, `qrToken`, `lastName`, `firstName`, `middleInitial`, `college`, `course`, `role`, `createdAt`, `adminPasswordReset` |
| `books` | `title`, `authors`, `isbn`, `category`, `copies`, `availableCopies`, `shelf`, `publisher`, `edition`, `description`, `tags` |
| `borrows` | `userId`, `bookId`, `bookTitle`, `status`, `borrowDate`, `dueDate`, `returnDate`, `walkUp`, `studentName`, `studentId`, `userDeleted` |
| `logger` | `uid`, `purpose`, `entryTime`, `exitTime`, `active`, `forcedLogout`, `webSignedOut`, `studentName`, `studentId`, `userDeleted` |
| `notifications` | `toUid`, `message`, `sentBy`, `sentByName`, `sentAt`, `resolved`, `acknowledged`, `followUp`, `type`, `borrowId` |
| `adminAuditLogs` | `activityType`, `targetId`, `targetName`, `fromRole`, `toRole`, `oldName`, `newName`, `oldProgram`, `newProgram`, `changedBy`, `changedByName`, `reason`, `timestamp`, `borrowsSnapshotted`, `logsSnapshotted` |
| `bookLogs` | `action`, `bookTitle`, `isbn`, `category`, `byName`, `byUid`, `timestamp` |
| `deleteRequests` | `targetId`, `targetName`, `targetIdNumber`, `reason`, `requestedBy`, `requestedByName`, `requestedAt`, `status`, `approvedBy`, `approvedAt` |

---

*New Era University — Library Management System — Technical Documentation v2.0*
