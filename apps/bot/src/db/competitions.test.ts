import { afterAll, beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { applyDatabaseMigrations } from "../../scripts/migrate-database";
import { getDatabase } from ".";
import {
  deleteActiveCompetition,
  getActiveCompetition,
  startCompetition,
  toggleRegistration,
} from "./competitions";
import { competitions, registrations, matches, matchResults } from "./schema";

// Open the lazy database connection in memory, using the real migrations and constraints.
const previousDatabase = process.env.DB_FILE_NAME;
process.env.DB_FILE_NAME = ":memory:";
applyDatabaseMigrations();
const database = getDatabase();
const input = {
  guildId: "test-guild",
  leagueNumber: 5,
  weekNumber: 1,
  maxTimeLimitMs: 1000,
  startedAt: new Date(),
};

beforeEach(() => {
  database.delete(competitions).run();
});

afterAll(() => {
  database.$client.close();
  if (previousDatabase === undefined) delete process.env.DB_FILE_NAME;
  else process.env.DB_FILE_NAME = previousDatabase;
});

test("only one active week per guild and league, while ended weeks remain unique", () => {
  expect(startCompetition(input)).toBe(true);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(false);
  expect(startCompetition({ ...input, leagueNumber: 6 })).toBe(true);
  expect(startCompetition({ ...input, guildId: "other-guild" })).toBe(true);
  const active = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(startCompetition(input)).toBe(false);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(true);
});

test("registration toggles only the active competition in the requested guild and league", () => {
  expect(toggleRegistration(input.guildId, 5)).toBeUndefined();
  startCompetition(input);
  startCompetition({ ...input, guildId: "other-guild" });
  expect(toggleRegistration(input.guildId, 5)?.registrationOpen).toBe(true);
  expect(getActiveCompetition("other-guild", 5)?.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)?.registrationOpen).toBe(false);
});

test("deletion cascades and an old confirmation cannot delete a replacement competition", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  // Build the full dependency chain to exercise cascading deletion through results.
  const registration = database
    .insert(registrations)
    .values({
      competitionId: active.id,
      discordUserId: "user",
      discordUsername: "player",
      minecraftUuid: "uuid",
      ign: "player",
      registeredAt: new Date(),
    })
    .returning()
    .get();
  const match = database
    .insert(matches)
    .values({
      competitionId: active.id,
      number: 1,
      participantCount: 1,
      timeLimitMs: 1000,
      createdAt: new Date(),
    })
    .returning()
    .get();
  database
    .insert(matchResults)
    .values({ matchId: match.id, registrationId: registration.id })
    .run();
  expect(deleteActiveCompetition("other-guild", active.id)).toBe(false);
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(true);
  expect(database.select().from(registrations).all()).toHaveLength(0);
  expect(database.select().from(matches).all()).toHaveLength(0);
  expect(database.select().from(matchResults).all()).toHaveLength(0);
  // Recreate the same week, then simulate confirming the old deletion prompt.
  expect(startCompetition(input)).toBe(true);
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(false);
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
});

test("an ended competition cannot be deleted through an active-competition confirmation", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(false);
});
