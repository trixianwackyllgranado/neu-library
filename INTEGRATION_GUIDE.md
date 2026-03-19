# NEU Library v2 — Feature Integration Guide

## Files Generated

Place each file in its corresponding `src/` path:

| File | Destination |
|------|-------------|
| `AuthContext.jsx` | `src/context/AuthContext.jsx` (REPLACE) |
| `TutorialContext.jsx` | `src/context/TutorialContext.jsx` (NEW) |
| `App.jsx` | `src/App.jsx` (REPLACE) |
| `AppLayout.jsx` | `src/components/shared/AppLayout.jsx` (REPLACE) |
| `RouteGuard.jsx` | `src/components/shared/RouteGuard.jsx` (REPLACE) |
| `DashboardPage.jsx` | `src/pages/DashboardPage.jsx` (REPLACE) |
| `FloatingTutorial.jsx` | `src/components/shared/FloatingTutorial.jsx` (NEW) |
| `OnlinePresenceIndicator.jsx` | `src/components/shared/OnlinePresenceIndicator.jsx` (NEW) |
| `tutorialContent.js` | `src/data/tutorialContent.js` (NEW) |
| `firestore.rules` | `firestore.rules` (REPLACE — root of project) |

---

## What Was Implemented

### 1. Prof. Esperanza as Prime Admin (jcesperanza@neu.edu.ph)
- Added `PRIME_ADMIN_EMAILS` list in `AuthContext.jsx`
- On Google sign-in, the account is auto-provisioned as admin with `isPrimeAdmin: true`
- The `hd: 'neu.edu.ph'` parameter still applies (this is a NEU email)
- Prof gets the "Welcome to NEU Library!" greeting via the standard visitor kiosk page

### 2. Role Switcher (Admin ↔ User View)
- **Only visible to prime admins** (Prof. Esperanza)
- Toggle button appears at the top of the sidebar, below the logo
- Shows "View as User" / "Back to Admin" with a swap icon
- When viewing as user:
  - Sidebar nav shows visitor nav items (empty — visitors use the kiosk)
  - The dashboard routes to `VisitorKioskPage` (full visitor experience)
  - Admin-only routes (`/admin/*`) redirect to `/dashboard`
  - A blue "VIEWING AS" badge appears in the user card
- Switching back restores full admin access instantly
- Role override is **client-side only** — Firestore role stays `admin`

### 3. Floating Tutorial System (? Button)
- **Non-invasive floating "?" button** in the bottom-right corner of every page
- Only shows for **new admin/staff** users (account created within 7 days)
- Each page has unique content explaining:
  - **What is this page?** — purpose
  - **How does it work?** — technical explanation
  - **Example Scenario** — real-world use case
  - **Quick Instructions** — numbered steps
- The tutorial card includes a note: *"This tutorial only appears for new admin/staff members"*
- **Per-page dismissal**: Click "Got it ✓" to hide for that page
- **Global skip**: Click "Skip all tutorials" (with confirmation) to hide everywhere
- State is persisted in Firestore (`tutorialPrefs` collection)
- Pages covered: Dashboard, Logger, Visitor Kiosk, User Management, Edit Requests, Reports, Catalog, Borrowing, QR Logger, Student Records

### 4. Your Account (wackylltrixian@gmail.com)
- Kept in `IT_SUPPORT_EMAILS` — auto-provisioned as admin
- **Not** a prime admin (no role switcher — only Prof. Esperanza gets that)
- Can test the tutorial by having a fresh `createdAt` within 7 days

### 5. Online Presence Tracking
- Every logged-in user writes a heartbeat to `onlinePresence/{uid}` every 60 seconds
- Goes offline on page unload, visibility change, or logout
- `OnlinePresenceIndicator` component shows green/gray dot per user
- `useOnlinePresenceMap` hook for batch-subscribing to multiple UIDs
- Students show as "online" even if not visitor-checked-in (just having the app open)

### 6. Firestore Rules Updated
- Added `tutorialPrefs/{userId}` — users can read/write their own tutorial prefs
- Added `onlinePresence/{userId}` — users write their own, anyone signed in can read

---

## Integration Steps for LoggerPage (Online Presence)

Add this to `LoggerPage.jsx` to show online dots next to student names:

```jsx
// At the top — add import
import OnlinePresenceIndicator from '../components/shared/OnlinePresenceIndicator';

// In the live session table, next to the student name:
<td style={tdSt}>
  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <OnlinePresenceIndicator uid={s.uid} size={7} />
    <button onClick={() => navigate('/staff/students', { state: { openStudentId: s.uid } })}
      style={{ /* existing styles */ }}>
      {name}
    </button>
  </span>
</td>
```

---

## Testing the Tutorial

### Reset tutorial for any user (Firebase Console or code):
In Firestore, delete or update the document at `tutorialPrefs/{uid}`:
```
globalDismissed: false
dismissedPages: {}
```

### Or use the `resetTutorial()` function from TutorialContext:
```jsx
import { useTutorial } from './context/TutorialContext';
// Inside a component:
const { resetTutorial } = useTutorial();
// Call resetTutorial() to re-show all tutorials
```

### Test new-user detection:
The tutorial shows for accounts created within 7 days. To test with an older account, either:
1. Update `createdAt` in their Firestore `users` doc to a recent timestamp
2. Or adjust `NEW_USER_WINDOW_MS` in `TutorialContext.jsx`

---

## No Need to Delete Prof. Esperanza

You do **not** need to delete his Firebase Auth account. To test the new-user tutorial flow:
1. Reset his `tutorialPrefs` doc in Firestore (delete it or set `globalDismissed: false`)
2. If his `createdAt` is older than 7 days, update it to now in Firestore
3. He'll see the floating tutorial on next login

---

## Deploy

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Build and deploy the app
npm run build
firebase deploy --only hosting
# or: vercel --prod
```
