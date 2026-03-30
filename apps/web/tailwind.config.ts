import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-sans)", "Noto Sans SC", "sans-serif"],
        display: ["var(--font-serif)", "Noto Serif SC", "serif"]
      },
      colors: {
        brand: {
          bg: "#f7f4ec",
          ink: "#0f172a",
          emerald: "#0f766e",
          gold: "#d97706",
          mist: "#ecfdf5",
          line: "#d6d3d1"
        }
      },
      boxShadow: {
        editorial: "0 18px 60px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
