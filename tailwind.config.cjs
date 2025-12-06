/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          'bg-primary': 'var(--bg-primary)',
          'bg-secondary': 'var(--bg-secondary)',
          'bg-tertiary': 'var(--bg-tertiary)',
          'bg-elevated': 'var(--bg-elevated)',
          'bg-hover': 'var(--bg-hover)',
          'border-primary': 'var(--border-primary)',
          'border-secondary': 'var(--border-secondary)',
          'border-muted': 'var(--border-muted)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'text-inverse': 'var(--text-inverse)',
        }
      },
      animation: {
        'bounce': 'bounce 1s infinite',
        'spin-slow': 'spin 10s linear infinite',
      },
      keyframes: {
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
