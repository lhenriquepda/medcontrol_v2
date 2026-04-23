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
  const now = new Date()
  const start = new Date()
  const end = new Date(now)
  if (rangeKey === '12h') end.setHours(end.getHours() + 12)
  else if (rangeKey === '24h') end.setHours(end.getHours() + 24)
  else if (rangeKey === '48h') end.setHours(end.getHours() + 48)
  else if (rangeKey === '7d') end.setDate(end.getDate() + 7)
  else return { from: null, to: null }
  start.setHours(start.getHours() - 6) // mostra também doses recentes atrasadas
  return { from: start.toISOString(), to: end.toISOString() }
}
