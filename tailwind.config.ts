import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#14532d",
        chalk: "#f8fafc",
        boot: "#dc2626",
        gold: "#f59e0b"
      }
    }
  },
  plugins: []
};

export default config;
