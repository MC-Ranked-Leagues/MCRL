import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { requiredEnv } from "../src/lib/environment";
import { applyDatabaseMigrations } from "./migrate-database";

const configuredPath = requiredEnv("DB_FILE_NAME");

if (configuredPath === ":memory:") {
  throw new Error(
    "The database reset command requires a file-backed database."
  );
}

const databasePath = resolve(configuredPath);

for (const path of [
  databasePath,
  `${databasePath}-shm`,
  `${databasePath}-wal`,
]) {
  rmSync(path, { force: true });
}

applyDatabaseMigrations();
console.info(`Reset ${databasePath} and applied all migrations.`);
