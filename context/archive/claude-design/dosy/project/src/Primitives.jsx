// Dosy primitives — Button, Pill chip, Input, Card, Sheet, BottomNav, Toast, Avatar, etc.

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

// ── Button ──────────────────────────────────────────────────────────────
const Button = ({ kind = 'primary', size = 'md', children, onClick, full, icon, iconRight, disabled, style }) => {
  const sizes = {
    sm: { pad: '9px 16px', fs: 13, h: 36 },
    md: { pad: '13px 22px', fs: 14.5, h: 46 },
    lg: { pad: '16px 28px', fs: 15.5, h: 54 },
  }[size];
  const kinds = {
    primary: {
      background: 'var(--gradient-sunset)', color: '#fff',
      boxShadow: '0 12px 28px -8px rgba(255,61,127,0.42)',
    },
    secondary: {
      background: 'var(--bg-elevated)', color: 'var(--fg)',
      boxShadow: 'var(--shadow-sm)',
    },
    ghost: { background: 'transparent', color: 'var(--fg)' },
    danger: {
      background: 'var(--danger-bg)', color: 'var(--danger)',
      boxShadow: 'var(--shadow-xs)',
    },
    'danger-solid': {
      background: 'var(--danger)', color: '#fff',
      boxShadow: '0 8px 20px -6px rgba(229,86,74,0.35)',
    },
  }[kind];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="dosy-press"
      style={{
        ...kinds, padding: sizes.pad, fontSize: sizes.fs, minHeight: sizes.h,
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 999, fontWeight: 700, letterSpacing: '-0.01em',
        width: full ? '100%' : 'auto',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18}/>}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 18}/>}
    </button>
  );
};

// ── IconButton (round, 44px) ───────────────────────────────────────────
const IconButton = ({ icon, onClick, size = 44, kind = 'elevated', dot, style }) => {
  const kinds = {
    elevated: { background: 'var(--bg-elevated)', color: 'var(--fg)', boxShadow: 'var(--shadow-sm)' },
    ghost:    { background: 'transparent',         color: 'var(--fg)', boxShadow: 'none' },
    sunken:   { background: 'var(--bg-sunken)',    color: 'var(--fg)', boxShadow: 'none' },
    sunset:   { background: 'var(--gradient-sunset)', color: '#fff', boxShadow: '0 8px 20px -6px rgba(255,61,127,0.4)' },
  }[kind];
  return (
    <button onClick={onClick} className="dosy-press" style={{
      width: size, height: size, borderRadius: 999, border: 'none',
      ...kinds,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', position: 'relative',
      ...style,
    }}>
      <Icon name={icon} size={size > 40 ? 20 : 18}/>
      {dot && <div style={{
        position: 'absolute', top: 10, right: 10,
        width: 9, height: 9, borderRadius: 999,
        background: 'var(--sunset-1)',
        boxShadow: '0 0 0 2px var(--bg-elevated)',
      }}/>}
    </button>
  );
};

// ── Chip ───────────────────────────────────────────────────────────────
const Chip = ({ children, active, onClick, icon, kind = 'neutral', size = 'md' }) => {
  const sz = size === 'sm'
    ? { pad: '6px 12px', fs: 12, h: 28 }
    : { pad: '9px 16px', fs: 13, h: 36 };
  const baseBg = active ? 'var(--gradient-sunset)' : 'var(--bg-elevated)';
  const baseColor = active ? '#fff' : 'var(--fg)';
  return (
    <button onClick={onClick} className="dosy-press" style={{
      padding: sz.pad, fontSize: sz.fs, minHeight: sz.h,
      border: 'none', cursor: 'pointer',
      background: baseBg, color: baseColor,
      borderRadius: 999, fontWeight: 600, letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      boxShadow: active ? '0 6px 14px -4px rgba(255,61,127,0.36)' : 'var(--shadow-xs)',
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15}/>}
      {children}
    </button>
  );
};

