// App.jsx — Dosy main app shell. Wires all screens, manages nav, sheets, toasts.

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tier": "free",
  "theme": "light",
  "showOnboarding": false,
  "showLogin": false,
  "alarmDoseId": null
}/*EDITMODE-END*/;

const App = ({ initialTab = 'inicio', initialTier = 'free', theme = 'light', showOnboarding = false, showLogin = false, initialAlarm = false }) => {
  const [tab, setTab] = useStateA(initialTab);
  const [tier, setTier] = useStateA(initialTier);

  const [doseSheet, setDoseSheet] = useStateA(null);
  const [filtersOpen, setFiltersOpen] = useStateA(false);
  const [paywallOpen, setPaywallOpen] = useStateA(false);
  const [paywallReason, setPaywallReason] = useStateA(null);
  const [confirmOpen, setConfirmOpen] = useStateA(false);
  const [shareOpen, setShareOpen] = useStateA(false);

  const [toast, setToast] = useStateA(null);
  const [stack, setStack] = useStateA([]);  // routed sub-screens
  const [selectedPatient, setSelectedPatient] = useStateA(null);
  const [alarmDose, setAlarmDose] = useStateA(initialAlarm ? window.DOSY_DATA.doses.find(d => d.status === 'overdue') : null);
  // For demo: show many doses ringing at the same alarm time, across all patients
  const alarmDosesDemo = React.useMemo(() => {
    if (!initialAlarm) return null;
    const all = window.DOSY_DATA.doses;
    return [
      all.find(d => d.id === 'd5'),  // Pedro · Amoxicilina (atrasada)
      all.find(d => d.id === 'd1'),  // Maria · Losartana
      all.find(d => d.id === 'd2'),  // Maria · Vit D3
      all.find(d => d.id === 'd3'),  // Helena · Salbutamol
      // Synthetic extras to demo a long scrollable list
      { id: 'demo1', patient: 'helena', med: 'Prednisolona',  dose: '5 ml',   time: '08:00', status: 'pending', color: 'soft-rose', icon: 'syringe' },
      { id: 'demo2', patient: 'pedro',  med: 'Probiótico',    dose: '1 sachê',time: '08:00', status: 'pending', color: 'tan',       icon: 'capsule' },
      { id: 'demo3', patient: 'maria',  med: 'Ômega 3',       dose: '1 cáps', time: '08:00', status: 'pending', color: 'peach-100', icon: 'capsule' },
    ].filter(Boolean);
  }, [initialAlarm]);

  // Apply theme class on root
  useEffectA(() => {
    const el = document.querySelector('[data-dosy-root]');
    if (el) el.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (showLogin) return <LoginScreen onLogin={() => { /* close */ }}/>;
  if (showOnboarding) return <OnboardingTour onDone={() => { /* close */ }}/>;

  const push = (s) => setStack([...stack, s]);
  const pop  = () => setStack(stack.slice(0, -1));
  const top  = stack[stack.length - 1];

  const openPaywall = (reason) => { setPaywallReason(reason); setPaywallOpen(true); };

  const renderTab = () => {
    switch (tab) {
      case 'inicio':
        return <InicioScreen tier={tier}
          onDoseClick={d => setDoseSheet(d)}
          onAddTreatment={() => push({ kind: 'novo' })}
          onOpenFilters={() => setFiltersOpen(true)}
          onSettings={() => push({ kind: 'ajustes' })}
          onPaywall={() => openPaywall('Sem anúncios no Pro.')}/>;
      case 'pacientes':
        return <PacientesListScreen tier={tier}
          onAdd={() => tier === 'free'
            ? openPaywall('No Free você só pode cadastrar 1 paciente. Faça upgrade para cuidar da família toda.')
            : push({ kind: 'novo' })}
          onPatient={(p) => { setSelectedPatient(p); push({ kind: 'paciente' }); }}
          onPaywall={() => openPaywall('Pacientes ilimitados no Pro.')}
          onSettings={() => push({ kind: 'ajustes' })}/>;
      case 'sos':
        return <SOSScreen tier={tier} onSettings={() => push({ kind: 'ajustes' })}/>;
      case 'historico':
        return <HistoricoScreen tier={tier} onSettings={() => push({ kind: 'ajustes' })}/>;
      case 'analises':
        return <AnalisesScreen tier={tier}
          onSettings={() => push({ kind: 'ajustes' })}
          onPaywall={() => openPaywall('Análises completas no Pro.')}/>;
      case 'mais':
        return <MaisScreen tier={tier}
          onPaywall={() => openPaywall()}
          onSettings={() => push({ kind: 'ajustes' })}/>;
      default:
        return null;
    }
  };

  return (
    <>
      {top ? (
        top.kind === 'paciente' ? (
          <PacienteDetailScreen patient={selectedPatient} onBack={pop}
            onShare={() => setShareOpen(true)}
            tier={tier}
            onPaywall={() => openPaywall('Compartilhamento de pacientes no Pro.')}
            onAddTreatment={() => push({ kind: 'novo' })}/>
        ) : top.kind === 'novo' ? (
          <NovoTratamentoScreen onBack={pop} onSave={() => { pop(); setToast({ message: 'Tratamento criado · 21 doses agendadas' }); }}/>
        ) : top.kind === 'ajustes' ? (
          <AjustesScreen onBack={pop}/>
        ) : null
      ) : renderTab()}

      {!top && (
        <BottomNav active={tab === 'historico' || tab === 'analises' ? 'mais' : tab}
          onChange={(id) => { setTab(id); }}
          onPlus={() => push({ kind: 'novo' })}/>
      )}

      <DoseSheet open={!!doseSheet} dose={doseSheet}
        onClose={() => setDoseSheet(null)}
        isPro={tier !== 'free'}
        onTake={(d) => { setDoseSheet(null); setToast({ message: `${d.med} marcado · obrigado, Maria!`, action: 'Desfazer' }); }}
        onSkip={(d) => { setDoseSheet(null); setToast({ message: `Pulou ${d.med}`, action: 'Desfazer' }); }}
        onUndo={() => setDoseSheet(null)}/>

      <FiltrosSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}/>
      <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} reason={paywallReason}/>
      <ConfirmDestructive open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => setConfirmOpen(false)}
        title="Excluir tratamento?" message="Doses futuras serão canceladas. Histórico permanece."/>
      <SharePatientSheet open={shareOpen} onClose={() => setShareOpen(false)} patient={selectedPatient}/>

      {alarmDose && <AlarmFullScreen dose={alarmDose} doses={alarmDosesDemo}
        onTake={() => { setAlarmDose(null); setToast({ message: 'Tomado às 08:42 · obrigado!' }); }}
        onSnooze={() => setAlarmDose(null)}
        onClose={() => setAlarmDose(null)}/>}

      <Toast message={toast?.message} action={toast?.action}
        onAction={() => setToast(null)} onDismiss={() => setToast(null)}/>
    </>
  );
};

window.App = App;
window.TWEAK_DEFAULTS = TWEAK_DEFAULTS;
