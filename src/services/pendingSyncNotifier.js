/**
 * pendingSyncNotifier.js — Refactor Sync v2 hardening (v0.2.7.0)
 *
 * Quando app vai pra background com queue > 0, agenda local notification
 * lembrando user de reabrir pra sincronizar. Sem isso, mutations ficam stuck
 * no IDB e cuidadores compartilhados nunca veem as marcações.
 *
 * Princípio P2 (Refactor_Sync_v2.md): healthcare critical — user PRECISA saber
 * que dose marcada ainda não chegou ao server.
 *
 * Comportamento:
 *   - onPause: se queue > 0, schedule notification com count
 *   - onResume: cancel notification (queue será drenada pelo lifecycle hooks)
 *   - Re-schedule sempre que count muda (DoseCard mark + queueAdd)
 *
 * ID fixo da notificação: 998888001 (cancelado/reagendado a cada evento).
 */
import { Capacitor } from '@capacitor/core'
import { getPendingQueueSize } from './markDose'

const NOTIF_ID = 998888001

let lastScheduledCount = 0

/**
 * Schedule notification informando user de N mutations pendentes.
 * Chamado quando app vai pra background.
 */
export async function schedulePendingSyncNotification() {
  if (!Capacitor.isNativePlatform()) return
  let count = 0
  try { count = await getPendingQueueSize() } catch { /* fail-safe */ }
  if (count === 0) {
    // Sem pendentes — cancela qualquer notificação anterior.
    await cancelPendingSyncNotification()
    return
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID,
        title: '⚠️ Doses não sincronizadas',
        body: count === 1
          ? '1 dose marcada ainda não foi salva no servidor. Abra o Dosy para sincronizar.'
          : `${count} doses marcadas ainda não foram salvas no servidor. Abra o Dosy para sincronizar.`,
        // Dispara em 30s — dá tempo do app fechar e drain bg eventual completar.
        schedule: { at: new Date(Date.now() + 30_000) },
        smallIcon: 'ic_stat_dosy',
        channelId: 'dosy_tray',
        autoCancel: true,
        extra: { type: 'pendingSync', count },
      }],
    })
    lastScheduledCount = count
  } catch (e) {
    console.warn('[pendingSyncNotifier] schedule fail:', e?.message)
  }
}

/**
 * Cancela notification pendente. Chamado em onResume e quando queue zera.
 */
export async function cancelPendingSyncNotification() {
  if (!Capacitor.isNativePlatform()) return
  if (lastScheduledCount === 0) return  // nada pra cancelar
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] })
    lastScheduledCount = 0
  } catch (e) {
    console.warn('[pendingSyncNotifier] cancel fail:', e?.message)
  }
}
