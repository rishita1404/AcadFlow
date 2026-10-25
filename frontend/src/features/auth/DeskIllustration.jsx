export default function DeskIllustration() {
  return (
    <div className="auth-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 420 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="auth-desk-svg"
      >
        {/* Soft background aura/glow */}
        <ellipse cx="210" cy="170" rx="190" ry="40" fill="var(--sand)" opacity="0.25" />

        {/* Desk top surface */}
        <rect x="25" y="172" width="370" height="12" rx="6" fill="var(--sand)" />
        <rect x="40" y="184" width="340" height="4" rx="2" fill="var(--border)" opacity="0.6" />

        {/* Desk Lamp (Left) */}
        {/* Lamp Base */}
        <path d="M70 172 C70 166, 100 166, 100 172 Z" fill="var(--ink-800)" />
        {/* Lamp Arm */}
        <path d="M85 168 L85 110 L120 75" stroke="var(--ink-800)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="85" cy="110" r="3.5" fill="var(--accent)" />
        <circle cx="120" cy="75" r="3.5" fill="var(--accent)" />
        {/* Lamp Shade & Light Beam */}
        <path d="M112 66 L138 88 L126 98 L104 76 Z" fill="var(--ink-900)" />
        {/* Lamp warm light beam */}
        <polygon points="120,95 70,172 175,172 135,95" fill="var(--sand)" opacity="0.2" />

        {/* Open Book (Center) */}
        {/* Book cover shadow */}
        <path d="M150 166 Q200 172 250 166 L254 169 Q200 176 146 169 Z" fill="var(--ink-900)" opacity="0.3" />
        {/* Left Page */}
        <path d="M150 164 Q198 168 200 142 L160 138 Q152 152 150 164 Z" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
        {/* Right Page */}
        <path d="M250 164 Q202 168 200 142 L240 138 Q248 152 250 164 Z" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
        {/* Book Spine Center */}
        <line x1="200" y1="142" x2="200" y2="168" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        {/* Book text lines */}
        <line x1="162" y1="146" x2="190" y2="148" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="162" y1="152" x2="186" y2="154" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="162" y1="158" x2="192" y2="160" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="210" y1="148" x2="238" y2="146" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="210" y1="154" x2="234" y2="152" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="210" y1="160" x2="238" y2="158" stroke="var(--sand)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Desk Calendar (Right) */}
        {/* Stand */}
        <polygon points="305,172 315,125 355,125 365,172" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
        {/* Header strip */}
        <polygon points="314,134 356,134 354,125 315,125" fill="var(--accent)" />
        {/* Calendar spiral rings */}
        <circle cx="324" cy="125" r="2" fill="var(--ink-900)" />
        <circle cx="335" cy="125" r="2" fill="var(--ink-900)" />
        <circle cx="346" cy="125" r="2" fill="var(--ink-900)" />
        {/* Calendar grid dots & badge */}
        <circle cx="325" cy="144" r="2" fill="var(--sand)" />
        <circle cx="335" cy="144" r="2" fill="var(--sand)" />
        <circle cx="345" cy="144" r="2" fill="var(--sage)" />
        <circle cx="325" cy="154" r="2" fill="var(--sand)" />
        <circle cx="335" cy="154" r="2" fill="var(--sage)" />
        <circle cx="345" cy="154" r="2" fill="var(--sand)" />
        <circle cx="325" cy="164" r="2" fill="var(--sand)" />
        <circle cx="335" cy="164" r="2" fill="var(--sand)" />

        {/* Small potted succulent next to calendar */}
        <path d="M280 172 L277 158 L293 158 L290 172 Z" fill="var(--sand)" stroke="var(--border)" strokeWidth="1" />
        <circle cx="285" cy="154" r="5" fill="var(--sage)" />
        <circle cx="282" cy="151" r="3.5" fill="var(--sage)" />
        <circle cx="288" cy="151" r="3.5" fill="var(--sage)" />
      </svg>
    </div>
  );
}
