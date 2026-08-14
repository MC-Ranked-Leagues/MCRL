import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.{ts,js}"],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          name: "frontend",
          include: ["src/**/*.test.{ts,tsx,js,jsx}"],
          exclude: [...configDefaults.exclude, "convex/**"],
          environment: "jsdom",
        },
      },
    ],
  },
});
