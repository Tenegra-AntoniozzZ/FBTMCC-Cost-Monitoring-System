/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // ITO ANG BAGO: Ina-allow natin na manual na mag-toggle ng class="dark"
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}