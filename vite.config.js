import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

/**
 * Plugin: emits public version.json on each build.
 * App fetches /version.json at runtime to detect new releases.
 */
function dosyVersionJsonPlugin() {
  return {
    name: 'dosy-version-json',
    closeBundle() {
      const out = resolve('dist/version.json')
      const payload = {
        version: pkg.version,
        buildDate: new Date().toISOString(),
        apkUrl: '/dosy-beta.apk',
        installUrl: '/install'
      }
      writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8')
      console.log(`[version.json] emitted v${pkg.version}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), dosyVersionJsonPlugin()],
  server: { host: true, port: 5173 },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  }
})
