// src/context/AuthContext.jsx
// ─── MIGRATION NOTE ────────────────────────────────────────────────────────
// After running migrate-emails.js, Firebase Auth accounts use real @neu.edu.ph
// emails. The login() function now looks up the real email from Firestore by
// idNumber, then signs in with that. Everything else is unchanged.
// ───────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, onSnapshot, query, where, getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

const ALLOWED_ADMIN_EMAILS = [
  'jcesperanza@neu.edu.ph',
  'trixianwackyll.granado@neu.edu.ph'
];

export function parseFirebaseError(error) {
  const code = error?.code || '';
  const map = {
    'auth/invalid-email':          'The email address format is invalid.',
    'auth/user-disabled':          'This account has been disabled. Contact the library administrator.',
    'auth/user-not-found':         'No account found with this ID number.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Incorrect ID number or password.',
    'auth/email-already-in-use':   'An account with this ID number already exists.',
    'auth/weak-password':          'Password must be at least 8 characters.',
    'auth/too-many-requests':      'Too many failed attempts. Account temporarily locked.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':  'Authentication not enabled. Contact the administrator.',
    'auth/missing-email':          'Please enter your ID number.',
    'auth/internal-error':         'An internal error occurred. Please try again.',
    'permission-denied':           'You do not have permission to perform this action.',
    'auth/popup-closed-by-user':   'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request':'Sign-in was cancelled. Please try again.',
    'auth/popup-blocked':          'Sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/unauthorized-domain':    'This domain is not authorized. Check your Firebase Console settings.',
  };
  if (map[code]) return map[code];
  if (error?.message) {
    return error.message.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

// ── Kept for new registrations only (still creates Auth account with real email) ──
// After migration, this is also how login works — via the real email.
const idToEmail = (idNumber) => `${idNumber.trim().replace(/\s/g, '')}@neu-lib.internal`;

// ── Look up a user's real email from Firestore by their ID number ──
// Returns the real email string, or null if not found / no email stored.
async function getRealEmailByIdNumber(idNumber) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('idNumber', '==', idNumber.trim()))
    );
    if (snap.empty) return null;
    return snap.docs[0].data().email || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [userProfile,    setUserProfile]    = useState(null);
  const [loadingAuth,    setLoadingAuth]    = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  const [studentBorrowMap,  setStudentBorrowMap]  = useState({});
  const [studentHasOverdue, setStudentHasOverdue] = useState(false);
  const [borrowMapReady,    setBorrowMapReady]    = useState(false);

  // ── Register ─────────────────────────────────────────────────────────────────
  // Now registers with the REAL email as the primary Firebase Auth email.
  // This means new accounts are migration-ready from day one.
  const register = async ({ idNumber, lastName, firstName, middleInitial, course, college, role = 'student', password, email }) => {
    // Use real email if provided, otherwise fall back to fake (for accounts without one)
    const authEmail = email?.trim() ? email.trim().toLowerCase() : idToEmail(idNumber);
    const qrToken   = crypto.randomUUID().replace(/-/g, '');
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid:           cred.user.uid,
        idNumber:      idNumber.trim(),
        qrToken,
        lastName:      lastName.trim().toUpperCase(),
        firstName:     firstName.trim().toUpperCase(),
        middleInitial: middleInitial ? middleInitial.trim().toUpperCase().replace(/\.+$/, '') : '',
        course:        course.trim().toUpperCase(),
        college:       college.trim().toUpperCase(),
        role,
        email:         authEmail, // always store the email used for Auth
        createdAt:     serverTimestamp(),
      });
      return cred;
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  // Strategy:
  //   1. Look up real email in Firestore by idNumber
  //   2. If found → sign in with real email (post-migration accounts)
  //   3. If not found → fall back to @neu-lib.internal (pre-migration / no email)
  const login = async (idNumber, password) => {
    try {
      const realEmail = await getRealEmailByIdNumber(idNumber);
      const authEmail = realEmail || idToEmail(idNumber);
      return await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = () => signOut(auth);

  // ── Password update ──────────────────────────────────────────────────────────
  const updateUserPassword = async (newPassword) => {
    if (!auth.currentUser) throw new Error('Not authenticated.');
    try {
      await updatePassword(auth.currentUser, newPassword);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Send password reset email ────────────────────────────────────────────────
  // Used by ForgotPasswordPage. Looks up real email by ID number, then sends.
  const sendResetEmail = async (idNumber) => {
    const realEmail = await getRealEmailByIdNumber(idNumber);
    if (!realEmail) {
      // Return a specific code so ForgotPasswordPage can show the right message
      const err = new Error('No email address is linked to this account. Please contact the library administrator.');
      err.code = 'no-email';
      throw err;
    }
    const actionCodeSettings = {
      url: `${window.location.origin}/auth/action`,
      handleCodeInApp: false,
    };
    try {
      await sendPasswordResetEmail(auth, realEmail, actionCodeSettings);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Fetch / refresh profile ──────────────────────────────────────────────────
  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({ ...data, uid });
        if (data.adminPasswordReset) setNeedsPasswordReset(true);
      } else {
        setUserProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const clearPasswordResetFlag = async () => {
    if (!userProfile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        adminPasswordReset: false, adminPasswordResetAt: null,
      });
      setNeedsPasswordReset(false);
    } catch (_) {}
  };

  const refreshProfile = () => { if (currentUser) return fetchProfile(currentUser.uid); };

  // ── Live borrow snapshot for students ───────────────────────────────────────
  useEffect(() => {
    if (!userProfile?.uid || userProfile.role !== 'student') {
      setStudentBorrowMap({});
      setStudentHasOverdue(false);
      setBorrowMapReady(userProfile?.role !== 'student');
      return;
    }
    setBorrowMapReady(false);
    const STATUS_PRIORITY = { active: 3, pending: 1 };
    const unsub = onSnapshot(
      query(collection(db, 'borrows'), where('userId', '==', userProfile.uid)),
      snap => {
        const map = {};
        const now = new Date();
        let overdueFound = false;
        snap.docs.forEach(d => {
          const b = d.data();
          if (b.status !== 'returned' && b.status !== 'rejected' && b.status !== 'cancelled') {
            const current = map[b.bookId];
            const newP = STATUS_PRIORITY[b.status] || 0;
            const oldP = STATUS_PRIORITY[current] || 0;
            if (!current || newP > oldP) map[b.bookId] = b.status;
          }
          if (b.status === 'active') {
            const due = b.dueDate?.toDate ? b.dueDate.toDate()
              : b.dueDate instanceof Date ? b.dueDate
              : typeof b.dueDate === 'string' ? new Date(b.dueDate)
              : b.dueDate?.seconds ? new Date(b.dueDate.seconds * 1000)
              : null;
            if (due && due < now) overdueFound = true;
          }
        });
        setStudentBorrowMap(map);
        setStudentHasOverdue(overdueFound);
        setBorrowMapReady(true);
      },
      () => { setBorrowMapReady(true); }
    );
    return unsub;
  }, [currentUser, userProfile]);

  // ── Auth state listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      try {
        if (user) await fetchProfile(user.uid);
        else setUserProfile(null);
      } catch (err) {
        console.error('[AuthContext] Auth state error:', err);
      } finally {
        setLoadingAuth(false);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loadingAuth, profileLoading,
      needsPasswordReset, clearPasswordResetFlag,
      studentBorrowMap, setStudentBorrowMap, studentHasOverdue, borrowMapReady,
      register, login, logout, refreshProfile,
      updateUserPassword, sendResetEmail, idToEmail,
      effectiveId: userProfile?.uid || currentUser?.uid,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
