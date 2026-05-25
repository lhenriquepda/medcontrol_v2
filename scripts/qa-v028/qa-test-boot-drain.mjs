// Test BUG #0031 boot drain — popula queue artificialmente + force-restart + observa logcat
import { connect, sleep } from './qa-cdp-helpers.mjs';
import { execSync, spawn } from 'child_process';

const { evalCDP } = await connect(9222);

// Pre-populate queue com 2 entries
const populate = await evalCDP(`(async () => {
  const entries = [
    { requestId: crypto.randomUUID(), doseId: '985d5c7b-1cb4-47f9-afc0-7eb8914e8055', action: 'skip', payload: {observation: 'QA boot test'}, createdAt: Date.now(), retryCount: 0 },
    { requestId: crypto.randomUUID(), doseId: '70ff05f4-b339-4ed4-b2e9-36f954f04d1d', action: 'skip', payload: {observation: 'QA boot test'}, createdAt: Date.now(), retryCount: 0 },
  ];
  await window.Capacitor.Plugins.Preferences.set({ key: 'dosy_pending_mutations', value: JSON.stringify(entries) });
  const v = await window.Capacitor.Plugins.Preferences.get({ key: 'dosy_pending_mutations' });
  return { written: JSON.parse(v.value).length };
})()`);
console.log('populated:', JSON.stringify(populate));

// Aguarda 4s pro SharedPreferences flush para disk (apply() async)
console.log('waiting 4s for SharedPreferences disk flush...');
await sleep(4000);

// Force-restart app
console.log('force-stop + restart...');
execSync('adb -s emulator-5554 shell am force-stop com.dosyapp.dosy.dev');
await sleep(2000);

// Spawn logcat in background to capture drain logs
const logcatProc = spawn('adb', ['-s', 'emulator-5554', 'logcat', '-T', '1', 'Capacitor/Console:I', '*:S']);
let logs = '';
logcatProc.stdout.on('data', (data) => {
  const line = data.toString();
  if (/drain|queue|Sincroniz/i.test(line)) {
    logs += line;
    console.log('LOGCAT:', line.trim());
  }
});

// Restart app
execSync('adb -s emulator-5554 shell am start -n com.dosyapp.dosy.dev/com.dosyapp.dosy.MainActivity');

// Wait 45s for boot drain completion
console.log('waiting 45s for boot drain...');
await sleep(45000);

logcatProc.kill();

// Check final queue state via SQL (need to connect to fresh CDP target post-restart)
// For now just dump logs
console.log('\n=== LOGS captured ===');
console.log(logs);
process.exit(0);
