/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0066CC",
        accent: "#FF6600",
        success: "#16A34A",
        danger: "#DC2626",
        background: "#F5F7FA",
        surface: "#FFFFFF",
        text: "#1A1A2E",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
