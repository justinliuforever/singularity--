/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0f",
          900: "#0f1015",
          850: "#15161d",
          800: "#1b1d26",
          700: "#272a37",
          600: "#3a3e4f",
        },
        accent: { DEFAULT: "#8b5cf6", soft: "#a78bfa" },
        truthlie: "#fb7185",
        reveal: "#34d399",
        know: "#60a5fa",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
