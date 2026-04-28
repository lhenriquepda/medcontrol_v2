/**
 * @deprecated — Use `useNotifications` from '../services/notifications'.
 * Mantido como re-export pra compatibilidade com imports existentes.
 * Toda lógica vive em src/services/notifications.js (single source of truth).
 */
export { useNotifications as usePushNotifications } from '../services/notifications'
