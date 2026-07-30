/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Navy + slate-gray theme.
        ink: "#0b1524", // deep navy — primary text & solid buttons
        paper: "#eef1f6", // cool light slate — page background
        navy: {
          DEFAULT: "#16233b", // header / chrome
          soft: "#22304d", // hover on navy surfaces
        },
      },
    },
  },
  plugins: [],
};
