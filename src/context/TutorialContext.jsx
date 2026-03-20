// src/context/TutorialContext.jsx
// Floating page tutorial — ONLY for prime admin emails.
// ── Persistence model ──
//   - Global on/off toggle: persisted in Firestore (survives logout)
//   - Per-page "Got it": session-only (React state). Resets on:
//       * Page reload / browser refresh
//       * Sign out and sign back in
//       * Toggling guides off then on again
// This means the ? button always comes back next session — it's a reference tool, not a one-time onboarding.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth, isPrimeAdminEmail } from './AuthContext';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const { userProfile, effectiveRole } = useAuth();
  const [tutorialEnabled, setTutorialEnabled] = useState(true);
  const [loading, setLoading]                 = useState(true);

  // ── Session-only dismissed pages (NOT persisted to Firestore) ─────────────
  const [dismissedPages, setDismissedPages] = useState({});

  const uid   = userProfile?.uid;
  const email = userProfile?.email;
  const role  = effectiveRole || userProfile?.role;

  const hasTutorialAccess = !!email && isPrimeAdminEmail(email);
  const isStaffOrAdmin    = role === 'admin' || role === 'staff';

  // ── Load only the global toggle from Firestore ────────────────────────────
  useEffect(() => {
    if (!uid || !hasTutorialAccess) {
      setTutorialEnabled(false);
      setLoading(false);
      return;
    }

    // Reset session dismissals on mount (new session = fresh start)
    setDismissedPages({});

    (async () => {
      try {
        const prefSnap = await getDoc(doc(db, 'tutorialPrefs', uid));
        if (prefSnap.exists()) {
          const data = prefSnap.data();
          setTutorialEnabled(data.enabled !== false); // default ON
        } else {
          setTutorialEnabled(true);
        }
      } catch (err) {
        console.error('[TutorialContext] Error loading prefs:', err);
        setTutorialEnabled(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, hasTutorialAccess]);

  // ── Toggle on/off (persisted to Firestore) ────────────────────────────────
  const toggleTutorial = useCallback(async () => {
    if (!uid) return;
    const next = !tutorialEnabled;
    setTutorialEnabled(next);

    // When turning back ON, reset all session dismissals so everything reappears
    if (next) setDismissedPages({});

    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        enabled: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (_) {}
  }, [uid, tutorialEnabled]);

  // ── Dismiss a single page (session-only, no Firestore write) ──────────────
  const dismissPage = useCallback((pageKey) => {
    setDismissedPages(prev => ({ ...prev, [pageKey]: true }));
  }, []);

  // ── Dismiss all = turn off globally ───────────────────────────────────────
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

  // ── Reset everything (for testing) ────────────────────────────────────────
  const resetTutorial = useCallback(async () => {
    if (!uid) return;
    setTutorialEnabled(true);
    setDismissedPages({});
    try {
      await setDoc(doc(db, 'tutorialPrefs', uid), {
        enabled: true,
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
