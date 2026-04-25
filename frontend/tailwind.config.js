/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: "#1a1a1a",
        dark: "#121212",
        payoneerOrange: "#ff5a00",
        payoneerRed: "#ff0000",
        aiGreen: "#10a37f",
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
