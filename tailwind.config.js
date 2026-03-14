/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // NEU Navy — dominant brand color
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#1a3a6b',   // core navy
          600: '#162f58',   // deep navy
          700: '#112447',   // darker navy
          800: '#0d1b36',   // near-black navy
          900: '#080f1f',   // darkest
        },
        // NEU Gold — accent
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        // Navy surface variants for cards/panels
        navy: {
          50:  '#f0f4ff',
          100: '#dce6f9',
          200: '#b3c8f0',
          300: '#7a9fd8',
          400: '#4677c0',
          500: '#1a3a6b',
          600: '#152f58',
          700: '#0f2244',
          800: '#0a1730',
          900: '#060e1e',
        },
        // Accent stripe colors (NEU building stripes)
        stripe: {
          red:    '#c0392b',
          gold:   '#f39c12',
          green:  '#27ae60',
          blue:   '#2980b9',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"Inter"', '"Poppins"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        'card':        '0 1px 4px 0 rgb(0 0 0 / 0.18), 0 1px 2px -1px rgb(0 0 0 / 0.12)',
        'card-hover':  '0 6px 20px 0 rgb(0 0 0 / 0.22), 0 2px 6px -1px rgb(0 0 0 / 0.14)',
        'navy':        '0 4px 16px 0 rgb(10 23 48 / 0.35)',
        'glow-gold':   '0 0 20px 2px rgb(245 158 11 / 0.25)',
      },
      backgroundImage: {
        'navy-gradient':  'linear-gradient(135deg, #0d1b36 0%, #1a3a6b 100%)',
        'gold-gradient':  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'stripe-bar':     'linear-gradient(90deg, #c0392b 0%, #c0392b 25%, #f39c12 25%, #f39c12 50%, #27ae60 50%, #27ae60 75%, #2980b9 75%, #2980b9 100%)',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
}
