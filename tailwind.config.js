/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mc-dark': '#1E1E1E',
        'mc-gray': '#3C3C3C',
        'mc-light-gray': '#5A5A5A',
        'mc-green': '#55FF55',
        'mc-blue': '#00AAAA',
        'mc-purple': '#AA00AA',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'mono': ['Fira Code', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #55FF55, 0 0 10px #55FF55' },
          '50%': { boxShadow: '0 0 20px #55FF55, 0 0 30px #55FF55' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
