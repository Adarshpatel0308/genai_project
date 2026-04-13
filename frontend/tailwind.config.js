/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1d4ed8',
          600: '#1e40af',
          700: '#1e3a8a',
          800: '#1e3060',
          900: '#0f1629',
        },
        'surface-bg':       '#0a0f1e',
        'surface-card':     '#0f1629',
        'surface-elevated': '#162040',
        'surface-border':   '#1e3a5f',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6C3FC5 0%, #a07aff 50%, #F59E0B 100%)',
        'gradient-hero':  'radial-gradient(ellipse at 20% 50%, rgba(108,63,197,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.2) 0%, transparent 50%)',
      },
      animation: {
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'slide-up':   'slideUp 0.5s ease-out',
        'fade-in':    'fadeIn 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
