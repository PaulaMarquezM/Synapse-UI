/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          800: "#1e293b",
          900: "#0f172a"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"]
      },
      backdropBlur: {
        md: "12px"
      }
    }
  },
  plugins: [],
  prefix: ""
}
