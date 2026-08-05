/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral graphite base + a small set of saturated neons, used
        // sparingly as signal rather than decoration (Edgerunners-ish, but
        // restrained). Semantic tokens so components read by role.
        paper: "#0b0b0d", // page background (near-black graphite)
        surface: "#141417", // cards, header
        surface2: "#1c1c21", // hover / secondary surface
        line: "#2a2a31", // hairline borders
        ink: "#ededf0", // primary text
        muted: "#8b8b96", // secondary text

        // Neon signal palette.
        neon: {
          green: "#39ff88", // on-time / active / positive
          red: "#ff2e5b", // delay / destructive
          violet: "#b16cff", // accent, passport/stats
          yellow: "#ffd93d", // warning / highlight
          cyan: "#22e0ff", // info / links
        },

        // Primary action = violet neon (was blue).
        accent: "#b16cff",
        "accent-soft": "#c79bff",
      },
      boxShadow: {
        // Subtle bloom for neon elements — keeps the glow minimal.
        neon: "0 0 12px -2px currentColor",
      },
      fontFamily: {
        sans: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Cascadia Code",
          "Roboto Mono",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
