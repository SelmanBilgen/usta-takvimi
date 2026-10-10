import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3fbf8",
          100: "#daf5ec",
          200: "#b4ead9",
          300: "#7fd8bf",
          400: "#48c4a2",
          500: "#1ea885",
          600: "#13866c",
          700: "#106b57",
          800: "#105547",
          900: "#0f473c"
        }
      }
    }
  },
  plugins: []
};

export default config;
