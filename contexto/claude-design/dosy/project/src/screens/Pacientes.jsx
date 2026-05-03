// Pacientes — list + detail + form
const PacientesListScreen = ({ tier, onAdd, onPatient, onPaywall, onSettings }) => {
  const ps = window.DOSY_DATA.patients;
  const limit = tier === 'free' ? 1 : Infinity;
  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
      <AppHeader greeting="Pacientes" name="Maria" tier={tier} onAdjustes={onSettings}/>
      <div style={{ padding: '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>Pacientes</div>
        <IconButton icon="plus" kind="sunset" onClick={onAdd}/>
      </div>
      {tier === 'free' && (
        <div onClick={onPaywall} className="dosy-press" style={{
          margin: '0 22px 14px', padding: '12px 14px', borderRadius: 14,
          background: 'var(--gradient-sunset-soft)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <Icon name="info" size={18}/>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
            Plano Free: 1/1 paciente. <span style={{ textDecoration: 'underline' }}>Conhecer Pro</span>
          </div>
        </div>
      )}
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ps.map(p => (
          <div key={p.id} onClick={() => onPatient(p)} className="dosy-press" style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 14,
            background: 'var(--bg-elevated)', borderRadius: 20, boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
          }}>
            <Avatar emoji={p.avatar.emoji} color={p.avatar.color} size={52}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>{p.name}</div>
                {p.shared && <Icon name="users" size={14} style={{ color: 'var(--fg-tertiary)' }}/>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)', marginTop: 2 }}>
                {p.age} anos · {p.condition}
              </div>
            </div>
            <Icon name="chevron-right" size={18} style={{ color: 'var(--fg-tertiary)' }}/>
          </div>
        ))}
      </div>
    </div>
  );
};

const PacienteDetailScreen = ({ patient, onBack, onShare, tier, onPaywall, onAddTreatment }) => {
  if (!patient) return null;
  const treats = window.DOSY_DATA.treatments.filter(t => t.patient === patient.id && t.status === 'active');
  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 30 }}>
      <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" onClick={onBack}/>
        <IconButton icon="more-vert" kind="ghost"/>
      </div>

      {/* Hero */}
      <div style={{ padding: '8px 22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Avatar emoji={patient.avatar.emoji} color={patient.avatar.color} size={92}/>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em' }}>{patient.name}</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-secondary)' }}>{patient.age} anos · {patient.weight} kg · {patient.condition}</div>
      </div>

      {/* Doctor + alergias */}
      <div style={{ padding: '0 22px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 14, boxShadow: 'var(--shadow-xs)' }}>
          <Icon name="stethoscope" size={18} style={{ color: 'var(--fg-secondary)' }}/>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{patient.doctor}</div>
        </div>
        {patient.allergies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 14 }}>
            <Icon name="alert" size={18} style={{ color: 'var(--danger)' }}/>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>Alergias: {patient.allergies.join(', ')}</div>
          </div>
        )}
      </div>

      {/* Share (Pro) */}
      <div style={{ padding: '0 22px 14px' }}>
        <div onClick={tier === 'pro' || tier === 'admin' ? onShare : onPaywall} className="dosy-press" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'var(--bg-elevated)', borderRadius: 14, cursor: 'pointer',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <Icon name="share" size={18}/>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Compartilhar paciente</div>
          {patient.shared && <StatusPill label="1 cuidador" kind="info"/>}
          {!(tier === 'pro' || tier === 'admin') && <Icon name="lock" size={14} style={{ color: 'var(--fg-tertiary)' }}/>}
        </div>
      </div>

      {/* Stats 2-up */}
      <div style={{ padding: '0 22px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MiniStat label="Adesão hoje" value="86%" tone="success"/>
        <MiniStat label="Tratamentos" value={treats.length} unit="ativos"/>
      </div>

      {/* Treatments */}
      <SectionTitle action={
        <button onClick={onAddTreatment} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="plus" size={14}/> Novo
        </button>
      }>Tratamentos ativos</SectionTitle>
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {treats.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13.5 }}>Sem tratamentos ativos</div>
        ) : treats.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 16, boxShadow: 'var(--shadow-xs)' }}>
            <PillIcon color={t.color} icon={t.icon} size={42}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }}>{t.med}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>{t.dose} · {t.freq}</div>
            </div>
            {t.daysLeft && <StatusPill label={`${t.daysLeft}d`} kind="upcoming"/>}
          </div>
        ))}
      </div>
    </div>
  );
};

window.PacientesListScreen = PacientesListScreen;
window.PacienteDetailScreen = PacienteDetailScreen;
