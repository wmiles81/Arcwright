/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'g-bg': 'var(--g-bg)',
        'g-text': 'var(--g-text)',
        'g-chrome': 'var(--g-chrome)',
        'g-border': 'var(--g-chrome-border)',
        'g-muted': 'var(--g-chrome-text)',
        'g-status': 'var(--g-status-text)',
        'g-accent': 'var(--g-accent)',
      },
    },
  },
  plugins: [],
};
