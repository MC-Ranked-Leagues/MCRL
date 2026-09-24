import { beforeEach, expect, spyOn, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import {
  getActiveCompetition,
  setCompetitionHost,
  startCompetition,
} from "../db/competitions";
import { getImportedMatches } from "../db/matches";
import { registerPlayer } from "../db/registrations";
import { ranked } from "../lib/ranked";
import {
  input,
  rankedMatch,
  registrationChannel,
  resetDatabase,
} from "../testing/competition";
import { importCommand } from "./import";

beforeEach(resetDatabase);

test("import uses the host's newest private game when match_id is omitted", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const league = guildConfiguration[guildId]!.leagues[5]!;
  startCompetition({ ...input, guildId });
  const competition = getActiveCompetition(guildId, 5)!;
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "player",
      discordUsername: "Player",
      minecraftUuid: "uuid0",
      ign: "Player0",
      registeredAt: new Date(),
    },
    { mode: "admin" }
  );
  const history = spyOn(ranked.users, "matches").mockResolvedValue([]);
  const match = spyOn(ranked.matches, "get").mockImplementation(
    async (id) =>
      rankedMatch(id) as Awaited<ReturnType<typeof ranked.matches.get>>
  );
  const { channel } = registrationChannel();
  const replies: string[] = [];
  let matchId: number | null = null;
  const interaction = {
    guildId,
    channelId: league.infoChannelId,
    member: { roles: { cache: { has: () => true } } },
    options: {
      getInteger: (name: string) => (name === "match_id" ? matchId : null),
    },
    guild: { channels: { fetch: async () => channel } },
    editReply: async (reply: string | { content: string }) => {
      replies.push(typeof reply === "string" ? reply : reply.content);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;

  try {
    await importCommand.execute(interaction);
    expect(replies.at(-1)).toContain("Run /host or supply match_id");
    expect(history).not.toHaveBeenCalled();

    setCompetitionHost(guildId, competition.id, "host-uuid");
    await importCommand.execute(interaction);
    expect(replies.at(-1)).toContain("no recent private games");
    expect(getImportedMatches(competition.id)).toHaveLength(0);

    history.mockResolvedValue([
      { id: 101 } as Awaited<ReturnType<typeof ranked.users.matches>>[number],
    ]);
    await importCommand.execute(interaction);
    expect(history).toHaveBeenCalledWith("host-uuid", {
      count: 1,
      sort: "newest",
      excludeDecay: true,
      type: 3,
    });
    expect(match).toHaveBeenCalledWith(101);
    expect(getImportedMatches(competition.id)).toHaveLength(1);

    await importCommand.execute(interaction);
    expect(replies.at(-1)).toContain("already imported as Match 1");
    expect(getImportedMatches(competition.id)).toHaveLength(1);

    matchId = 102;
    await importCommand.execute(interaction);
    expect(match).toHaveBeenCalledWith(102);
    expect(history).toHaveBeenCalledTimes(3);
    expect(getImportedMatches(competition.id)).toHaveLength(2);
  } finally {
    history.mockRestore();
    match.mockRestore();
  }
});
