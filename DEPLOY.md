# NEU Library Management System v2 — Deployment Guide

## Prerequisites

- Node.js v18+
- Git installed
- GitHub CLI (`gh`) installed and authenticated
- Vercel CLI installed: `npm install -g vercel`
- Firebase CLI installed: `npm install -g firebase-tools`

---

## 1. Install Dependencies

```powershell
cd neu-library
npm install
```

---

## 2. Configure Firebase

Create `src/firebase/config.js` with your project credentials. The file already
exists with `import.meta.env` placeholders — set the following environment variables
instead of hardcoding them.

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 3. Initialize Git Repository

```powershell
git init
git add .
git commit -m "feat: initial commit — NEU Library v2"
```

---

## 4. Create GitHub Repository

```powershell
gh repo create neu-library-system --private --source=. --remote=origin --push
```

This creates the repo, sets the remote, and pushes in one command.

---

## 5. Deploy Firestore Rules and Indexes

```powershell
firebase login
firebase use --add          # select your Firebase project
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 6. Deploy to Vercel

### First time setup:

```powershell
vercel login
vercel link                 # link to existing Vercel project or create new one
```

### Set environment variables on Vercel:

```powershell
vercel env add VITE_FIREBASE_API_KEY            production
vercel env add VITE_FIREBASE_AUTH_DOMAIN        production
vercel env add VITE_FIREBASE_PROJECT_ID         production
vercel env add VITE_FIREBASE_STORAGE_BUCKET     production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID             production
```

Each command will prompt you to paste the value.

### Deploy to production:

```powershell
vercel deploy --prod
```

---

## 7. (Optional) Deploy to Firebase Hosting

```powershell
npm run build
firebase deploy --only hosting
```

---

## 8. First Admin Account Setup

1. Register at `/register` using any student ID number
2. In Firebase Console → Firestore → `users` collection, find your document
3. Manually set the `role` field to `"admin"`
4. All subsequent role promotions can be done from `/admin/users`

---

## 9. Data Migration (Existing Users)

If you have existing Firestore data with deprecated fields (`age`, `birthday`, `sex`,
`yearLevel`, `email`, `profileComplete`, etc.), run the pruning script.

### Install Admin SDK dependency:

```powershell
npm install firebase-admin
```

### Download a service account key:
Firebase Console → Project Settings → Service Accounts → Generate new private key
Save as `service-account.json` in the project root (it is gitignored).

### Dry run first (no writes):

```powershell
node tools/migrate/prune-users.js
```

### Execute live pruning:

```powershell
node tools/migrate/prune-users.js --execute
```

### Prune a single user (by UID):

```powershell
node tools/migrate/prune-users.js --execute --uid=abc123def456
```

---

## 10. Auth Import (Migrating Firebase Auth Users)

If you are moving Firebase projects and need to preserve password hashes:

### Export auth users from old project:

```powershell
firebase auth:export users.json --format=json
```

### Dry run (shows first 5 users):

```powershell
node tools/import-auth.js
```

### Execute import:

```powershell
node tools/import-auth.js --execute
```

### Import from custom file path:

```powershell
node tools/import-auth.js --file=path/to/users.json --execute
```

The SCRYPT hash config is already embedded in the script and matches the original
project's Firebase Auth configuration.

---

## 11. Subsequent Deployments

```powershell
git add .
git commit -m "your commit message"
git push
vercel deploy --prod        # or Vercel auto-deploys on push if connected
```

---

## 12. Validate After Deploy

Run a quick sanity check from the Firebase Console:

| Check | Location |
|-------|----------|
| Users collection exists | Firestore → users |
| Firestore rules active | Firebase Console → Firestore → Rules |
| App loads at Vercel URL | Browser |
| Register creates user | `/register` → check Firestore |
| Login with ID number works | `/login` |
| QR code appears on dashboard | `/dashboard` (student) |
| Staff QR scanner page loads | `/staff/qr-logger` |

---

## Architecture Notes

### Authentication Model Change

The original system used `@neu.edu.ph` email addresses. The new system:

- **User-facing**: ID Number (e.g. `22-12345-123`) + password
- **Internal**: Firebase Auth email is synthetically generated as `{digits}@neu-lib.internal`
  and never exposed to users
- This means existing Firebase Auth accounts with `@neu.edu.ph` emails are **not
  automatically compatible** — run the auth import script if migrating

### QR Code Flow

```
Student registers → QR generated (payload = ID Number)
                 ↓
Student shows QR to staff camera at QRLoggerPage (/staff/qr-logger)
                 ↓
Staff scanner reads ID number from QR
                 ↓
If student NOT in library → prompt purpose → write logger document (active: true)
If student IS in library  → update logger document (active: false, exitTime: now)
                 ↓
Student's app updates in real-time via LibrarySessionContext onSnapshot listener
```

### Running QR Logger Locally

The QR Logger page (`/staff/qr-logger`) requires camera access.

1. `npm run dev`
2. Open `http://localhost:5173/staff/qr-logger` in a browser that supports `getUserMedia`
3. Click **Start Scanner** — browser will prompt for camera permission
4. Chrome/Edge work best; Safari requires HTTPS (use a local tunnel if needed)

For HTTPS locally:
```powershell
npm install -g local-ssl-proxy
local-ssl-proxy --source 5174 --target 5173
# Then open https://localhost:5174
```

---

## Removed Features

| Feature | Reason |
|---------|--------|
| `CompleteProfilePage` | Replaced by simplified inline registration |
| Email/password login | Replaced by ID Number login |
| `@neu.edu.ph` email validation | No longer needed |
| Invite codes for staff/admin | Role assignment now exclusively via `/admin/users` |

---

*NEU Library Management System v2 — New Era University*
