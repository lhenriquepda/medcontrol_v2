import { Component } from 'react'
import * as Sentry from '@sentry/react'

/**
 * ErrorBoundary global — Aud 4.5.7 G2.
 * Captura crashes no React tree (componente errado, exception em render),
 * reporta ao Sentry e mostra fallback amigável em vez de white screen.
 *
 * Render fallback ao invés de re-throw — usuário não fica preso.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Sentry capture (PII strip aplicado em beforeSend global)
    Sentry.captureException(error, {
      contexts: {
        react: { componentStack: errorInfo?.componentStack },
      },
    })
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  handleGoHome = () => {
    if (typeof window !== 'undefined') window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #0d1535 0%, #1a2660 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24, lineHeight: 1.5 }}>
            O Dosy encontrou um erro inesperado. O time já foi notificado. Tente recarregar o app.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={this.handleReload}
              style={{
                background: '#1873f5',
                color: '#fff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '12px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Voltar pro Início
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                marginTop: 24,
                fontSize: 11,
                textAlign: 'left',
                background: 'rgba(0,0,0,0.3)',
                padding: 12,
                borderRadius: 6,
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
