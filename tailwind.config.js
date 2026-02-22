/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Menggunakan font bawaan Apple/iOS
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        ios: {
          bg: "#F2F2F7", // Warna background abu-abu terang khas iOS
          card: "#FFFFFF",
          primary: "#007AFF", // Warna biru khas iOS
          danger: "#FF3B30",
        },
      },
    },
  },
  plugins: [],
};
