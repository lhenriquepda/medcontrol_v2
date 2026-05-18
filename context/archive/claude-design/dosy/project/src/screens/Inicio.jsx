// Início — dashboard screen with hero gauge, status cards, grouped dose list.

const InicioScreen = ({ tier = 'free', onDoseClick, onAddTreatment, onOpenFilters, onOverdue, onSettings, onPaywall }) => {
  const [period, setPeriod] = React.useState('24h');
  const [collapsed, setCollapsed] = React.useState({});

  const allDoses = window.DOSY_DATA.doses;
  const taken = allDoses.filter(d => d.status === 'taken').length;
  const total = allDoses.length;
  const overdue = allDoses.filter(d => d.status === 'overdue').length;
  const pending = allDoses.filter(d => d.status === 'pending').length;
  const groups = window.dosyGroupDosesByPatient(allDoses);

  const periods = [
    { id: '12h', label: '12h' },
    { id: '24h', label: '24h' },
    { id: '48h', label: '48h' },
    { id: '7d',  label: '7 dias' },
    { id: 'all', label: 'Tudo' },
  ];

  return (
    <div className="dosy-scroll" style={{
      flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
      paddingBottom: 110,
    }}>
      <AppHeader
        greeting="Bom dia"
        name="Maria"
        tier={tier}
        overdue={overdue}
        onAdjustes={onSettings}
        onOverdue={onOverdue}
      />

      {tier === 'free' && <AdBanner onClick={onPaywall}/>}

      {/* Hero stats — 3 cards */}
      <div style={{ padding: '14px 22px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* main hero — pendentes */}
        <Card gradient padding={18} style={{ gridColumn: '1 / -1', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -50, right: -40, width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)',
          }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            <HeroGauge taken={taken} total={total} size={108}/>
            <div style={{ flex: 1, color: '#fff' }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', opacity: 0.85,
              }}>Hoje</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30,
                lineHeight: 1.05, letterSpacing: '-0.025em', marginTop: 4,
              }}>{pending} pendentes</div>
              <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 6, lineHeight: 1.4 }}>
                {overdue > 0
                  ? `${overdue} atrasada${overdue > 1 ? 's' : ''} agora`
                  : 'Tá em dia, Maria.'}
              </div>
            </div>
          </div>
        </Card>

        <MiniStat label="Adesão 7d" value="91%" trend="+4" tone="success"/>
        <MiniStat label="Atrasadas" value={overdue} unit="hoje" tone={overdue > 0 ? 'danger' : 'neutral'}/>
      </div>

      {/* Period filter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px 8px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
          letterSpacing: '-0.02em', color: 'var(--fg)',
        }}>Próximas doses</div>
        <button onClick={onOpenFilters} className="dosy-press" style={{
          height: 30, padding: '0 12px', borderRadius: 999,
          background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xs)',
          border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontWeight: 600, fontSize: 12, color: 'var(--fg-secondary)',
        }}>
          <Icon name="filter" size={13}/>
          Filtros
        </button>
      </div>
      <div style={{
        display: 'flex', gap: 8, padding: '0 22px 4px',
        overflowX: 'auto',
      }} className="dosy-scroll">
        {periods.map(p => (
          <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)} size="sm">
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Dose groups */}
      <div style={{ padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map(({ patient, doses, overdue: groupOverdue }) => {
          const isCollapsed = collapsed[patient.id];
          return (
            <div key={patient.id} style={{
              background: 'var(--bg-elevated)',
              borderRadius: 22,
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setCollapsed({ ...collapsed, [patient.id]: !isCollapsed })}
                className="dosy-press"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Avatar emoji={patient.avatar.emoji} color={patient.avatar.color} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15.5,
                    letterSpacing: '-0.02em', color: 'var(--fg)',
                  }}>{patient.shortName}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 1 }}>
                    {doses.length} dose{doses.length !== 1 ? 's' : ''} hoje
                  </div>
                </div>
                {groupOverdue > 0 && (
                  <StatusPill label={`${groupOverdue} atrasada${groupOverdue > 1 ? 's' : ''}`} kind="danger" icon="alert"/>
                )}
                <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} style={{ color: 'var(--fg-tertiary)' }}/>
              </button>

              {!isCollapsed && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doses.map(d => (
                    <DoseRow key={d.id} dose={d} onClick={() => onDoseClick(d)}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── HeroGauge — animated circular ring
const HeroGauge = ({ taken, total, size = 108 }) => {
  const pct = Math.round((taken / total) * 100);
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setProgress(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  const offset = c * (1 - progress / 100);
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="8"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#fff" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size * 0.3,
          lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{taken}</span><span style={{ opacity: 0.6, fontSize: '0.6em' }}>/{total}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, marginTop: 3, letterSpacing: '0.05em' }}>doses</div>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, unit, trend, tone = 'neutral' }) => {
  const colors = {
    neutral: { fg: 'var(--fg)', trendFg: 'var(--fg-secondary)' },
    success: { fg: 'var(--fg)', trendFg: '#3F9E7E' },
    danger:  { fg: 'var(--danger)', trendFg: 'var(--danger)' },
  }[tone];
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--bg-elevated)',
      borderRadius: 18,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--fg-secondary)',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26,
          letterSpacing: '-0.02em', color: colors.fg,
          fontVariantNumeric: 'tabular-nums',
        }}>{value}</span>
        {unit && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)' }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ fontSize: 11.5, color: colors.trendFg, fontWeight: 600, marginTop: 2 }}>
          {trend}
        </div>
      )}
    </div>
  );
};

// ── DoseRow — a single dose card
const DoseRow = ({ dose, onClick, onTake, onSkip }) => {
  const status = dose.status;
  const statusInfo = {
    taken:   { label: 'tomado', kind: 'success' },
    pending: { label: 'pendente', kind: 'pending' },
    overdue: { label: 'atrasada', kind: 'danger' },
    skipped: { label: 'pulado', kind: 'skipped' },
  }[status];

  return (
    <div
      onClick={onClick}
      className="dosy-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px', borderRadius: 16,
        background: status === 'overdue' ? 'var(--danger-bg)' : 'var(--bg-sunken)',
        cursor: 'pointer',
      }}
    >
      <PillIcon color={dose.color} icon={dose.icon} size={40}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em',
          color: status === 'taken' ? 'var(--fg-secondary)' : 'var(--fg)',
          textDecoration: status === 'taken' ? 'line-through' : 'none',
          textDecorationColor: 'var(--fg-tertiary)',
        }}>{dose.med}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)', marginTop: 1 }}>
          {dose.dose}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
          letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          color: status === 'overdue' ? 'var(--danger)' : 'var(--fg)',
        }}>{dose.time}</div>
        <StatusPill label={statusInfo.label} kind={statusInfo.kind}/>
      </div>
    </div>
  );
};

window.InicioScreen = InicioScreen;
window.HeroGauge = HeroGauge;
window.DoseRow = DoseRow;
window.MiniStat = MiniStat;
