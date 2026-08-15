import convexPlugin from "@convex-dev/eslint-plugin";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/dist-ssr/**",
    "**/.astro/**",
    "**/coverage/**",
    "**/convex/_generated/**",
    "backups/**",
  ]),
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: ["domains/*/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      "**/*.config.{js,mjs,cjs,ts}",
      "**/scripts/**/*.{js,mjs,cjs,ts}",
      "eslint.config.js",
      "vitest.shared.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["domains/*/web/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["domains/league/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mcrl/seed", "@mcrl/seed/*", "**/seed/**"],
              message:
                "League must use Seed's public API contracts, not Seed internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["domains/seed/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mcrl/league", "@mcrl/league/*", "**/league/**"],
              message:
                "Seed must use League's public API contracts, not League internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/shared/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@mcrl/league",
                "@mcrl/league/*",
                "@mcrl/seed",
                "@mcrl/seed/*",
                "**/domains/**",
              ],
              message: "Shared code must not depend on domain internals.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@mcrl/league",
                "@mcrl/league/*",
                "@mcrl/seed",
                "@mcrl/seed/*",
                "**/domains/**",
                "**/convex/**",
                "convex",
                "convex/*",
              ],
              message:
                "Contracts must remain independent of domains and Convex-specific types.",
            },
          ],
        },
      ],
    },
  },
  ...convexPlugin.configs.recommended,
]);
