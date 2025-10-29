/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'mc-dark': '#1A1A1A',
        'mc-gray': '#2C2C2C',
        'mc-light-gray': '#3A3A3A',
        'mc-green': '#39FF14',
        'mc-blue': '#3B82F6',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
