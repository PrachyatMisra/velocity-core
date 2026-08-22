/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "neon-red": "#ff0066",
        "neon-rose": "#ff1a8c",
        "scan-cyan": "#00d4ff",
        "scan-green": "#00ff41",
        "scan-white": "#e8e8f0",
        "scan-dim": "#8888aa",
        "scan-ghost": "#444455",
        "void-black": "#050508",
        "void-surface": "#0a0a10",
        "void-mid": "#111118",
        "void-elevated": "#1a1a24",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
