import * as astro from "prettier-plugin-astro";
import * as tailwindcss from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
export default {
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
  tailwindFunctions: ["cn", "cva"],
  plugins: [astro, tailwindcss],
  overrides: [
    {
      files: "apps/web/**/*.{js,mjs,ts,tsx,astro,html,css}",
      options: {
        tailwindStylesheet: "./apps/web/src/global.css",
      },
    },
    {
      files: "apps/web/**/*.astro",
      options: {
        parser: "astro",
        tailwindStylesheet: "./apps/web/src/global.css",
      },
    },
  ],
};
