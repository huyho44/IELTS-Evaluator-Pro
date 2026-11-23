/** @type {import('tailwindcss').Config} */

// `brand` is resolved per workspace through CSS variables (see src/index.css):
// student = cobalt, instructor = teal, admin = graphite. Components use
// `brand-*` and inherit the right hue from the nearest [data-workspace].
const brandShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const brand = Object.fromEntries(
  brandShades.map((shade) => [
    shade,
    `rgb(var(--brand-${shade}) / <alpha-value>)`,
  ]),
);
brand.DEFAULT = brand[600];

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        // Neutral page canvas, slightly cooler than slate-50.
        canvas: '#F6F8FB',
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        '2xs': '0 1px 1px 0 rgb(15 23 42 / 0.04)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05)',
        raised:
          '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        popover:
          '0 12px 32px -8px rgb(15 23 42 / 0.18), 0 4px 8px -4px rgb(15 23 42 / 0.08)',
      },
      letterSpacing: {
        tighter: '-0.025em',
        tight: '-0.012em',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'pop-in': 'pop-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
