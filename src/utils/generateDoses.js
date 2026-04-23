// Gera a lista de doses para um tratamento. Função pura.
// Modos suportados:
//   mode: 'interval' — intervalHours (h), firstDoseTime ("HH:mm"), durationDays
//   mode: 'times'    — dailyTimes: ["HH:mm", ...], durationDays
export function generateDoses(treatment) {
  const {
    id: treatmentId, patientId, medName, unit,
    startDate, durationDays, mode, intervalHours, firstDoseTime, dailyTimes
  } = treatment

  const base = new Date(startDate)
  base.setSeconds(0, 0)
  const doses = []

  if (mode === 'times') {
    const times = (dailyTimes || []).slice().sort()
    for (let d = 0; d < durationDays; d++) {
      for (const hhmm of times) {
        const [h, m] = hhmm.split(':').map(Number)
        const dt = new Date(base)
        dt.setDate(dt.getDate() + d)
        dt.setHours(h, m, 0, 0)
        doses.push({
          treatmentId, patientId, medName, unit,
          scheduledAt: dt.toISOString(),
          actualTime: null, status: 'pending', type: 'scheduled', observation: ''
        })
      }
    }
    return doses
  }

  // interval
  const [h0, m0] = (firstDoseTime || '08:00').split(':').map(Number)
  const first = new Date(base)
  first.setHours(h0, m0, 0, 0)
  const totalHours = durationDays * 24
  const step = Math.max(1, Number(intervalHours) || 8)
  for (let t = 0; t < totalHours; t += step) {
    const dt = new Date(first)
    dt.setHours(dt.getHours() + t)
    doses.push({
      treatmentId, patientId, medName, unit,
      scheduledAt: dt.toISOString(),
      actualTime: null, status: 'pending', type: 'scheduled', observation: ''
    })
  }
  return doses
}
