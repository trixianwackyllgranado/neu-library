// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

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
    return error.message.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
  }
  return 'An unexpected error occurred. Please try again.';
}

export { parseFirebaseError };

const idToEmail = (idNumber) => `${idNumber.trim().replace(/\s/g, '')}@neu-lib.internal`;

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [userProfile,    setUserProfile]    = useState(null);
  const [loadingAuth,    setLoadingAuth]    = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const register = async ({ idNumber, lastName, firstName, middleInitial, course, college, role = 'student', password }) => {
    const email   = idToEmail(idNumber);
    // qrToken is kept so the student QR code works for staff scanner check-in
    const qrToken = crypto.randomUUID().replace(/-/g, '');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        idNumber: idNumber.trim(),
        qrToken,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleInitial: middleInitial ? middleInitial.trim().replace(/\.+$/, '') : '',
        course: course.trim(),
        college: college.trim(),
        role,
        createdAt: serverTimestamp(),
      });
      return cred;
    } catch (err) {
      const friendly = new Error(parseFirebaseError(err));
      friendly.code = err.code;
      throw friendly;
    }
  };

  const login = async (idNumber, password) => {
    try {
      return await signInWithEmailAndPassword(auth, idToEmail(idNumber), password);
    } catch (err) {
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
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setUserProfile(snap.data());
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = () => { if (currentUser) return fetchProfile(currentUser.uid); };

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
      register, login, logout, refreshProfile, updateUserPassword, idToEmail,
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
