import { useEffect, useState, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase, hasSupabase } from '../services/supabase'

/* eslint-disable no-undef */
const BUNDLE_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
/* eslint-enable no-undef */

const isNative = Capacitor.isNativePlatform()

// v0.2.3.11 #299 — native version source-of-truth = Android packageInfo
// (App.getInfo()). Bundle pode ficar stale se cap sync não rodou antes do AAB.
let cachedNativeVersion = null
let cachedNativeVersionCode = null
async function getRealVersion() {
  if (!isNative) return { name: BUNDLE_VERSION, code: null }
  if (cachedNativeVersion) return { name: cachedNativeVersion, code: cachedNativeVersionCode }
  try {
    const { App } = await import('@capacitor/app')
    const info = await App.getInfo()
    cachedNativeVersion = info?.version || BUNDLE_VERSION
    cachedNativeVersionCode = info?.build ? parseInt(info.build, 10) : null
    return { name: cachedNativeVersion, code: cachedNativeVersionCode }
  } catch {
    return { name: BUNDLE_VERSION, code: null }
  }
}

// Web fallback (mantém comportamento legacy /version.json para usuários web)
const VERSION_URL = typeof window !== 'undefined' && window.location?.origin
  ? `${window.location.origin}/version.json`
  : 'https://dosy-app.vercel.app/version.json'
const CHECK_INTERVAL_MS = 30 * 60 * 1000
const DISMISS_KEY = 'dosy_update_dismissed_version'
const VNAME_CACHE_PREFIX = 'dosy_vname_'  // localStorage cache por vcode (imutável)

/**
 * v0.2.3.11 #299 — resolve version_name + is_mandatory via DB autoritativa.
 *
 * - version_name: cache localStorage por vcode (releases name nunca muda).
 * - is_mandatory: NÃO cacheia (IA pode editar flag depois do ship em casos
 *   excepcionais; query roda 1× por sessão, custo negligível).
 *
 * Retorna { name, mandatory } ou null se DB indisponível/sem linha.
 */
async function fetchReleaseFromDb(currentVc, availableVc) {
  if (!hasSupabase || !availableVc) return null

  // 1. version_name pelo cache (imutável)
  let cachedName = null
  try { cachedName = localStorage.getItem(VNAME_CACHE_PREFIX + availableVc) } catch {}

  try {
    // 2. Query única: pega available release + verifica mandatory entre current..available
    const { data: availableRow } = await supabase
      .from('app_releases')
      .select('version_code, version_name, is_mandatory, whatsnew')
      .eq('version_code', availableVc)
      .maybeSingle()

    if (availableRow?.version_name && !cachedName) {
      try { localStorage.setItem(VNAME_CACHE_PREFIX + availableVc, availableRow.version_name) } catch {}
      cachedName = availableRow.version_name
    }

    // v0.2.3.14 #0011 — robusto a Play Core race condition (info.currentVersionCode
    // pode vir null em primeiro check, antes do useEffect getRealVersion popular).
    // Antes: `if (currentVc != null && currentVc < availableVc)` PULAVA mandatory check
    // inteiro → mandatory=false default → modal vermelho nunca renderizava.
    // Agora: query upper-bound-only sempre roda. Se currentVc disponível, refina com
    // lower bound. Trade-off: fresh install muito antigo pode ver falso-positivo
    // mandatory (release antiga marcada mandatory ainda existe na tabela) — aceitável
    // em healthcare (errar pelo lado seguro).
    let mandatory = false
    let mandQuery = supabase
      .from('app_releases')
      .select('version_code')
      .lte('version_code', availableVc)
      .eq('is_mandatory', true)
      .limit(1)
    if (currentVc != null && currentVc < availableVc) {
      mandQuery = mandQuery.gt('version_code', currentVc)
    }
    const { data: mandRows } = await mandQuery
    mandatory = !!mandRows?.length

    return {
      name: cachedName || availableRow?.version_name || null,
      mandatory,
      whatsnew: availableRow?.whatsnew || null,
    }
  } catch (e) {
    console.warn('[useAppUpdate #299] DB fetch failed:', e?.message)
    return cachedName ? { name: cachedName, mandatory: false, whatsnew: null } : null
  }
}

