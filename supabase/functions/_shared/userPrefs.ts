// Item #085 (release v0.1.7.3) — helper compartilhado pra Edge Functions
// consultarem user_prefs.notif (toggle Alarme Crítico, push, DND, etc).
//
// Schema:
//   medcontrol.user_prefs (user_id PK, prefs JSONB, updatedAt)
//   prefs blob: { push, criticalAlarm, dailySummary, summaryTime, advanceMins,
//                 dndEnabled, dndStart, dndEnd }
//
// Defaults aplicados pra users sem row ou campos faltantes.

export interface NotifPrefs {
  push: boolean
  criticalAlarm: boolean
  dailySummary: boolean
  summaryTime: string
  advanceMins: number
  dndEnabled: boolean
  dndStart: string
  dndEnd: string
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  push: true,
  criticalAlarm: true,
  dailySummary: true,
  summaryTime: '12:00',
  advanceMins: 0,
  dndEnabled: false,
  dndStart: '23:00',
  dndEnd: '07:00'
}

/**
 * Busca prefs de notif de um user. Retorna defaults se row ausente.
 * Idempotente, fail-safe — se DB query falhar, retorna defaults (loud-on, melhor errar
 * pelo lado de notificar do que silenciar healthcare).
 */
// deno-lint-ignore no-explicit-any
export async function getUserNotifPrefs(supabase: any, userId: string): Promise<NotifPrefs> {
  try {
    const { data, error } = await supabase
      .from('user_prefs')
      .select('prefs')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn(`[userPrefs] fetch fail user=${userId}: ${error.message}`)
      return { ...DEFAULT_NOTIF_PREFS }
    }
    return { ...DEFAULT_NOTIF_PREFS, ...(data?.prefs ?? {}) }
  } catch (e) {
    console.warn(`[userPrefs] exception user=${userId}: ${(e as Error).message}`)
    return { ...DEFAULT_NOTIF_PREFS }
  }
}

/**
 * Verifica se horário cai dentro da janela DND. Suporta janela atravessando
 * meia-noite (ex: dndStart=23:00, dndEnd=07:00 — DND ativo entre 23:00-07:00).
 */
export function inDndWindow(date: Date, prefs: NotifPrefs, tz = 'America/Sao_Paulo'): boolean {
  if (!prefs.dndEnabled) return false
  // Format date em timezone do user
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const hh = parts.find(p => p.type === 'hour')?.value ?? '00'
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00'
  const cur = parseInt(hh, 10) * 60 + parseInt(mm, 10)

  const [sH, sM] = prefs.dndStart.split(':').map(Number)
  const [eH, eM] = prefs.dndEnd.split(':').map(Number)
  const start = sH * 60 + sM
  const end = eH * 60 + eM

  if (start <= end) {
    // Janela mesma data (ex: 13:00 - 15:00)
    return cur >= start && cur < end
  } else {
    // Atravessa meia-noite (ex: 23:00 - 07:00)
    return cur >= start || cur < end
  }
}
