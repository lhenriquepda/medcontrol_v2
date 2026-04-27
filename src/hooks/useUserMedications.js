import { useQuery } from '@tanstack/react-query'
import { hasSupabase, supabase } from '../services/supabase'
import { mock } from '../services/mockStore'

/**
 * useUserMedications — fetches distinct medication names that the current user
 * has used in treatments + sos_doses, sorted by recency (most recent first).
 *
 * These are merged into MedNameInput suggestions ABOVE the hardcoded list,
 * giving each user a personalized autocomplete that learns from their usage.
 *
 * Auto-add behavior: any treatment the user saves contributes to this list
 * automatically (no explicit add step) — distinct query picks up new names.
 */
export function useUserMedications() {
  return useQuery({
    queryKey: ['user_medications'],
    queryFn: async () => {
      if (!hasSupabase) {
        // Demo mode: pull from local mockStore treatments
        const treatments = mock.list('treatments') || []
        const names = [...new Set(treatments.map((t) => t.medName).filter(Boolean))]
        return names
      }
      // Real DB: distinct medNames ordered by most recent createdAt
      const { data, error } = await supabase
        .schema('medcontrol')
        .from('treatments')
        .select('medName, createdAt')
        .order('createdAt', { ascending: false })
        .limit(100)
      if (error) {
        console.warn('[useUserMedications] fetch failed:', error.message)
        return []
      }
      const seen = new Set()
      const names = []
      for (const row of data || []) {
        const n = (row.medName || '').trim()
        if (!n) continue
        const key = n.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        names.push(n)
      }
      return names
    },
    staleTime: 30_000,
    gcTime: 1000 * 60 * 30
  })
}
