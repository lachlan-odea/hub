// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        '16': '4rem',
        '64': '16rem',
      }
    },
  },
  plugins: [],
}