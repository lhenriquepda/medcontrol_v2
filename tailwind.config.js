/** @type {import('tailwindcss').Config} */
/*
 * Tailwind colors mapeadas pra CSS vars (definidas em src/styles/theme.css
 * para legacy + src/styles/dosy-tokens.css para v0.2.0.0 redesign).
 *
 * LEGACY (theme.css):
 *   bg-brand-{50..900}, text-brand-*, ring-brand-*
 *
 * DOSY (dosy-tokens.css):
 *   bg-dosy-bg, bg-dosy-bg-elevated, bg-dosy-peach-100, bg-dosy-sunset-1/40,
 *   text-dosy-fg, text-dosy-fg-secondary, shadow-dosy-md, font-display,
 *   bg-dosy-sunset (gradient), animate-dosy-fade-in, etc.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Legacy brand (theme.css) ────────────────────────────
        brand: {
          50:  'rgb(var(--color-brand-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900-rgb) / <alpha-value>)'
        },
        // ── Dosy v0.2.0.0 redesign (dosy-tokens.css) ────────────
        // Warm fintech / wellness. Sunset signature gradient.
        dosy: {
          bg: 'var(--dosy-bg)',
          'bg-elevated': 'var(--dosy-bg-elevated)',
          'bg-sunken': 'var(--dosy-bg-sunken)',
          fg: 'var(--dosy-fg)',
          'fg-secondary': 'var(--dosy-fg-secondary)',
          'fg-tertiary': 'var(--dosy-fg-tertiary)',
          'fg-disabled': 'var(--dosy-fg-disabled)',
          'fg-on-sunset': 'var(--dosy-fg-on-sunset)',
          primary: 'var(--dosy-primary)',
          'primary-hover': 'var(--dosy-primary-hover)',
          'primary-press': 'var(--dosy-primary-press)',
          'sunset-1': 'rgb(var(--dosy-sunset-1-rgb) / <alpha-value>)',
          'sunset-2': 'rgb(var(--dosy-sunset-2-rgb) / <alpha-value>)',
          'sunset-3': 'rgb(var(--dosy-sunset-3-rgb) / <alpha-value>)',
          peach: {
            50:  'var(--dosy-peach-50)',
            100: 'var(--dosy-peach-100)',
            200: 'var(--dosy-peach-200)',
            300: 'var(--dosy-peach-300)',
            400: 'var(--dosy-peach-400)'
          },
          success: 'var(--dosy-success)',
          'success-bg': 'var(--dosy-success-bg)',
          warning: 'var(--dosy-warning)',
          'warning-bg': 'var(--dosy-warning-bg)',
          danger: 'var(--dosy-danger)',
          'danger-bg': 'var(--dosy-danger-bg)',
          info: 'var(--dosy-info)',
          'info-bg': 'var(--dosy-info-bg)',
          border: 'var(--dosy-border)',
          'border-strong': 'var(--dosy-border-strong)',
          divider: 'var(--dosy-divider)'
        }
      },
      fontFamily: {
        sans: ['var(--font-family)', 'Inter', 'system-ui', 'sans-serif'],
        // Dosy display + body — Manrope (Gilroy substitute)
        display: ['Manrope', 'Gilroy', 'system-ui', 'sans-serif'],
        dosy: ['Manrope', 'Gilroy', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'dosy-sunset': 'var(--dosy-gradient-sunset)',
        'dosy-sunset-soft': 'var(--dosy-gradient-sunset-soft)',
        'dosy-sunset-radial': 'var(--dosy-gradient-sunset-radial)'
      },
      boxShadow: {
        'dosy-xs': 'var(--dosy-shadow-xs)',
        'dosy-sm': 'var(--dosy-shadow-sm)',
        'dosy-md': 'var(--dosy-shadow-md)',
        'dosy-lg': 'var(--dosy-shadow-lg)',
        'dosy-sunset': 'var(--dosy-shadow-sunset)'
      },
      transitionTimingFunction: {
        'dosy-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'dosy-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)'
      },
      keyframes: {
        'dosy-fade-in': {
          from: { opacity: 0 },
          to:   { opacity: 1 }
        },
        'dosy-slide-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' }
        },
        'dosy-slide-down': {
          from: { transform: 'translateY(-12px)', opacity: 0 },
          to:   { transform: 'translateY(0)', opacity: 1 }
        },
        'dosy-pop': {
          '0%':   { transform: 'scale(0.92)', opacity: 0 },
          '60%':  { transform: 'scale(1.02)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        },
        'dosy-pulse-ring': {
          '0%':   { transform: 'scale(1)', opacity: 0.7 },
          '100%': { transform: 'scale(1.6)', opacity: 0 }
        }
      },
      animation: {
        'dosy-fade-in': 'dosy-fade-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'dosy-slide-up': 'dosy-slide-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'dosy-slide-down': 'dosy-slide-down 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'dosy-pop': 'dosy-pop 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'dosy-pulse-ring': 'dosy-pulse-ring 1.4s ease-out infinite'
      },
      // Border radius — escala -30% legacy preservada. Dosy usa rounded-dosy-*.
      borderRadius: {
        none: '0',
        sm: '0.0875rem',     // 1.4px (was 2px)
        DEFAULT: '0.175rem', // 2.8px (was 4px)
        md: '0.2625rem',     // 4.2px (was 6px)
        lg: '0.35rem',       // 5.6px (was 8px)
        xl: '0.525rem',      // 8.4px (was 12px)
        '2xl': '0.7rem',     // 11.2px (was 16px)
        '3xl': '1.05rem',    // 16.8px (was 24px)
        full: '9999px',
        // Dosy generosos (não-reduzidos)
        'dosy-xs':   '6px',
        'dosy-sm':   '12px',
        'dosy-md':   '16px',
        'dosy-lg':   '24px',
        'dosy-xl':   '32px',
        'dosy-pill': '9999px'
      }
    }
  },
  plugins: []
}
