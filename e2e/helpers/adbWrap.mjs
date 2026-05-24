// MEL-006 v0.2.6.11 — adb wrapper helpers.
// Fallback pra gestos quando mobile: commands não cobrem (ex: dragDrop preciso, multi-touch).
import { execSync } from 'node:child_process'

const SERIAL = process.env.DOSY_E2E_DEVICE
  ? `emulator-${process.env.DOSY_E2E_DEVICE}`
  : 'emulator-5554'

export function adbTap(x, y, serial = SERIAL) {
  execSync(`adb -s ${serial} shell input tap ${x} ${y}`)
}

export function adbSwipe(x1, y1, x2, y2, durationMs = 300, serial = SERIAL) {
  execSync(`adb -s ${serial} shell input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`)
}

export function adbKey(keycode, serial = SERIAL) {
  execSync(`adb -s ${serial} shell input keyevent ${keycode}`)
}

export function adbBack(serial = SERIAL) { adbKey('KEYCODE_BACK', serial) }
export function adbHome(serial = SERIAL) { adbKey('KEYCODE_HOME', serial) }

/** Limpa estado app (cache + storage) — usar antes de specs que precisam fresh launch */
export function resetAppData(pkg = 'com.dosyapp.dosy.dev', serial = SERIAL) {
  execSync(`adb -s ${serial} shell pm clear ${pkg}`)
  execSync(`adb -s ${serial} shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`)
}

/** Tira screenshot do device. Path host. */
export function adbScreenshot(hostPath, serial = SERIAL) {
  execSync(`adb -s ${serial} shell screencap -p /sdcard/screen.png`)
  execSync(`adb -s ${serial} pull /sdcard/screen.png "${hostPath}"`)
}
