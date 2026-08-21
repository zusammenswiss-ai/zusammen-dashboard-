// A mountain range with a small heart nestled above its peaks — the
// ZUSAMMEN brand mark, kept as a plain icon (no baked-in wordmark/tagline)
// so the surrounding text can switch between DE and EN. Shared between
// the landing funnel (app/landing/page.tsx) and its legal pages
// (app/landing/impressum, app/landing/datenschutz).
export default function LandingMark({ size = 128, color = "var(--l-walnut)" }: { size?: number; color?: string }) {
  return (
    <svg
      className="landing-mark"
      width={size}
      height={size / 2}
      viewBox="0 0 200 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M88 21c-3.5-5-11-4.5-11 2 0 6 11 12 11 12s11-6 11-12c0-6.5-7.5-7-11-2Z"
        stroke={color}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M8 74 L34 36 L47 52 L60 22 L73 45 L86 18 L99 45 L112 22 L125 52 L138 36 L164 74"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
