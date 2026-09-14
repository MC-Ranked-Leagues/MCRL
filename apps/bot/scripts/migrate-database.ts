import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { sql } from "drizzle-orm";

import { getDatabase } from "../src/db";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function applyDatabaseMigrations(): void {
  const database = getDatabase();

  // Migration 0001 rebuilds a referenced table, which SQLite only permits safely
  // with foreign-key enforcement disabled before the migration transaction starts.
  database.run(sql`PRAGMA foreign_keys = OFF`);

  try {
    migrate(database, { migrationsFolder });
  } finally {
    database.run(sql`PRAGMA foreign_keys = ON`);
  }
}

if (import.meta.main) {
  applyDatabaseMigrations();
  console.info("Database migrations applied.");
}
