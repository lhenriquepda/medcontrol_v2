// Investiga + força online state no emul
import { connect, sleep } from './qa-cdp-helpers.mjs';

const { evalCDP } = await connect(9222);

const inspect = await evalCDP(`(async () => {
  const r = {};
  r.navOnline = navigator.onLine;
  try {
    const k = await window.Capacitor?.Plugins?.Preferences?.keys?.();
    r.allKeys = k?.keys || [];
    if ((k?.keys||[]).includes('dosy_pending_mutations')) {
      const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
      const arr = JSON.parse(v.value || '[]');
      r.queueLen = arr.length;
      r.queueEntries = arr.slice(0,3);
    }
  } catch (e) { r.err = e?.message; }
  // Dispatch online event
  window.dispatchEvent(new Event('online'));
  return r;
})()`);
console.log('inspect:', JSON.stringify(inspect, null, 2));

await sleep(3000);

const post = await evalCDP(`(async () => {
  try {
    const k = await window.Capacitor?.Plugins?.Preferences?.keys?.();
    if ((k?.keys||[]).includes('dosy_pending_mutations')) {
      const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
      const arr = JSON.parse(v.value || '[]');
      return { queueLen: arr.length, queueEntries: arr.slice(0,3) };
    }
    return { noQueue: true };
  } catch (e) { return { err: e?.message }; }
})()`);
console.log('post online dispatch:', JSON.stringify(post, null, 2));

process.exit(0);
