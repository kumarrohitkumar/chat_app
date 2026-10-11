import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        // Incoming and outgoing bubbles lean in from their own side.
        "bubble-in-left": {
          "0%": { opacity: "0", transform: "translate3d(-12px, 8px, 0) scale(.96)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "bubble-in-right": {
          "0%": { opacity: "0", transform: "translate3d(12px, 8px, 0) scale(.96)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translate3d(0, 10px, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translate3d(0, -12px, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        // A short overshoot, so a new badge reads as "something arrived".
        pop: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.18)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // A ring that expands and fades out of the online dot.
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: ".55" },
          "70%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: ".45" },
          "30%": { transform: "translateY(-5px)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "spin-slow": {
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "bubble-in-left": "bubble-in-left .34s cubic-bezier(.22,1.2,.36,1) both",
        "bubble-in-right": "bubble-in-right .34s cubic-bezier(.22,1.2,.36,1) both",
        "fade-up": "fade-up .4s cubic-bezier(.22,1,.36,1) both",
        "fade-in": "fade-in .3s ease-out both",
        "slide-down": "slide-down .3s cubic-bezier(.22,1,.36,1) both",
        pop: "pop .32s cubic-bezier(.34,1.56,.64,1) both",
        "ping-soft": "ping-soft 2s cubic-bezier(0,0,.2,1) infinite",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
        "spin-slow": "spin-slow 1.4s linear infinite",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
      "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
      "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
      "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade",
      "night", "coffee", "winter", "dim", "nord", "sunset",
    ],
  },
};
