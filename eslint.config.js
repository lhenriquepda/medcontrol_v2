// ESLint 9 flat config
import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly',
        fetch: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        Notification: 'readonly', atob: 'readonly', btoa: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly',
        Intl: 'readonly', crypto: 'readonly',
        Uint8Array: 'readonly',
        // Vite define
        __APP_VERSION__: 'readonly',
        // Node (vite.config.js, scripts/)
        process: 'readonly', require: 'readonly', module: 'readonly',
        __dirname: 'readonly', __filename: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'warn',
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',  // regra nova react-hooks 7, agressiva
      'react-hooks/purity': 'warn',  // Date.now() / Math.random() em render — mostly cosmetic
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off'  // muitos globals dinâmicos (Capacitor, etc)
    },
    settings: { react: { version: 'detect' } }
  },
  prettier,
  // Gemini Fase 5 (v0.2.8.2): folder boundaries — UI (pages + components) não importa
  // @supabase/supabase-js nem @capacitor/* direto. Devem usar wrappers em src/services
  // (services agnostic) ou src/core/* (entityFactory + realtime manager).
  // Iniciado como WARN — devs migram gradualmente conforme tocarem nos arquivos.
  // Subir pra ERROR em release futura quando toda UI estiver limpa.
  {
    files: ['src/pages/**/*.{js,jsx}', 'src/components/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: [
          { name: '@supabase/supabase-js', message: 'UI não importa Supabase direto. Use wrappers em src/services/ ou src/core/.' },
          { name: '@capacitor/preferences', message: 'UI não importa Capacitor direto. Use wrappers em src/services/ ou src/state/.' },
          { name: '@capacitor/filesystem', message: 'UI não importa Capacitor direto. Use wrappers em src/services/.' },
          { name: '@capacitor/network', message: 'UI não importa Capacitor direto. Use wrappers em src/services/.' },
          { name: '@aparajita/capacitor-secure-storage', message: 'UI não importa SecureStorage direto. Use wrappers em src/services/.' },
        ],
        patterns: [
          {
            group: ['../services/supabase', '../../services/supabase'],
            message: 'UI deve passar por hooks (useDoses/usePatients/etc) ou services específicos — não tocar supabase client direto.',
            allowTypeImports: false,
          },
        ],
      }],
    },
  },
  {
    ignores: [
      'dist/**', 'android/**', 'node_modules/**',
      '.vercel/**', 'tools/**', 'scripts/**',
      'supabase/migrations/**'
    ]
  }
]
