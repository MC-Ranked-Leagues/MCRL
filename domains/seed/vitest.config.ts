import { configDefaults, defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...sharedTestConfig,
          name: "convex",
          include: ["convex/**/*.test.{ts,js}"],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          ...sharedTestConfig,
          name: "frontend",
          include: ["web/src/**/*.test.{ts,tsx,js,jsx}"],
          exclude: [...configDefaults.exclude, "convex/**"],
          environment: "jsdom",
        },
      },
    ],
  },
});
