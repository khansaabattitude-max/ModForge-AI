/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Sirf 'src' ke bajaye, poore project ki files ko dekhega
    "./**/*.{js,ts,jsx,tsx,mdx}", 
  ],
  theme: {
    extend: {
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
