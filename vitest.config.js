import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/App.jsx',
        'src/**/*.test.{js,jsx}',
        'src/data/**',
        'src/services/mockStore.js'
      ],
      // Thresholds desabilitados globalmente. Aud 4.5.6 alvo: utils ≥90%, resto ≥70%.
      // Aplicar threshold por path quando coverage UI/hooks crescer.
      thresholds: {
        // Núcleo crítico — apertar conforme adiciona tests
        'src/utils/**': { lines: 80, functions: 80, branches: 70, statements: 80 }
      }
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify('test')
  }
})
