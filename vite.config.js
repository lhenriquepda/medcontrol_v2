import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
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
        installUrl: '/install',
      }
      writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8')
      console.log(`[version.json] emitted v${pkg.version}`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
  const SENTRY_ORG = process.env.SENTRY_ORG
  const SENTRY_PROJECT = process.env.SENTRY_PROJECT

  return {
    plugins: [
      react(),
      dosyVersionJsonPlugin(),
      // Aud 4.5.7 G1 — upload source maps pra Sentry decodar stack traces em prod.
      // Só ativa quando SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT estão setados (CI).
      isProd &&
        SENTRY_AUTH_TOKEN &&
        SENTRY_ORG &&
        SENTRY_PROJECT &&
        sentryVitePlugin({
          authToken: SENTRY_AUTH_TOKEN,
          org: SENTRY_ORG,
          project: SENTRY_PROJECT,
          release: { name: `dosy@${pkg.version}` },
          sourcemaps: { assets: './dist/**' },
          telemetry: false,
        }),
    ].filter(Boolean),
    server: { host: true, port: 5173 },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      // Aud 4.5.7 G1: source maps gerados pra upload Sentry. Excluídos do client final.
      sourcemap: isProd ? 'hidden' : 'inline',
      // Aud 4.5.1 G5 — strip console.log/warn/info/debug via Terser.
      minify: isProd ? 'terser' : 'esbuild',
      terserOptions: isProd
        ? {
            compress: {
              pure_funcs: ['console.log', 'console.warn', 'console.info', 'console.debug'],
              drop_debugger: true,
            },
          }
        : undefined,
      rollupOptions: {
        output: {
          // Aud 4.5.5 G3 — manualChunks pra separar vendor de app code.
          // Cache hit em vendor não-mudado entre builds → user re-baixa só app chunk.
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined
            // Heavy libs com dynamic import — deixa rollup criar chunks separados (Reports route)
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) {
              return undefined
            }
            if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('react-router')) return 'vendor-react'
            if (/[\\/]react[\\/]/.test(id)) return 'vendor-react'
            if (id.includes('@supabase') || id.includes('@tanstack')) return 'vendor-data'
            if (id.includes('@sentry')) return 'vendor-sentry'
            if (id.includes('@capacitor')) return 'vendor-capacitor'
            if (id.includes('lucide-react')) return 'vendor-icons'
            return 'vendor'
          },
        },
      },
    },
  }
})
