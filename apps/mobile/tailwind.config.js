/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "../../packages/shared/src/**/*.{js,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
