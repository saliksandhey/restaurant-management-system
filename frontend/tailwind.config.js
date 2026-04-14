/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff5f0',
          100: '#ffebd9',
          500: '#ff6b00',
          600: '#e65a00',
          900: '#7a3100',
        }
      }
    },
  },
  plugins: [
    require("tailwindcss-animate")
  ],
}
