import { defineConfig } from "drizzle-kit";

import { loadDatabaseConfig } from "./src/config";

const databaseConfig = loadDatabaseConfig();

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseConfig.fileName,
  },
});
