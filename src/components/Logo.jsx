/**
 * Dosy logo component
 * - size prop: icon size in px
 * - withWordmark: show "dosy" text next to icon
 */
export default function Logo({ size = 36, withWordmark = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* Pill icon — recreates the Dosy capsule mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Dosy"
      >
        <defs>
          <linearGradient id="dosyG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#2B3EDF" />
            <stop offset="55%"  stopColor="#5A28D8" />
            <stop offset="100%" stopColor="#8B2BE2" />
          </linearGradient>
        </defs>
        {/* Outer pill shape */}
        <rect x="4" y="18" width="56" height="28" rx="14" fill="url(#dosyG)" />
        {/* Left circle void → forms "O" */}
        <circle cx="18" cy="32" r="8" fill="white" />
        {/* Right D-shaped void */}
        <path d="M30,23 L30,41 L38,41 Q48,41 48,32 Q48,23 38,23 Z" fill="white" />
      </svg>

      {withWordmark && (
        <span
          className="font-extrabold tracking-tight"
          style={{
            fontSize: size * 0.72,
            background: 'linear-gradient(135deg, #2B3EDF 0%, #5A28D8 55%, #8B2BE2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          dosy
        </span>
      )}
    </span>
  )
}
