// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  deleteUser,
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
    'auth/invalid-email':            'The email address format is invalid.',
    'auth/user-disabled':            'This account has been disabled. Contact the library administrator.',
    'auth/user-not-found':           'No account found with this ID number.',
    'auth/wrong-password':           'Incorrect password. Please try again.',
    'auth/invalid-credential':       'Incorrect ID number or password.',
    'auth/email-already-in-use':     'An account with this ID number already exists.',
    'auth/weak-password':            'Password must be at least 8 characters.',
    'auth/too-many-requests':        'Too many failed attempts. Account temporarily locked.',
    'auth/network-request-failed':   'Network error. Check your connection and try again.',
    'auth/operation-not-allowed':    'Authentication not enabled. Contact the administrator.',
    'auth/missing-email':            'Please enter your ID number.',
    'auth/internal-error':           'An internal error occurred. Please try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email. Please sign in with your ID and password instead.',
    'permission-denied':             'You do not have permission to perform this action.',
    'auth/popup-closed-by-user':     'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request':  'Sign-in was cancelled. Please try again.',
    'auth/popup-blocked':            'Sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/unauthorized-domain':      'This domain is not authorized. Check your Firebase Console settings.',
    'no-profile':                    'No library account found for this Google account. Please register first or sign in with your Student ID.',
  };
  if (map[code]) return map[code];
  if (error?.message) {
    return error.message.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

const idToEmail = (idNumber) => `${idNumber.trim().replace(/\s/g, '')}@neu-lib.internal`;

// Look up a user's real email from Firestore by their ID number.
// Does NOT swallow errors — callers handle them.
async function getRealEmailByIdNumber(idNumber) {
  const snap = await getDocs(
    query(collection(db, 'users'), where('idNumber', '==', idNumber.trim()))
  );
  if (snap.empty) return null;
  return snap.docs[0].data().email || null;
}

// Look up a Firestore user doc by their real email
async function getUserDocByEmail(email) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()))
    );
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
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
  const register = async ({ idNumber, lastName, firstName, middleInitial, course, college, role = 'student', password, email }) => {
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
        email:         authEmail,
        createdAt:     serverTimestamp(),
      });
      return cred;
    } catch (err) {
      // ── Orphan account recovery ──────────────────────────────────────────
      // If auth/email-already-in-use fires AND the current signed-in user has
      // this email but NO Firestore document, it is an orphan account left
      // behind by a failed Google Sign-In attempt. Delete it and retry once.
      if (err.code === 'auth/email-already-in-use') {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email === authEmail) {
          // Check if there is a Firestore profile for this orphan
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
          if (!snap.exists()) {
            // Orphan confirmed — delete it and retry registration
            try {
              await deleteUser(currentUser);
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
                email:         authEmail,
                createdAt:     serverTimestamp(),
              });
              return cred;
            } catch (retryErr) {
              const friendly = new Error(parseFirebaseError(retryErr));
              friendly.code = retryErr.code;
              throw friendly;
            }
          }
        }
      }
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Login with ID + password ──────────────────────────────────────────────
  const login = async (idNumber, password) => {
    try {
      let authEmail = idToEmail(idNumber); // fallback
      try {
        const realEmail = await getRealEmailByIdNumber(idNumber);
        if (realEmail) authEmail = realEmail;
      } catch (_) { /* rules blocked — use fake email fallback */ }

      return await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────
  // Flow:
  //   1. Sign in with Google popup → get googleUser
  //   2. Look up Firestore for a user doc with matching email
  //   3. If found → that IS their account (same UID after migration) → success
  //   4. If NOT found → no library account for this Google email → show error
  //
  // After migration all accounts use real emails, so Google sign-in with
  // their @neu.edu.ph email lands on the exact same Firebase Auth account
  // (same UID) and the same Firestore document. No linking needed.
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' }); // hint: NEU accounts only
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      // Check if there's a Firestore profile for this UID
      const profileSnap = await getDoc(doc(db, 'users', googleUser.uid));

      if (profileSnap.exists()) {
        // Perfect — their Google email matches the migrated Auth account
        return result;
      }

      // No Firestore doc for this UID — this Google account has no library profile.
      // CRITICAL: We must delete the Firebase Auth account that was just auto-created
      // by signInWithPopup, otherwise the user can never register with this email
      // (Firebase would throw auth/email-already-in-use on their next attempt).
      try { await deleteUser(googleUser); } catch (_) { /* best effort */ }
      await signOut(auth);
      const err = new Error(parseFirebaseError({ code: 'no-profile' }));
      err.code = 'no-profile';
      throw err;

    } catch (err) {
      if (err.code === 'no-profile') throw err;
      if (err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request') {
        const friendly = new Error(parseFirebaseError(err));
        friendly.code = err.code;
        throw friendly;
      }
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => signOut(auth);

  // ── Password update ───────────────────────────────────────────────────────
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

  // ── Send password reset email ─────────────────────────────────────────────
  const sendResetEmail = async (idNumber) => {
    // Step 1: look up real email from Firestore (errors now surface, not swallowed)
    let realEmail;
    try {
      realEmail = await getRealEmailByIdNumber(idNumber);
    } catch (fsErr) {
      const err = new Error('Could not look up account. Check your connection or contact the library administrator.');
      err.code = 'firestore-lookup-failed';
      throw err;
    }

    if (!realEmail) {
      const err = new Error('No account found with that Student ID. Please check the ID and try again.');
      err.code = 'no-account';
      throw err;
    }

    // Step 2: send reset email to the real @neu.edu.ph address
    const actionCodeSettings = {
      url: `${window.location.origin}/auth/action`,
      handleCodeInApp: false,
    };
    try {
      await sendPasswordResetEmail(auth, realEmail, actionCodeSettings);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Firebase Auth doesn\'t recognise this email — migration may have missed this account
        const friendly = new Error(
          'Account found in records but not in the authentication system. ' +
          'Please contact the library administrator to fix this account.'
        );
        friendly.code = 'auth-user-not-found';
        throw friendly;
      }
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  // ── Fetch / refresh profile ───────────────────────────────────────────────
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

  // ── Live borrow snapshot for students ────────────────────────────────────
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

  // ── Auth state listener ───────────────────────────────────────────────────
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
      register, login, loginWithGoogle, logout, refreshProfile,
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
