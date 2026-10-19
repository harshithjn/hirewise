import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { keyframes: { slide: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } } } } },
  plugins: [typography],
};
export default config;
