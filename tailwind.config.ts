import type { Config } from "tailwindcss";

/**
 * Lattice design system.
 * Tokens are exposed both as Tailwind theme values and as CSS variables
 * (see src/app/globals.css) so non-Tailwind surfaces stay consistent.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep charcoal / near-black foundation
        void: "#07080c",
        ink: {
          950: "#0a0b11",
          900: "#0e1017",
          850: "#12141d",
          800: "#171a25",
          700: "#1f2331",
          600: "#2a2f40",
          500: "#3a4155",
        },
        // Accent: considered, not neon. "Signal" = primary action, "Aurora" = discovery.
        signal: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#b9cfff",
          300: "#8aadff",
          400: "#5c86fb",
          500: "#3a62f0",
          600: "#2646d4",
          700: "#1e37ab",
          800: "#1d3187",
          900: "#1d2f6b",
        },
        aurora: {
          400: "#5eead4",
          500: "#2dd4bf",
          600: "#14b8a6",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
        parchment: {
          100: "#f4f5f7",
          200: "#e6e8ee",
          300: "#c9cdd8",
          400: "#9aa0b0",
          500: "#6f7686",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.9)",
        lift: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 60px -30px rgba(0,0,0,1)",
        glow: "0 0 0 1px rgba(58,98,240,0.35), 0 0 40px -8px rgba(58,98,240,0.45)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-8px,0)" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.6s ease both",
        shimmer: "shimmer 1.8s linear infinite",
        drift: "drift 6s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
