import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#38a0db",
          dark: "#1e3a5f",
          soft: "#f2f7fa",
          muted: "#607179",
          border: "#d1d5db",
        },
      },
      boxShadow: {
        card: "0 4px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
