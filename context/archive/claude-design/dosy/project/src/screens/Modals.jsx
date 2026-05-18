// Modals — Dose, Filtros, Paywall, Confirmação destrutiva, Compartilhar paciente.

const { useState: useStateM } = React;

// ── Modal de Dose (bottom sheet)
const DoseSheet = ({ open, dose, onClose, onTake, onSkip, onUndo, isPro }) => {
  const [showUndo, setShowUndo] = useStateM(false);
  const [timingMode, setTimingMode] = useStateM('agora'); // agora | prevista | outro
  const [customTime, setCustomTime] = useStateM('');
  // Reset picker when dose changes
  React.useEffect(() => {
    if (dose) { setTimingMode('agora'); setCustomTime(dose.time || ''); }
  }, [dose?.id]);
  if (!dose) return null;
  const statusInfo = {
    taken:   { label: 'Tomado', kind: 'success', icon: 'check' },
    pending: { label: 'Pendente', kind: 'pending', icon: 'clock' },
    overdue: { label: 'Atrasada', kind: 'danger', icon: 'alert' },
    skipped: { label: 'Pulado', kind: 'skipped', icon: 'close' },
  }[dose.status] || { label: '—', kind: 'pending' };
  const patient = window.dosyByPatient(dose.patient);

  return (
    <Sheet open={open} onClose={onClose} glass>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <PillIcon color={dose.color} icon={dose.icon} size={56}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>{dose.med}</div>
          <div style={{ fontSize: 14, color: 'var(--fg-secondary)', marginTop: 3 }}>
            {dose.dose} · {patient.shortName}
          </div>
        </div>
        <StatusPill label={statusInfo.label} kind={statusInfo.kind} icon={statusInfo.icon}/>
      </div>

      {/* Big time card */}
      <div style={{
        background: dose.status === 'overdue' ? 'var(--danger-bg)' : 'var(--bg-sunken)',
        borderRadius: 18,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: dose.status === 'overdue' ? 'var(--danger)' : 'var(--fg-secondary)',
          }}>Previsto</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
            letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
            color: dose.status === 'overdue' ? 'var(--danger)' : 'var(--fg)',
            lineHeight: 1.1, marginTop: 2,
          }}>{dose.time}</div>
        </div>
        {dose.takenAt && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>Tomado</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
              letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums',
              color: '#3F9E7E', lineHeight: 1.1, marginTop: 2,
            }}>{dose.takenAt}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {dose.status !== 'taken' && (
        <>
          {/* When did you take it? */}
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: 18, padding: 4,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
            marginBottom: 10, boxShadow: 'var(--shadow-xs)',
          }}>
            {[
              { id: 'agora',    label: 'Agora',         sub: 'agora mesmo' },
              { id: 'prevista', label: 'Hora prevista', sub: dose.time },
              { id: 'outro',    label: 'Outro',         sub: 'definir' },
            ].map(opt => {
              const active = timingMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTimingMode(opt.id)}
                  className="dosy-press"
                  style={{
                    border: 'none', cursor: 'pointer',
                    padding: '10px 6px', borderRadius: 14,
                    background: active ? 'var(--bg)' : 'transparent',
                    color: active ? 'var(--fg)' : 'var(--fg-secondary)',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    alignItems: 'center',
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{opt.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>{opt.sub}</span>
                </button>
              );
            })}
          </div>
          {timingMode === 'outro' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', marginBottom: 10,
              background: 'var(--bg-sunken)', borderRadius: 14,
            }}>
              <Icon name="clock" size={16}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)' }}>Tomei às</span>
              <input
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 22, letterSpacing: '-0.02em',
                  color: 'var(--fg)', outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button kind="primary" full size="lg" icon="check" onClick={() => {
              const taken = timingMode === 'agora' ? null
                : timingMode === 'prevista' ? dose.time
                : customTime;
              onTake && onTake(dose, { mode: timingMode, takenAt: taken });
              setShowUndo(true);
            }}>
              {timingMode === 'agora' ? 'Tomei agora'
                : timingMode === 'prevista' ? `Tomei às ${dose.time}`
                : customTime ? `Tomei às ${customTime}` : 'Confirmar'}
            </Button>
            <IconButton icon="close" size={54} kind="elevated" onClick={() => onSkip && onSkip(dose)}/>
          </div>
        </>
      )}
      {dose.status === 'taken' && (
        <Button kind="secondary" full size="lg" icon="refresh" onClick={() => onUndo && onUndo(dose)}>
          Desfazer
        </Button>
      )}

      {isPro && (
        <button style={{
          width: '100%', marginTop: 10, padding: '10px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="edit" size={14}/> Editar horário
        </button>
      )}

      {/* Recent history */}
      <div style={{ marginTop: 18 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fg-secondary)', marginBottom: 10,
        }}>Últimas 5 doses</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['ontem · 08:00', 'tomado às 08:04', 'success'],
            ['anteontem · 08:00', 'tomado às 07:58', 'success'],
            ['seg · 08:00', 'pulou', 'danger'],
            ['dom · 08:00', 'tomado às 08:12', 'success'],
            ['sáb · 08:00', 'tomado às 08:00', 'success'],
          ].map(([when, what, kind], i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 12,
              background: 'var(--bg-elevated)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: kind === 'success' ? '#DDF1E8' : 'var(--danger-bg)',
                color: kind === 'success' ? '#3F9E7E' : 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={kind === 'success' ? 'check' : 'close'} size={14}/>
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{when}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{what}</div>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
};

// ── Modal Filtros
const FiltrosSheet = ({ open, onClose }) => {
  const [paciente, setPaciente] = useStateM('todos');
  const [statuses, setStatuses] = useStateM(['pendente', 'atrasada']);
  const [tipos, setTipos] = useStateM(['fixo']);
  const toggle = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  return (
    <Sheet open={open} onClose={onClose} title="Filtros" glass>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Paciente</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip active={paciente === 'todos'} onClick={() => setPaciente('todos')} size="sm">Todos</Chip>
            {window.DOSY_DATA.patients.map(p => (
              <Chip key={p.id} active={paciente === p.id} onClick={() => setPaciente(p.id)} size="sm">
                <span style={{ marginRight: 4 }}>{p.avatar.emoji}</span>{p.shortName}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { id: 'pendente', label: 'Pendente', icon: 'clock' },
              { id: 'atrasada', label: 'Atrasada', icon: 'alert' },
              { id: 'tomada',   label: 'Tomada',   icon: 'check' },
              { id: 'pulada',   label: 'Pulada',   icon: 'close' },
            ].map(s => (
              <Chip key={s.id} active={statuses.includes(s.id)} onClick={() => setStatuses(toggle(statuses, s.id))} icon={s.icon} size="sm">
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Tipo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip active={tipos.includes('fixo')} onClick={() => setTipos(toggle(tipos, 'fixo'))} icon="clock" size="sm">Horário fixo</Chip>
            <Chip active={tipos.includes('sos')} onClick={() => setTipos(toggle(tipos, 'sos'))} icon="siren" size="sm">S.O.S</Chip>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button kind="secondary" full onClick={() => { setPaciente('todos'); setStatuses([]); setTipos([]); }}>Limpar</Button>
          <Button kind="primary" full onClick={onClose}>Aplicar</Button>
        </div>
      </div>
    </Sheet>
  );
};

// ── Paywall
const PaywallSheet = ({ open, onClose, reason }) => (
  <Sheet open={open} onClose={onClose} padding="14px 22px 28px" glass>
    <div style={{ textAlign: 'center', marginBottom: 18 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 18, margin: '0 auto 12px',
        background: 'var(--gradient-sunset)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 24px -8px rgba(255,61,127,0.4)', color: '#fff',
      }}>
        <Icon name="crown" size={26}/>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24,
        letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 6,
      }}>Liberar com Dosy Pro</div>
      <div style={{ fontSize: 14, color: 'var(--fg-secondary)', lineHeight: 1.5, padding: '0 16px' }}>
        {reason || 'Pacientes ilimitados, análises completas e relatórios pro médico.'}
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {[
        { icon: 'users', label: 'Pacientes ilimitados', sub: 'Cuide da família toda' },
        { icon: 'bar-chart', label: 'Análises e calendários', sub: 'Adesão por mês, paciente, remédio' },
        { icon: 'file-text', label: 'Relatórios PDF / CSV', sub: 'Para mostrar pro médico' },
        { icon: 'share', label: 'Compartilhar pacientes', sub: 'Cuidadores em tempo real' },
        { icon: 'bell-off', label: 'Sem anúncios', sub: 'Foco no que importa' },
      ].map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 16,
          background: 'var(--bg-elevated)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'var(--gradient-sunset-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={b.icon} size={18}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>{b.label}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{b.sub}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Plans */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
      <div style={{ padding: 14, borderRadius: 18, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>Mensal</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginTop: 4 }}>R$ 14,90</div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-secondary)', marginTop: 2 }}>por mês</div>
      </div>
      <div style={{
        padding: 14, borderRadius: 18,
        background: 'var(--gradient-sunset)',
        color: '#fff',
        boxShadow: '0 12px 28px -8px rgba(255,61,127,0.42)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -8, right: 10,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
          background: '#fff', color: 'var(--primary)',
          padding: '3px 8px', borderRadius: 999,
          textTransform: 'uppercase',
        }}>−40%</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.9 }}>Anual</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginTop: 4 }}>R$ 8,90</div>
        <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>por mês</div>
      </div>
    </div>

    <Button kind="primary" full size="lg">Assinar Pro</Button>
    <button onClick={onClose} style={{
      width: '100%', marginTop: 8, padding: 10,
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 600,
    }}>Agora não</button>
  </Sheet>
);

