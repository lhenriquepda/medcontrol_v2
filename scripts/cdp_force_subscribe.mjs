import { WebSocket } from 'ws'
const PORT = process.argv[2], PAGE_ID = process.argv[3]
const ws = new WebSocket(`ws://localhost:${PORT}/devtools/page/${PAGE_ID}`)
let mid = 0
const send = (m, p={}) => new Promise(r => { const id=++mid; ws.send(JSON.stringify({id,method:m,params:p})); const h=d=>{const x=JSON.parse(d.toString());if(x.id===id){ws.off('message',h);r(x.result)}}; ws.on('message',h) })
ws.on('open', async () => {
  await send('Runtime.enable')
  const s = `
    (async () => {
      try {
        // Clear flag
        const keys = Object.keys(localStorage).filter(k => k.startsWith('dosy_push_asked_'))
        keys.forEach(k => localStorage.removeItem(k))
        // Force subscribe via PushNotifications + criticalAlarm
        const { PushNotifications } = window.Capacitor?.Plugins || {}
        const SS = window.Capacitor?.Plugins?.SecureStorage
        if (!PushNotifications) return JSON.stringify({err: 'no PushNotifications plugin'})

        // Register with FCM
        await PushNotifications.requestPermissions()
        let tokenResolved = null
        const handle = await PushNotifications.addListener('registration', (t) => { tokenResolved = t.value })
        await PushNotifications.register()

        // Wait for token
        for (let i = 0; i < 30; i++) {
          if (tokenResolved) break
          await new Promise(r => setTimeout(r, 500))
        }
        handle?.remove?.()
        if (!tokenResolved) return JSON.stringify({err: 'token timeout'})

        // Upsert via RPC
        const supaUrl = 'https://guefraaqbkcehofchnrc.supabase.co'
        const anon = 'sb_publishable_gUsNMQJJWnl9s_b3E1CSQA_OtJOK4ex'
        const sessionKey = 'sb-guefraaqbkcehofchnrc-auth-token'
        const sess = JSON.parse(await SS.get(sessionKey).then(r => r.value).catch(() => null) || localStorage.getItem(sessionKey))
        const accessToken = sess?.access_token

        const deviceIdRes = await window.Capacitor.Plugins.CriticalAlarm.getDeviceId()
        const deviceId = deviceIdRes?.deviceId

        const r = await fetch(supaUrl + '/rest/v1/rpc/upsert_push_subscription', {
          method: 'POST',
          headers: { 'apikey': anon, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json', 'Content-Profile': 'medcontrol' },
          body: JSON.stringify({ p_device_token: tokenResolved, p_platform: 'android', p_advance_mins: 0, p_user_agent: 'capacitor-android', p_device_id_uuid: deviceId })
        })
        return JSON.stringify({token: tokenResolved.slice(0,20)+'...', deviceId, upsertStatus: r.status, body: (await r.text()).slice(0,200)})
      } catch (e) { return JSON.stringify({err: e.message, stack: e.stack?.slice(0,200)}) }
    })()
  `
  const res = await send('Runtime.evaluate', { expression: s, awaitPromise: true, returnByValue: true })
  console.log('Result:', res.result?.value || JSON.stringify(res.exceptionDetails))
  ws.close(); process.exit(0)
})
ws.on('error', e => { console.error('WS:', e.message); process.exit(1) })