function isNewer(a, b) {
  const as = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  const bs = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const av = as[i] ?? 0
    const bv = bs[i] ?? 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return false
}

/**
 * useAppUpdate — version availability detector + update trigger.
 *
 * NATIVE (Android): Google Play In-App Updates API (flexible mode).
 *   - getAppUpdateInfo() reads Play Store directly — source of truth = Play Console
 *   - version_name resolvido via DB app_releases (v0.2.3.11 #299) — substituiu
 *     mapa hardcoded + cadeia frágil de fallbacks Vercel
 *   - is_mandatory=true → modal bloqueante (não dismissable, não pode usar app)
 *   - Default banner verde (dismissable em web only; native = sempre exibe até atualizar)
 *   - Tap "Atualizar" → startFlexibleUpdate (download bg, app continua usável)
 *   - Download done → completeFlexibleUpdate restarts app
 *
 * WEB: legacy /version.json (Vercel deploy). Sem is_mandatory (web não precisa
 * força update; reload é suficiente).
 */
export function useAppUpdate() {
  const [latest, setLatest] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) } catch { return null }
  })
  const [currentVersion, setCurrentVersion] = useState(BUNDLE_VERSION)
  const [currentVersionCode, setCurrentVersionCode] = useState(null)
  const listenerRef = useRef(null)

  useEffect(() => {
    let active = true
    getRealVersion().then(({ name, code }) => {
      if (!active) return
      setCurrentVersion(name)
      setCurrentVersionCode(code)
    })
    return () => { active = false }
  }, [])

  // ─── Native check (Play Store) ──────────────────────────────────────
  const checkNative = useCallback(async () => {
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      const info = await AppUpdate.getAppUpdateInfo()

      // updateAvailability: 1=NOT_AVAILABLE, 2=UPDATE_AVAILABLE, 3=IN_PROGRESS
      // installStatus: 11=DOWNLOADED
      if (info?.updateAvailability === 2 && info.flexibleUpdateAllowed) {
        const availableVc = info.availableVersionCode
        const currentVc = info.currentVersionCode ?? currentVersionCode ?? null

        // DB autoritativa: version_name + is_mandatory
        const dbInfo = await fetchReleaseFromDb(currentVc, availableVc)

        // v0.2.3.14 #0010 — DB primeiro (autoritativa), Play Core SÓ se shape semver real.
        // Plugin @capawesome/capacitor-app-update retorna `availableVersion="77"`
        // (versionCode stringified) quando Play Store backend não populou versionName
        // imediatamente pós-publish. `??` só pula null/undefined → `"77"` truthy
        // curtocircuitava DB lookup → banner mostrava "versão 77" em vez de "0.2.3.14".
        const looksLikeSemver = (v) => typeof v === 'string' && /\d+\.\d+/.test(v)
        const version =
          dbInfo?.name                                                                  // 1º DB autoritativa
          ?? (looksLikeSemver(info.availableVersion) ? info.availableVersion : null)    // 2º Play Core SE semver real
          ?? `versão ${availableVc}`                                                    // 3º fallback final

        setLatest({
          version,
          versionCode: availableVc,
          mandatory: dbInfo?.mandatory || false,
          whatsnew: dbInfo?.whatsnew || null,
          source: 'play',
        })
      } else {
        setLatest(null)
      }
      if (info?.installStatus === 11) setDownloaded(true)
    } catch (e) {
      console.log('[useAppUpdate] native check skipped:', e?.message || e)
    }
  }, [currentVersionCode])

  // ─── Web check (Vercel) ─────────────────────────────────────────────
  const checkWeb = useCallback(async () => {
    try {
      const res = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setLatest({ ...data, source: 'web', mandatory: false })
    } catch {
      // network/404 → ignore silently
    }
  }, [])

  const check = useCallback(() => {
    if (isNative) return checkNative()
    return checkWeb()
  }, [checkNative, checkWeb])

  useEffect(() => {
    check()
    const t = setInterval(check, CHECK_INTERVAL_MS)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [check])

  // ─── Native: subscribe a download state changes ─────────────────────
  useEffect(() => {
    if (!isNative) return
    let active = true
    ;(async () => {
      try {
        const { AppUpdate } = await import('@capawesome/capacitor-app-update')
        const handle = await AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
          if (!active) return
          if (state.installStatus === 2 && state.bytesDownloaded && state.totalBytesToDownload) {
            setProgress(state.bytesDownloaded / state.totalBytesToDownload)
          }
          if (state.installStatus === 11) setDownloaded(true)
        })
        listenerRef.current = handle
      } catch (e) {
        console.log('[useAppUpdate] listener skipped:', e?.message)
      }
    })()
    return () => {
      active = false
      listenerRef.current?.remove?.()
    }
  }, [])

  // ─── Trigger update ────────────────────────────────────────────────
  const startUpdate = useCallback(async () => {
    if (!isNative) {
      window.location.reload()
      return
    }
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      // v0.2.3.11 #299 — mandatory usa IMMEDIATE (Play UI full-screen)
      // ao invés de FLEXIBLE (background download + restart). Mantém UX
      // consistente com modal bloqueante exibido no app.
      if (latest?.mandatory) {
        await AppUpdate.performImmediateUpdate?.() ?? AppUpdate.startFlexibleUpdate()
      } else {
        await AppUpdate.startFlexibleUpdate()
      }
    } catch (e) {
      console.error('[useAppUpdate] start failed:', e?.message)
    }
  }, [latest])

  const completeUpdate = useCallback(async () => {
    if (!isNative) return
    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update')
      await AppUpdate.completeFlexibleUpdate()
    } catch (e) {
      console.error('[useAppUpdate] complete failed:', e?.message)
    }
  }, [])

  // ─── Debug toggles (runtime, dev only) ───────────────────────────
  //   window.__dosyForceUpdate = true       → força banner verde
  //   window.__dosyForceMandatory = true    → força modal bloqueante (preview layout)
  //   window.__dosyDebugRecheck()           → re-avalia flags em TODAS instâncias
  //
  // Múltiplas instâncias do hook (UpdateBanner + AppHeader + Settings) precisam
  // todas reagir ao toggle — usa CustomEvent global ao invés de setState direto.
  // Debug-only tick que força re-render quando flags mudam em runtime
  const [, setDebugTick] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      if (window.__dosyForceMandatory === true) {
        setLatest(prev => prev?.mandatory
          ? prev
          : { version: prev?.version || '0.2.3.99', mandatory: true, whatsnew: 'Atualização obrigatória — preview de layout.', source: 'debug' })
      } else if (window.__dosyForceUpdate === true && !latest) {
        // Banner verde precisa de `latest.version` pra renderizar subtitle. Injeta fake.
        setLatest({ version: '0.2.3.99', mandatory: false, source: 'debug' })
      } else {
        setDebugTick(t => t + 1)  // força re-render pra re-avaliar available
      }
    }
    window.addEventListener('__dosyDebugRecheck', handler)
    if (window.__dosyForceMandatory === true || window.__dosyForceUpdate === true) handler()
    window.__dosyDebugRecheck = () => window.dispatchEvent(new Event('__dosyDebugRecheck'))
    return () => window.removeEventListener('__dosyDebugRecheck', handler)
  }, [latest])

  // ─── Availability flag ─────────────────────────────────────────────
  const isWebNewer = !isNative && latest?.version && isNewer(latest.version, currentVersion)
  let available = isNative
    ? !!latest
    : (isWebNewer && dismissed !== latest.version)

  if (typeof window !== 'undefined') {
    if (window.__dosyForceUpdate === true) available = true
    if (window.__dosyForceMandatory === true) available = true
  }

  // mandatory=true só vem do native (DB app_releases). Web /version.json não popula
  // is_mandatory (sem coluna). __dosyForceMandatory debug bypassa isNative pra preview.
  const mandatory = !!latest?.mandatory

  const dismiss = () => {
    if (mandatory) return  // mandatory não pode ser dismissado
    if (latest) {
      localStorage.setItem(DISMISS_KEY, latest.version)
      setDismissed(latest.version)
    }
  }

  return {
    available,
    mandatory,
    current: currentVersion,
    latest,
    downloaded,
    progress,
    isNative,
    startUpdate,
    completeUpdate,
    dismiss,
    recheck: check,
  }
}
