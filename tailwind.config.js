/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    borderRadius: {
      none:    '0px',
      sm:      '0.0625rem', // 1px  (era 2px)
      DEFAULT: '0.125rem',  // 2px  (era 4px)
      md:      '0.1875rem', // 3px  (era 6px)
      lg:      '0.25rem',   // 4px  (era 8px)
      xl:      '0.375rem',  // 6px  (era 12px)
      '2xl':   '0.5rem',    // 8px  (era 16px)
      '3xl':   '0.75rem',   // 12px (era 24px)
      full:    '9999px',
    },
    extend: {
      colors: {
        molly: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

