// Mock data for Dosy prototype — Maria (mom) caring for 2 kids + herself.

const DOSY_DATA = {
  user: {
    name: 'Maria Costa',
    email: 'maria.costa@gmail.com',
    initial: 'M',
  },
  patients: [
    {
      id: 'maria',
      name: 'Maria (eu)',
      shortName: 'Você',
      avatar: { emoji: '🌷', color: 'sunset' },
      age: 38,
      weight: 64,
      condition: 'Hipertensão leve',
      doctor: 'Dra. Renata Souza',
      allergies: ['Dipirona'],
      shared: false,
    },
    {
      id: 'helena',
      name: 'Helena',
      shortName: 'Helena',
      avatar: { emoji: '🐰', color: 'rose' },
      age: 7,
      weight: 24,
      condition: 'Asma leve',
      doctor: 'Dr. Carlos Mendes',
      allergies: [],
      shared: false,
    },
    {
      id: 'pedro',
      name: 'Pedro',
      shortName: 'Pedro',
      avatar: { emoji: '🦖', color: 'tan' },
      age: 4,
      weight: 17,
      condition: 'Otite recorrente',
      doctor: 'Dr. Carlos Mendes',
      allergies: ['Amoxicilina'],
      shared: true,
      sharedWith: ['joao.costa@gmail.com'],
    },
  ],
  treatments: [
    { id: 't1', patient: 'maria',  med: 'Losartana',         dose: '50 mg',  freq: '1×/dia',     next: '08:00', color: 'peach-200', icon: 'pill', status: 'active', adherence: 92 },
    { id: 't2', patient: 'maria',  med: 'Vitamina D3',       dose: '2000 UI',freq: '1×/dia',     next: '08:00', color: 'peach-100', icon: 'capsule', status: 'active', adherence: 96 },
    { id: 't3', patient: 'helena', med: 'Salbutamol (bombinha)', dose: '2 jatos', freq: '12 em 12h', next: '08:00', color: 'soft-rose', icon: 'pill', status: 'active', adherence: 88 },
    { id: 't4', patient: 'pedro',  med: 'Amoxicilina',       dose: '5 ml',   freq: '8 em 8h',    next: '08:00', color: 'tan', icon: 'syringe', status: 'active', adherence: 100, daysLeft: 3 },
    { id: 't5', patient: 'pedro',  med: 'Ibuprofeno',        dose: '2,5 ml', freq: 'S.O.S',      next: '—',     color: 'peach-200', icon: 'capsule', status: 'sos', adherence: 0 },
  ],
  doses: [
    // Maria
    { id: 'd1', tid: 't1', patient: 'maria',  med: 'Losartana',     dose: '50 mg',   time: '08:00', status: 'taken',     takenAt: '08:04', color: 'peach-200', icon: 'pill' },
    { id: 'd2', tid: 't2', patient: 'maria',  med: 'Vitamina D3',   dose: '2000 UI', time: '08:00', status: 'taken',     takenAt: '08:04', color: 'peach-100', icon: 'capsule' },
    // Helena
    { id: 'd3', tid: 't3', patient: 'helena', med: 'Salbutamol',    dose: '2 jatos', time: '08:00', status: 'taken',     takenAt: '07:58', color: 'soft-rose', icon: 'pill' },
    { id: 'd4', tid: 't3', patient: 'helena', med: 'Salbutamol',    dose: '2 jatos', time: '20:00', status: 'pending',   color: 'soft-rose', icon: 'pill' },
    // Pedro — antibiótico (8 em 8h) — 1 atrasada!
    { id: 'd5', tid: 't4', patient: 'pedro',  med: 'Amoxicilina',   dose: '5 ml',    time: '07:00', status: 'overdue',   color: 'tan', icon: 'syringe' },
    { id: 'd6', tid: 't4', patient: 'pedro',  med: 'Amoxicilina',   dose: '5 ml',    time: '15:00', status: 'pending',   color: 'tan', icon: 'syringe' },
    { id: 'd7', tid: 't4', patient: 'pedro',  med: 'Amoxicilina',   dose: '5 ml',    time: '23:00', status: 'pending',   color: 'tan', icon: 'syringe' },
    // Maria — noite
    { id: 'd8', tid: 't1', patient: 'maria',  med: 'Losartana',     dose: '50 mg',   time: '20:00', status: 'pending',   color: 'peach-200', icon: 'pill' },
  ],
};

window.DOSY_DATA = DOSY_DATA;

// Helpers
window.dosyByPatient = (id) => DOSY_DATA.patients.find(p => p.id === id);
window.dosyDosesByPatient = (id) => DOSY_DATA.doses.filter(d => d.patient === id);
window.dosyGroupDosesByPatient = (doses) => {
  const groups = {};
  doses.forEach(d => {
    if (!groups[d.patient]) groups[d.patient] = [];
    groups[d.patient].push(d);
  });
  return Object.entries(groups).map(([pid, ds]) => ({
    patient: window.dosyByPatient(pid),
    doses: ds,
    overdue: ds.filter(x => x.status === 'overdue').length,
  }));
};
