import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

test("initial migration creates the bot schema on an empty database", () => {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  const migrationsFolder = fileURLToPath(
    new URL("../../drizzle", import.meta.url)
  );

  try {
    sqlite.exec("PRAGMA foreign_keys = ON");
    migrate(db, { migrationsFolder });

    const tables = sqlite
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      )
      .all()
      .map(({ name }) => name)
      .filter(
        (name) => !name.startsWith("__drizzle") && !name.startsWith("sqlite_")
      );
    expect(tables).toEqual([
      "account_migrations",
      "competitions",
      "guilds",
      "match_results",
      "matches",
      "players",
      "registrations",
    ]);

    sqlite.exec(`
      INSERT INTO guilds (id) VALUES ('test');
      INSERT INTO players (id, guild_id, discord_user_id, discord_username, minecraft_uuid, ign)
      VALUES (1, 'test', 'player', 'Player', 'uuid', 'Player');
      INSERT INTO competitions (id, guild_id, league_number, week_number, max_time_limit_ms, started_at)
      VALUES (1, 'test', 5, 1, 1000, 1);
      INSERT INTO registrations (id, competition_id, discord_user_id, discord_username, minecraft_uuid, ign, registered_at)
      VALUES (1, 1, 'player', 'Player', 'uuid', 'Player', 1);
      INSERT INTO matches (id, competition_id, number, time_limit_ms, created_at)
      VALUES (1, 1, 1, 1000, 1);
      INSERT INTO match_results (match_id, registration_id) VALUES (1, 1);
    `);

    expect(
      sqlite.query("SELECT current_week FROM guilds WHERE id = 'test'").get()
    ).toEqual({ current_week: 1 });
    expect(
      sqlite
        .query(
          "SELECT has_used_relegate, host_minecraft_uuid FROM competitions WHERE id = 1"
        )
        .get()
    ).toEqual({ has_used_relegate: 0, host_minecraft_uuid: null });
    expect(
      sqlite
        .query(
          "SELECT average_used, movement, streaming FROM registrations WHERE id = 1"
        )
        .get()
    ).toEqual({ average_used: null, movement: null, streaming: 0 });

    migrate(db, { migrationsFolder });
    sqlite.exec("DELETE FROM matches WHERE id = 1");
    expect(sqlite.query("SELECT * FROM match_results").all()).toEqual([]);
    expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    sqlite.close();
  }
});
