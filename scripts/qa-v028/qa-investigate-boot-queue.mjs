// Investiga boot queue state real
import { connect, sleep } from './qa-cdp-helpers.mjs';

const { evalCDP } = await connect(9222);

// Inspect queue, online status, navigator
const debug = await evalCDP(`(async () => {
  const r = { ts: Date.now() };
  r.navOnline = navigator.onLine;
  try {
    const keys = await window.Capacitor?.Plugins?.Preferences?.keys?.();
    r.prefsKeys = keys?.keys || [];
    if ((keys?.keys||[]).includes('dosy_pending_mutations')) {
      const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
      const arr = JSON.parse(v.value || '[]');
      r.queueLen = arr.length;
      r.queue = arr;
    }
    if ((keys?.keys||[]).find(k => /sb-.*-auth-token/.test(k))) {
      const authKey = (keys.keys || []).find(k => /sb-.*-auth-token/.test(k));
      const auth = await window.Capacitor.Plugins.Preferences.get({ key: authKey });
      const a = JSON.parse(auth.value || '{}');
      r.user = a?.user?.email;
      r.expiresAt = a?.expires_at;
      r.nowSec = Math.floor(Date.now() / 1000);
      r.secsUntilExpiry = (a?.expires_at || 0) - r.nowSec;
    }
  } catch (e) { r.err = e?.message; }
  return r;
})()`);

console.log(JSON.stringify(debug, null, 2));
process.exit(0);