// ── StatusPill ──────────────────────────────────────────────────────────
const StatusPill = ({ label, kind = 'success', icon }) => {
  const styles = {
    success:   { color: '#3F9E7E', bg: '#DDF1E8' },
    upcoming:  { color: '#C5841A', bg: '#FCEACB' },
    pending:   { color: 'var(--fg-secondary)', bg: 'var(--peach-100)' },
    danger:    { color: 'var(--danger)', bg: 'var(--danger-bg)' },
    info:      { color: 'var(--info)', bg: 'var(--info-bg)' },
    sunset:    { color: '#fff', bg: 'var(--gradient-sunset)' },
    skipped:   { color: 'var(--fg-tertiary)', bg: 'var(--bg-sunken)' },
  }[kind];
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
      color: styles.color, background: styles.bg,
      padding: icon ? '4px 10px 4px 7px' : '4px 10px',
      borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      whiteSpace: 'nowrap',
      textTransform: 'lowercase',
    }}>
      {icon && <Icon name={icon} size={11}/>}
      {label}
    </span>
  );
};

// ── Avatar ─────────────────────────────────────────────────────────────
const Avatar = ({ name, emoji, size = 44, color = 'sunset', style }) => {
  const palettes = {
    sunset:    { bg: 'var(--gradient-sunset)', fg: '#fff' },
    peach:     { bg: 'var(--peach-200)', fg: 'var(--fg)' },
    rose:      { bg: '#FFD0DC', fg: 'var(--fg)' },
    tan:       { bg: '#F5E2D8', fg: 'var(--fg)' },
    mint:      { bg: '#D6EFE5', fg: '#3F9E7E' },
    soft:      { bg: 'var(--peach-100)', fg: 'var(--fg)' },
  };
  const p = palettes[color] || palettes.sunset;
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: p.bg, color: p.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontSize: emoji ? size * 0.55 : size * 0.36,
      fontWeight: 800, letterSpacing: '-0.02em',
      boxShadow: color === 'sunset' ? '0 6px 14px -4px rgba(255,61,127,0.32)' : 'none',
      flexShrink: 0,
      ...style,
    }}>
      {emoji || (name ? name[0].toUpperCase() : '')}
    </div>
  );
};

// ── Card ───────────────────────────────────────────────────────────────
const Card = ({ children, padding = 18, style, onClick, gradient, soft }) => {
  const bg = gradient
    ? 'var(--gradient-sunset)'
    : soft
    ? 'var(--gradient-sunset-soft)'
    : 'var(--bg-elevated)';
  return (
    <div onClick={onClick} className={onClick ? 'dosy-press' : ''} style={{
      background: bg,
      color: gradient ? '#fff' : 'var(--fg)',
      borderRadius: 24,
      padding,
      boxShadow: gradient
        ? '0 16px 36px -10px rgba(255,61,127,0.4), 0 6px 14px -6px rgba(255,107,91,0.24)'
        : 'var(--shadow-md)',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {children}
    </div>
  );
};

// ── SectionTitle ───────────────────────────────────────────────────────
const SectionTitle = ({ children, action, style }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 22px 10px',
    ...style,
  }}>
    <div style={{
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
      letterSpacing: '0.02em', textTransform: 'uppercase',
      color: 'var(--fg-secondary)',
    }}>{children}</div>
    {action}
  </div>
);

// ── Input ──────────────────────────────────────────────────────────────
const Input = ({ label, value, placeholder, onChange, icon, type = 'text', readOnly, hint, error, suffix }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    {label && (
      <label style={{
        fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)',
        letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: 4,
      }}>{label}</label>
    )}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <div style={{ position: 'absolute', left: 16, color: 'var(--fg-secondary)', pointerEvents: 'none' }}>
          <Icon name={icon} size={18}/>
        </div>
      )}
      <input
        type={type} value={value || ''} placeholder={placeholder}
        onChange={onChange || (() => {})} readOnly={readOnly || !onChange}
        style={{
          width: '100%', padding: icon ? '14px 18px 14px 44px' : '14px 18px',
          paddingRight: suffix ? 56 : 18,
          borderRadius: 16,
          background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xs)',
          border: error ? '1.5px solid var(--danger)' : '1.5px solid transparent',
          fontSize: 15, color: 'var(--fg)', outline: 'none',
        }}
      />
      {suffix && (
        <div style={{
          position: 'absolute', right: 14,
          fontSize: 13, color: 'var(--fg-secondary)', fontWeight: 500,
        }}>{suffix}</div>
      )}
    </div>
    {hint && !error && (
      <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', paddingLeft: 4, lineHeight: 1.4 }}>{hint}</div>
    )}
    {error && (
      <div style={{ fontSize: 12, color: 'var(--danger)', paddingLeft: 4, lineHeight: 1.4 }}>{error}</div>
    )}
  </div>
);

