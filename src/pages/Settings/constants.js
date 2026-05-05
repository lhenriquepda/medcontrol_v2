// #029 (release v0.2.0.11) — refactor Settings.jsx 692 LOC → split em sections.
// Constants compartilhadas pelas sections.

import { TIMING, EASE } from '../../animations'

export const ADVANCE_OPTIONS = [
  { value: 0,  label: 'Na hora' },
  { value: 5,  label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1h antes' },
]

export const SECTION_LABEL_STYLE = {
  fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--dosy-fg-secondary)',
  margin: '0 0 12px 0',
  fontFamily: 'var(--dosy-font-display)',
}

export const sectionVariant = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: TIMING.base, ease: EASE.inOut } }
}
