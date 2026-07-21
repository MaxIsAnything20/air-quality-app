/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aqi: {
          good: '#3B9E5F',
          moderate: '#C99A2E',
          sensitive: '#D2762E',
          unhealthy: '#C24545',
          veryunhealthy: '#8A4FA0',
          hazardous: '#6E2E36'
        },
        ink: {
          900: '#1A1A18',
          600: '#57564F',
          400: '#8B8A82',
          200: '#D8D6CC',
          100: '#EFEDE4'
        },
        night: {
          900: '#14140F',
          800: '#1E1E17',
          700: '#26261D',
          600: '#35352A',
          500: '#4A4A3B',
          400: '#85846F',
          200: '#B8B6A8',
          100: '#F2F0E6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
