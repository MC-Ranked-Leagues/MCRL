import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import journal from "../../drizzle/meta/_journal.json";

test("schema migrations preserve competition data and initialize guild state", () => {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  const baselineFolder = mkdtempSync(join(tmpdir(), "mcrl-migration-"));
  const migrationsFolder = fileURLToPath(
    new URL("../../drizzle", import.meta.url)
  );
  try {
    mkdirSync(join(baselineFolder, "meta"));
    writeFileSync(
      join(baselineFolder, "meta/_journal.json"),
      JSON.stringify({
        ...journal,
        entries: journal.entries.slice(0, 1),
      })
    );
    copyFileSync(
      join(migrationsFolder, "0000_production_baseline.sql"),
      join(baselineFolder, "0000_production_baseline.sql")
    );
    sqlite.exec("PRAGMA foreign_keys = ON");
    migrate(db, { migrationsFolder: baselineFolder });
    sqlite.exec(`
      INSERT INTO players (id, guild_id, discord_user_id, discord_username, minecraft_uuid, ign)
      VALUES (1, 'test', 'player', 'Player', 'uuid', 'Player');
      INSERT INTO competitions (id, guild_id, league_number, week_number, max_time_limit_ms, started_at)
      VALUES (1, 'test', 5, 1, 1000, 1);
      INSERT INTO competitions (id, guild_id, league_number, week_number, status, max_time_limit_ms, started_at)
      VALUES (2, 'test', 6, 7, 'ended', 1000, 1);
      INSERT INTO registrations (id, competition_id, discord_user_id, discord_username, minecraft_uuid, ign, registered_at)
      VALUES (1, 1, 'player', 'Player', 'uuid', 'Player', 1);
      INSERT INTO matches (id, competition_id, number, participant_count, time_limit_ms, imported, ranked_match_id, created_at)
      VALUES (1, 1, 1, 1, 1000, 1, '100', 1);
      INSERT INTO match_results (match_id, registration_id, status, time_ms, placement, points, submitted_at)
      VALUES (1, 1, 'finished', 500, 1, 1, 1);
    `);
    const results = sqlite.query("SELECT * FROM match_results").all();
    const matches = sqlite
      .query(
        "SELECT id, competition_id, number, time_limit_ms, imported, ranked_match_id, created_at FROM matches"
      )
      .all();
    migrate(db, { migrationsFolder });
    expect(sqlite.query("SELECT * FROM matches").all()).toEqual(matches);
    expect(sqlite.query("SELECT * FROM match_results").all()).toEqual(results);
    expect(sqlite.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(() =>
      sqlite.query("SELECT participant_count FROM matches").all()
    ).toThrow();
    expect(
      sqlite.query("SELECT twitch FROM players WHERE id = 1").get()
    ).toEqual({ twitch: null });
    expect(
      sqlite.query("SELECT streaming FROM registrations WHERE id = 1").get()
    ).toEqual({ streaming: 0 });
    expect(
      sqlite.query("SELECT * FROM guilds WHERE id = 'test'").get()
    ).toEqual({ id: "test", current_week: 7 });
    expect(
      sqlite
        .query("SELECT has_used_relegate FROM competitions WHERE id = 1")
        .get()
    ).toEqual({ has_used_relegate: 0 });
    expect(
      sqlite
        .query("SELECT host_minecraft_uuid FROM competitions WHERE id = 1")
        .get()
    ).toEqual({ host_minecraft_uuid: null });
    expect(() =>
      sqlite.query("SELECT host_ign FROM competitions").all()
    ).toThrow();
    // Re-running migrations is harmless, and cascade deletion still works afterward.
    migrate(db, { migrationsFolder });
    expect(sqlite.query("SELECT * FROM match_results").all()).toEqual(results);
    sqlite.exec("DELETE FROM matches WHERE id = 1");
    expect(sqlite.query("SELECT * FROM match_results").all()).toEqual([]);
  } finally {
    sqlite.close();
    rmSync(baselineFolder, { recursive: true, force: true });
  }
});
