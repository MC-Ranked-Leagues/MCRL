import { getDatabase } from ".";
import { competitions } from "./schema";

interface StartCompetitionInput {
  guildId: string;
  leagueNumber: number;
  weekNumber: number;
  maxTimeLimitMs: number;
  startedAt: Date;
}

export function startCompetition(input: StartCompetitionInput): boolean {
  // The unique index handles duplicate starts, including concurrent requests.
  const competition = getDatabase()
    .insert(competitions)
    .values(input)
    .onConflictDoNothing({
      target: [
        competitions.guildId,
        competitions.leagueNumber,
        competitions.weekNumber,
      ],
    })
    .returning({ id: competitions.id })
    .get();

  return competition !== undefined;
}
