import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { getDatabase } from "../src/db";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function applyDatabaseMigrations(): void {
  migrate(getDatabase(), { migrationsFolder });
}

if (import.meta.main) {
  applyDatabaseMigrations();
  console.info("Database migrations applied.");
}
