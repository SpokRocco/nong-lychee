/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Prompt"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      colors: {
        lychee: {
          50: '#fff1f2',
          100: '#ffe0e3',
          200: '#ffc6cc',
          300: '#ff9aa5',
          400: '#fb6477',
          500: '#e93a55',
          600: '#c8213f',
          700: '#a6173a',
          800: '#8a1636',
          900: '#4a0d1f',
        },
        leaf: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#2f9e58',
          600: '#237a45',
          700: '#1c5f38',
        },
        uniform: { navy: '#1f2f5c' },
      },
      boxShadow: {
        soft: '0 10px 30px -10px rgba(200,33,63,0.35)',
      },
    },
  },
  plugins: [],
};
