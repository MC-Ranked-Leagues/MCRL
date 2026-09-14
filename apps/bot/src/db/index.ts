import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { requiredEnv } from "../lib/environment";
import * as schema from "./schema";

function createDatabase() {
  const sqlite = new Database(requiredEnv("DB_FILE_NAME"), { create: true });
  sqlite.run("PRAGMA foreign_keys = ON");

  return drizzle({ client: sqlite, schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDatabase(): ReturnType<typeof createDatabase> {
  // Scripts import database helpers before reset deletes the old database file.
  database ??= createDatabase();
  return database;
}
