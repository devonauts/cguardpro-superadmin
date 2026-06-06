import { heroui } from "@heroui/theme";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: "#6366f1",
              foreground: "#ffffff",
            },
          },
        },
        light: {
          colors: {
            primary: {
              DEFAULT: "#4f46e5",
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
  ],
};
