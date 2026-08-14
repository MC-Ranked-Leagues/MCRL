import { z } from "zod"

const positiveInt = (field: string) =>
  z.int(`${field} must be an integer.`).min(1, `${field} must be at least 1.`)

const nonEmptyString = (field: string) =>
  z.string(`${field} must be a string.`).min(1, `${field} must not be empty.`)

export const CompetitionSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  maxTimeLimitMs: z
    .number("maxTimeLimitMs must be a number.")
    .nonnegative("maxTimeLimitMs must be at least 0.")
    .int("maxTimeLimitMs must be an integer."),
  startingTime: z.optional(
    z
      .number("startingTime must be a number.")
      .int("startingTime must be an integer.")
  ),
})

export const CompetitionStatusSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  status: z.enum(["active", "ended"], {
    error: "status must be either 'active' or 'ended'.",
  }),
})

export const RegisterPlayerSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  uuid: nonEmptyString("uuid"),
  ign: nonEmptyString("ign"),
  elo: z.number("elo must be a number.").optional(),
})

export const UnregisterPlayerSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  uuid: nonEmptyString("uuid"),
})

export const UpdatePlayerLeagueSchema = z.object({
  uuid: nonEmptyString("uuid"),
  leagueTier: positiveInt("leagueTier"),
})

export const CreateEmptyMatchSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  matchNumber: positiveInt("matchNumber"),
})

export const ClearMatchResultsSchema = CreateEmptyMatchSchema

export const MatchResultImportSchema = z.object({
  uuid: nonEmptyString("results[].uuid"),
  timeMs: z.union([
    z
      .number("results[].timeMs must be a number.")
      .int("results[].timeMs must be an integer."),
    z.null(),
  ]),
  dnf: z.boolean("results[].dnf must be a boolean."),
  placement: z.union([
    z
      .int("results[].placement must be an integer.")
      .min(1, "results[].placement must be at least 1."),
    z.null(),
  ]),
  pointsWon: z
    .number("results[].pointsWon must be a number.")
    .nonnegative("results[].pointsWon must be at least 0."),
})

export const ImportMatchSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  matchNumber: positiveInt("matchNumber"),
  rankedMatchId: nonEmptyString("rankedMatchId"),
  results: z.array(MatchResultImportSchema, "results must be an array."),
})

export const PointAdjustmentSchema = z.object({
  leagueTier: positiveInt("leagueTier"),
  weekNumber: positiveInt("weekNumber"),
  uuid: nonEmptyString("uuid"),
  manualAdjustmentPoints: z.number("manualAdjustmentPoints must be a number."),
})

export const MovementSchema = z
  .object({
    leagueTier: positiveInt("leagueTier"),
    weekNumber: positiveInt("weekNumber"),
    promotedUuids: z.array(
      z.string("promotedUuids entries must be strings.").min(1),
      "promotedUuids must be an array."
    ),
    demotedUuids: z.array(
      z.string("demotedUuids entries must be strings.").min(1),
      "demotedUuids must be an array."
    ),
  })
  .superRefine((value, ctx) => {
    const demotedLookup = new Set(value.demotedUuids)
    const overlap = value.promotedUuids.filter((uuid) =>
      demotedLookup.has(uuid)
    )
    if (overlap.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "A uuid cannot be both promoted and demoted.",
        path: ["promotedUuids"],
      })
    }
  })

export const ListPlayerMatchesSchema = z
  .object({
    uuid: z.string().min(1).optional(),
    playerName: z.string().min(1).optional(),
    weekNumber: z.coerce
      .number("weekNumber must be a number.")
      .int("weekNumber must be an integer.")
      .min(1, "weekNumber must be at least 1."),
  })
  .refine((v) => v.uuid !== undefined || v.playerName !== undefined, {
    message: "Either uuid or playerName must be provided.",
    path: ["uuid"],
  })
