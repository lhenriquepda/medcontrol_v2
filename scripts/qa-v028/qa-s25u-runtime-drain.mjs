// QA RUNTIME drain test S25U — pós force-kill + abrir + popula queue + watch drain
import { connect, sleep } from './qa-cdp-helpers.mjs';
import { spawn, execSync } from 'child_process';

const { evalCDP } = await connect(9223);

// Confirma logged user
const user = await evalCDP(`(async () => {
  const k = await window.Capacitor?.Plugins?.Preferences?.keys?.();
  const authKey = (k?.keys || []).find(x => /sb-.*-auth-token/.test(x));
  if (!authKey) return { user: null };
  const v = await window.Capacitor.Plugins.Preferences.get({ key: authKey });
  return { user: JSON.parse(v.value || '{}')?.user?.email };
})()`);
console.log('S25U user:', JSON.stringify(user));

// Start logcat capture
const logcatProc = spawn('adb', ['-s', 'RXCY308LH0L', 'logcat', '-T', '1', 'Capacitor/Console:I', '*:S']);
const startTs = Date.now();
logcatProc.stdout.on('data', (data) => {
  const line = data.toString();
  if (/drain|trigger via|queue size/i.test(line)) {
    console.log(`[t+${Date.now()-startTs}ms]`, line.trim().slice(0, 200));
  }
});

console.log('Populando queue S25U com 2 entries DIRETAMENTE (simula RPC que falhou)...');
const pop = await evalCDP(`(async () => {
  const entries = [
    { requestId: crypto.randomUUID(), doseId: '985d5c7b-1cb4-47f9-afc0-7eb8914e8055', action: 'skip', payload: {observation:'S25U runtime test'}, createdAt: Date.now(), retryCount: 0 },
    { requestId: crypto.randomUUID(), doseId: '70ff05f4-b339-4ed4-b2e9-36f954f04d1d', action: 'skip', payload: {observation:'S25U runtime test'}, createdAt: Date.now(), retryCount: 0 },
  ];
  await window.Capacitor.Plugins.Preferences.set({ key: 'dosy_pending_mutations', value: JSON.stringify(entries) });
  const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
  return { count: JSON.parse(v.value).length, ts: Date.now() };
})()`);
console.log(`[t+${Date.now()-startTs}ms] populate done:`, JSON.stringify(pop));

console.log('Waiting 30s para drain disparar (watchdog + onlineManager subscribe)...');
await sleep(30000);

const final = await evalCDP(`(async () => {
  const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
  const arr = JSON.parse(v.value || '[]');
  return { count: arr.length, entries: arr.map(e => ({doseId: e.doseId, retryCount: e.retryCount})) };
})()`);
console.log(`[t+${Date.now()-startTs}ms] final queue:`, JSON.stringify(final));

logcatProc.kill();
process.exit(0);
