// PhoneFrame — Android-style phone bezel for Dosy mockups.
// Uses Dosy design tokens; warm, not cold M3.

const PhoneFrame = ({ children, screenLabel, theme = 'light', width = 390, height = 820, statusBarTime = '08:42' }) => {
  return (
    <div data-screen-label={screenLabel} className={theme === 'dark' ? 'dark' : ''} style={{
      width, height,
      borderRadius: 44,
      background: '#1A1410',
      padding: 7,
      boxShadow: '0 30px 60px -20px rgba(74,36,16,0.30), 0 12px 24px -8px rgba(74,36,16,0.20)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* side buttons */}
      <div style={{ position: 'absolute', left: -3, top: 110, width: 3, height: 36, borderRadius: 2, background: '#1A1410' }}/>
      <div style={{ position: 'absolute', left: -3, top: 160, width: 3, height: 56, borderRadius: 2, background: '#1A1410' }}/>
      <div style={{ position: 'absolute', right: -3, top: 130, width: 3, height: 70, borderRadius: 2, background: '#1A1410' }}/>

      <div style={{
        width: '100%', height: '100%',
        borderRadius: 38,
        background: 'var(--bg)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--fg)',
      }}>
        <PhoneStatusBar time={statusBarTime} theme={theme}/>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <PhoneNavGesture/>
      </div>
    </div>
  );
};

const PhoneStatusBar = ({ time = '08:42', theme = 'light' }) => (
  <div style={{
    height: 32, padding: '8px 22px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 13, fontWeight: 700, color: 'var(--fg)',
    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
    flexShrink: 0,
    position: 'relative',
    zIndex: 5,
  }}>
    <span>{time}</span>
    {/* punch-hole camera */}
    <div style={{
      position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)',
      width: 18, height: 18, borderRadius: '50%', background: '#1A1410',
    }}/>
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {/* signal */}
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
        <rect x="0" y="7" width="2.5" height="4" rx="0.5"/>
        <rect x="4" y="4.5" width="2.5" height="6.5" rx="0.5"/>
        <rect x="8" y="2" width="2.5" height="9" rx="0.5"/>
        <rect x="12" y="0" width="2.5" height="11" rx="0.5"/>
      </svg>
      {/* wifi */}
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1 3a10 10 0 0 1 12 0"/>
        <path d="M3 5.5a7 7 0 0 1 8 0"/>
        <circle cx="7" cy="8.5" r="1" fill="currentColor"/>
      </svg>
      {/* battery */}
      <svg width="20" height="11" viewBox="0 0 20 11" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="0.5" y="1.5" width="16" height="8" rx="2"/>
        <rect x="2" y="3" width="11" height="5" rx="1" fill="currentColor"/>
        <rect x="17" y="4" width="2" height="3" rx="0.5" fill="currentColor"/>
      </svg>
    </div>
  </div>
);

const PhoneNavGesture = () => (
  <div style={{
    height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative', zIndex: 5,
  }}>
    <div style={{ width: 130, height: 4, borderRadius: 2, background: 'var(--fg)', opacity: 0.55 }}/>
  </div>
);

window.PhoneFrame = PhoneFrame;
window.PhoneStatusBar = PhoneStatusBar;
window.PhoneNavGesture = PhoneNavGesture;
