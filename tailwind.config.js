/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#c0c0bf',
          main: '#e1c614',
          accent: '#ffffff',
          dark: '#333333',
          light: '#f5f5f4',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
