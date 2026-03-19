// src/context/TutorialContext.jsx
// Detects new admin/staff users and shows a floating page-by-page tutorial.
// "New" = account created within the last 7 days AND tutorialDismissed !== true in Firestore.
// Users can dismiss individual page tooltips or skip the entire tutorial at once.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const TutorialContext = createContext(null);

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function TutorialProvider({ children }) {
  const { userProfile, effectiveRole } = useAuth();
  const [tutorialActive, setTutorialActive] = useState(false);
  const [dismissedPages, setDismissedPages] = useState({});
  const [loading, setLoading]               = useState(true);
  const [globalDismissed, setGlobalDismissed] = useState(false);

  const uid  = userProfile?.uid;
  const role = effectiveRole || userProfile?.role;
  const isStaffOrAdmin = role === 'admin' || role === 'staff';

  // ── Check if user qualifies for the tutorial ──────────────────────────────
  useEffect(() => {
    if (!uid || !isStaffOrAdmin) {
      setTutorialActive(false);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Read tutorial prefs
        const prefSnap = await getDoc(doc(db, 'tutorialPrefs', uid));
        if (prefSnap.exists()) {
          const data = prefSnap.data();
          if (data.globalDismissed) {
            setGlobalDismissed(true);
            setTutorialActive(false);
            setDismissedPages(data.dismissedPages || {});
            setLoading(false);
            return;
          }
          setDismissedPages(data.dismissedPages || {});
        }

        // Check if "new" user (created within 7 days)
        const createdAt = userProfile?.createdAt?.toDate?.()
          || userProfile?.createdAt
          || null;

        const isNew = createdAt
          ? (Date.now() - new Date(createdAt).getTime()) < NEW_USER_WINDOW_MS
          : true; // If no createdAt, treat as new (safety net)

        setTutorialActive(isNew);
      } catch (err) {
        console.error('[TutorialContext] Error loading prefs:', err);
        setTutorialActive(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, isStaffOrAdmin, userProfile?.createdAt]);

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

  // ── Dismiss entire tutorial globally ──────────────────────────────────────
  const dismissAll = useCallback(async () => {
    if (!uid) return;
    setGlobalDismissed(true);
    setTutorialActive(false);
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        globalDismissed: true,
        dismissedAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid]);

  // ── Reset tutorial (for testing / admin utility) ──────────────────────────
  const resetTutorial = useCallback(async () => {
    if (!uid) return;
    setGlobalDismissed(false);
    setDismissedPages({});
    setTutorialActive(true);
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        globalDismissed: false,
        dismissedPages: {},
        resetAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid]);

  const isPageDismissed = useCallback((pageKey) => {
    return globalDismissed || !!dismissedPages[pageKey];
  }, [globalDismissed, dismissedPages]);

  const shouldShowTutorial = tutorialActive && !globalDismissed && isStaffOrAdmin;

  return (
    <TutorialContext.Provider value={{
      tutorialActive: shouldShowTutorial,
      loading,
      dismissPage,
      dismissAll,
      resetTutorial,
      isPageDismissed,
      globalDismissed,
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
