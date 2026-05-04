// Login + Onboarding tour + Tela cheia de alarme.

const LoginScreen = ({ onLogin }) => {
  const [mode, setMode] = React.useState('login');
  return (
    <div style={{
      flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      paddingBottom: 0,
    }}>
      {/* Hero */}
      <div style={{
        padding: '60px 26px 50px',
        background: 'var(--gradient-sunset)',
        position: 'relative', overflow: 'hidden',
        borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)',
        }}/>
        <div style={{
          position: 'absolute', bottom: -40, left: -50, width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
        }}/>
        {/* Logo (centered) */}
        <img src="assets/logo-mono-light.png" alt="Dosy" style={{
          width: 160, height: 'auto', display: 'block',
          position: 'relative',
          filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.14))',
        }}/>
      </div>

      <div style={{ flex: 1, padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--bg-sunken)', borderRadius: 999 }}>
          {[
            { id: 'login', label: 'Entrar' },
            { id: 'signup', label: 'Criar conta' },
          ].map(o => (
            <button key={o.id} onClick={() => setMode(o.id)} style={{
              flex: 1, padding: 10, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: mode === o.id ? 'var(--bg-elevated)' : 'transparent',
              color: mode === o.id ? 'var(--fg)' : 'var(--fg-secondary)',
              fontWeight: 700, fontSize: 13.5, letterSpacing: '-0.01em',
              boxShadow: mode === o.id ? 'var(--shadow-xs)' : 'none',
            }}>{o.label}</button>
          ))}
        </div>

        {mode === 'signup' && <Input label="Nome" placeholder="Maria Souza" icon="user"/>}
        <Input label="Email" placeholder="seu@email.com" icon="mail"/>
        <Input label="Senha" placeholder="••••••••" icon="lock" type="password"/>

        <Button kind="primary" full size="lg" icon={mode === 'signup' ? 'arrow-right' : 'log-in'} onClick={onLogin}>
          {mode === 'signup' ? 'Criar conta' : 'Entrar'}
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg-tertiary)', fontSize: 12, fontWeight: 600, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
          ou
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
        </div>

        <Button kind="secondary" full size="lg" icon="google" onClick={onLogin}>Continuar com Google</Button>
        <Button kind="secondary" full size="lg" icon="apple" onClick={onLogin}>Continuar com Apple</Button>

        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--fg-tertiary)', marginTop: 'auto', lineHeight: 1.5 }}>
          Ao continuar você aceita os <span style={{ color: 'var(--fg-secondary)', textDecoration: 'underline' }}>Termos</span> e a <span style={{ color: 'var(--fg-secondary)', textDecoration: 'underline' }}>Política de Privacidade</span>.
        </div>
      </div>
    </div>
  );
};

