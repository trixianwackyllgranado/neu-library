// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  deleteUser,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);
const NEU_DOMAIN = '@neu.edu.ph';

export function parseFirebaseError(error) {
  const code = error?.code || '';
  const map = {
    'auth/popup-closed-by-user':    'Sign-in popup was closed. Please try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
    'auth/popup-blocked':           'Sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/unauthorized-domain':     'This domain is not authorized. Check your Firebase Console settings.',
    'auth/network-request-failed':  'Network error. Check your connection and try again.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'non-neu-email':  'Only @neu.edu.ph institutional emails are allowed.',
    'not-registered': 'not-registered',
    'no-profile':     'No library account found for this Google account.',
  };
  if (map[code]) return map[code];
  if (error?.message) {
    return error.message.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

export function parseNameFromEmail(email) {
  const local = email.split('@')[0];
  const parts = local.split('.');
  if (parts.length < 2) return { firstName: local, lastName: '' };
  const lastName  = parts[parts.length - 1];
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return { firstName: cap(firstName), lastName: cap(lastName) };
}

export function AuthProvider({ children }) {
  const [currentUser,       setCurrentUser]       = useState(null);
  const [userProfile,       setUserProfile]       = useState(null);
  const [loadingAuth,       setLoadingAuth]       = useState(true);
  const [profileLoading,    setProfileLoading]    = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  // ── THE KEY FIX ──────────────────────────────────────────────────────────
  // This ref is set SYNCHRONOUSLY inside loginWithGoogle BEFORE any async work.
  // onAuthStateChanged fires almost immediately after signInWithPopup resolves —
  // if it runs while we're still checking Firestore, it would see userProfile=null
  // and RequireAuth would kick the user to /login before we can show the modal.
  //
  // A ref (not state) is used because:
  //   1. It's synchronous — no render cycle between set and read
  //   2. It doesn't trigger re-renders that could interfere
  //
  // The lock is released in three places:
  //   - Normal login success (profile loaded, return result)
  //   - Non-NEU email (blocked, signed out)
  //   - Firestore error (rethrown)
  //   - register() completion (after writing the doc)
  // NOT released when not-registered — stays held until register() runs.
  const loginInProgressRef = useRef(false);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = async ({ uid, email, firstName, lastName, middleInitial, idNumber, role, visitorType, college, course }) => {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email:         email.trim().toLowerCase(),
      firstName:     firstName.trim().toUpperCase(),
      lastName:      lastName.trim().toUpperCase(),
      middleInitial: middleInitial ? middleInitial.trim().toUpperCase().replace(/\.+$/, '') : '',
      idNumber:      idNumber.trim(),
      role,
      visitorType:   role === 'visitor' ? (visitorType || 'student') : null,
      college:       college?.trim().toUpperCase() || null,
      course:        course?.trim().toUpperCase() || null,
      createdAt:     serverTimestamp(),
    });
    // Release the lock and clear pending state
    setPendingGoogleUser(null);
    loginInProgressRef.current = false;
    // Fetch profile so the app can route to the kiosk immediately
    await fetchProfile(uid);
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });

    // SET THE LOCK BEFORE the popup — onAuthStateChanged fires right after
    // signInWithPopup and must not race our Firestore check.
    loginInProgressRef.current = true;

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      // Popup closed/cancelled/blocked — release lock and rethrow
      loginInProgressRef.current = false;
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }

    const googleUser = result.user;
    const email = googleUser.email || '';

    // Block non-NEU emails immediately
    if (!email.endsWith(NEU_DOMAIN)) {
      loginInProgressRef.current = false;
      try { await deleteUser(googleUser); } catch (_) {}
      await signOut(auth);
      const err = new Error('Only @neu.edu.ph institutional emails are allowed.');
      err.code = 'non-neu-email';
      throw err;
    }

    // Check for existing Firestore profile
    let profileSnap;
    try {
      profileSnap = await getDoc(doc(db, 'users', googleUser.uid));
    } catch (firestoreErr) {
      // Firestore error — release lock and rethrow
      loginInProgressRef.current = false;
      throw firestoreErr;
    }

    if (profileSnap.exists()) {
      // Registered — load profile directly here (don't wait for onAuthStateChanged)
      // then release the lock.
      setUserProfile({ ...profileSnap.data(), uid: googleUser.uid });
      setCurrentUser(googleUser);
      loginInProgressRef.current = false;
      return result;
    }

    // NEU email but NOT yet registered.
    // KEEP the lock held — this prevents onAuthStateChanged from evicting them.
    // pendingGoogleUser tells RequireGuest to allow /register through.
    setCurrentUser(googleUser);
    setPendingGoogleUser(googleUser);
    const err = new Error('not-registered');
    err.code = 'not-registered';
    throw err;
    // loginInProgressRef.current stays true until register() completes.
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    setPendingGoogleUser(null);
    loginInProgressRef.current = false;
    return signOut(auth);
  };

  // ── Profile ───────────────────────────────────────────────────────────────
  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setUserProfile({ ...snap.data(), uid });
      else setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = () => { if (currentUser) return fetchProfile(currentUser.uid); };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // If loginWithGoogle is mid-flight, it's managing currentUser and
      // userProfile directly. Do NOT interfere — just make sure loadingAuth
      // is cleared so the app doesn't hang on the splash screen.
      if (loginInProgressRef.current) {
        setCurrentUser(user);
        setLoadingAuth(false);
        return;
      }

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
      pendingGoogleUser, setPendingGoogleUser,
      loginWithGoogle, logout, register, refreshProfile,
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
