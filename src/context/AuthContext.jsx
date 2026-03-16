// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, onSnapshot, query, where, getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';

const AuthContext = createContext(null);

// ── The professor's Google email — only these accounts can self-switch roles ──
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
    'auth/unauthorized-domain':    'This domain is not authorized for Google Sign-In. Check your Firebase Console settings.',
  };
  if (map[code]) return map[code];
  if (error?.message) {
    return error.message.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

const idToEmail = (idNumber) => `${idNumber.trim().replace(/\s/g, '')}@neu-lib.internal`;

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [userProfile,    setUserProfile]    = useState(null);
  const [loadingAuth,    setLoadingAuth]    = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  const [studentBorrowMap,  setStudentBorrowMap]  = useState({});
  const [studentHasOverdue, setStudentHasOverdue] = useState(false);
  const [borrowMapReady,    setBorrowMapReady]    = useState(false);

  // ── Register (ID-number flow) ───────────────────────────────────────────────
  const register = async ({ idNumber, lastName, firstName, middleInitial, course, college, role = 'student', password }) => {
    const email   = idToEmail(idNumber);
    const qrToken = crypto.randomUUID().replace(/-/g, '');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
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
        createdAt:     serverTimestamp(),
      });
      return cred;
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Login with ID + password ────────────────────────────────────────────────
  const login = async (idNumber, password) => {
    try {
      return await signInWithEmailAndPassword(auth, idToEmail(idNumber), password);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Google Sign-In — merges with existing student profile via @neu.edu.ph email
  const loginWithGoogle = async () => {
    let googleUser = null;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      googleUser = result.user;

      // 🔒 Block non-NEU emails with a clear, specific error message
      if (!googleUser.email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        const err = new Error('NEU_ONLY');
        err.code = 'auth/neu-only';
        throw err;
      }

      // Step 1: Check if there's already a Firestore doc under this Google UID
      const directRef  = doc(db, 'users', googleUser.uid);
      const directSnap = await getDoc(directRef);

      if (directSnap.exists()) {
        // Already fully merged — nothing else to do
        return result;
      }

      // Step 2: Find the existing student profile by their @neu.edu.ph email field
      // (This was stored by add-institutional-emails.js)
      const emailSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', googleUser.email))
      );

      if (!emailSnap.empty) {
        // Found the existing student profile (it lives under the old ID-based UID)
        const existingData = emailSnap.docs[0].data();

        // Write the SAME profile data under the Google UID so the auth-state
        // listener can find it going forward. All borrow records, QR code, etc.
        // remain intact because the data is directly copied over.
        await setDoc(directRef, {
          ...existingData,
          uid:            googleUser.uid,
          authProvider:   'google',
          googleLinkedAt: serverTimestamp(),
        });

        console.log('[AuthContext] Merged Google login with existing student profile.');
        return result;
      }

      // Step 3: Truly brand-new user (no existing record) — create a minimal profile
      const nameParts = (googleUser.displayName || '').split(' ');
      await setDoc(directRef, {
        uid:          googleUser.uid,
        email:        googleUser.email,
        firstName:    nameParts[0]?.toUpperCase() || '',
        lastName:     nameParts.slice(1).join(' ').toUpperCase() || '',
        idNumber:     '',
        qrToken:      crypto.randomUUID().replace(/-/g, ''),
        college:      '',
        course:       '',
        role:         'student',
        authProvider: 'google',
        createdAt:    serverTimestamp(),
      });

      return result;
    } catch (err) {
      const msg = err.code === 'auth/neu-only'
        ? 'Access Denied: This library system is only for NEU students and staff. Please use your @neu.edu.ph school email to continue with Google.'
        : parseFirebaseError(err);
      const friendly = new Error(msg);
      friendly.code  = err?.code;
      throw friendly;
    }
  };

  // ── Role switch ──────────────────────────────────────────────────────────────
  const switchRole = async () => {
    try {
      if (!currentUser || !userProfile) return;
      if (!ALLOWED_ADMIN_EMAILS.includes(currentUser.email)) {
        alert("Unauthorized: Your email does not have permission to switch roles.");
        return;
      }
      const newRole = userProfile.role === 'admin' ? 'student' : 'admin';
      await updateDoc(doc(db, 'users', currentUser.uid), { role: newRole });
      setUserProfile(prev => ({ ...prev, role: newRole }));
    } catch (err) {
      console.error("[AuthContext] Error switching role:", err);
      alert(`Role Switch Failed: ${err.message}`);
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

  // ── Fetch / refresh profile ──────────────────────────────────────────────────
  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        if (data.adminPasswordReset) setNeedsPasswordReset(true);
      } else {
        setUserProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const clearPasswordResetFlag = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        adminPasswordReset: false, adminPasswordResetAt: null,
      });
      setNeedsPasswordReset(false);
    } catch (_) {}
  };

  const refreshProfile = () => { if (currentUser) return fetchProfile(currentUser.uid); };

  // ── Live borrow snapshot for students ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !userProfile || userProfile.role !== 'student') {
      setStudentBorrowMap({});
      setStudentHasOverdue(false);
      setBorrowMapReady(userProfile?.role !== 'student');
      return;
    }
    setBorrowMapReady(false);
    const STATUS_PRIORITY = { active: 3, pending: 1 };
    const unsub = onSnapshot(
      query(collection(db, 'borrows'), where('userId', '==', currentUser.uid)),
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
      if (user) await fetchProfile(user.uid);
      else setUserProfile(null);
      setLoadingAuth(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loadingAuth, profileLoading,
      needsPasswordReset, clearPasswordResetFlag,
      studentBorrowMap, setStudentBorrowMap, studentHasOverdue, borrowMapReady,
      register, login, loginWithGoogle, logout, refreshProfile,
      updateUserPassword, idToEmail,
      switchRole,
      isProfessor: ALLOWED_ADMIN_EMAILS.includes(currentUser?.email),
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