// ── Toggle (switch) ────────────────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange && onChange(!value)} style={{
    width: 46, height: 28, borderRadius: 999,
    background: value ? 'var(--gradient-sunset)' : 'var(--bg-sunken)',
    border: 'none', cursor: 'pointer', position: 'relative', padding: 0,
    transition: 'background .25s var(--ease-out)',
    flexShrink: 0,
  }}>
    <div style={{
      position: 'absolute', top: 3, left: value ? 21 : 3,
      width: 22, height: 22, borderRadius: 999, background: '#fff',
      boxShadow: '0 2px 6px rgba(74,36,16,0.25)',
      transition: 'left .25s var(--ease-out)',
    }}/>
  </button>
);

// ── Bottom Sheet ───────────────────────────────────────────────────────
const Sheet = ({ open, onClose, children, title, full, padding = '14px 22px 26px', closeOnOverlay = true, glass = false }) => {
  if (!open) return null;
  const glassPanel = glass ? {
    background: 'linear-gradient(180deg, color-mix(in oklab, var(--bg-elevated) 88%, transparent) 0%, color-mix(in oklab, var(--bg) 82%, transparent) 100%)',
    backdropFilter: 'blur(36px) saturate(180%)',
    WebkitBackdropFilter: 'blur(36px) saturate(180%)',
    boxShadow: [
      'inset 0 1px 0 color-mix(in oklab, var(--fg-on-sunset, #fff) 35%, transparent)',
      'inset 0 0 0 1px var(--border)',
      '0 -24px 60px -16px rgba(0,0,0,0.45)',
    ].join(', '),
  } : {
    background: 'var(--bg)',
    boxShadow: '0 -20px 40px -12px rgba(74,36,16,0.18)',
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={closeOnOverlay ? onClose : undefined} style={{
        position: 'absolute', inset: 0,
        background: glass ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
        animation: 'dosy-fade-in .22s var(--ease-out)',
      }}/>
      <div style={{
        position: 'relative',
        borderRadius: '32px 32px 0 0',
        padding,
        animation: 'dosy-slide-up .35s var(--ease-out)',
        maxHeight: full ? '92%' : '82%',
        overflow: 'auto',
        ...glassPanel,
      }} className="dosy-scroll">
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--border-strong)', margin: '0 auto 16px' }}/>
        {title && (
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.02em', marginBottom: 16,
          }}>{title}</div>
        )}
        {children}
      </div>
    </div>
  );
};

// ── Centered modal ─────────────────────────────────────────────────────
const Modal = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'var(--bg-overlay)',
        animation: 'dosy-fade-in .22s var(--ease-out)',
      }}/>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 340,
        background: 'linear-gradient(180deg, color-mix(in oklab, var(--bg-elevated) 88%, transparent) 0%, color-mix(in oklab, var(--bg) 82%, transparent) 100%)',
        backdropFilter: 'blur(36px) saturate(180%)',
        WebkitBackdropFilter: 'blur(36px) saturate(180%)',
        borderRadius: 28, padding: 24,
        animation: 'dosy-pop .25s var(--ease-out)',
        boxShadow: [
          'inset 0 1px 0 color-mix(in oklab, #fff 35%, transparent)',
          'inset 0 0 0 1px var(--border)',
          '0 24px 60px -16px rgba(0,0,0,0.45)',
        ].join(', '),
      }}>
        {title && (
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
            letterSpacing: '-0.02em', marginBottom: 12,
          }}>{title}</div>
        )}
        {children}
      </div>
    </div>
  );
};

