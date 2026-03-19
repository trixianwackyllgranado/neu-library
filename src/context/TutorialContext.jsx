// src/context/TutorialContext.jsx
// Floating page tutorial — ONLY for prime admin emails (Prof. Esperanza + wackylltrixian).
// Always active by default (not tied to account age). Can be toggled off via a switch.
// State is persisted per-user in Firestore `tutorialPrefs/{uid}`.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth, isPrimeAdminEmail } from './AuthContext';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const { userProfile, effectiveRole } = useAuth();
  const [tutorialEnabled, setTutorialEnabled] = useState(true);
  const [dismissedPages, setDismissedPages]   = useState({});
  const [loading, setLoading]                 = useState(true);

  const uid   = userProfile?.uid;
  const email = userProfile?.email;
  const role  = effectiveRole || userProfile?.role;

  // Only prime admins get the tutorial feature
  const hasTutorialAccess = !!email && isPrimeAdminEmail(email);
  const isStaffOrAdmin    = role === 'admin' || role === 'staff';

  // ── Load tutorial prefs from Firestore ────────────────────────────────────
  useEffect(() => {
    if (!uid || !hasTutorialAccess) {
      setTutorialEnabled(false);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const prefSnap = await getDoc(doc(db, 'tutorialPrefs', uid));
        if (prefSnap.exists()) {
          const data = prefSnap.data();
          if (data.enabled === false) {
            setTutorialEnabled(false);
          } else {
            setTutorialEnabled(true);
          }
          setDismissedPages(data.dismissedPages || {});
        } else {
          // First time — tutorial is ON by default
          setTutorialEnabled(true);
          setDismissedPages({});
        }
      } catch (err) {
        console.error('[TutorialContext] Error loading prefs:', err);
        setTutorialEnabled(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, hasTutorialAccess]);

  // ── Toggle tutorial on/off (persisted) ────────────────────────────────────
  const toggleTutorial = useCallback(async () => {
    if (!uid) return;
    const next = !tutorialEnabled;
    setTutorialEnabled(next);
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        enabled: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid, tutorialEnabled]);

  // ── Dismiss a single page ─────────────────────────────────────────────────
  const dismissPage = useCallback(async (pageKey) => {
    if (!uid) return;
    const next = { ...dismissedPages, [pageKey]: true };
    setDismissedPages(next);
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        dismissedPages: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid, dismissedPages]);

  // ── Dismiss all pages at once ─────────────────────────────────────────────
  const dismissAll = useCallback(async () => {
    if (!uid) return;
    setTutorialEnabled(false);
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        enabled: false,
        dismissedAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid]);

  // ── Reset (re-enable + clear dismissed pages) ─────────────────────────────
  const resetTutorial = useCallback(async () => {
    if (!uid) return;
    setTutorialEnabled(true);
    setDismissedPages({});
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        enabled: true,
        dismissedPages: {},
        resetAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid]);

  const isPageDismissed = useCallback((pageKey) => {
    return !tutorialEnabled || !!dismissedPages[pageKey];
  }, [tutorialEnabled, dismissedPages]);

  const tutorialActive = hasTutorialAccess && tutorialEnabled && isStaffOrAdmin;

  return (
    <TutorialContext.Provider value={{
      tutorialActive,
      hasTutorialAccess,
      tutorialEnabled,
      loading,
      dismissPage,
      dismissAll,
      toggleTutorial,
      resetTutorial,
      isPageDismissed,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
