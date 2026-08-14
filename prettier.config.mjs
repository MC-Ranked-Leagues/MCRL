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
      files: "domains/league/**/*.{js,mjs,ts,tsx,astro,html,css}",
      options: {
        tailwindStylesheet: "./domains/league/web/src/global.css",
      },
    },
    {
      files: "domains/league/**/*.astro",
      options: {
        parser: "astro",
        tailwindStylesheet: "./domains/league/web/src/global.css",
      },
    },
    {
      files: "domains/seed/**/*.{js,mjs,ts,tsx,html,css}",
      options: {
        tailwindStylesheet: "./domains/seed/web/src/index.css",
      },
    },
  ],
};
