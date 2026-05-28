/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/renderer/index.html',
    './app/renderer/src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        glass: '0 24px 60px -20px rgba(2, 6, 23, 0.9)',
      },
      colors: {
        ink: '#0b0f19',
      },
    },
  },
  plugins: [],
};
