/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark navy theme (default). Semantic tokens so components read by role.
        paper: "#0a1120", // page background (deep navy-black)
        surface: "#111a2e", // cards, header
        surface2: "#1a2440", // hover / secondary surface
        line: "#243149", // hairline borders
        ink: "#e7ecf6", // primary text (light)
        muted: "#93a1bd", // secondary text
        accent: "#3b82f6", // primary action (blue)
        "accent-soft": "#60a5fa",
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
