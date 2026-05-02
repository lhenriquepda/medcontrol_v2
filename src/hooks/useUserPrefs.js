import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { setCriticalAlarmEnabled } from '../services/criticalAlarm'

/**
 * User-wide notification + UX preferences. Stored in DB (medcontrol.user_prefs)
 * as JSONB blob so prefs sync across devices (web + Android).
 *
 * localStorage `medcontrol_notif` is kept as cache so usePushNotifications
 * (which schedules native alarms) reads sync without round-trip. Cache is
 * refreshed on every successful query/mutation.
 *
 * Schema:
 *   { push, criticalAlarm, dailySummary, summaryTime, advanceMins }
 */
export const PREFS_LOCAL_KEY = 'medcontrol_notif'

export const DEFAULT_PREFS = {
  push: true,
  criticalAlarm: true,
  dailySummary: true,
  summaryTime: '12:00',
  advanceMins: 0,
  // DND (Não perturbe) — durante janela: doses geram apenas push notif silenciosa,
  // sem alarme tocando. Suporta janelas que cruzam meia-noite (ex: 23:00 → 07:00).
  dndEnabled: false,
  dndStart: '23:00',
  dndEnd: '07:00'
}

function readLocal() {
  try {
    const raw = localStorage.getItem(PREFS_LOCAL_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function writeLocal(prefs) {
  try { localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(prefs)) } catch {}
}

export function useUserPrefs() {
  return useQuery({
    queryKey: ['user_prefs'],
    queryFn: async () => {
      if (!hasSupabase) return readLocal()
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return readLocal()
        const { data, error } = await supabase
          .schema('medcontrol')
          .from('user_prefs')
          .select('prefs')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) {
          console.warn('[useUserPrefs] fetch failed:', error.message)
          return readLocal()
        }
        const merged = { ...DEFAULT_PREFS, ...(data?.prefs || readLocal()) }
        // Sync local cache so usePushNotifications.scheduleDoses sees DB state
        writeLocal(merged)
        // Item #085 — sincroniza toggle pro SharedPreferences Android no carregamento
        // (best-effort — Android nativo lê flag em DoseSyncWorker + DosyMessagingService)
        setCriticalAlarmEnabled(merged.criticalAlarm !== false).catch(() => {})
        return merged
      } catch (e) {
        console.warn('[useUserPrefs] exception:', e?.message)
        return readLocal()
      }
    },
    staleTime: 30_000
  })
}

export function useUpdateUserPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch) => {
      const current = qc.getQueryData(['user_prefs']) || readLocal()
      const merged = { ...current, ...patch }
      // Always update local first (instant UI)
      writeLocal(merged)
      qc.setQueryData(['user_prefs'], merged)

      if (!hasSupabase) return merged
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const e = new Error('NOT_AUTHENTICATED: no user session')
        console.error('[useUserPrefs]', e.message)
        throw e
      }
      const { error } = await supabase
        .schema('medcontrol')
        .from('user_prefs')
        .upsert({ user_id: user.id, prefs: merged, updatedAt: new Date().toISOString() })
      if (error) {
        console.error('[useUserPrefs] upsert error:', error.message, error.details, error.hint)
        throw new Error(`Sync prefs falhou: ${error.message}`)
      }
      console.log('[useUserPrefs] saved to DB:', Object.keys(patch).join(','))

      // Item #085 (release v0.1.7.3) — propaga toggle Alarme Crítico pro
      // SharedPreferences Android quando flag muda. DoseSyncWorker (background)
      // e DosyMessagingService (FCM receiver) leem flag pra decidir agendar
      // alarme nativo. Best-effort (isNative-only, falha silenciosa em web).
      if ('criticalAlarm' in patch) {
        setCriticalAlarmEnabled(merged.criticalAlarm !== false).catch(e =>
          console.warn('[useUserPrefs] setCriticalAlarmEnabled fail:', e?.message)
        )
      }
      return merged
    }
  })
}
