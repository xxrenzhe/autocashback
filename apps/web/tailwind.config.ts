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
          bg: "#fafaf9",
          ink: "#0f172a",
          emerald: "#059669",
          amber: "#f59e0b",
          mist: "#ecfdf5",
          line: "#e7e5e4"
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
