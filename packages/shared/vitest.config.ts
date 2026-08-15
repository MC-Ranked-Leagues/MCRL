import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    name: "shared",
    include: ["src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
