// This project assumes a fresh database, so read/write models do not include
// legacy-data fallbacks or backfill compatibility paths.
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

type DbCtx = MutationCtx | QueryCtx

type RegistrationSnapshot = {
  playerIgn: string
  weekNumber: number
  leagueTier: number
}

type MatchResultSnapshot = {
  competitionId: Id<"competitions">
  weekNumber: number
  leagueTier: number
  matchNumber: number
}

export function getLeagueName(leagueTier: number) {
  return `League ${leagueTier}`
}

export async function getPlayerByUuid(
  ctx: DbCtx,
  uuid: string
): Promise<Doc<"players"> | null> {
  return await ctx.db
    .query("players")
    .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
    .unique()
}

export async function getLeagueByTier(
  ctx: DbCtx,
  leagueTier: number
): Promise<Doc<"leagues"> | null> {
  return await ctx.db
    .query("leagues")
    .withIndex("by_league_tier", (q) => q.eq("leagueTier", leagueTier))
    .unique()
}

export async function ensureLeague(
  ctx: MutationCtx,
  leagueTier: number
): Promise<Id<"leagues">> {
  const existing = await getLeagueByTier(ctx, leagueTier)
  if (existing) return existing._id

  return await ctx.db.insert("leagues", {
    leagueTier,
    name: getLeagueName(leagueTier),
  })
}

export async function getWeekSummary(
  ctx: DbCtx,
  weekNumber: number
): Promise<Doc<"weeks"> | null> {
  return await ctx.db
    .query("weeks")
    .withIndex("by_week_number", (q) => q.eq("weekNumber", weekNumber))
    .unique()
}

export async function applyWeekCompetitionDelta(
  ctx: MutationCtx,
  weekNumber: number,
  delta: number
) {
  const existing = await getWeekSummary(ctx, weekNumber)
  if (!existing) {
    return await ctx.db.insert("weeks", {
      weekNumber,
      activeCompetitionCount: Math.max(0, delta),
    })
  }

  return await ctx.db.patch(existing._id, {
    activeCompetitionCount: Math.max(0, existing.activeCompetitionCount + delta),
  })
}

export async function ensureWeekHasActiveCompetition(
  ctx: MutationCtx,
  weekNumber: number
) {
  const existing = await getWeekSummary(ctx, weekNumber)
  if (!existing) {
    return await ctx.db.insert("weeks", {
      weekNumber,
      activeCompetitionCount: 1,
    })
  }

  if (existing.activeCompetitionCount > 0) {
    return existing._id
  }

  await ctx.db.patch(existing._id, { activeCompetitionCount: 1 })
  return existing._id
}

export function buildRegistrationSnapshot(
  player: Pick<Doc<"players">, "ign">,
  competition: Pick<Doc<"competitions">, "weekNumber" | "leagueTier">
): RegistrationSnapshot {
  return {
    playerIgn: player.ign,
    weekNumber: competition.weekNumber,
    leagueTier: competition.leagueTier,
  }
}

export function buildMatchResultSnapshot(
  competition: Pick<Doc<"competitions">, "_id" | "weekNumber" | "leagueTier">,
  matchNumber: number
): MatchResultSnapshot {
  return {
    competitionId: competition._id,
    weekNumber: competition.weekNumber,
    leagueTier: competition.leagueTier,
    matchNumber,
  }
}

export function buildMatchWinnerPatch(
  players: Array<{ player: Doc<"players">; placement: number | null }>
) {
  const winner = players
    .filter((entry) => entry.placement !== null)
    .sort(
      (a, b) =>
        (a.placement ?? Number.MAX_SAFE_INTEGER) -
        (b.placement ?? Number.MAX_SAFE_INTEGER)
    )[0]

  return {
    winnerPlayerId: winner?.player._id ?? null,
    winnerName: winner?.player.ign ?? null,
  }
}

export async function syncPlayerRegistrationSnapshots(
  ctx: MutationCtx,
  playerId: Id<"players">,
  player: Pick<Doc<"players">, "ign">
) {
  const registrations = await ctx.db
    .query("registrations")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .collect()

  for (const registration of registrations) {
    if (registration.playerIgn === player.ign) {
      continue
    }

    await ctx.db.patch(registration._id, {
      playerIgn: player.ign,
    })
  }
}

export async function syncPlayerWinnerSnapshots(
  ctx: MutationCtx,
  playerId: Id<"players">,
  player: Pick<Doc<"players">, "ign">
) {
  const matches = await ctx.db
    .query("matches")
    .withIndex("by_winner_player", (q) => q.eq("winnerPlayerId", playerId))
    .collect()

  for (const match of matches) {
    if (match.winnerName === player.ign) continue

    await ctx.db.patch(match._id, {
      winnerName: player.ign,
    })
  }
}

export async function recomputeMatchWinnerSnapshot(
  ctx: MutationCtx,
  matchId: Id<"matches">
) {
  const results = await ctx.db
    .query("matchResults")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .collect()

  const winner = results
    .filter((result) => result.placement !== null)
    .sort(
      (a, b) =>
        (a.placement ?? Number.MAX_SAFE_INTEGER) -
        (b.placement ?? Number.MAX_SAFE_INTEGER)
    )[0]

  if (!winner) {
    await ctx.db.patch(matchId, {
      winnerPlayerId: null,
      winnerName: null,
    })
    return
  }

  const player = await ctx.db.get(winner.playerId)
  await ctx.db.patch(matchId, {
    winnerPlayerId: winner.playerId,
    winnerName: player?.ign ?? null,
  })
}
