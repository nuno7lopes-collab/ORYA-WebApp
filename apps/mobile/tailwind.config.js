/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
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
