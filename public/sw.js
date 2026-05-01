// Item #078 (release v0.1.7.0) — bumpar a CADA release com mudança em bundle JS.
// Activate event abaixo deleta caches != CACHE atual, forçando download fresh.
// Sem bump, devices podem manter chunks antigos cacheados após deploy.
// TODO (P2): automatizar via vite plugin que injeta versão do package.json no build.
const CACHE = 'medcontrol-v6'
const ASSETS = ['/', '/index.html', '/manifest.webmanifest']

// ─── Install / Activate ──────────────────────────────────────────────────────

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch (network-first nav, SWR assets) ───────────────────────────────────

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  // ⚠️ Nunca cachear requests cross-origin (Supabase API, CDNs externos)
  // Cachear API data causaria respostas stale após mutações
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  const isNav =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  if (isNav) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/index.html'))
        )
    )
    return
  }
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})

// ─── Push (server-sent Web Push) ─────────────────────────────────────────────

self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch {}
  const title = data.title || 'MedControl 💊'
  const options = {
    body: data.body || 'Hora de tomar o medicamento.',
    icon: '/icon-192.png',
    badge: '/favicon-64.png',
    tag: data.tag || 'medcontrol-dose',
    renotify: true,
    data: { url: data.url || '/', doseId: data.doseId },
    actions: [
      { action: 'confirm', title: '✅ Tomei' },
      { action: 'snooze',  title: '⏰ 15 min' }
    ]
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const { url, doseId } = e.notification.data || {}

  if (e.action === 'snooze') {
    // Re-schedule notification in 15 minutes
    const snoozeMs = 15 * 60 * 1000
    e.waitUntil(
      new Promise((resolve) => {
        setTimeout(() => {
          self.registration.showNotification(e.notification.title, {
            ...e.notification,
            body: '(repetição) ' + e.notification.body,
            tag: 'snooze-' + (doseId || Date.now())
          })
          resolve()
        }, snoozeMs)
      })
    )
    return
  }

  // Open / focus app
  const target = url || '/'
  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        const existing = wins.find((w) => w.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.postMessage({ type: 'NOTIFICATION_CLICK', doseId, url: target })
          return
        }
        return clients.openWindow(target)
      })
  )
})

// ─── Local scheduling via message ────────────────────────────────────────────
// App sends: { type: 'SCHEDULE_DOSES', doses: [{ id, medName, unit, scheduledAt, advanceMins }] }

const _timers = new Map() // doseId → timeoutId

self.addEventListener('message', (e) => {
  const msg = e.data
  if (!msg) return

  if (msg.type === 'SCHEDULE_DOSES') {
    const doses = msg.doses || []
    const now = Date.now()

    // Clear old timers no longer in the list
    const incoming = new Set(doses.map((d) => d.id))
    for (const [id, tid] of _timers) {
      if (!incoming.has(id)) { clearTimeout(tid); _timers.delete(id) }
    }

    // Schedule each dose
    for (const dose of doses) {
      if (_timers.has(dose.id)) continue // already scheduled
      const fireAt = new Date(dose.scheduledAt).getTime() - (dose.advanceMins || 0) * 60000
      const delay = fireAt - now
      if (delay < 0) continue // already past

      const tid = setTimeout(() => {
        _timers.delete(dose.id)
        self.registration.showNotification('MedControl 💊', {
          body: `${dose.medName} — ${dose.unit}`,
          icon: '/icon-192.png',
          badge: '/favicon-64.png',
          tag: `dose-${dose.id}`,
          renotify: true,
          data: { url: '/', doseId: dose.id },
          actions: [
            { action: 'confirm', title: '✅ Tomei' },
            { action: 'snooze',  title: '⏰ 15 min' }
          ]
        })
      }, delay)
      _timers.set(dose.id, tid)
    }
  }

  if (msg.type === 'CLEAR_SCHEDULE') {
    for (const [, tid] of _timers) clearTimeout(tid)
    _timers.clear()
  }
})
