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
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          dark: "#0f172a",
          soft: "#f8fafc",
          muted: "#64748b",
          border: "#e2e8f0",
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
