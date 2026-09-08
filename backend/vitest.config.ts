import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    include: ["convex/**/*.test.ts"],
    environment: "edge-runtime",
  },
});