const OnboardingTour = ({ onDone }) => {
  const [step, setStep] = React.useState(0);
  const slides = [
    {
      icon: 'pill', tone: 'sunset',
      title: 'Tudo num lugar.',
      sub: 'Remédios da família com horários, doses e validades — sem caderninho.',
      art: <PillScatter/>,
    },
    {
      icon: 'bell', tone: 'sunset',
      title: 'Alarme que insiste.',
      sub: 'Tela cheia, vibração e som — até alguém confirmar a dose.',
      art: <AlarmGlow/>,
    },
    {
      icon: 'siren', tone: 'danger',
      title: 'S.O.S com segurança.',
      sub: 'Bloqueia doses extras se ainda tá no intervalo mínimo.',
      art: <SafetyShield/>,
    },
    {
      icon: 'users', tone: 'sunset',
      title: 'Cuidando juntos.',
      sub: 'No Pro, compartilhe pacientes em tempo real com cuidadores.',
      art: <FamilyArt/>,
    },
  ];
  const s = slides[step];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Skip */}
      <div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={{ background: 'transparent', border: 'none', color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Pular</button>
      </div>

      {/* Art */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 26px' }}>
        {s.art}
      </div>

      {/* Body */}
      <div style={{ padding: '0 30px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          {s.title}
        </div>
        <div style={{ fontSize: 15, color: 'var(--fg-secondary)', marginTop: 10, lineHeight: 1.5, textWrap: 'pretty' }}>
          {s.sub}
        </div>
      </div>

      {/* Dots + CTA */}
      <div style={{ padding: '8px 26px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 7, height: 7, borderRadius: 999,
              background: i === step ? 'var(--primary)' : 'var(--border-strong)',
              transition: 'all 200ms',
            }}/>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button kind="primary" size="lg" icon={step === slides.length - 1 ? 'check' : 'arrow-right'} onClick={() => step === slides.length - 1 ? onDone() : setStep(step + 1)}>
            {step === slides.length - 1 ? 'Começar' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Onboarding artwork pieces — abstract, no AI slop
const PillScatter = () => (
  <div style={{ position: 'relative', width: 240, height: 220 }}>
    {[
      { x: 30, y: 20, c: 'peach', r: 32, ang: -12 },
      { x: 130, y: 60, c: 'sunset', r: 38, ang: 22 },
      { x: 60, y: 120, c: 'mint', r: 30, ang: 8 },
      { x: 160, y: 140, c: 'sky', r: 34, ang: -18 },
      { x: 100, y: 180, c: 'lemon', r: 28, ang: 30 },
    ].map((p, i) => {
      const colors = {
        peach: '#FFB89E', sunset: 'linear-gradient(135deg, #FFA280, #FF3D7F)',
        mint: '#9DDFC8', sky: '#9FCBE8', lemon: '#F5DA84',
      };
      return (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y,
          width: p.r * 2, height: p.r, borderRadius: p.r,
          background: colors[p.c], boxShadow: '0 12px 24px -10px rgba(122,112,104,0.3)',
          transform: `rotate(${p.ang}deg)`,
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5,
            background: 'rgba(0,0,0,0.08)', transform: 'translateX(-50%)',
          }}/>
        </div>
      );
    })}
  </div>
);

const AlarmGlow = () => (
  <div style={{
    width: 200, height: 200, borderRadius: '50%', position: 'relative',
    background: 'radial-gradient(circle, rgba(255,162,128,0.4), transparent 65%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      width: 110, height: 110, borderRadius: '50%',
      background: 'var(--gradient-sunset)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', boxShadow: '0 20px 40px -12px rgba(255,61,127,0.5)',
    }}>
      <Icon name="bell" size={48}/>
    </div>
  </div>
);

const SafetyShield = () => (
  <div style={{ position: 'relative', width: 220, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{
      width: 140, height: 160,
      background: 'linear-gradient(135deg, var(--danger), #B83A30)',
      clipPath: 'polygon(50% 0, 100% 18%, 100% 60%, 50% 100%, 0 60%, 0 18%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', boxShadow: '0 20px 40px -12px rgba(229,86,74,0.5)',
    }}>
      <Icon name="siren" size={52}/>
    </div>
  </div>
);

const FamilyArt = () => (
  <div style={{ position: 'relative', width: 240, height: 200 }}>
    {[
      { x: 30, y: 60, e: '👵', c: 'peach' },
      { x: 110, y: 30, e: '👨‍🦰', c: 'sunset' },
      { x: 90, y: 110, e: '👧', c: 'mint' },
      { x: 170, y: 80, e: '👦', c: 'sky' },
    ].map((p, i) => {
      const bg = p.c === 'sunset' ? 'var(--gradient-sunset)' : p.c === 'peach' ? '#FFD9C7' : p.c === 'mint' ? '#C7EBDD' : '#C9DEED';
      return (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y,
          width: 70, height: 70, borderRadius: 22,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          boxShadow: '0 12px 24px -10px rgba(122,112,104,0.3)',
        }}>{p.e}</div>
      );
    })}
  </div>
);

// Tela cheia de alarme — estilo despertador
const AlarmFullScreen = ({ dose, doses: dosesProp, onTake, onSnooze, onClose }) => {
  const [now, setNow] = React.useState('08:00');
  const [taken, setTaken] = React.useState({}); // dose id → true
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Build the alarm dose list. Either explicit array, or all doses ringing at the same alarm time.
  const alarmDoses = React.useMemo(() => {
    if (dosesProp && dosesProp.length) return dosesProp;
    if (!dose) return [];
    // Pick all doses that ring at same hour as this dose (so the alarm represents one moment)
    const hour = dose.time.split(':')[0];
    const all = (window.DOSY_DATA?.doses || []).filter(d => d.time?.startsWith(hour));
    // Plus a few synthetic extras to demo a long list
    return all.length >= 3 ? all : [dose];
  }, [dose, dosesProp]);

  if (!alarmDoses.length) return null;

  const groups = window.dosyGroupDosesByPatient(alarmDoses);
  const total = alarmDoses.length;
  const takenCount = Object.values(taken).filter(Boolean).length;
  const allTaken = takenCount === total;
  const alarmTime = alarmDoses[0]?.time || '—';

  const markTaken = (id) => setTaken(t => ({ ...t, [id]: true }));
  const takeAll = () => {
    const next = {};
    alarmDoses.forEach(d => { next[d.id] = true; });
    setTaken(next);
    setTimeout(() => onTake && onTake(), 350);
  };

  const patientColor = (pid) => {
    const map = { maria: '#FFD0DC', helena: '#FFE5D6', pedro: '#F5E2D8' };
    return map[pid] || 'rgba(255,255,255,0.18)';
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--gradient-sunset)',
      color: '#fff',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Live ripple bg */}
      <div style={{
        position: 'absolute', top: '10%', right: '-30%', width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)',
        animation: 'dosyPulse 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-30%', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
        animation: 'dosyPulse 2.8s ease-in-out infinite 0.4s',
        pointerEvents: 'none',
      }}/>
      <style>{`
        @keyframes dosyPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>

      {/* Sticky header */}
      <div style={{
        position: 'relative', flexShrink: 0,
        padding: '46px 24px 18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.92, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="bell" size={14}/> Hora do remédio
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="close" size={16}/></button>
        </div>
        {/* Big clock */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 72,
            letterSpacing: '-0.04em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
            textShadow: '0 6px 20px rgba(0,0,0,0.15)',
          }}>{now}</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>Previsto</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{alarmTime}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, opacity: 0.95 }}>
          {takenCount > 0
            ? `${takenCount} de ${total} dose${total > 1 ? 's' : ''} tomada${takenCount > 1 ? 's' : ''}`
            : `${total} dose${total > 1 ? 's' : ''} pra agora · ${groups.length} pessoa${groups.length > 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Scrollable list grouped by patient */}
      <div className="dosy-scroll" style={{
        position: 'relative', flex: 1, overflow: 'auto',
        padding: '4px 24px 16px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {groups.map(g => {
          const groupAllTaken = g.doses.every(d => taken[d.id]);
          return (
            <div key={g.patient.id}>
              {/* Patient header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 10, padding: '0 4px',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 999,
                  background: patientColor(g.patient.id),
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17,
                  border: '1.5px solid rgba(255,255,255,0.35)',
                }}>{g.patient.avatar.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {g.patient.shortName}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 500 }}>
                    {g.doses.length} dose{g.doses.length > 1 ? 's' : ''}{groupAllTaken ? ' · todas tomadas' : ''}
                  </div>
                </div>
                {groupAllTaken && (
                  <div style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: 'rgba(255,255,255,0.96)', color: '#3F9E7E',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name="check" size={15}/></div>
                )}
              </div>

              {/* Dose rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.doses.map(d => {
                  const isTaken = !!taken[d.id];
                  return (
                    <div key={d.id} style={{
                      padding: '13px 14px', borderRadius: 18,
                      background: isTaken ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      border: '1.5px solid rgba(255,255,255,0.28)',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: isTaken ? 0.6 : 1,
                      transition: 'all 250ms var(--ease-out)',
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 14, background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                        flexShrink: 0,
                      }}><Icon name={d.icon || 'pill'} size={20}/></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15.5,
                          letterSpacing: '-0.02em', lineHeight: 1.15,
                          textDecoration: isTaken ? 'line-through' : 'none',
                          textDecorationColor: 'rgba(255,255,255,0.5)',
                        }}>{d.med}</div>
                        <div style={{ fontSize: 12, opacity: 0.92, marginTop: 2, fontWeight: 500 }}>
                          {d.dose} · {d.time}
                        </div>
                      </div>
                      <button
                        onClick={() => !isTaken && markTaken(d.id)}
                        className="dosy-press"
                        aria-label={isTaken ? 'Tomada' : 'Marcar como tomada'}
                        style={{
                          width: 38, height: 38, borderRadius: 999,
                          border: 'none', cursor: isTaken ? 'default' : 'pointer',
                          background: isTaken ? 'rgba(255,255,255,0.96)' : '#fff',
                          color: isTaken ? '#3F9E7E' : 'var(--primary)',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px -2px rgba(0,0,0,0.15)',
                        }}
                      >
                        <Icon name="check" size={18}/>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bottom actions */}
      <div style={{
        position: 'relative', flexShrink: 0,
        padding: '14px 24px 28px',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.10) 100%)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <button onClick={takeAll} className="dosy-press" disabled={allTaken} style={{
          width: '100%', padding: '17px', borderRadius: 22,
          background: '#fff', color: 'var(--primary)', border: 'none',
          cursor: allTaken ? 'default' : 'pointer',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.02em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 16px 30px -10px rgba(0,0,0,0.25)',
          opacity: allTaken ? 0.7 : 1,
        }}>
          <Icon name="check" size={20}/>
          {allTaken ? 'Tudo pronto' : takenCount > 0 ? `Tomar restantes (${total - takenCount})` : `Tomei todas (${total})`}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSnooze} className="dosy-press" style={{
            flex: 1, padding: '13px', borderRadius: 18,
            background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13.5,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon name="clock" size={15}/> Adiar 5 min
          </button>
          <button onClick={onClose} className="dosy-press" style={{
            flex: 1, padding: '13px', borderRadius: 18,
            background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', cursor: 'pointer',
            fontWeight: 700, fontSize: 13.5,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>Pular</button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { LoginScreen, OnboardingTour, AlarmFullScreen });
