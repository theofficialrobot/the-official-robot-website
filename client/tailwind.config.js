/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        soft: 'var(--bg-soft)',
        elevated: 'var(--bg-elevated)',
        card: 'var(--bg-card)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        dim: 'var(--text-dim)',
        accent: 'var(--accent)',
        'accent-bright': 'var(--accent-bright)',
        'accent-deep': 'var(--accent-deep)',
        purple: 'var(--purple)',
        green: 'var(--green)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif']
      },
      boxShadow: {
        or: '0 10px 40px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
        'or-lg': '0 25px 60px rgba(15,23,42,0.08), 0 10px 25px rgba(15,23,42,0.05)'
      },
      borderRadius: {
        or: '20px',
        'or-sm': '12px'
      }
    }
  },
  plugins: []
};
