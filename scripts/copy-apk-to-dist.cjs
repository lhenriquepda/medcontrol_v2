#!/usr/bin/env node
/**
 * Copies the freshly-built signed APK from android/app/release/ into dist/
 * AFTER `npm run build && npx cap sync android` ran. APK lives in dist/ only
 * for Vercel deploy — it never enters public/ (Vite would forward it to dist
 * before cap sync, recursively bloating each subsequent APK build).
 *
 * Usage:
 *   1. Edit code
 *   2. npm run build && npx cap sync android       (no APK in android assets)
 *   3. Studio Build → Generate Signed APK release  (clean ~10-15MB APK)
 *   4. node scripts/copy-apk-to-dist.cjs           (copies APK → dist/)
 *   5. vercel deploy --prod
 */
const fs = require('fs')
const path = require('path')

const APK_SRC = path.resolve('android/app/release/app-release.apk')
const APK_DST = path.resolve('dist/dosy-beta.apk')
const DIST_DIR = path.resolve('dist')

if (!fs.existsSync(DIST_DIR)) {
  console.error('[copy-apk] dist/ does not exist. Run `npm run build` first.')
  process.exit(1)
}

if (!fs.existsSync(APK_SRC)) {
  console.error('[copy-apk] APK not found at', APK_SRC)
  console.error('  Build APK in Android Studio first (Build → Generate Signed Bundle / APK → APK → release)')
  process.exit(1)
}

fs.copyFileSync(APK_SRC, APK_DST)
const sizeMB = (fs.statSync(APK_DST).size / 1024 / 1024).toFixed(1)
console.log(`[copy-apk] copied → dist/dosy-beta.apk (${sizeMB} MB)`)
