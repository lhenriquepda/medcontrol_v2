/**
 * FilterPanel — Refactor Fase 4 (Refactor_Full.md §11.3 item 3).
 *
 * Schema-driven filter panel. Substituirá filtros locais em FilterBar
 * (Dashboard), DoseHistory, Reports, Analytics — cada um inventava o
 * seu. Adicionar nova dimensão de filtro vira 1 entry de schema, 0
 * código nas páginas.
 *
 * Uso:
 *   <FilterPanel
 *     schema={[
 *       { key: 'range', label: 'Período', type: 'chips',
 *         options: [{key:'12h',label:'12h'}, ...] },
 *       { key: 'patientId', label: 'Paciente', type: 'select',
 *         options: patients.map(p => ({ key: p.id, label: p.name })) },
 *       { key: 'status', label: 'Status', type: 'multi',
 *         options: [{key:'pending',label:'Pendente'},...] },
 *       { key: 'search', label: 'Buscar', type: 'text',
 *         placeholder: 'Medicamento...' },
 *     ]}
 *     values={values}
 *     onChange={setValues}
 *   />
 */
import { Chip } from './buttons'
import { Input } from './forms'

export default function FilterPanel({ schema = [], values = {}, onChange }) {
  if (!Array.isArray(schema) || schema.length === 0) return null

  const setField = (key, value) => {
    onChange?.({ ...values, [key]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {schema.map((field) => {
        switch (field.type) {
          case 'chips':
            return (
              <ChipsField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            )
          case 'multi':
            return (
              <MultiField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            )
          case 'select':
            return (
              <SelectField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            )
          case 'text':
            return (
              <TextField
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function FieldWrapper({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--dosy-fg-tertiary)',
          fontFamily: 'var(--dosy-font-display)',
        }}>{label}</span>
      )}
      {children}
    </div>
  )
}

function ChipsField({ field, value, onChange }) {
  return (
    <FieldWrapper label={field.label}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {field.options?.map((o) => (
          <Chip
            key={o.key}
            active={value === o.key}
            onClick={() => onChange(value === o.key && field.allowClear !== false ? null : o.key)}
          >
            {o.label}
          </Chip>
        ))}
      </div>
    </FieldWrapper>
  )
}

function MultiField({ field, value, onChange }) {
  const arr = Array.isArray(value) ? value : []
  const toggle = (key) => {
    const next = arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]
    onChange(next.length ? next : null)
  }
  return (
    <FieldWrapper label={field.label}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {field.options?.map((o) => (
          <Chip
            key={o.key}
            active={arr.includes(o.key)}
            onClick={() => toggle(o.key)}
          >
            {o.label}
          </Chip>
        ))}
      </div>
    </FieldWrapper>
  )
}

function SelectField({ field, value, onChange }) {
  return (
    <FieldWrapper label={field.label}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          width: '100%', padding: '10px 12px',
          borderRadius: 12,
          background: 'var(--dosy-bg-elevated)',
          color: 'var(--dosy-fg)',
          border: '1px solid var(--dosy-border)',
          fontFamily: 'var(--dosy-font-body)',
          fontSize: 14,
        }}
      >
        <option value="">{field.placeholder || 'Todos'}</option>
        {field.options?.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </FieldWrapper>
  )
}

function TextField({ field, value, onChange }) {
  return (
    <FieldWrapper label={field.label}>
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={field.placeholder}
        type={field.inputType || 'text'}
      />
    </FieldWrapper>
  )
}
