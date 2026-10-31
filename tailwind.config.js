/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    screens: {
      xs: '360px',
      sm: '600px',
      md: '900px',
      lg: '1000px',
      xl: '1500px',
    },
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        ink: 'var(--ink)',
        mute: 'var(--mute)',
        line: 'var(--line)',
        acc: 'var(--acc)',
        accsoft: 'var(--accsoft)',
        warn: 'var(--warn)',
        warnsoft: 'var(--warnsoft)',
        bad: 'var(--bad)',
        badsoft: 'var(--badsoft)',
        on: 'var(--on)',
      },
      fontFamily: {
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        head: ['var(--font-head)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: 'var(--shadow)',
      },
      backgroundImage: {
        stockroom: 'var(--grad)',
      },
      keyframes: {
        fadeup: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        live: {
          '0%': { boxShadow: '0 0 0 0 rgba(124,255,178,.7)' },
          '70%, 100%': { boxShadow: '0 0 0 8px rgba(124,255,178,0)' },
        },
      },
      animation: {
        fadeup: 'fadeup .45s ease both',
        live: 'live 1.8s infinite',
      },
    },
  },
  plugins: [],
}