// ── Confirmação destrutiva
const ConfirmDestructive = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Excluir' }) => (
  <Modal open={open} onClose={onClose} title={title}>
    <div style={{ fontSize: 14, color: 'var(--fg-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
      {message}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button kind="secondary" full onClick={onClose}>Cancelar</Button>
      <Button kind="danger-solid" full onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  </Modal>
);

// ── Compartilhar Paciente (Pro)
const SharePatientSheet = ({ open, onClose, patient }) => {
  const [email, setEmail] = useStateM('');
  const [perm, setPerm] = useStateM('view');
  if (!patient) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Compartilhar paciente" glass>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--bg-elevated)', marginBottom: 16 }}>
        <Avatar emoji={patient.avatar.emoji} color={patient.avatar.color} size={44}/>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{patient.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)' }}>{patient.condition}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Compartilhamentos atuais</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {(patient.sharedWith || ['joao.costa@gmail.com']).map(e => (
          <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--bg-elevated)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--peach-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>J</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e}</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-secondary)' }}>Pode editar · há 2 meses</div>
            </div>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Revogar</button>
          </div>
        ))}
      </div>

      <Input label="Email do cuidador" value={email} placeholder="cuidador@email.com" icon="mail" onChange={e => setEmail(e.target.value)}/>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <Chip active={perm === 'view'} onClick={() => setPerm('view')} icon="eye">Visualizar</Chip>
        <Chip active={perm === 'edit'} onClick={() => setPerm('edit')} icon="edit">Editar</Chip>
      </div>
      <div style={{ marginTop: 18 }}>
        <Button kind="primary" full size="lg" icon="send">Convidar</Button>
      </div>
    </Sheet>
  );
};

Object.assign(window, { DoseSheet, FiltrosSheet, PaywallSheet, ConfirmDestructive, SharePatientSheet });
