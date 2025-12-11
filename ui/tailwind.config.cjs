/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214, 12%, 87%)",
        background: "hsl(222, 47%, 98%)",
        foreground: "hsl(222, 47%, 11%)",
        primary: {
          DEFAULT: "hsl(221, 83%, 53%)",
          foreground: "white",
        },
        muted: {
          DEFAULT: "hsl(220, 13%, 95%)",
          foreground: "hsl(222, 10%, 45%)",
        },
        card: {
          DEFAULT: "white",
          foreground: "hsl(222, 47%, 11%)",
        },
        ring: "hsl(221, 83%, 53%)",
        input: "hsl(214, 12%, 87%)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(15, 23, 42, 0.2)",
      },
    },
  },
  plugins: [],
};
