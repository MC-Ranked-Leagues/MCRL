import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...sharedTestConfig,
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          ...sharedTestConfig,
          name: "web",
          include: ["web/src/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
