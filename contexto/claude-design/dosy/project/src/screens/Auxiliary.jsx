// Histórico, Análises, Mais, Ajustes — auxiliary tabs.

const HistoricoScreen = ({ tier, onSettings, onPaywall }) => {
  const [tab, setTab] = React.useState('hoje');
  const days = [
    { day: 'hoje', label: 'Hoje', date: 'qua, 19 mar', adesao: 86 },
    { day: 'ontem', label: 'Ontem', date: 'ter, 18 mar', adesao: 100 },
    { day: '17', label: 'Seg', date: 'seg, 17 mar', adesao: 75 },
    { day: '16', label: 'Dom', date: 'dom, 16 mar', adesao: 100 },
    { day: '15', label: 'Sáb', date: 'sáb, 15 mar', adesao: 88 },
  ];
  const items = [
    { time: '08:04', med: 'Levotiroxina', dose: '50 mcg', patient: 'Helena', status: 'taken', delta: '+4 min' },
    { time: '08:00', med: 'Ibuprofeno', dose: '2,5 ml', patient: 'Pedro', status: 'taken', delta: 'no horário' },
    { time: '12:30', med: 'Vitamina D', dose: '5 gotas', patient: 'Helena', status: 'overdue' },
    { time: '11:30', med: 'Ibuprofeno', dose: '2,5 ml', patient: 'Pedro', status: 'taken', sos: true, delta: 'S.O.S' },
    { time: '07:00', med: 'Metformina', dose: '500 mg', patient: 'Maria', status: 'skipped', delta: 'pulou' },
  ];

  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
      <AppHeader greeting="Histórico" name="Maria" tier={tier} onAdjustes={onSettings}/>
      <div style={{ padding: '4px 22px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>Histórico</div>
        <IconButton icon="filter" kind="ghost"/>
      </div>

      {/* Day strip */}
      <div className="dosy-scroll" style={{ display: 'flex', gap: 8, padding: '0 18px 14px', overflowX: 'auto' }}>
        {days.map(d => (
          <button key={d.day} onClick={() => setTab(d.day)} className="dosy-press" style={{
            padding: '10px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: tab === d.day ? 'var(--gradient-sunset)' : 'var(--bg-elevated)',
            color: tab === d.day ? '#fff' : 'var(--fg)',
            boxShadow: tab === d.day ? '0 8px 16px -6px rgba(255,61,127,0.4)' : 'var(--shadow-xs)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            minWidth: 64, flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: tab === d.day ? 0.9 : 0.7 }}>{d.label}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{d.adesao}%</span>
          </button>
        ))}
      </div>

      {/* Daily summary */}
      <div style={{ padding: '0 22px 14px' }}>
        <Card padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>{days.find(d => d.day === tab)?.date}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', marginTop: 4 }}>6 de 7 doses</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)', marginTop: 2 }}>1 atraso, 0 puladas</div>
            </div>
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: 'var(--gradient-sunset-soft)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em', lineHeight: 1 }}>86%</div>
              <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginTop: 1 }}>adesão</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => {
          const tone = it.status === 'taken' ? 'success' : it.status === 'overdue' ? 'danger' : 'skipped';
          const icon = it.status === 'taken' ? 'check' : it.status === 'overdue' ? 'alert' : 'close';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--bg-elevated)', borderRadius: 16, boxShadow: 'var(--shadow-xs)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: tone === 'success' ? '#DDF1E8' : tone === 'danger' ? 'var(--danger-bg)' : 'var(--bg-sunken)',
                color: tone === 'success' ? '#3F9E7E' : tone === 'danger' ? 'var(--danger)' : 'var(--fg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={icon} size={16}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>{it.med}</span>
                  {it.sos && <StatusPill label="S.O.S" kind="danger"/>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>{it.dose} · {it.patient}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{it.time}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginTop: 1 }}>{it.delta}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AnalisesScreen = ({ tier, onSettings, onPaywall }) => {
  const isPro = tier === 'pro' || tier === 'admin';

  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110, position: 'relative' }}>
      <AppHeader greeting="Análises" name="Maria" tier={tier} onAdjustes={onSettings}/>
      <div style={{ padding: '4px 22px 12px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>Análises</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-secondary)', marginTop: 4 }}>Adesão e padrões dos últimos 30 dias</div>
      </div>

      <div style={{ filter: isPro ? 'none' : 'blur(2px)', pointerEvents: isPro ? 'auto' : 'none' }}>
        {/* Big number */}
        <div style={{ padding: '0 22px 14px' }}>
          <Card gradient padding={20}>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>Adesão geral · 30d</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, letterSpacing: '-0.035em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>89</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', opacity: 0.8 }}>%</span>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, opacity: 0.92, fontWeight: 600 }}>↗ +6 vs mês anterior</span>
              </div>
              <BarChart30 days={30}/>
            </div>
          </Card>
        </div>

        {/* Per patient */}
        <SectionTitle>Por paciente</SectionTitle>
        <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {window.DOSY_DATA.patients.map((p, i) => {
            const pct = [86, 100, 78][i] || 90;
            return (
              <div key={p.id} style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 18, boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Avatar emoji={p.avatar.emoji} color={p.avatar.color} size={36}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.shortName}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{p.condition}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
                </div>
                <div style={{ height: 8, background: 'var(--bg-sunken)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: 'var(--gradient-sunset)', borderRadius: 999,
                  }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar heatmap */}
        <SectionTitle>Calendário · março</SectionTitle>
        <div style={{ padding: '0 22px 14px' }}>
          <Card padding={16}>
            <CalendarHeatmap/>
          </Card>
        </div>

        {/* Export */}
        <div style={{ padding: '0 22px 14px', display: 'flex', gap: 8 }}>
          <Button kind="secondary" full icon="file-text">Exportar PDF</Button>
          <Button kind="secondary" full icon="download">CSV</Button>
        </div>
      </div>

      {/* Paywall overlay for Free */}
      {!isPro && (
        <div style={{
          position: 'absolute', top: 180, left: 22, right: 22,
          background: 'var(--bg-elevated)', borderRadius: 22,
          boxShadow: 'var(--shadow-xl)',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
            background: 'var(--gradient-sunset)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 12px 24px -8px rgba(255,61,127,0.4)',
          }}><Icon name="bar-chart" size={24}/></div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Análises completas no Pro</div>
          <div style={{ fontSize: 13.5, color: 'var(--fg-secondary)', marginTop: 6, lineHeight: 1.5 }}>Adesão por paciente e remédio, calendários, exportação para PDF.</div>
          <div style={{ marginTop: 14 }}>
            <Button kind="primary" full size="lg" icon="crown" onClick={onPaywall}>Liberar com Pro</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Bar chart sparkline
const BarChart30 = ({ days = 30 }) => {
  const data = Array.from({ length: days }, (_, i) => {
    const seed = (i * 31 + 7) % 100;
    return Math.max(40, 60 + (seed % 50));
  });
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 14, height: 56 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${v}%`,
          background: v >= 80 ? '#fff' : 'rgba(255,255,255,0.45)',
          borderRadius: 2,
          minHeight: 6,
        }}/>
      ))}
    </div>
  );
};

// Calendar heatmap (5×7)
const CalendarHeatmap = () => {
  const cells = Array.from({ length: 35 }, (_, i) => {
    if (i < 4) return null; // March starts Saturday-ish for demo
    const seed = (i * 13 + 5) % 100;
    if (i > 25) return -1; // future
    return seed > 80 ? 0.4 : seed > 30 ? 0.95 : 0.7;
  });
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-tertiary)', textAlign: 'center', letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((c, i) => {
          if (c === null) return <div key={i}/>;
          if (c === -1) return <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: 'var(--bg-sunken)' }}/>;
          const bg = c < 0.5 ? 'rgba(229,86,74,0.85)' : c < 0.8 ? 'rgba(255,162,128,0.95)' : 'rgba(63,158,126,0.85)';
          return (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 6, background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>{i - 3}</div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--fg-secondary)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(63,158,126,0.85)' }}/>100%</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,162,128,0.95)' }}/>50–99%</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(229,86,74,0.85)' }}/>&lt;50%</div>
      </div>
    </div>
  );
};

const MaisScreen = ({ tier, onPaywall, onSettings, onShare }) => {
  const sections = [
    { title: 'Conta', items: [
      { icon: 'user', label: 'Perfil', sub: 'Maria Souza · maria@email.com' },
      { icon: 'crown', label: 'Plano', sub: tier === 'free' ? 'Free · 1/1 paciente' : tier === 'pro' ? 'Pro · anual' : 'Admin · interno', cta: tier === 'free' ? 'Upgrade' : null, onClick: tier === 'free' ? onPaywall : null },
    ]},
    { title: 'Pacientes', items: [
      { icon: 'users', label: 'Compartilhamentos', sub: '1 cuidador · Helena' },
      { icon: 'database', label: 'Modelos de tratamento', sub: '3 modelos salvos' },
    ]},
    { title: 'Notificações', items: [
      { icon: 'bell', label: 'Alarmes', sub: 'Som padrão · vibração' },
      { icon: 'clock', label: 'Tolerância de atraso', sub: '15 min' },
      { icon: 'volume', label: 'Persistência', sub: 'A cada 5 min · 3 vezes' },
    ]},
    { title: 'Sobre', items: [
      { icon: 'info', label: 'Política e Privacidade', sub: '' },
      { icon: 'help', label: 'Ajuda e contato', sub: '' },
      { icon: 'log-out', label: 'Sair', sub: '', destructive: true },
    ]},
  ];
  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
      <AppHeader greeting="Mais" name="Maria" tier={tier} onAdjustes={onSettings}/>
      <div style={{ padding: '4px 22px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>Mais</div>
      </div>

      {/* Profile card */}
      <div style={{ padding: '0 22px 14px' }}>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'var(--gradient-sunset)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em',
              boxShadow: '0 12px 24px -8px rgba(255,61,127,0.4)',
            }}>MS</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.025em' }}>Maria Souza</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>maria@email.com · 3 pacientes</div>
            </div>
            {tier === 'pro' && <StatusPill label="Pro" kind="info" icon="crown"/>}
            {tier === 'admin' && <StatusPill label="Admin" kind="info" icon="shield"/>}
          </div>
        </Card>
      </div>

      {sections.map(sec => (
        <div key={sec.title} style={{ marginBottom: 6 }}>
          <SectionTitle>{sec.title}</SectionTitle>
          <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sec.items.map((it, i) => (
              <div key={i} onClick={it.onClick} className="dosy-press" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--bg-elevated)', borderRadius: 16, boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: it.destructive ? 'var(--danger-bg)' : 'var(--bg-sunken)',
                  color: it.destructive ? 'var(--danger)' : 'var(--fg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icon name={it.icon} size={18}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: it.destructive ? 'var(--danger)' : 'var(--fg)' }}>{it.label}</div>
                  {it.sub && <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 1 }}>{it.sub}</div>}
                </div>
                {it.cta ? (
                  <div style={{
                    padding: '5px 11px', borderRadius: 999,
                    background: 'var(--gradient-sunset)',
                    color: '#fff', fontWeight: 700, fontSize: 11.5,
                  }}>{it.cta}</div>
                ) : (
                  <Icon name="chevron-right" size={16} style={{ color: 'var(--fg-tertiary)' }}/>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', padding: '20px 0 10px', color: 'var(--fg-tertiary)', fontSize: 11 }}>
        Dosy v2.4.1 · feito com cuidado
      </div>
    </div>
  );
};

const AjustesScreen = ({ onBack }) => {
  const [tolerancia, setTolerancia] = React.useState(15);
  const [persistencia, setPersistencia] = React.useState(true);
  const [vibracao, setVibracao] = React.useState(true);
  const [notificacoes, setNotificacoes] = React.useState(true);
  const [alarme, setAlarme] = React.useState(true);
  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 30 }}>
      <div style={{ padding: '14px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" onClick={onBack}/>
      </div>
      <div style={{ padding: '4px 22px 18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>Ajustes</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-secondary)', marginTop: 4 }}>Notificações e regras</div>
      </div>

      <SectionTitle>Notificações</SectionTitle>
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SettingRow icon="bell" label="Notificações" sub={notificacoes ? 'Receber lembretes do app' : 'Desligado — você não receberá lembretes'}>
          <Toggle value={notificacoes} onChange={setNotificacoes}/>
        </SettingRow>
        {notificacoes && (
          <>
            <SettingRow icon="volume" label="Vibração" sub="Pulso curto a cada toque">
              <Toggle value={vibracao} onChange={setVibracao}/>
            </SettingRow>
            <SettingRow icon="bell-ring" label="Alarme" sub="Som + tela cheia">
              <Toggle value={alarme} onChange={setAlarme}/>
            </SettingRow>
            {alarme && (
              <>
                <SettingRow icon="refresh" label="Persistência" sub="Reenvia até confirmar">
                  <Toggle value={persistencia} onChange={setPersistencia}/>
                </SettingRow>
                <SettingRow icon="clock" label="Tolerância de atraso">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{tolerancia}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>min</span>
                  </div>
                </SettingRow>
                <div style={{ padding: '0 14px' }}>
                  <input type="range" min="0" max="60" step="5" value={tolerancia} onChange={e => setTolerancia(+e.target.value)} style={{ width: '100%', accentColor: 'var(--primary)' }}/>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <SectionTitle>Privacidade</SectionTitle>
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SettingRow icon="lock" label="Bloquear com biometria" sub="FaceID / digital">
          <Toggle value={false}/>
        </SettingRow>
        <SettingRow icon="download" label="Exportar dados" sub="JSON completo"/>
        <SettingRow icon="alert" label="Apagar conta" destructive sub="Ação irreversível"/>
      </div>
    </div>
  );
};

const SettingRow = ({ icon, label, sub, destructive, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    background: 'var(--bg-elevated)', borderRadius: 16, boxShadow: 'var(--shadow-xs)',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 12,
      background: destructive ? 'var(--danger-bg)' : 'var(--bg-sunken)',
      color: destructive ? 'var(--danger)' : 'var(--fg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Icon name={icon} size={18}/></div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: destructive ? 'var(--danger)' : 'var(--fg)' }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 1 }}>{sub}</div>}
    </div>
    {children}
  </div>
);

Object.assign(window, { HistoricoScreen, AnalisesScreen, MaisScreen, AjustesScreen, BarChart30, CalendarHeatmap, SettingRow });
