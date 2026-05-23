// v0.2.6.4 P9.6 (Roteiro_Alinhamento_Dosy_v2) — BulkCategorizeModal
//
// User abre Analytics, vê fatia "Não classificado" do donut, tap → modal com
// lista de medicamentos NULL + sugestão IA (classify_medication_robust 5-tier).
// Checkbox per-item + ação bulk apply (cascata treatments + doses do user).
//
// Reduz drasticamente "% doses não-categorizadas" sem o user precisar abrir
// cada tratamento individualmente.

import { useState, useEffect } from 'react'
import { Sheet, Button } from './dosy'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { useNullMedsSuggestions, useApplyBulkCategorize } from '../hooks/useNullMedsSuggestions'
import { getGroup, MED_GROUPS } from '../constants/medCategories'
import { useToast } from '../hooks/useToast'

const SOURCE_LABEL = {
  dcb: 'DCB ANVISA',
  catalog_exact: 'CMED',
  catalog_like: 'CMED ~',
  principio_like: 'Princípio',
  heuristic_suffix: 'Sufixo',
  heuristic_client: 'Sufixo offline',
}

export default function BulkCategorizeModal({ open, onClose }) {
  const { data: meds = [], isLoading, isError } = useNullMedsSuggestions(50)
  const apply = useApplyBulkCategorize()
  const toast = useToast()
  const [overrides, setOverrides] = useState({}) // { med_name: group_id }
  const [selected, setSelected] = useState({})   // { med_name: bool }

  // Default selection on first render after data arrives — useEffect (não useMemo)
  // pra evitar setState dentro de useMemo (lint react-hooks/set-state-in-effect ok aqui
  // pois é one-shot guard com Object.keys check).
  useEffect(() => {
    if (meds.length > 0 && Object.keys(selected).length === 0) {
      const ini = {}
      for (const m of meds) {
        if (m.suggested_group) ini[m.med_name] = true
      }
      setSelected(ini)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds])

  const totalSelected = Object.values(selected).filter(Boolean).length
  const totalDoses = meds
    .filter((m) => selected[m.med_name])
    .reduce((sum, m) => sum + (m.dose_count || 0), 0)

  function toggleSelected(name) {
    setSelected((s) => ({ ...s, [name]: !s[name] }))
  }

  function setOverride(name, groupId) {
    setOverrides((o) => ({ ...o, [name]: groupId }))
    setSelected((s) => ({ ...s, [name]: true })) // auto-select se mudou categoria
  }

  async function handleApply() {
    const payload = meds
      .filter((m) => selected[m.med_name])
      .map((m) => ({
        med_name: m.med_name,
        group_id: overrides[m.med_name] || m.suggested_group,
        cmed_class: m.suggested_cmed_class || null,
      }))
      .filter((p) => p.group_id) // só com group_id válido
    if (payload.length === 0) {
      toast?.show({ kind: 'warn', message: 'Selecione ao menos 1 medicamento.' })
      return
    }
    try {
      const result = await apply.mutateAsync(payload)
      toast?.show({
        kind: 'success',
        message: `${result.treatments_fixed} tratamentos + ${result.doses_fixed} doses categorizados`,
      })
      onClose?.()
    } catch (e) {
      toast?.show({ kind: 'error', message: 'Erro: ' + (e?.message || 'unknown') })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Categorizar medicamentos pendentes">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--dosy-fg-secondary)', lineHeight: 1.5, margin: 0 }}>
          Medicamentos do seu histórico sem categoria ainda. Nossa IA sugeriu
          baseada em CMED ANVISA e princípio ativo. Confirme ou ajuste, e aplique
          a todas as doses passadas de uma vez.
        </p>

        {isLoading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--dosy-fg-secondary)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 12 }}>Buscando medicamentos…</p>
          </div>
        )}

        {isError && (
          <div style={{ padding: 16, background: 'var(--dosy-danger-bg)', color: 'var(--dosy-danger)', borderRadius: 12, fontSize: 13 }}>
            Erro ao carregar lista. Tente novamente mais tarde.
          </div>
        )}

        {!isLoading && meds.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--dosy-fg-secondary)' }}>
            <Check size={28} color="var(--dosy-success, #10b981)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Tudo categorizado!</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Não há medicamentos pendentes de categoria.</p>
          </div>
        )}

        {meds.length > 0 && (
          <>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
              {meds.map((m) => {
                const isSelected = !!selected[m.med_name]
                const effectiveGroup = overrides[m.med_name] || m.suggested_group
                const groupInfo = effectiveGroup ? getGroup(effectiveGroup) : null
                return (
                  <li
                    key={m.med_name}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'var(--dosy-bg-elevated)',
                      border: isSelected ? '1.5px solid var(--dosy-primary)' : '1px solid var(--dosy-border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(m.med_name)}
                      style={{ marginTop: 4, accentColor: 'var(--dosy-primary)', cursor: 'pointer' }}
                      aria-label={`Selecionar ${m.med_name}`}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dosy-fg)' }}>
                        {m.med_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--dosy-fg-secondary)', marginTop: 2 }}>
                        {m.dose_count} doses · {m.patient_count} paciente{m.patient_count > 1 ? 's' : ''}
                      </div>
                      {effectiveGroup ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 999,
                            background: 'color-mix(in srgb, ' + (groupInfo?.color || 'var(--dosy-fg-tertiary)') + ' 14%, transparent)',
                            color: groupInfo?.color || 'var(--dosy-fg)',
                            fontSize: 11, fontWeight: 600,
                          }}>
                            <Sparkles size={11} />
                            {groupInfo?.label || effectiveGroup}
                          </span>
                          {m.suggestion_source && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--dosy-bg-sunken)', color: 'var(--dosy-fg-tertiary)', fontWeight: 600 }}>
                              {SOURCE_LABEL[m.suggestion_source] || m.suggestion_source}
                            </span>
                          )}
                          <select
                            value={effectiveGroup}
                            onChange={(e) => setOverride(m.med_name, e.target.value)}
                            style={{
                              fontSize: 11, padding: '2px 6px', borderRadius: 4,
                              border: '1px solid var(--dosy-border)',
                              background: 'var(--dosy-bg-elevated)', color: 'var(--dosy-fg)',
                              marginLeft: 'auto',
                            }}
                            aria-label="Mudar categoria"
                          >
                            {MED_GROUPS.map((g) => (
                              <option key={g.id} value={g.id}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div style={{ marginTop: 6 }}>
                          <select
                            value=""
                            onChange={(e) => setOverride(m.med_name, e.target.value)}
                            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--dosy-border)' }}
                          >
                            <option value="">Sem sugestão — escolha…</option>
                            {MED_GROUPS.map((g) => (
                              <option key={g.id} value={g.id}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button kind="ghost" onClick={onClose} full>Cancelar</Button>
              <Button
                kind="primary"
                onClick={handleApply}
                disabled={apply.isPending || totalSelected === 0}
                full
              >
                {apply.isPending
                  ? 'Aplicando…'
                  : `Aplicar ${totalSelected} med${totalSelected !== 1 ? 's' : ''} · ${totalDoses} doses`
                }
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
