// v0.2.2.0 — Shared audit log helper for Edge Functions.
// Tabela `medcontrol.alarm_audit_log` registra todos eventos de agendamento
// pra observabilidade via admin.dosymed.app. Configurável por user_id em
// `medcontrol.alarm_audit_config`.

export interface AuditRow {
  user_id: string
  source: string  // 'edge_daily_sync' | 'edge_trigger_handler'
  action: string  // 'scheduled' | 'cancelled' | 'fcm_sent' | 'skipped' | 'batch_start' | 'batch_end'
  dose_id?: string
  scheduled_at?: string
  patient_name?: string
  med_name?: string
  device_id?: string
  // deno-lint-ignore no-explicit-any
  metadata?: Record<string, any>
}

// deno-lint-ignore no-explicit-any
export async function getEnabledAuditUsers(supabase: any): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('alarm_audit_config').select('user_id').eq('enabled', true)
    if (error) {
      console.warn(`[auditLog] config fetch error: ${error.message}`)
      return new Set()
    }
    return new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
  } catch (e) {
    console.warn(`[auditLog] config exception: ${(e as Error).message}`)
    return new Set()
  }
}

// deno-lint-ignore no-explicit-any
export async function logAuditBatch(supabase: any, rows: AuditRow[]): Promise<void> {
  if (!rows.length) return
  try {
    const payload = rows.map(r => ({
      user_id: r.user_id,
      source: r.source,
      action: r.action,
      dose_id: r.dose_id ?? null,
      scheduled_at: r.scheduled_at ?? null,
      patient_name: r.patient_name ?? null,
      med_name: r.med_name ?? null,
      device_id: r.device_id ?? null,
      metadata: r.metadata ?? {}
    }))
    const { error } = await supabase.from('alarm_audit_log').insert(payload)
    if (error) console.warn(`[auditLog] insert error: ${error.message}`)
  } catch (e) {
    console.warn(`[auditLog] exception: ${(e as Error).message}`)
  }
}
