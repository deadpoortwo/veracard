/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        amber: {
          200: "#faecd2",
          300: "#f3dfb8",
          400: "#e4c082",
          500: "#d4a96a",
          600: "#b88946",
        },
        zinc: {
          200: "#f5f5f4",
          300: "#e7e5e4",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#352f2b",
          900: "#26211e",
          950: "#1c1815",
        },
      },
    },
  },
  plugins: [],
};
