// src/components/shared/AnimatedIcons.jsx
// Animated SVG icons for modals and popups.
// Each icon draws itself on mount with a satisfying stroke animation.
// Usage: <SuccessIcon size={56} /> inside a modal's icon area.

const baseCircle = (color, size) => ({
  width: size, height: size, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

// ── Animated Checkmark (Success) ─────────────────────────────────────────────
export function SuccessIcon({ size = 56 }) {
  const r = size * 0.38;
  return (
    <div style={{ ...baseCircle('var(--green)', size), background: 'var(--green-soft)', border: '1.5px solid var(--green-border)' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="63" strokeDashoffset="63" opacity="0.3">
          <animate attributeName="stroke-dashoffset" from="63" to="0" dur="0.5s" fill="freeze" />
        </circle>
        <path d="M7 12.5l3.5 3.5L17 9" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="20" strokeDashoffset="20">
          <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.35s" begin="0.25s" fill="freeze" />
        </path>
      </svg>
    </div>
  );
}

// ── Animated X (Error) ───────────────────────────────────────────────────────
export function ErrorIcon({ size = 56 }) {
  return (
    <div style={{ ...baseCircle('var(--red)', size), background: 'var(--red-soft)', border: '1.5px solid var(--red-border)' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--red)" strokeWidth="1.5" strokeDasharray="63" strokeDashoffset="63" opacity="0.3">
          <animate attributeName="stroke-dashoffset" from="63" to="0" dur="0.5s" fill="freeze" />
        </circle>
        <path d="M15 9l-6 6" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.25s" begin="0.2s" fill="freeze" />
        </path>
        <path d="M9 9l6 6" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="10" strokeDashoffset="10">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.25s" begin="0.35s" fill="freeze" />
        </path>
      </svg>
    </div>
  );
}

// ── Animated Warning Triangle ────────────────────────────────────────────────
export function WarningIcon({ size = 56 }) {
  return (
    <div style={{ ...baseCircle('var(--gold)', size), background: 'var(--gold-soft)', border: '1.5px solid var(--gold-border)' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="60" strokeDashoffset="60" fill="none">
          <animate attributeName="stroke-dashoffset" from="60" to="0" dur="0.5s" fill="freeze" />
        </path>
        <line x1="12" y1="9" x2="12" y2="13" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray="4" strokeDashoffset="4">
          <animate attributeName="stroke-dashoffset" from="4" to="0" dur="0.2s" begin="0.4s" fill="freeze" />
        </line>
        <circle cx="12" cy="16.5" r="0" fill="var(--gold)">
          <animate attributeName="r" from="0" to="1.2" dur="0.15s" begin="0.55s" fill="freeze" />
        </circle>
      </svg>
    </div>
  );
}

// ── Animated Info Circle ─────────────────────────────────────────────────────
export function InfoIcon({ size = 56 }) {
  return (
    <div style={{ ...baseCircle('var(--blue)', size), background: 'var(--blue-soft)', border: '1.5px solid var(--blue-border)' }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.5"
          strokeDasharray="63" strokeDashoffset="63" opacity="0.4">
          <animate attributeName="stroke-dashoffset" from="63" to="0" dur="0.5s" fill="freeze" />
        </circle>
        <line x1="12" y1="16" x2="12" y2="12" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray="4" strokeDashoffset="4">
          <animate attributeName="stroke-dashoffset" from="4" to="0" dur="0.2s" begin="0.3s" fill="freeze" />
        </line>
        <circle cx="12" cy="8" r="0" fill="var(--blue)">
          <animate attributeName="r" from="0" to="1.2" dur="0.15s" begin="0.45s" fill="freeze" />
        </circle>
      </svg>
    </div>
  );
}

// ── Animated Spinner (Loading) ───────────────────────────────────────────────
export function SpinnerIcon({ size = 56, color = 'var(--gold)' }) {
  return (
    <div style={{ ...baseCircle(color, size), background: 'var(--gold-soft)', border: '1.5px solid var(--gold-border)' }}>
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" style={{ animation: 'modalSpin 1s linear infinite' }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeLinecap="round"
          strokeDasharray="50 20" opacity="0.7" />
      </svg>
      <style>{`@keyframes modalSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
