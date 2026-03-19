// src/components/shared/FloatingTutorial.jsx
// Floating "?" button with tutorial card. ONLY renders for prime admin emails.
// All hooks MUST be called before any conditional returns (React rules of hooks).
import { useState, useEffect, useRef } from 'react';
import { useTutorial } from '../../context/TutorialContext';
import { useAuth } from '../../context/AuthContext';
import TUTORIAL_CONTENT from '../../data/tutorialContent';

const PP = { fontFamily: "'Poppins', sans-serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };
const SR = { fontFamily: "'Playfair Display', serif" };

export default function FloatingTutorial({ pageKey }) {
  const { tutorialActive, hasTutorialAccess, tutorialEnabled, isPageDismissed, dismissPage, dismissAll } = useTutorial();
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [confirmSkipAll, setConfirmSkipAll] = useState(false);
  const cardRef = useRef(null);
  const btnRef = useRef(null);

  const content = TUTORIAL_CONTENT[pageKey] || null;
  const shouldRender = hasTutorialAccess && tutorialEnabled && content && !isPageDismissed(pageKey);

  // ── All hooks MUST be above this line — no early returns before hooks ──────

  // Stop pulse after 5 seconds
  useEffect(() => {
    if (!shouldRender) return;
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, [shouldRender]);

  // Close on outside click
  useEffect(() => {
    if (!open || !shouldRender) return;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
        setConfirmSkipAll(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, shouldRender]);

  // Reset state when pageKey changes
  useEffect(() => {
    setOpen(false);
    setPulse(true);
    setConfirmSkipAll(false);
  }, [pageKey]);

  // ── Now safe to early-return ──────────────────────────────────────────────
  if (!shouldRender) return null;

  const handleDismissPage = () => {
    dismissPage(pageKey);
    setOpen(false);
  };

  const handleSkipAll = () => {
    if (!confirmSkipAll) {
      setConfirmSkipAll(true);
      return;
    }
    dismissAll();
    setOpen(false);
  };

  return (
    <>
      {/* Floating ? button */}
      <button
        ref={btnRef}
        onClick={() => { setOpen(!open); setPulse(false); setConfirmSkipAll(false); }}
        aria-label="Page tutorial"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold) 0%, #d4a012 100%)',
          border: 'none',
          color: '#1a1a2e',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(245,158,11,0.35), 0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 1000,
          transition: 'all 0.2s ease',
          animation: pulse ? 'tutorialPulse 2s ease-in-out infinite' : 'none',
          transform: open ? 'rotate(90deg) scale(0.9)' : 'scale(1)',
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, ...SR }}>?</span>
        )}
      </button>

      {/* Tutorial card */}
      {open && (
        <div ref={cardRef} style={{
          position: 'fixed',
          bottom: 84,
          right: 24,
          width: 'min(380px, calc(100vw - 48px))',
          background: 'var(--card)',
          border: '1px solid var(--card-border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-modal)',
          zIndex: 1001,
          animation: 'tutorialSlideUp 0.25s ease both',
        }}>
          {/* Gold accent bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), var(--gold-border), transparent)' }} />

          {/* Header */}
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{content.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ ...MN, fontSize: 9, letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 2 }}>Page Guide</p>
                <p style={{ ...SR, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{content.title}</p>
              </div>
            </div>
            {/* Exclusive notice */}
            <div style={{
              marginTop: 8,
              padding: '8px 10px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 8,
            }}>
              <p style={{ ...MN, fontSize: 9, color: '#60a5fa', lineHeight: 1.5, letterSpacing: '0.04em' }}>
                This guide is exclusive to you as the system administrator. Regular staff and students cannot see this. You can turn it off anytime using the sidebar toggle.
              </p>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px', maxHeight: 'min(340px, 45vh)', overflowY: 'auto' }}>
            {/* Purpose */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ ...PP, fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                What is this page?
              </p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                {content.purpose}
              </p>
            </div>

            {/* How it works */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ ...PP, fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                How does it work?
              </p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                {content.howItWorks}
              </p>
            </div>

            {/* Scenario */}
            <div style={{
              background: 'var(--gold-soft)',
              border: '1px solid var(--gold-border)',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 16,
            }}>
              <p style={{ ...PP, fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>
                Example Scenario
              </p>
              <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {content.scenario}
              </p>
            </div>

            {/* Instructions */}
            <div>
              <p style={{ ...PP, fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Quick Instructions
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {content.instructions.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{
                      ...MN, fontSize: 10, fontWeight: 700, color: 'var(--gold)',
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--gold-soft)', border: '1px solid var(--gold-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--divider)', display: 'flex', gap: 8 }}>
            <button onClick={handleDismissPage} style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              background: 'var(--gold-soft)', border: '1px solid var(--gold-border)',
              color: 'var(--gold)', cursor: 'pointer',
              ...PP, fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}>
              Got it for this page
            </button>
            <button onClick={handleSkipAll} style={{
              padding: '10px 14px', borderRadius: 8,
              background: confirmSkipAll ? 'var(--red-soft)' : 'var(--surface)',
              border: `1px solid ${confirmSkipAll ? 'var(--red-border)' : 'var(--card-border)'}`,
              color: confirmSkipAll ? 'var(--red)' : 'var(--text-dim)',
              cursor: 'pointer',
              ...PP, fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
            }}>
              {confirmSkipAll ? 'Confirm turn off' : 'Turn off all guides'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(245,158,11,0.35), 0 2px 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 4px 30px rgba(245,158,11,0.55), 0 2px 12px rgba(0,0,0,0.4), 0 0 0 8px rgba(245,158,11,0.12); }
        }
        @keyframes tutorialSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
