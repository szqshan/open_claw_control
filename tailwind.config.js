/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f97316',
          dark: '#0f0f0f',
          card: '#1a1a1a',
          border: '#2a2a2a',
        }
      },
      fontFamily: {
        mono: ['Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      animation: {
        'spin-fast': 'spin 0.6s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
