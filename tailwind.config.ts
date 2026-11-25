import type { Config } from "tailwindcss";

// Colours are CSS variables (see globals.css) so light/dark share one set of classes.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        elevated: token("elevated"),
        subtle: token("subtle"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        accent: token("accent"),
        violet: token("violet"),
        success: token("success"),
        danger: token("danger"),
        warn: token("warn"),
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 16px rgb(var(--shadow) / 0.06)",
        pop: "0 8px 32px rgb(var(--shadow) / 0.22), 0 2px 8px rgb(var(--shadow) / 0.12)",
        glow: "0 6px 20px rgb(var(--glow) / 0.35)",
      },
      keyframes: {
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.5" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "msg-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "flash": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--accent) / 0)" },
          "30%": { boxShadow: "0 0 0 4px rgb(var(--accent) / 0.45)" },
        },
        "rec-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "typing-dot": "typing-dot 1.2s infinite",
        "fade-in": "fade-in 0.15s ease-out",
        "pop-in": "pop-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "sheet-up": "sheet-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "msg-in": "msg-in 0.18s ease-out",
        flash: "flash 1.2s ease-out",
        "rec-pulse": "rec-pulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
