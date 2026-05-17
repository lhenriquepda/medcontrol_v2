// Native APK login: REST signIn + write SecureStorage via Capacitor plugin + reload.
// Usage: node cdp_login_native.mjs PORT PAGE_ID EMAIL PASS
import { WebSocket } from 'ws'

const PORT = process.argv[2]
const PAGE_ID = process.argv[3]
const EMAIL = process.argv[4]
const PASS = process.argv[5] || '123456'
const SUPABASE_URL = 'https://guefraaqbkcehofchnrc.supabase.co'
const ANON_KEY = 'sb_publishable_gUsNMQJJWnl9s_b3E1CSQA_OtJOK4ex'

const ws = new WebSocket(`ws://localhost:${PORT}/devtools/page/${PAGE_ID}`)
let msgId = 0

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId
    ws.send(JSON.stringify({ id, method, params }))
    const handler = (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === id) { ws.off('message', handler); resolve(msg.result) }
    }
    ws.on('message', handler)
  })
}

ws.on('open', async () => {
  console.log(`CDP port ${PORT} connected`)
  await send('Runtime.enable')

  const script = `
    (async () => {
      try {
        // 1. REST signIn — get tokens
        const r = await fetch('${SUPABASE_URL}/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': '${ANON_KEY}' },
          body: JSON.stringify({ email: '${EMAIL}', password: '${PASS}' })
        })
        if (!r.ok) return JSON.stringify({err:'rest fail '+r.status, body:(await r.text()).slice(0,300)})
        const session = await r.json()

        // 2. Write to SecureStorage via Capacitor plugin (native)
        const SS = window.Capacitor?.Plugins?.SecureStorage
        if (!SS) return JSON.stringify({err:'no SecureStorage plugin'})

        // Supabase storage key
        const key = 'sb-guefraaqbkcehofchnrc-auth-token'
        const value = JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: session.user
        })

        // Positional API per README: SS.set(key, value)
        await SS.set(key, value)

        // Plus localStorage fallback (some code paths read here)
        try { localStorage.setItem(key, value) } catch {}

        return JSON.stringify({ok:true, email:session.user.email, exp:session.expires_at})
      } catch (e) {
        return JSON.stringify({err:e.message, stack:e.stack?.slice(0,300)})
      }
    })()
  `
  const res = await send('Runtime.evaluate', {
    expression: script,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log('Result:', res.result?.value || JSON.stringify(res.exceptionDetails))

  // Reload to pick up session
  await send('Page.enable')
  await send('Page.reload')
  console.log('reloaded')
  ws.close()
  process.exit(0)
})

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
