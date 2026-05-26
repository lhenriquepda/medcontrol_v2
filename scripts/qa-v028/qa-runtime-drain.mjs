// QA RUNTIME drain test — app aberto, populate queue, watchdog deve drenar em <10s
import { connect, sleep } from './qa-cdp-helpers.mjs';
import { spawn } from 'child_process';

const { evalCDP } = await connect(9222);

// Start logcat ANTES de populate pra capturar tudo
const logcatProc = spawn('adb', ['-s', 'emulator-5554', 'logcat', '-T', '1', 'Capacitor/Console:I', '*:S']);
const startTs = Date.now();
logcatProc.stdout.on('data', (data) => {
  const line = data.toString();
  if (/drain|trigger via|queue size/i.test(line)) {
    console.log(`[t+${Date.now()-startTs}ms]`, line.trim().slice(0, 200));
  }
});

console.log('App está aberto. Populando queue com 2 entries DIRETAMENTE (simulando RPC que falhou)...');
const pop = await evalCDP(`(async () => {
  const entries = [
    { requestId: crypto.randomUUID(), doseId: '985d5c7b-1cb4-47f9-afc0-7eb8914e8055', action: 'skip', payload: {observation:'runtime test'}, createdAt: Date.now(), retryCount: 0 },
    { requestId: crypto.randomUUID(), doseId: '70ff05f4-b339-4ed4-b2e9-36f954f04d1d', action: 'skip', payload: {observation:'runtime test'}, createdAt: Date.now(), retryCount: 0 },
  ];
  await window.Capacitor.Plugins.Preferences.set({ key: 'dosy_pending_mutations', value: JSON.stringify(entries) });
  return { count: entries.length, ts: Date.now() };
})()`);
console.log(`[t+${Date.now()-startTs}ms] populate done:`, JSON.stringify(pop));

console.log('Waiting 30s para watchdog detectar + drenar...');
await sleep(30000);

// Check queue state
const final = await evalCDP(`(async () => {
  const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
  const arr = JSON.parse(v.value || '[]');
  return { count: arr.length, entries: arr };
})()`);
console.log(`[t+${Date.now()-startTs}ms] final queue:`, JSON.stringify(final));

logcatProc.kill();
process.exit(0);
