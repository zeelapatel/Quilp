import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0A0A0A",
          secondary: "#111111",
          tertiary: "#1A1A1A"
        },
        border: {
          DEFAULT: "#222222",
          hover: "#333333"
        },
        text: {
          primary: "#F0F0F0",
          secondary: "#888888",
          tertiary: "#444444"
        },
        accent: "#E8F94A",
        danger: "#FF4444",
        success: "#44FF88"
      },
      fontFamily: {
        mono: ["DM Mono", "monospace"],
        sans: ["DM Sans", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        lg: "8px"
      }
    }
  },
  plugins: []
} satisfies Config;
