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
  collection, onSnapshot, query, where,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';

const AuthContext = createContext(null);

// ── The professor's Google email — only this account can self-switch roles ──
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

  // Student borrow state — persists across page navigations
  const [studentBorrowMap,  setStudentBorrowMap]  = useState({});
  const [studentHasOverdue, setStudentHasOverdue] = useState(false);
  const [borrowMapReady,    setBorrowMapReady]    = useState(false);

  // ── Register (existing ID-number flow — unchanged) ──────────────────────────
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

  // ── Login with ID + password (existing flow — unchanged) ────────────────────
  const login = async (idNumber, password) => {
    try {
      return await signInWithEmailAndPassword(auth, idToEmail(idNumber), password);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Google Sign-In (new — for professor account) ─────────────────────────────
  const loginWithGoogle = async () => {
    try {
      console.log("[AuthContext] Initiating Google Sign-In...");
      const result = await signInWithPopup(auth, googleProvider);
      const user   = result.user;
      console.log("[AuthContext] Google Sign-In Success! UID:", user.uid);

      // Create or update their Firestore profile on first login
      const ref  = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        console.log("[AuthContext] First-time Google user detected. Creating Firestore document...");
        // First-time Google login — create a minimal profile
        // Default role: 'student' (regular user). Professor can switch to 'admin' via UI.
        const nameParts = (user.displayName || '').split(' ');
        const firstName = nameParts[0]?.toUpperCase() || '';
        const lastName  = nameParts.slice(1).join(' ').toUpperCase() || '';
        await setDoc(ref, {
          uid:           user.uid,
          email:         user.email,
          firstName,
          lastName,
          idNumber:      '',           // Google users have no ID number
          qrToken:       crypto.randomUUID().replace(/-/g, ''),
          college:       '',
          course:        '',
          role:          'student',    // start as regular user
          authProvider:  'google',
          createdAt:     serverTimestamp(),
        });
        console.log("[AuthContext] Firestore document created successfully.");
      } else {
        console.log("[AuthContext] Existing Google user profile found in Firestore.");
      }
      return result;
    } catch (err) {
      console.error("[AuthContext] Google Sign-In Error Details:", err);
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err?.code;
      throw friendly;
    }
  };

  // ── Role switch — only allowed for the professor's Google account ────────────
  // Toggles between 'student' (regular user) and 'admin'.
  // Protected: only the professor's own UID can call this, and Firestore rules
  // only allow the special email to self-update role (see firestore.rules).
  // ── Role switch — Bulletproof version ────────────
  const switchRole = async () => {
    try {
      if (!currentUser || !userProfile) return;
      
      // 1. Ensure only authorized emails can do this
      if (!ALLOWED_ADMIN_EMAILS.includes(currentUser.email)) {
        alert("Unauthorized: Your email does not have permission to switch roles.");
        return;
      }

      const newRole = userProfile.role === 'admin' ? 'student' : 'admin';
      console.log(`[AuthContext] Switching role to: ${newRole}...`);

      // 2. Update Firestore Database
      await updateDoc(doc(db, 'users', currentUser.uid), { role: newRole });
      console.log(`[AuthContext] Firestore updated successfully to ${newRole}!`);

      // 3. IMMEDIATELY update React state so the UI changes without needing a page refresh
      setUserProfile(prev => ({ ...prev, role: newRole }));

    } catch (err) {
      console.error("[AuthContext] Error switching role:", err);
      // If Firestore blocks the test email, this alert will catch it!
      alert(`Role Switch Failed: ${err.message}\n\nIf this says "permission-denied", you need to whitelist your test email in Firestore Security Rules!`);
    }
  };
    // refreshProfile will be triggered by the onSnapshot in useEffect
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