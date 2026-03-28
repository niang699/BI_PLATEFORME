/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        senblue: {
          50:  '#eef2fb',
          100: '#ccd7f0',
          200: '#99b0e1',
          300: '#6689d2',
          400: '#3362c3',
          500: '#1F3B72',
          600: '#192f5c',
          700: '#132346',
          800: '#0d1730',
          900: '#060b18',
        },
        sengreen: {
          50:  '#f3f9e6',
          100: '#d9edac',
          200: '#c0e173',
          300: '#a6d539',
          400: '#96C11E',
          500: '#7aa018',
          600: '#608013',
          700: '#47600e',
          800: '#2d3f09',
          900: '#141f05',
        },
        senred: {
          400: '#E84040',
          500: '#d63030',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'card':  '0 2px 4px rgba(31,59,114,0.06), 0 8px 20px rgba(31,59,114,0.10)',
        'card-hover': '0 4px 8px rgba(31,59,114,0.10), 0 16px 40px rgba(31,59,114,0.18)',
        'fab': '0 4px 12px rgba(31,59,114,0.4)',
      },
      animation: {
        'slide-up': 'slideUp .4s ease',
        'fade-in':  'fadeIn .3s ease',
        'pulse-dot': 'pulseDot 1.5s infinite',
        'shimmer':   'shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        shimmer: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
