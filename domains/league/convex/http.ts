import { httpRouter } from "convex/server"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import {
  ClearMatchResultsSchema,
  CompetitionSchema,
  CompetitionStatusSchema,
  CreateEmptyMatchSchema,
  ImportMatchSchema,
  MovementSchema,
  PointAdjustmentSchema,
  RegisterPlayerSchema,
  UpdatePlayerLeagueSchema,
  UnregisterPlayerSchema,
  ListPlayerMatchesSchema,
} from "./lib/validators"
import {
  extractQueryParams,
  extractRequestBody,
  jsonError,
  jsonResponse,
  validateApiKey,
} from "./lib/utils"
import { z } from "zod"

const http = httpRouter()

type RouteResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; status: number; error: string }

async function runProtectedJsonRoute<T>(args: {
  request: Request
  schema: z.ZodType<T>
  routeLabel: string
  run: (payload: T) => Promise<RouteResult>
  successStatus?: number
}) {
  const authError = await validateApiKey(args.request, "WRITER_API_KEY")
  if (authError) return authError

  const bodyResult = await extractRequestBody(args.request, args.schema)
  if ("errorResponse" in bodyResult) return bodyResult.errorResponse

  try {
    const result = await args.run(bodyResult.data)
    if (result.ok === false) {
      return jsonError(result.error, result.status)
    }

    console.info(`[${args.routeLabel}] Success`, result)
    return jsonResponse(result, args.successStatus ?? 200)
  } catch (error) {
    console.error(`[${args.routeLabel}] Unhandled error`, error)
    return jsonError("Internal server error.", 500)
  }
}

async function runReadRoute<T>(args: {
  request: Request
  schema: z.ZodType<T>
  routeLabel: string
  run: (payload: T) => Promise<RouteResult>
}) {
  const authError = await validateApiKey(args.request, "READER_API_KEY") // uses READER_API_KEY
  if (authError) return authError

  const paramResult = extractQueryParams(args.request, args.schema) // query params, no Content-Type needed
  if ("errorResponse" in paramResult) return paramResult.errorResponse

  try {
    const result = await args.run(paramResult.data)
    if (result.ok === false) {
      return jsonError(result.error, result.status)
    }
    console.info(`[${args.routeLabel}] Success`, result)
    return jsonResponse(result)
  } catch (error) {
    console.error(`[${args.routeLabel}] Unhandled error`, error)
    return jsonError("Internal server error.", 500)
  }
}

http.route({
  path: "/api/write/competition",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: CompetitionSchema,
      routeLabel: "POST /api/write/competition",
      successStatus: 200,
      run: (payload) =>
        ctx.runMutation(internal.writeApi.createOrRestartCompetition, payload),
    })
  ),
})

http.route({
  path: "/api/write/competition/status",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: CompetitionStatusSchema,
      routeLabel: "PATCH /api/write/competition/status",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.updateCompetitionStatus, payload),
    })
  ),
})

http.route({
  path: "/api/write/player",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: RegisterPlayerSchema,
      routeLabel: "POST /api/write/player",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.registerPlayer, payload),
    })
  ),
})

http.route({
  path: "/api/write/player/unregister",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: UnregisterPlayerSchema,
      routeLabel: "PATCH /api/write/player",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.unregisterPlayer, payload),
    })
  ),
})

http.route({
  path: "/api/write/player/league",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: UpdatePlayerLeagueSchema,
      routeLabel: "PATCH /api/write/player/league",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.updatePlayerLeague, payload),
    })
  ),
})

http.route({
  path: "/api/write/match/create",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: CreateEmptyMatchSchema,
      routeLabel: "POST /api/write/match/create",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.createEmptyMatch, payload),
    })
  ),
})

http.route({
  path: "/api/write/match/clear",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: ClearMatchResultsSchema,
      routeLabel: "PATCH /api/write/match/clear",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.clearMatchResults, payload),
    })
  ),
})

http.route({
  path: "/api/write/match/results",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: ImportMatchSchema,
      routeLabel: "POST /api/write/match/results",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.importMatchData, payload),
    })
  ),
})

http.route({
  path: "/api/write/adjustment",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: PointAdjustmentSchema,
      routeLabel: "PATCH /api/write/adjustment",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.setPointAdjustment, payload),
    })
  ),
})

http.route({
  path: "/api/write/movements",
  method: "PATCH",
  handler: httpAction(async (ctx, request) =>
    runProtectedJsonRoute({
      request,
      schema: MovementSchema,
      routeLabel: "PATCH /api/write/movements",
      run: (payload) =>
        ctx.runMutation(internal.writeApi.processMovements, payload),
    })
  ),
})

// READ ROUTES

http.route({
  path: "/api/read/player/matches/latest",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    runReadRoute({
      request,
      schema: ListPlayerMatchesSchema,
      routeLabel: "GET /api/read/player/matches/latest",
      run: async (payload) => {
        const result = await ctx.runQuery(
          internal.readAPI.listPlayerMatches,
          payload
        )
        return { ok: true, ...result }
      },
    })
  ),
})

export default http
