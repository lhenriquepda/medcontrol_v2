// v0.2.6.1 P0.4 (Roteiro_Alinhamento_Dosy_v2) — ConsentBanner LGPD.
//
// Antes: PostHog inicializava sem consent (telemetria começava no primeiro pageload).
// Agora: banner aparece em primeiro launch perguntando consentimento explícito.
// Settings → Dados & Privacidade → toggle persistente pra mudar depois.
//
// Default: pending (banner aparece). User clica Aceitar/Recusar → grava localStorage.
// Banner renderiza SOMENTE quando localStorage[CONSENT_KEY] === null.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X } from 'lucide-react'
import { getConsent, setConsent, track, EVENTS } from '../services/analytics'

export default function ConsentBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Só mostra se ainda não decidiu (getConsent === null)
    const current = getConsent()
    if (current === null) setShow(true)
  }, [])

  if (!show) return null

  function accept() {
    setConsent(true)
    setShow(false)
    // PostHog instance ainda não existe nesse instante (setConsent dispara init async).
    // Capture com pequeno delay pra garantir init drenou.
    setTimeout(() => track(EVENTS.TELEMETRY_CONSENT_ACCEPTED), 1500)
  }

  function decline() {
    // Antes do setConsent(false) tentamos capturar evento (best-effort,
    // só funciona se PostHog rodou em sessão anterior — caso raro).
    try { track(EVENTS.TELEMETRY_CONSENT_DECLINED) } catch {}
    setConsent(false)
    setShow(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-banner-title"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          left: 16,
          right: 16,
          zIndex: 9999,
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--dosy-bg-elevated)',
          border: '1px solid var(--dosy-border)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
          fontFamily: 'var(--dosy-font-body)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--dosy-primary) 14%, transparent)',
            flexShrink: 0,
          }}>
            <Shield size={20} color="var(--dosy-primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="consent-banner-title" style={{
              fontSize: 15, fontWeight: 700, color: 'var(--dosy-fg)',
              margin: 0, fontFamily: 'var(--dosy-font-display)',
            }}>
              Telemetria anônima
            </h2>
            <p style={{
              fontSize: 13, color: 'var(--dosy-fg-secondary)',
              margin: '4px 0 0 0', lineHeight: 1.5,
            }}>
              Coletamos dados anônimos de uso (cliques em telas, tempo entre doses, fluxos)
              pra melhorar o app. <strong>Nenhum dado pessoal ou de saúde</strong> é enviado —
              nem nome, e-mail, medicamento ou observações. Você pode mudar depois em
              Configurações → Dados &amp; Privacidade.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={decline}
            style={{
              padding: '10px 16px',
              border: '1px solid var(--dosy-border)',
              background: 'transparent',
              color: 'var(--dosy-fg-secondary)',
              borderRadius: 10,
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--dosy-font-body)',
              minHeight: 44,
            }}
            aria-label="Recusar telemetria"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={accept}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'var(--dosy-primary)',
              color: 'var(--dosy-fg-on-primary)',
              borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--dosy-font-display)',
              minHeight: 44,
            }}
            aria-label="Aceitar telemetria"
          >
            Aceitar
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
