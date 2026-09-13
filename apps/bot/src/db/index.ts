import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { loadDatabaseConfig } from "../config";
import * as schema from "./schema";

const sqlite = new Database(loadDatabaseConfig().fileName, { create: true });

export const db = drizzle({ client: sqlite, schema });
