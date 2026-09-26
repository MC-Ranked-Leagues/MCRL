import { beforeEach, expect, spyOn, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { getCompetitionStandings, importMatch } from "../db/matches";
import { getPlayer } from "../db/players";
import { matchResults, registrations } from "../db/schema";
import { ranked } from "../lib/ranked";
import {
  database,
  input,
  rankedMatch,
  registrationChannel,
  resetDatabase,
  setupMatchPlayers,
} from "../testing/competition";
import { adminRegCommand } from "./admin-reg";

beforeEach(resetDatabase);

function setupLateRegistration() {
  const guildId = Object.keys(guildConfiguration)[0]!;
  input.guildId = guildId;
  const config = guildConfiguration[guildId]!;
  const league = config.leagues[5]!;
  const competition = setupMatchPlayers(5);
  importMatch(competition.id, rankedMatch(100));
  importMatch(competition.id, rankedMatch(101));
  const { channel, messages } = registrationChannel();
  const replies: string[] = [];
  const interaction = {
    guildId,
    channelId: league.infoChannelId,
    member: { roles: { cache: { has: () => true } } },
    options: { getUser: () => ({ id: "late", username: "late" }) },
    guild: {
      members: {
        fetch: async () => ({
          roles: {
            cache: { has: (id: string) => id === league.leagueRoleId },
            add: async () => {},
          },
        }),
      },
      roles: {
        fetch: async () => ({ id: config.currentWeekRoleId, editable: true }),
      },
      channels: { fetch: async () => channel },
    },
    editReply: async (reply: string | { content: string }) => {
      replies.push(typeof reply === "string" ? reply : reply.content);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
  const lookup = spyOn(ranked.users, "get").mockResolvedValue({
    uuid: "uuid99",
    nickname: "Late",
    eloRate: null,
    seasonResult: { highest: null },
  } as Awaited<ReturnType<typeof ranked.users.get>>);
  const fetchMatch = spyOn(ranked.matches, "get").mockImplementation(
    async (id) =>
      rankedMatch(id) as Awaited<ReturnType<typeof ranked.matches.get>>
  );
  return {
    competition,
    interaction,
    messages,
    replies,
    fetchMatch,
    restore: () => {
      lookup.mockRestore();
      fetchMatch.mockRestore();
    },
  };
}

test("admin registration replays every imported match and refreshes the leaderboard", async () => {
  const setup = setupLateRegistration();
  try {
    await adminRegCommand.execute(setup.interaction);
    expect(setup.fetchMatch.mock.calls.map(([id]) => id)).toEqual([100, 101]);
    const standings = getCompetitionStandings(setup.competition.id)!.standings;
    expect(standings.find((player) => player.ign === "Late")).toMatchObject({
      points: 16,
      played: 2,
      averageTimeMs: 100,
    });
    expect(standings.find((player) => player.ign === "Player0")?.points).toBe(
      10
    );
    expect([...setup.messages.values()].join("\n")).toContain(
      "Late(late) - 16 pts"
    );
    expect(setup.replies.at(-1)).toContain("Registered **Late**");
  } finally {
    setup.restore();
  }
});

test("a failed match fetch leaves registration and all results untouched", async () => {
  const setup = setupLateRegistration();
  const before = database.select().from(matchResults).all();
  setup.fetchMatch.mockImplementation(async (id) => {
    if (id === 101) throw new Error("Ranked unavailable");
    return rankedMatch(id) as Awaited<ReturnType<typeof ranked.matches.get>>;
  });
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    await adminRegCommand.execute(setup.interaction);
    expect(setup.fetchMatch.mock.calls.map(([id]) => id)).toEqual([100, 101]);
    expect(database.select().from(matchResults).all()).toEqual(before);
    expect(database.select().from(registrations).all()).toHaveLength(5);
    expect(getPlayer(input.guildId, "late")).toBeUndefined();
    expect(setup.replies.at(-1)).toContain("No changes were saved");
  } finally {
    log.mockRestore();
    setup.restore();
  }
});

test("a changed import rejects fetched results before saving a late registration", async () => {
  const setup = setupLateRegistration();
  setup.fetchMatch.mockImplementation(async (id) => {
    if (id === 101) importMatch(setup.competition.id, rankedMatch(202), 1);
    return rankedMatch(id) as Awaited<ReturnType<typeof ranked.matches.get>>;
  });
  try {
    await adminRegCommand.execute(setup.interaction);
    expect(database.select().from(registrations).all()).toHaveLength(5);
    expect(getPlayer(input.guildId, "late")).toBeUndefined();
    expect(setup.replies.at(-1)).toContain("Imported matches changed");
  } finally {
    setup.restore();
  }
});

test("a failed result write rolls back registration and every replayed match", async () => {
  const setup = setupLateRegistration();
  const before = database.select().from(matchResults).all();
  const secondMatch = getActiveCompetition(input.guildId, 5)!;
  const matchId = database.$client
    .query("SELECT id FROM matches WHERE competition_id = ? AND number = 2")
    .get(secondMatch.id) as { id: number };
  database.$client
    .exec(`CREATE TRIGGER reject_replay BEFORE INSERT ON match_results
    WHEN NEW.match_id = ${matchId.id}
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    await adminRegCommand.execute(setup.interaction);
    expect(database.select().from(matchResults).all()).toEqual(before);
    expect(database.select().from(registrations).all()).toHaveLength(5);
    expect(getPlayer(input.guildId, "late")).toBeUndefined();
    expect(setup.replies.at(-1)).toContain("No changes were saved");
  } finally {
    database.$client.exec("DROP TRIGGER reject_replay");
    log.mockRestore();
    setup.restore();
  }
});
