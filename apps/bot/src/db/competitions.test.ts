import { setPlayerTwitchUsername } from "./players";
import { importMatch } from "./matches";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import { registerPlayer } from "./registrations";
import { beforeEach, expect, test } from "bun:test";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { eq } from "drizzle-orm";
import {
  advanceGuildWeek,
  endCompetition,
  getActiveCompetition,
  getCompetitionExport,
  getLatestEndedCompetition,
  getAdvanceWeekPreview,
  setCompetitionHost,
  startCompetition,
  toggleRegistration,
  unendCompetition,
} from "./competitions";
import { getCurrentWeek, setCurrentWeek } from "./guilds";
import { competitions, matchResults } from "./schema";
import {
  resetDatabase,
  database,
  input,
  registrationChannel,
  setupMatchPlayers,
  rankedMatch,
} from "../testing/competition";

beforeEach(resetDatabase);

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

test("host account belongs to one active competition and cannot be saved after it ends", () => {
  startCompetition(input);
  startCompetition({ ...input, leagueNumber: 6 });
  const active = getActiveCompetition(input.guildId, 5)!;

  expect(setCompetitionHost(input.guildId, active.id, "host-uuid")).toBe(true);
  expect(getActiveCompetition(input.guildId, 5)).toMatchObject({
    hostMinecraftUuid: "host-uuid",
  });
  expect(getActiveCompetition(input.guildId, 6)?.hostMinecraftUuid).toBeNull();

  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  startCompetition({ ...input, weekNumber: 2 });
  expect(setCompetitionHost(input.guildId, active.id, "new-uuid")).toBe(false);
  expect(getActiveCompetition(input.guildId, 5)?.hostMinecraftUuid).toBeNull();
  expect(
    database
      .select()
      .from(competitions)
      .where(eq(competitions.id, active.id))
      .get()?.hostMinecraftUuid
  ).toBe("host-uuid");
});

test("registration toggles only the active competition in the requested guild and league", () => {
  expect(toggleRegistration(input.guildId, 5)).toBeUndefined();
  startCompetition(input);
  startCompetition({ ...input, guildId: "other-guild" });
  expect(toggleRegistration(input.guildId, 5)).toMatchObject({
    registrationOpen: true,
  });
  expect(getActiveCompetition("other-guild", 5)?.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)).toMatchObject({
    registrationOpen: false,
  });
});

test("week advancement requires relegation unless forced", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  const preview = getAdvanceWeekPreview(input.guildId);

  expect(preview.competitions[0]?.hasUsedRelegate).toBe(false);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, false)).toBe(
    "unprocessed"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "advanced"
  );
  expect(getCurrentWeek(input.guildId)).toBe(5);
});

test("a newly unprocessed competition blocks confirmed advancement", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  database
    .update(competitions)
    .set({ hasUsedRelegate: true })
    .where(eq(competitions.guildId, input.guildId))
    .run();
  const preview = getAdvanceWeekPreview(input.guildId);
  startCompetition({ ...input, leagueNumber: 6, weekNumber: 4 });

  expect(advanceGuildWeek(input.guildId, preview.currentWeek, false)).toBe(
    "unprocessed"
  );
  expect(getAdvanceWeekPreview(input.guildId).competitions).toHaveLength(2);
});

test("a stale week blocks forced and repeated advancement", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  const preview = getAdvanceWeekPreview(input.guildId);
  setCurrentWeek(input.guildId, 5);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "stale_week"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
  setCurrentWeek(input.guildId, 4);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "advanced"
  );
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "stale_week"
  );
  expect(getCurrentWeek(input.guildId)).toBe(5);
});

test("competition exports read the current Twitch username for streaming registrations", () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  for (const registration of [
    {
      discordUserId: "streamer",
      ign: "Streamer",
      streaming: true,
    },
    {
      discordUserId: "private",
      ign: "PrivatePlayer",
      streaming: false,
    },
  ]) {
    expect(
      registerPlayer(
        {
          ...registration,
          competitionId: active.id,
          discordUsername: registration.discordUserId,
          minecraftUuid: registration.discordUserId,
          registeredAt: new Date(),
        },
        registration.streaming
          ? { twitch: `${registration.discordUserId}_linked` }
          : undefined
      )
    ).toBe("registered");
    expect(
      setPlayerTwitchUsername(
        input.guildId,
        registration.discordUserId,
        `${registration.discordUserId}_live`
      )
    ).toBe(true);
  }

  expect(
    getCompetitionExport(active.id)!.players.map((player) => ({
      ign: player.ign,
      streaming: player.streaming,
      twitch: player.twitch,
    }))
  ).toEqual([
    {
      ign: "PrivatePlayer",
      streaming: false,
      twitch: "private_live",
    },
    {
      ign: "Streamer",
      streaming: true,
      twitch: "streamer_live",
    },
  ]);
  expect(
    setPlayerTwitchUsername(input.guildId, "streamer", "new_channel")
  ).toBe(true);
  expect(
    getCompetitionExport(active.id)!.players.find(
      (player) => player.ign === "Streamer"
    )?.twitch
  ).toBe("new_channel");
  expect(setPlayerTwitchUsername(input.guildId, "missing", "no_account")).toBe(
    false
  );
});

test("finalization rejects unknown competitions, other guilds, and competitions without imported matches", () => {
  const competition = setupMatchPlayers();
  expect(endCompetition(input.guildId, -1).status).toBe("not_found");
  expect(endCompetition("other-guild", competition.id).status).toBe(
    "not_found"
  );
  expect(endCompetition(input.guildId, competition.id).status).toBe(
    "no_matches"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
});

test("unending restores an ended competition without reopening registration or changing results", async () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  expect(endCompetition(input.guildId, competition.id).status).toBe("ended");
  const savedResults = database.select().from(matchResults).all();

  expect(unendCompetition(input.guildId, competition.id).status).toBe("active");
  const active = getActiveCompetition(input.guildId, input.leagueNumber)!;
  expect(active.id).toBe(competition.id);
  expect(active.registrationOpen).toBe(false);
  expect(active.endedAt).toBeNull();
  expect(database.select().from(matchResults).all()).toEqual(savedResults);
  expect(getLatestEndedCompetition(input.guildId, input.leagueNumber)).toBe(
    undefined
  );

  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  await updateRegistrationMessages(channel, competition.id);
  const content = [...messages.values()].join("\n");
  expect(content).toContain("**Status:** active");
  expect(content).toContain("Registration: **OFF**");
});

test("unending rejects unknown, active, cross-guild, and superseded competitions", () => {
  const competition = setupMatchPlayers();
  expect(unendCompetition(input.guildId, -1).status).toBe("not_found");
  expect(unendCompetition("other-guild", competition.id).status).toBe(
    "not_found"
  );
  expect(unendCompetition(input.guildId, competition.id).status).toBe(
    "already_active"
  );

  importMatch(competition.id, rankedMatch());
  endCompetition(input.guildId, competition.id);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(true);
  expect(unendCompetition(input.guildId, competition.id).status).toBe(
    "has_active"
  );
  expect(getLatestEndedCompetition(input.guildId, input.leagueNumber)?.id).toBe(
    competition.id
  );
  expect(
    getActiveCompetition(input.guildId, input.leagueNumber)?.weekNumber
  ).toBe(2);
});
