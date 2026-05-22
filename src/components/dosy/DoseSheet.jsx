/**
 * DoseSheet — Refactor Fase 4 (Refactor_Full.md §11.3 item 6).
 *
 * Wrapper que decide entre DoseModal (1 dose, edição completa) ou
 * MultiDoseModal (N doses, fila simplificada). Consolida o entry
 * point em um único componente.
 *
 *   - `doses.length === 1` → DoseModal (UI completa com timing/observação)
 *   - `doses.length > 1`   → MultiDoseModal (fila confirm/skip simples)
 *
 * Uso:
 *   <DoseSheet doses={[dose]} open={!!selected} onClose={...} patientName="X" />
 *   <DoseSheet doses={multiList} open={...} onClose={...} patients={...} />
 *
 * Substituição gradual: páginas que querem migrar trocam <DoseModal/> +
 * <MultiDoseModal/> separados por <DoseSheet/>. Compat shim — os 2
 * componentes underlying continuam em src/components/ até a migração
 * estar completa em todas as páginas.
 */
import DoseModal from '../DoseModal'
import MultiDoseModal from '../MultiDoseModal'

export default function DoseSheet({
  doses = [],
  open,
  onClose,
  patientName,
  patients = [],
  queueRemaining = 0,
}) {
  if (!open) return null

  if (Array.isArray(doses) && doses.length > 1) {
    return (
      <MultiDoseModal
        open={open}
        onClose={onClose}
        doses={doses}
        patients={patients}
      />
    )
  }

  // 1 dose (ou nenhuma — DoseModal renderiza null se dose undefined).
  const single = Array.isArray(doses) ? doses[0] : doses
  return (
    <DoseModal
      dose={single}
      open={open}
      onClose={onClose}
      patientName={patientName}
      queueRemaining={queueRemaining}
    />
  )
}
