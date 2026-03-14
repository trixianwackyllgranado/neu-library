// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  getAuth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { initializeApp, getApps } from 'firebase/app';

const AuthContext = createContext(null);

// ── Error parser ──────────────────────────────────────────────────────────────
function parseFirebaseError(error) {
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
  };
  if (map[code]) return map[code];
  if (error?.message) {
    return error.message
      .replace('Firebase: ', '')
      .replace(/\s*\(auth\/[^)]+\)\.?/, '')
      .trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

export { parseFirebaseError };

// Internal email generated from idNumber (not exposed to user).
// We keep the dashes so Auth identifiers are human-readable in the console.
// e.g. "24-12998-121@neu-lib.internal"
const idToEmail = (idNumber) => {
  const clean = idNumber.trim().replace(/\s/g, '');
  return `${clean}@neu-lib.internal`;
};

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [effectiveUid,   setEffectiveUid]   = useState(null); // real UID — differs from currentUser.uid for QR ghost accounts
  const [userProfile,    setUserProfile]    = useState(null);
  const [loadingAuth,    setLoadingAuth]    = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  /**
   * Register a new account.
   * 1. Creates main Firebase Auth user (idNumber@neu-lib.internal / userPassword)
   * 2. Creates a QR ghost Auth user using a secondary app instance so the main
   *    session is never disrupted: (qr-TOKEN@neu-lib.internal / "QR:TOKEN")
   * 3. Writes the main Firestore user doc with qrToken field
   * 4. Writes a minimal qrUsers doc so fetchProfile can resolve ghost → main UID
   */
  const register = async ({ idNumber, lastName, firstName, middleInitial, course, college, role = 'student', password }) => {
    const email   = idToEmail(idNumber);
    const qrToken = crypto.randomUUID().replace(/-/g, '');
    const qrEmail = `qr-${qrToken}@neu-lib.internal`;
    const qrPass  = `QR:${qrToken}`;

    try {
      // 1. Create main account (this signs the user in)
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Create ghost QR account using a secondary app — doesn't touch main session
      const firebaseConfig = auth.app.options;
      const secondaryAppName = `secondary-${Date.now()}`;
      const secondaryApp  = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const qrCred = await createUserWithEmailAndPassword(secondaryAuth, qrEmail, qrPass);
        // 3. Write qrUsers mapping doc so fetchProfile can resolve ghost UID → main UID
        await setDoc(doc(db, 'qrUsers', qrCred.user.uid), {
          mainUid: cred.user.uid,
          qrToken,
        });
      } catch {
        // Ghost account creation failed — QR login won't work but manual login still will
      } finally {
        await signOut(secondaryAuth).catch(() => {});
      }

      // 4. Write main user doc
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid:           cred.user.uid,
        idNumber:      idNumber.trim(),
        qrToken,
        lastName:      lastName.trim(),
        firstName:     firstName.trim(),
        middleInitial: middleInitial ? middleInitial.trim().replace(/\.+$/, '') : '',
        course:        course.trim(),
        college:       college.trim(),
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

  /**
   * Login by idNumber + password.
   */
  const login = async (idNumber, password) => {
    const email = idToEmail(idNumber);
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  /**
   * Passwordless QR login.
   * The QR code encodes the 32-char qrToken.
   * We sign in to the ghost Firebase Auth account (qr-TOKEN@neu-lib.internal / "QR:TOKEN").
   * fetchProfile then resolves ghost UID → main user doc via the qrUsers collection.
   */
  const loginWithQRToken = async (token) => {
    const qrEmail = `qr-${token}@neu-lib.internal`;
    const qrPass  = `QR:${token}`;
    try {
      return await signInWithEmailAndPassword(auth, qrEmail, qrPass);
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        throw new Error('QR code not recognised or account was created before QR login was enabled. Please sign in with your ID number and password.');
      }
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  const logout = () => signOut(auth);

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

  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      // Try direct users lookup first (normal login path)
      let snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) {
        // Might be a QR ghost account — resolve via qrUsers collection
        const qrSnap = await getDoc(doc(db, 'qrUsers', uid));
        if (qrSnap.exists()) {
          const { mainUid } = qrSnap.data();
          snap = await getDoc(doc(db, 'users', mainUid));
          // CRITICAL: store mainUid so all downstream queries use the real UID,
          // not the ghost UID that currentUser.uid returns after QR login
          if (snap.exists()) setEffectiveUid(mainUid);
        }
      } else {
        setEffectiveUid(uid);
      }
      if (snap.exists()) setUserProfile(snap.data());
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = () => {
    if (currentUser) return fetchProfile(currentUser.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
        setEffectiveUid(null);
      }
      setLoadingAuth(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, effectiveUid, userProfile, loadingAuth, profileLoading,
      register, login, loginWithQRToken, logout, refreshProfile, updateUserPassword,
      idToEmail,
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
