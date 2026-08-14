import type { Doc } from "../_generated/dataModel"

export function buildPlayerListEntry(
  player: Doc<"players">,
  rank: number | null
) {
  return {
    rank,
    playerId: player._id,
    uuid: player.uuid,
    name: player.ign,
    elo: player.elo ?? 0,
    leagueTier: player.currentLeagueNumber,
    fastestTimeMs: player.fastestTimeMs ?? null,
  }
}
