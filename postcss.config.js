import tailwind from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: [
    // Tailwind CSS v4 PostCSS plugin to process `@import "tailwindcss";`
    tailwind(),
    autoprefixer(),
  ],
};
