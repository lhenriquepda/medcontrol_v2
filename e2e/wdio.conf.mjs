// MEL-006 v0.2.6.11 — wdio config Dosy e2e.
// Default 1 capability emul-5554; setar DOSY_E2E_DEVICE=5556 pra outro emul.
// 2 capabilities paralelas requer 2 Appium servers (port 4723 + 4724).
const device = process.env.DOSY_E2E_DEVICE || '5554'
const appPath = process.env.DOSY_E2E_APK || '../android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'

export const config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.mjs'],
  exclude: [],
  maxInstances: 1,
  capabilities: [{
    platformName: 'Android',
    'appium:deviceName': `emulator-${device}`,
    'appium:udid': `emulator-${device}`,
    'appium:platformVersion': '14',
    'appium:automationName': 'UiAutomator2',
    'appium:appPackage': 'com.dosyapp.dosy.dev',
    'appium:appActivity': 'com.dosyapp.dosy.MainActivity',
    'appium:noReset': true,           // preserva estado entre specs
    'appium:autoWebview': false,      // hybrid switch manual — ver autowebview-spike-decision.md
    'appium:newCommandTimeout': 120,
    'appium:adbExecTimeout': 60_000,
  }],
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,
  services: [['appium', {
    args: { address: '127.0.0.1', port: 4723 + (device === '5556' ? 1 : 0) }
  }]],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 120_000 },
}
