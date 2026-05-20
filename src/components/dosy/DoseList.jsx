/**
 * DoseList — Refactor Fase 4 (Refactor_Full.md §11.3 item 2).
 *
 * Substitui renderização inline de lista de doses em Dashboard
 * (grouped por paciente), PatientDetail (flat), DoseHistory (timeline).
 *
 * Reusa DoseCard internamente (já é o card primitive).
 *
 * Uso:
 *   <DoseList doses={doses} mode="grouped" patients={patients}
 *             onSwipeConfirm={fn} onSwipeSkip={fn} onClickDose={fn} />
 *   <DoseList doses={doses} mode="flat" />
 */
import { useMemo } from 'react'
import DoseCard from '../DoseCard'

export default function DoseList({
  doses = [],
  mode = 'flat',
  patients = [],
  onClickDose,
  onSwipeConfirm,
  onSwipeSkip,
  emptyState = null,
}) {
  // Hooks SEMPRE chamados (regra react-hooks/rules-of-hooks) — só usados se mode='grouped'.
  const patientsMap = useMemo(() => new Map((patients || []).map((p) => [p.id, p])), [patients])
  const groups = useMemo(() => {
    if (mode !== 'grouped') return []
    const byPatient = new Map()
    for (const d of doses || []) {
      const pid = d.patientId || 'sem-paciente'
      if (!byPatient.has(pid)) byPatient.set(pid, [])
      byPatient.get(pid).push(d)
    }
    return Array.from(byPatient.entries()).map(([pid, ds]) => ({
      patient: patientsMap.get(pid) || { id: pid, name: 'Sem paciente' },
      doses: ds,
    }))
  }, [doses, patientsMap, mode])

  if (!Array.isArray(doses) || doses.length === 0) {
    return emptyState
  }

  if (mode === 'grouped') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => (
          <div key={g.patient.id}>
            <h4 style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--dosy-fg-tertiary)',
              margin: '0 0 6px 0', fontFamily: 'var(--dosy-font-display)',
            }}>{g.patient.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.doses.map((d) => (
                <DoseCard
                  key={d.id}
                  dose={d}
                  onClick={onClickDose}
                  onSwipeConfirm={onSwipeConfirm}
                  onSwipeSkip={onSwipeSkip}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default 'flat' mode.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {doses.map((d) => (
        <DoseCard
          key={d.id}
          dose={d}
          onClick={onClickDose}
          onSwipeConfirm={onSwipeConfirm}
          onSwipeSkip={onSwipeSkip}
        />
      ))}
    </div>
  )
}
