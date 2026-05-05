const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function pad(n) { return String(n).padStart(2, '0') }

export function formatDate(d) {
  const x = new Date(d)
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`
}

export function formatTime(d) {
  const x = new Date(d)
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export function formatDateTime(d) {
  return `${formatDate(d)} ${formatTime(d)}`
}

export function relativeLabel(d) {
  const x = new Date(d)
  const now = new Date()
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const diffDays = Math.round((startOfDay(x) - startOfDay(now)) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === -1) return 'Ontem'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays > 1 && diffDays <= 6) return DIAS[x.getDay()]
  return formatDate(x)
}

export function toDatetimeLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocalInput(value) {
  return new Date(value).toISOString()
}

export function rangeNow(rangeKey) {
  // Janela assimétrica: forward = N, backward = N/2 (mostra tomadas/puladas
  // recentes do contexto). Overdue sempre adicionadas via merge no Dashboard
  // (independente do range). 'all' = janela aberta.
  //   12h => +12h / -6h
  //   24h => +24h / -12h
  //   48h => +48h / -24h
  //   7d  => +7d  / -3.5d (84h)
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (rangeKey === '12h') {
    start.setHours(start.getHours() - 6)
    end.setHours(end.getHours() + 12)
  } else if (rangeKey === '24h') {
    start.setHours(start.getHours() - 12)
    end.setHours(end.getHours() + 24)
  } else if (rangeKey === '48h') {
    start.setHours(start.getHours() - 24)
    end.setHours(end.getHours() + 48)
  } else if (rangeKey === '7d') {
    start.setHours(start.getHours() - 84)
    end.setDate(end.getDate() + 7)
  } else if (rangeKey === '10d') {
    // #137 (v0.2.0.9): substituiu 'all'. -5d / +10d (proporção -N/2 / +N).
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 10)
  } else {
    return { from: null, to: null }
  }
  return { from: start.toISOString(), to: end.toISOString() }
}