// ── Toast (transient) ─────────────────────────────────────────────────
const Toast = ({ message, action, onAction, onDismiss, kind = 'success' }) => {
  useEffectP(() => {
    if (!message) return;
    const t = setTimeout(() => onDismiss && onDismiss(), 4500);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div className="dosy-toast" style={{
      position: 'absolute', left: 16, right: 16, bottom: 110, zIndex: 70,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: 'var(--bg-elevated)',
      borderRadius: 999,
      boxShadow: 'var(--shadow-lg)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 999,
        background: kind === 'success' ? '#DDF1E8' : 'var(--danger-bg)',
        color: kind === 'success' ? '#3F9E7E' : 'var(--danger)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={kind === 'success' ? 'check' : 'alert'} size={16}/>
      </div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{message}</div>
      {action && (
        <button onClick={onAction} style={{
          border: 'none', background: 'transparent',
          color: 'var(--primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          padding: '4px 4px',
        }}>{action}</button>
      )}
    </div>
  );
};

// ── Header (greeting) ─────────────────────────────────────────────────
const AppHeader = ({ tier = 'free', overdue, onAdjustes, onOverdue }) => {
  const [showOverdue, setShowOverdue] = React.useState(false);
  const tierLabels = {
    free: { label: 'Free', bg: 'var(--peach-100)', fg: 'var(--fg-secondary)' },
    plus: { label: 'Plus', bg: '#F5E2D8', fg: 'var(--info)' },
    pro:  { label: 'Pro',  bg: 'var(--gradient-sunset)', fg: '#fff' },
    admin:{ label: 'Admin',bg: 'var(--fg)', fg: 'var(--bg)' },
  }[tier];
  // Greeting based on time of day (defaults to "Bom dia" in design)
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const name = 'Maria';
  // Auto-compute global overdue if not provided
  const overdueCount = overdue != null
    ? overdue
    : (window.DOSY_DATA?.doses?.filter(d => d.status === 'overdue').length || 0);
  return (
    <div style={{
      padding: '14px 22px 10px', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 20,
      background: 'color-mix(in oklab, var(--bg) 86%, transparent)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="assets/logo-mono-dark.png" alt="Dosy" className="dosy-wordmark" style={{
          height: 22, width: 'auto', display: 'block', flexShrink: 0,
        }}/>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)',
            letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{greeting}, <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{name}</span></span>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em',
            padding: '3px 8px', borderRadius: 999,
            background: tierLabels.bg, color: tierLabels.fg,
            textTransform: 'uppercase', flexShrink: 0,
          }}>{tierLabels.label}</span>
        </div>
        {/* Overdue alert button — present on every screen */}
        <button
          onClick={() => setShowOverdue(v => !v)}
          className="dosy-press"
          aria-label={`${overdueCount} doses atrasadas`}
          style={{
            position: 'relative',
            width: 38, height: 38, borderRadius: 999,
            border: 'none', cursor: 'pointer', flexShrink: 0,
            background: overdueCount > 0 ? 'var(--danger-bg)' : 'var(--bg-elevated)',
            color: overdueCount > 0 ? 'var(--danger)' : 'var(--fg)',
            boxShadow: 'var(--shadow-sm)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="bell" size={18}/>
          {overdueCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 999,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10.5, fontWeight: 800, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg)',
              lineHeight: 1,
            }}>{overdueCount > 9 ? '9+' : overdueCount}</span>
          )}
        </button>
        <IconButton icon="settings" onClick={onAdjustes} size={38}/>
      </div>
      {overdueCount > 0 && showOverdue && (
        <button
          onClick={() => { setShowOverdue(false); onOverdue && onOverdue(); }}
          className="dosy-press"
          style={{
          marginTop: 12, width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: 'none',
          borderRadius: 14,
          fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
          cursor: 'pointer',
          textAlign: 'left',
        }}>
          <Icon name="alert" size={16}/>
          <span style={{ flex: 1 }}>{overdueCount} dose{overdueCount > 1 ? 's' : ''} atrasada{overdueCount > 1 ? 's' : ''}</span>
          <Icon name="chevron-right" size={16}/>
        </button>
      )}
    </div>
  );
};

