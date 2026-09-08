import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          clearMocks: true,
          restoreMocks: true,
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
        },
      },
      {
        extends: true,
        test: {
          clearMocks: true,
          restoreMocks: true,
          name: "web",
          include: ["web/src/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
