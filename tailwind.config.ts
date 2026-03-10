import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        '3xl': '2.5rem', // [Design Spec 4.1] 40px 곡률 정의
      },
    },
  },
  plugins: [],
};
export default config;
