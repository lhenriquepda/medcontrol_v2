// Appium login via WebView + Capacitor SecureStorage (matches app adapter)
import { remote } from 'webdriverio'

const EMAIL = process.argv[2] || 'daffiny.estevam@gmail.com'
const PASS = process.argv[3] || '123456'

const driver = await remote({
  hostname: 'localhost',
  port: 4723,
  logLevel: 'warn',
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'emulator-5554',
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,
    'appium:fullReset': false,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 180,
    'appium:chromedriverAutodownload': true,
  },
})

console.log('session OK')
await driver.pause(4500)

const wv = (await driver.getContexts()).find(c => (typeof c === 'string' ? c : c.id).startsWith('WEBVIEW'))
const wvId = typeof wv === 'string' ? wv : wv.id
await driver.switchContext(wvId)
await driver.pause(2000)

// Try multiple plugin signature variations + clear before set
const result = await driver.executeAsync(`
  const done = arguments[arguments.length - 1];
  (async () => {
    try {
      const r = await fetch('https://guefraaqbkcehofchnrc.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'apikey': 'sb_publishable_gUsNMQJJWnl9s_b3E1CSQA_OtJOK4ex', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '${EMAIL}', password: '${PASS}' })
      }).then(r => r.json());
      if (!r.access_token) return done('auth fail: ' + JSON.stringify(r));

      const session = JSON.stringify({
        access_token: r.access_token, refresh_token: r.refresh_token,
        expires_at: Math.floor(Date.now()/1000) + r.expires_in,
        expires_in: r.expires_in, token_type: 'bearer', user: r.user
      });
      const key = 'sb-guefraaqbkcehofchnrc-auth-token';
      localStorage.setItem(key, session);

      const SS = window.Capacitor?.Plugins?.SecureStorage;
      let ssStatus = 'no plugin';
      if (SS) {
        // Plugin @aparajita/capacitor-secure-storage usa API positional:
        // set(key, data) — data é stringify pelo plugin internamente.
        try { await SS.remove('sb-guefraaqbkcehofchnrc-auth-token'); } catch {}
        try {
          await SS.set('sb-guefraaqbkcehofchnrc-auth-token', session);
          ssStatus = 'set OK';
        } catch (e) {
          ssStatus = 'set fail: ' + e.message;
        }
      }

      setTimeout(() => location.reload(), 400);
      done('auth OK ' + r.user.email + ' | SS: ' + ssStatus);
    } catch (e) {
      done('exception: ' + e.message);
    }
  })();
`)
console.log(result)

await driver.pause(6000)
await driver.deleteSession()
console.log('done')
