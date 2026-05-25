// Stress test BUG #0031: 3 entries simultâneas via Preferences + force-restart + observa logcat
import { connect, sleep } from './qa-cdp-helpers.mjs';
import { execSync, spawn } from 'child_process';

const { evalCDP } = await connect(9222);

// Populate queue com 3 entries pra teste parallel
const populate = await evalCDP(`(async () => {
  const entries = [
    { requestId: crypto.randomUUID(), doseId: '256da164-8876-4220-80db-bc68458693f4', action: 'confirm', payload: {actualTime: new Date().toISOString()}, createdAt: Date.now(), retryCount: 0 },
    { requestId: crypto.randomUUID(), doseId: '985d5c7b-1cb4-47f9-afc0-7eb8914e8055', action: 'skip', payload: {observation: 'QA stress'}, createdAt: Date.now(), retryCount: 0 },
    { requestId: crypto.randomUUID(), doseId: '70ff05f4-b339-4ed4-b2e9-36f954f04d1d', action: 'skip', payload: {observation: 'QA stress'}, createdAt: Date.now(), retryCount: 0 },
  ];
  await window.Capacitor.Plugins.Preferences.set({ key: 'dosy_pending_mutations', value: JSON.stringify(entries) });
  const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
  return { written: JSON.parse(v.value).length };
})()`);
console.log('populated:', JSON.stringify(populate));

await sleep(4000);
execSync('adb -s emulator-5554 shell am force-stop com.dosyapp.dosy.dev');
await sleep(2000);

const logcatProc = spawn('adb', ['-s', 'emulator-5554', 'logcat', '-T', '1', 'Capacitor/Console:I', '*:S']);
let logs = '';
const startTs = Date.now();
logcatProc.stdout.on('data', (data) => {
  const line = data.toString();
  if (/drain/i.test(line)) {
    logs += `[t+${Date.now()-startTs}ms] ${line}`;
    console.log(`[t+${Date.now()-startTs}ms]`, line.trim().slice(0, 200));
  }
});

execSync('adb -s emulator-5554 shell am start -n com.dosyapp.dosy.dev/com.dosyapp.dosy.MainActivity');
console.log('waiting 30s for drain...');
await sleep(30000);
logcatProc.kill();

console.log('\n=== Stress test complete ===');
process.exit(0);
