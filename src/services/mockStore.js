// Store em memória persistido em localStorage. Usado quando Supabase não está configurado.
const KEY = 'medcontrol_store_v1'

const defaultState = () => ({
  user: null,
  accounts: [], // { id, email, passwordHash, name }
  patients: [],
  treatments: [],
  doses: [],
  sos_rules: [],
  treatment_templates: []
})

// hash ingênuo só para não guardar senha em claro em localStorage. NÃO é seguro.
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return String(h)
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

let state = load()
const listeners = new Set()

function save() {
  localStorage.setItem(KEY, JSON.stringify(state))
  listeners.forEach((fn) => fn())
}

export const mock = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  get() { return state },
  setUser(u) { state.user = u; save() },
  uid() { return state.user?.id || 'demo-user' },

  async signInDemo(name = 'Usuário Demo') {
    state.user = { id: 'demo-user', email: 'demo@medcontrol.app', name }
    const hasDemoData = state.patients.some((p) => p.userId === 'demo-user')
    if (!hasDemoData) seed()
    save()
    return state.user
  },

  async signUpLocal(email, password, name) {
    const e = String(email).trim().toLowerCase()
    if (!e || !password) throw new Error('Preencha email e senha.')
    if (password.length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.')
    if (state.accounts.some((a) => a.email === e)) throw new Error('Este email já está cadastrado.')
    const account = { id: crypto.randomUUID(), email: e, passwordHash: hash(password), name: name || e.split('@')[0] }
    state.accounts = [...state.accounts, account]
    state.user = { id: account.id, email: account.email, name: account.name }
    save()
    return state.user
  },

  async signInLocal(email, password) {
    const e = String(email).trim().toLowerCase()
    const account = state.accounts.find((a) => a.email === e)
    if (!account) throw new Error('Email não cadastrado.')
    if (account.passwordHash !== hash(password)) throw new Error('Senha incorreta.')
    state.user = { id: account.id, email: account.email, name: account.name }
    save()
    return state.user
  },

  async signOut() { state.user = null; save() },

  updateProfile({ name }) {
    if (!state.user) return
    state.user = { ...state.user, name: (name || '').trim() || state.user.name }
    const acc = state.accounts.find((a) => a.id === state.user.id)
    if (acc) acc.name = state.user.name
    save()
  },

  list(table, filter) {
    const uid = mock.uid()
    const rows = (state[table] || []).filter((r) => r.userId === uid)
    if (!filter) return rows
    const entries = Object.entries(filter).filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (entries.length === 0) return rows
    return rows.filter((r) => entries.every(([k, v]) => r[k] === v))
  },
  getById(table, id) {
    const uid = mock.uid()
    return (state[table] || []).find((r) => r.id === id && r.userId === uid)
  },
  insert(table, row) {
    const id = row.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const full = { id, createdAt: now, updatedAt: now, userId: mock.uid(), ...row }
    state[table] = [...(state[table] || []), full]
    save()
    return full
  },
  insertMany(table, rows) {
    const inserted = rows.map((r) => mock.insertSilent(table, r))
    save()
    return inserted
  },
  insertSilent(table, row) {
    const id = row.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const full = { id, createdAt: now, updatedAt: now, userId: mock.uid(), ...row }
    state[table] = [...(state[table] || []), full]
    return full
  },
  update(table, id, patch) {
    const uid = mock.uid()
    state[table] = (state[table] || []).map((r) =>
      r.id === id && r.userId === uid ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
    )
    save()
    return state[table].find((r) => r.id === id && r.userId === uid)
  },
  remove(table, id) {
    const uid = mock.uid()
    state[table] = (state[table] || []).filter((r) => !(r.id === id && r.userId === uid))
    save()
  },
  removeWhere(table, filter) {
    const uid = mock.uid()
    state[table] = (state[table] || []).filter((r) => {
      if (r.userId !== uid) return true
      return !Object.entries(filter).every(([k, v]) => r[k] === v)
    })
    save()
  }
}

function seed() {
  const p1 = mock.insertSilent('patients', {
    name: 'Maria Silva', age: 72, avatar: '👵', condition: 'Hipertensão', doctor: 'Dr. Souza', allergies: 'Dipirona'
  })
  const p2 = mock.insertSilent('patients', {
    name: 'João Pereira', age: 8, avatar: '🧒', condition: 'Asma', doctor: 'Dra. Lima', allergies: ''
  })
  const now = new Date()
  const start = new Date(now); start.setHours(8, 0, 0, 0)
  const t1 = mock.insertSilent('treatments', {
    patientId: p1.id, medName: 'Losartana', unit: '1 comprimido', intervalHours: 12,
    durationDays: 7, startDate: start.toISOString(), firstDoseTime: '08:00', status: 'active', isTemplate: false
  })
  for (let d = 0; d < 7; d++) {
    for (let h of [0, 12]) {
      const at = new Date(start); at.setDate(at.getDate() + d); at.setHours(start.getHours() + h)
      const isPast = at < now
      mock.insertSilent('doses', {
        treatmentId: t1.id, patientId: p1.id, medName: 'Losartana', unit: '1 comprimido',
        scheduledAt: at.toISOString(), actualTime: null,
        status: isPast ? (Math.random() > 0.3 ? 'done' : 'overdue') : 'pending',
        type: 'scheduled', observation: ''
      })
    }
  }
  const t2 = mock.insertSilent('treatments', {
    patientId: p2.id, medName: 'Salbutamol', unit: '2 jatos', intervalHours: 8,
    durationDays: 3, startDate: start.toISOString(), firstDoseTime: '07:00', status: 'active', isTemplate: false
  })
  for (let d = 0; d < 3; d++) {
    for (let h of [0, 8, 16]) {
      const at = new Date(start); at.setDate(at.getDate() + d); at.setHours(7 + h)
      const isPast = at < now
      mock.insertSilent('doses', {
        treatmentId: t2.id, patientId: p2.id, medName: 'Salbutamol', unit: '2 jatos',
        scheduledAt: at.toISOString(), actualTime: null,
        status: isPast ? 'done' : 'pending', type: 'scheduled', observation: ''
      })
    }
  }
  save()
}
