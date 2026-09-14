import { defineConfig } from "drizzle-kit";

import { requiredEnv } from "../src/lib/environment";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: requiredEnv("DB_FILE_NAME"),
  },
});
