export default function Logo({ size = 40, withWordmark = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="MedControl">
        <defs>
          <linearGradient id="mcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#59b1ff" />
            <stop offset="55%" stopColor="#1873f5" />
            <stop offset="100%" stopColor="#19438f" />
          </linearGradient>
          <linearGradient id="mcHeart" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mcGrad)" />
        <rect x="2" y="2" width="60" height="60" rx="16" fill="white" fillOpacity="0.06" />
        {/* cruz médica */}
        <rect x="27" y="14" width="10" height="36" rx="3" fill="url(#mcHeart)" />
        <rect x="14" y="27" width="36" height="10" rx="3" fill="url(#mcHeart)" />
        {/* pulso / heartbeat */}
        <path d="M10 46 L20 46 L24 38 L30 54 L36 42 L42 46 L54 46"
              fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWordmark && (
        <span className="font-extrabold text-lg tracking-tight">
          <span className="text-brand-600 dark:text-brand-400">Med</span>Control
        </span>
      )}
    </span>
  )
}
