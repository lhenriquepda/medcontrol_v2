// Novo Tratamento + S.O.S screens.

const NovoTratamentoScreen = ({ onBack, onSave }) => {
  const [paciente, setPaciente] = React.useState('helena');
  const [med, setMed] = React.useState('');
  const [dose, setDose] = React.useState('');
  const [unidade, setUnidade] = React.useState('mg');
  const [modo, setModo] = React.useState('intervalo');
  const [freq, setFreq] = React.useState('8h');
  const [primeiraHora, setPrimeiraHora] = React.useState('08:00');
  const [horarios, setHorarios] = React.useState(['08:00', '14:00', '20:00']);
  const [continuo, setContinuo] = React.useState(false);
  const [duracao, setDuracao] = React.useState('7');

  const freqs = ['4h', '6h', '8h', '12h', '1×/dia', '2 em 2 dias', '3 em 3 dias', '1×/sem', 'quinzenal', '1×/mês'];

  const dosesPerDay = modo === 'horarios'
    ? horarios.length
    : freq.includes('h') ? 24 / parseInt(freq) : freq === '1×/dia' ? 1 : 0.5;
  const totalDoses = continuo ? '∞' : Math.round(dosesPerDay * parseInt(duracao || 0));

  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
      <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" onClick={onBack}/>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="database" size={14}/> Modelos
        </button>
      </div>

      <div style={{ padding: '8px 22px 18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1 }}>Novo tratamento</div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-secondary)', marginTop: 4 }}>Configura o remédio e os horários</div>
      </div>

      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Paciente seletor */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 4, display: 'block', marginBottom: 8 }}>Paciente</label>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="dosy-scroll">
            {window.DOSY_DATA.patients.map(p => (
              <button key={p.id} onClick={() => setPaciente(p.id)} className="dosy-press" style={{
                padding: '8px 12px 8px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: paciente === p.id ? 'var(--gradient-sunset)' : 'var(--bg-elevated)',
                color: paciente === p.id ? '#fff' : 'var(--fg)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: paciente === p.id ? '0 8px 16px -6px rgba(255,61,127,0.4)' : 'var(--shadow-xs)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                <Avatar emoji={p.avatar.emoji} color="peach" size={28}/>
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>{p.shortName}</span>
              </button>
            ))}
          </div>
        </div>

        <Input label="Medicamento" value={med} placeholder="ex: Ibuprofeno" icon="pill" onChange={e => setMed(e.target.value)} hint="Sugestões aparecem conforme você digita"/>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <Input label="Dose" value={dose} placeholder="ex: 5" onChange={e => setDose(e.target.value)}/>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 4, display: 'block', marginBottom: 7 }}>Unidade</label>
            <select value={unidade} onChange={e => setUnidade(e.target.value)} style={{
              width: '100%', padding: '14px 14px', borderRadius: 16,
              background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xs)',
              border: '1.5px solid transparent', fontSize: 15, color: 'var(--fg)', outline: 'none',
              appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3cpath d=\'M1 1l5 5 5-5\' stroke=\'%237A7068\' stroke-width=\'1.6\' fill=\'none\' stroke-linecap=\'round\'/%3e%3c/svg%3e")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
              paddingRight: 36,
            }}>
              <option>mg</option><option>ml</option><option>UI</option><option>cápsula</option><option>jato</option><option>gota</option>
            </select>
          </div>
        </div>

        {/* Modo de agendamento */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 4, display: 'block', marginBottom: 8 }}>Como agendar</label>
          <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--bg-sunken)', borderRadius: 999 }}>
            {[
              { id: 'intervalo', label: 'Intervalo fixo' },
              { id: 'horarios',  label: 'Horários' },
            ].map(o => (
              <button key={o.id} onClick={() => setModo(o.id)} style={{
                flex: 1, padding: '9px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: modo === o.id ? 'var(--bg-elevated)' : 'transparent',
                color: modo === o.id ? 'var(--fg)' : 'var(--fg-secondary)',
                fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em',
                boxShadow: modo === o.id ? 'var(--shadow-xs)' : 'none',
              }}>{o.label}</button>
            ))}
          </div>
        </div>

        {modo === 'intervalo' ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {freqs.map(f => (
                <Chip key={f} active={freq === f} onClick={() => setFreq(f)} size="sm">{f}</Chip>
              ))}
            </div>
            <Input label="1ª dose" value={primeiraHora} icon="clock" onChange={e => setPrimeiraHora(e.target.value)}/>
          </>
        ) : (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 4, display: 'block', marginBottom: 8 }}>Horários</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {horarios.map((h, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 8px 9px 14px', borderRadius: 999,
                  background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xs)',
                  fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {h}
                  <button onClick={() => setHorarios(horarios.filter((_, j) => j !== i))} style={{
                    width: 22, height: 22, borderRadius: 999, border: 'none',
                    background: 'var(--bg-sunken)', color: 'var(--fg-secondary)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name="close" size={12}/></button>
                </div>
              ))}
              <button onClick={() => setHorarios([...horarios, '12:00'])} className="dosy-press" style={{
                padding: '9px 14px', borderRadius: 999, border: '1.5px dashed var(--border-strong)',
                background: 'transparent', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, color: 'var(--fg-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}><Icon name="plus" size={14}/> Adicionar</button>
            </div>
          </div>
        )}

        {/* Uso contínuo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          background: 'var(--bg-elevated)', borderRadius: 16, boxShadow: 'var(--shadow-xs)',
        }}>
          <Icon name="refresh" size={18} style={{ color: 'var(--fg-secondary)' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>Uso contínuo</div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>Sem data de fim</div>
          </div>
          <Toggle value={continuo} onChange={setContinuo}/>
        </div>

        {!continuo && <Input label="Duração" value={duracao} suffix="dias" onChange={e => setDuracao(e.target.value)}/>}

        {/* Preview */}
        <div style={{
          padding: '14px 16px', borderRadius: 16,
          background: 'var(--gradient-sunset-soft)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Icon name="calendar-check" size={20}/>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700 }}>{totalDoses}</span> doses serão geradas{!continuo ? `, ${duracao} dias` : ''}
          </div>
        </div>

        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <Button kind="primary" full size="lg" icon="check" onClick={onSave}>Criar tratamento</Button>
        </div>
      </div>
    </div>
  );
};

const SOSScreen = ({ onBack, onSettings, tier }) => {
  const [paciente, setPaciente] = React.useState('pedro');
  const [med, setMed] = React.useState('Ibuprofeno');
  const [dose, setDose] = React.useState('2,5');
  const [obs, setObs] = React.useState('');
  const blocked = true; // demo: regra de segurança ativa

  return (
    <div className="dosy-scroll" style={{ flex: 1, overflow: 'auto', paddingBottom: 110 }}>
      <AppHeader greeting="Dose extra" name="S.O.S" tier={tier} onAdjustes={onSettings}/>

      <div style={{ padding: '0 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'var(--danger-bg)', color: 'var(--danger)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="siren" size={22}/></div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.025em', lineHeight: 1.1 }}>S.O.S</div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-secondary)', marginTop: 1 }}>Dose extra fora do agendado</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 4, display: 'block', marginBottom: 8 }}>Paciente</label>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="dosy-scroll">
            {window.DOSY_DATA.patients.map(p => (
              <button key={p.id} onClick={() => setPaciente(p.id)} className="dosy-press" style={{
                padding: '8px 12px 8px 8px', borderRadius: 999, border: 'none',
                background: paciente === p.id ? 'var(--gradient-sunset)' : 'var(--bg-elevated)',
                color: paciente === p.id ? '#fff' : 'var(--fg)',
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                boxShadow: paciente === p.id ? '0 8px 16px -6px rgba(255,61,127,0.4)' : 'var(--shadow-xs)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                <Avatar emoji={p.avatar.emoji} color="peach" size={28}/>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.shortName}</span>
              </button>
            ))}
          </div>
        </div>

        <Input label="Medicamento" value={med} icon="pill" onChange={e => setMed(e.target.value)}/>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <Input label="Dose" value={dose} suffix="ml" onChange={e => setDose(e.target.value)}/>
          <Input label="Quando" value="agora" readOnly icon="clock"/>
        </div>

        {/* Regra de segurança (bloqueio) */}
        {blocked && (
          <div style={{
            padding: 14, borderRadius: 16,
            background: 'var(--danger-bg)',
            border: '1.5px solid rgba(229,86,74,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="alert" size={18} style={{ color: 'var(--danger)' }}/>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--danger)' }}>Intervalo mínimo não respeitado</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 6, lineHeight: 1.45, opacity: 0.9 }}>
              Última dose foi às <b>11:30</b>. Próxima permitida: <b>15:30</b> (intervalo mínimo de 4h).
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <Chip size="sm">Intervalo mín: 4h</Chip>
              <Chip size="sm">Máx 4×/24h</Chip>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Editar regra</button>
            </div>
          </div>
        )}

        <Input label="Observação" value={obs} placeholder="ex: febre 38,5" onChange={e => setObs(e.target.value)}/>

        <Button kind="primary" full size="lg" icon="siren" disabled={blocked}>
          {blocked ? 'Bloqueado pela regra' : 'Registrar S.O.S'}
        </Button>

        <SectionTitle style={{ padding: '14px 0 8px' }}>Histórico recente</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { time: 'hoje 11:30', med: 'Ibuprofeno 2,5ml', note: 'febre 38,2' },
            { time: 'ontem 22:00', med: 'Ibuprofeno 2,5ml', note: 'dor de ouvido' },
          ].map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 16 }}>
              <PillIcon color="peach-200" icon="capsule" size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{h.med}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{h.note}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{h.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.NovoTratamentoScreen = NovoTratamentoScreen;
window.SOSScreen = SOSScreen;