// ── BottomNav (5 items, with center plus) ─────────────────────────────
const BottomNav = ({ active, onChange, onPlus }) => {
  const items = [
    { id: 'inicio',    icon: 'home',  label: 'Início' },
    { id: 'pacientes', icon: 'users', label: 'Pacientes' },
    { id: 'plus',      icon: 'plus',  label: '', center: true },
    { id: 'sos',       icon: 'siren', label: 'S.O.S' },
    { id: 'mais',      icon: 'menu',  label: 'Mais' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 12,
      pointerEvents: 'none', zIndex: 30,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        background: 'rgba(255,250,245,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 999,
        boxShadow: '0 16px 32px -10px rgba(74,36,16,0.22), 0 4px 10px -2px rgba(74,36,16,0.08)',
        pointerEvents: 'auto',
        border: '1px solid rgba(255,255,255,0.6)',
      }} className="dosy-bottom-nav">
        {items.map(item => {
          const isActive = active === item.id;
          if (item.center) {
            return (
              <button key={item.id} onClick={onPlus} className="dosy-press" style={{
                width: 50, height: 50, borderRadius: 999, border: 'none',
                background: 'var(--gradient-sunset)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 10px 20px -6px rgba(255,61,127,0.5)',
              }}>
                <Icon name="plus" size={24} stroke={2}/>
              </button>
            );
          }
          return (
            <button key={item.id} onClick={() => onChange(item.id)} style={{
              border: 'none', cursor: 'pointer',
              padding: '6px 10px', minWidth: 56,
              borderRadius: 999, background: 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--fg-tertiary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              fontWeight: 600, fontSize: 10.5, letterSpacing: '0.01em',
              transition: 'color .2s var(--ease-out)',
            }}>
              <Icon name={item.icon} size={20} stroke={isActive ? 2 : 1.75}/>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── AdBanner (Free tier) ──────────────────────────────────────────────
const AdBanner = ({ onClick }) => (
  <div onClick={onClick} className="dosy-press" style={{
    margin: '6px 22px 0',
    padding: '12px 14px',
    background: 'var(--bg-sunken)',
    borderRadius: 14,
    display: 'flex', alignItems: 'center', gap: 12,
    cursor: 'pointer',
    border: '1px dashed var(--border-strong)',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: 'rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--fg-tertiary)',
    }}>
      <Icon name="image" size={20}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Anúncio</div>
      <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)', fontWeight: 500, marginTop: 2 }}>Sem ads no Plus</div>
    </div>
    <Icon name="close" size={14} style={{ color: 'var(--fg-tertiary)' }}/>
  </div>
);

// ── UpdateBanner ──────────────────────────────────────────────────────
const UpdateBanner = ({ onUpdate, onDismiss }) => (
  <div style={{
    margin: '0 22px 10px',
    padding: '10px 14px',
    background: 'var(--gradient-sunset-soft)',
    borderRadius: 14,
    display: 'flex', alignItems: 'center', gap: 10,
    fontSize: 13, fontWeight: 600, color: 'var(--fg)',
  }}>
    <Icon name="sparkles" size={16}/>
    <span style={{ flex: 1 }}>Nova versão 2.4 disponível</span>
    <button onClick={onUpdate} style={{
      border: 'none', background: 'var(--fg)', color: 'var(--bg)',
      fontSize: 12, fontWeight: 700, padding: '5px 12px',
      borderRadius: 999, cursor: 'pointer',
    }}>Atualizar</button>
  </div>
);

// ── Pill icon block — for med-row leading slot (with color) ───────────
const PillIcon = ({ color = 'peach-100', icon = 'pill', size = 44 }) => {
  const palette = {
    'peach-100': '#FFE5D6',
    'peach-200': '#FFD4C2',
    'peach-300': '#FFB99B',
    'tan': '#F5E2D8',
    'soft-rose': '#FFD0DC',
    'mint': '#D6EFE5',
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      background: palette[color] || palette['peach-100'],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: 'var(--fg)',
    }}>
      <Icon name={icon} size={size > 40 ? 22 : 18}/>
    </div>
  );
};

Object.assign(window, {
  Button, IconButton, Chip, StatusPill, Avatar, Card, SectionTitle,
  Input, Toggle, Sheet, Modal, Toast, AppHeader, BottomNav, AdBanner,
  UpdateBanner, PillIcon,
});
