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
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);
const NEU_DOMAIN = '@neu.edu.ph';

// ── IT Support / Prime Admin ──────────────────────────────────────────────────
// These emails bypass the NEU domain check entirely.
// They are always treated as admin and hidden from User Management.
export const IT_SUPPORT_EMAILS = [
  'wackylltrixian@gmail.com',
  'dianacastro1115@gmail.com',
];

export function isITSupportEmail(email) {
  return IT_SUPPORT_EMAILS.includes((email || '').toLowerCase().trim());
}

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

  // Prevents onAuthStateChanged from racing loginWithGoogle's Firestore checks.
  // Set synchronously before signInWithPopup; released after login resolves.
  const loginInProgressRef = useRef(false);

  // ── Register ──────────────────────────────────────────────────────────────
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
    setPendingGoogleUser(null);
    loginInProgressRef.current = false;
    await fetchProfile(uid);
  };

  // ── Google Sign-In ─────────────────────────────────────────────────────────
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });

    // Lock BEFORE popup — onAuthStateChanged fires right after signInWithPopup.
    loginInProgressRef.current = true;

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      loginInProgressRef.current = false;
      const friendly = new Error(parseFirebaseError(err));
      friendly.code  = err.code;
      throw friendly;
    }

    const googleUser = result.user;
    const email      = googleUser.email || '';
    const emailLower = email.toLowerCase();

    // ── IT Support Prime Admin bypass ──────────────────────────────────────
    if (isITSupportEmail(emailLower)) {
      let snap = null;
      try { snap = await getDoc(doc(db, 'users', googleUser.uid)); } catch (_) {}

      if (!snap?.exists()) {
        // Auto-create a hidden admin profile on first sign-in
        await setDoc(doc(db, 'users', googleUser.uid), {
          uid:           googleUser.uid,
          email:         emailLower,
          firstName:     'IT',
          lastName:      'SUPPORT',
          middleInitial: '',
          idNumber:      'IT-SUPPORT',
          role:          'admin',
          visitorType:   null,
          college:       null,
          course:        null,
          isITSupport:   true,
          createdAt:     serverTimestamp(),
        });
      }

      const base = snap?.exists() ? snap.data() : { firstName: 'IT', lastName: 'SUPPORT' };
      setUserProfile({ ...base, role: 'admin', isITSupport: true, uid: googleUser.uid });
      setCurrentUser(googleUser);
      loginInProgressRef.current = false;
      return result;
    }

    // ── NEU domain check ───────────────────────────────────────────────────
    if (!email.endsWith(NEU_DOMAIN)) {
      // Check if this Gmail has a pending staff invite
      let hasInvite = false;
      try {
        const inviteSnap = await getDocs(query(
          collection(db, 'staffInvites'),
          where('email',  '==', emailLower),
          where('status', '==', 'pending')
        ));
        hasInvite = !inviteSnap.empty;
      } catch (_) {}

      if (!hasInvite) {
        loginInProgressRef.current = false;
        try { await deleteUser(googleUser); } catch (_) {}
        await signOut(auth);
        const err  = new Error('Only @neu.edu.ph institutional emails are allowed.');
        err.code   = 'non-neu-email';
        throw err;
      }
      // Staff-invited Gmail — fall through to profile check
    }

    // ── Firestore profile check ────────────────────────────────────────────
    let profileSnap;
    try {
      profileSnap = await getDoc(doc(db, 'users', googleUser.uid));
    } catch (firestoreErr) {
      loginInProgressRef.current = false;
      throw firestoreErr;
    }

    if (profileSnap.exists()) {
      setUserProfile({ ...profileSnap.data(), uid: googleUser.uid });
      setCurrentUser(googleUser);
      loginInProgressRef.current = false;
      return result;
    }

    // NEU email (or invited Gmail) but NOT yet registered — show modal.
    // Lock stays held until register() completes.
    setCurrentUser(googleUser);
    setPendingGoogleUser(googleUser);
    const err  = new Error('not-registered');
    err.code   = 'not-registered';
    throw err;
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = () => {
    setPendingGoogleUser(null);
    loginInProgressRef.current = false;
    return signOut(auth);
  };

  // ── Profile ─────────────────────────────────────────────────────────────────
  const fetchProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        // Always force admin + IT support flag for prime admin accounts
        setUserProfile(
          isITSupportEmail(data.email)
            ? { ...data, role: 'admin', isITSupport: true, uid }
            : { ...data, uid }
        );
      } else {
        setUserProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = () => {
    if (currentUser) return fetchProfile(currentUser.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // If loginWithGoogle is mid-flight, it owns currentUser/userProfile.
      // Just clear the loading flag so the app doesn't hang.
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
