import { useEffect, useState } from 'react'
import { getPatient } from '../services/patientsService'

/**
 * usePatientPhoto — local-first cache of patient photo_url by version.
 *
 * Item #115 (release v0.2.0.2): egress-friendly photo loading.
 *   - Lista carrega só photo_version (2B). Nunca photo_url (~50KB).
 *   - Hook checa localStorage[dosy_photo_<id>] = { v, data }.
 *   - Match version → render instant, ZERO request da imagem.
 *   - Mismatch (1ª vez OU foto editada externamente) → 1 fetch único
 *     via getPatient(id) → salva → reusa forever.
 *   - Edit de foto: PatientForm submit bump photo_version. Realtime
 *     trigger em outros devices → React Query invalida lista → next
 *     render detecta mismatch → re-fetch + re-cache.
 *
 * Result: foto baixa 1 vez por device. Lista refetches custam só
 * version int. Storage budget: 100 pacientes × 50KB = 5MB localStorage,
 * dentro do limit típico (5-10MB).
 */
const KEY_PREFIX = 'dosy_photo_'

function readCache(id, version) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.v !== version) return null
    return parsed.data || null
  } catch {
    return null
  }
}

function writeCache(id, version, data) {
  try {
    localStorage.setItem(KEY_PREFIX + id, JSON.stringify({ v: version, data }))
  } catch (e) {
    // QuotaExceededError → drop oldest entries
    console.warn('[usePatientPhoto] localStorage write failed:', e?.message)
    try { evictOldestPhotos(2) } catch { /* ignore */ }
  }
}

function clearCache(id) {
  try { localStorage.removeItem(KEY_PREFIX + id) } catch { /* ignore */ }
}

/** LRU-ish eviction: drop N random photo entries when quota hits. */
function evictOldestPhotos(n) {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k)
  }
  keys.slice(0, n).forEach((k) => localStorage.removeItem(k))
}

export function usePatientPhoto(patientId, version) {
  // version=0 (or null/undefined) = no photo. Skip cache + fetch.
  const hasPhoto = !!version && version > 0
  const [src, setSrc] = useState(() => (hasPhoto ? readCache(patientId, version) : null))

  useEffect(() => {
    if (!hasPhoto || !patientId) {
      setSrc(null)
      clearCache(patientId)
      return
    }
    const cached = readCache(patientId, version)
    if (cached) {
      setSrc(cached)
      return
    }
    let active = true
    getPatient(patientId).then((p) => {
      if (!active) return
      if (p?.photo_url) {
        writeCache(patientId, version, p.photo_url)
        setSrc(p.photo_url)
      } else {
        clearCache(patientId)
        setSrc(null)
      }
    }).catch((e) => {
      console.warn('[usePatientPhoto] fetch failed:', e?.message)
    })
    return () => { active = false }
  }, [patientId, version, hasPhoto])

  return src
}

/** Pre-warm cache after edit (skip 1 round-trip on next list render). */
export function primePatientPhotoCache(id, version, dataUrl) {
  if (!id || !version) return
  writeCache(id, version, dataUrl)
}

/** Drop cached photo (e.g. patient deleted). */
export function dropPatientPhotoCache(id) {
  clearCache(id)
}

/** Drop cached photos for IDs not in `validIds` set. Call when list loads. */
export function pruneStalePhotoCaches(validIds) {
  if (!Array.isArray(validIds)) return
  const valid = new Set(validIds.map(String))
  try {
    const toDelete = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(KEY_PREFIX)) continue
      const id = k.slice(KEY_PREFIX.length)
      if (!valid.has(id)) toDelete.push(k)
    }
    toDelete.forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
