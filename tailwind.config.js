/** @type {import('tailwindcss').Config} */
/*
 * Tailwind colors mapeadas pra CSS vars (definidas em src/styles/theme.css).
 * Resultado: classes como `bg-brand-600`, `text-brand-300` continuam funcionando,
 * mas pegam valores do theme.css. Editar cor → theme.css → app inteiro muda.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)',
          400: 'var(--color-brand-400)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)',
          900: 'var(--color-brand-900)'
        }
      },
      fontFamily: {
        sans: ['var(--font-family)', 'Inter', 'system-ui', 'sans-serif']
      },
      // Border radius scale -30% global (app menos arredondado).
      // Sobrescreve defaults Tailwind. `rounded-full` mantido (pílulas/avatares).
      borderRadius: {
        none: '0',
        sm: '0.0875rem',     // 1.4px (was 2px)
        DEFAULT: '0.175rem', // 2.8px (was 4px)
        md: '0.2625rem',     // 4.2px (was 6px)
        lg: '0.35rem',       // 5.6px (was 8px)
        xl: '0.525rem',      // 8.4px (was 12px)
        '2xl': '0.7rem',     // 11.2px (was 16px)
        '3xl': '1.05rem',    // 16.8px (was 24px)
        full: '9999px'
      }
    }
  },
  plugins: []
}
