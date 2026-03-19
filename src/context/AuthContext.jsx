// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
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

// Parse firstname/lastname from NEU email: firstname.lastname@neu.edu.ph
// Last segment after last dot = last name; everything before = first name
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
  const [currentUser,      setCurrentUser]      = useState(null);
  const [userProfile,      setUserProfile]      = useState(null);
  const [loadingAuth,      setLoadingAuth]      = useState(true);
  const [profileLoading,   setProfileLoading]   = useState(false);
  const [pendingGoogleUser,setPendingGoogleUser] = useState(null);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = async ({ uid, email, firstName, lastName, middleInitial, idNumber, role, visitorType }) => {
    const qrToken = crypto.randomUUID().replace(/-/g, '');
    await setDoc(doc(db, 'users', uid), {
      uid,
      email:         email.trim().toLowerCase(),
      firstName:     firstName.trim().toUpperCase(),
      lastName:      lastName.trim().toUpperCase(),
      middleInitial: middleInitial ? middleInitial.trim().toUpperCase().replace(/\.+$/, '') : '',
      idNumber:      idNumber.trim(),
      role,
      visitorType:   role === 'visitor' ? (visitorType || 'student') : null,
      qrToken,
      createdAt:     serverTimestamp(),
    });
    setPendingGoogleUser(null);
  };

  // ── Google Sign-In ────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }

    const googleUser = result.user;
    const email = googleUser.email || '';

    // Domain check — block non-NEU emails immediately
    if (!email.endsWith(NEU_DOMAIN)) {
      try { await deleteUser(googleUser); } catch (_) {}
      await signOut(auth);
      const err = new Error('Only @neu.edu.ph institutional emails are allowed.');
      err.code = 'non-neu-email';
      throw err;
    }

    // Check for existing Firestore profile
    const profileSnap = await getDoc(doc(db, 'users', googleUser.uid));
    if (profileSnap.exists()) {
      return result; // normal login
    }

    // NEU email but not registered — keep signed in, surface error for redirect to /register
    setPendingGoogleUser(googleUser);
    const err = new Error('not-registered');
    err.code = 'not-registered';
    err.googleUser = googleUser;
    throw err;
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    setPendingGoogleUser(null);
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
