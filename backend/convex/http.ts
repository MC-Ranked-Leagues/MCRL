import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { ListPlayerMatchesSchema } from "./lib/validators";
import {
  extractQueryParams,
  jsonError,
  jsonResponse,
  validateApiKey,
} from "./lib/utils";
import type { z } from "zod";

const http = httpRouter();

type RouteResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; status: number; error: string };

async function runReadRoute<T>(args: {
  request: Request;
  schema: z.ZodType<T>;
  routeLabel: string;
  run: (payload: T) => Promise<RouteResult>;
}) {
  const authError = await validateApiKey(args.request, "READER_API_KEY"); // uses READER_API_KEY
  if (authError) return authError;

  const paramResult = extractQueryParams(args.request, args.schema); // query params, no Content-Type needed
  if ("errorResponse" in paramResult) return paramResult.errorResponse;

  try {
    const result = await args.run(paramResult.data);
    if (result.ok === false) {
      return jsonError(result.error, result.status);
    }
    console.info(`[${args.routeLabel}] Success`, result);
    return jsonResponse(result);
  } catch (error) {
    console.error(`[${args.routeLabel}] Unhandled error`, error);
    return jsonError("Internal server error.", 500);
  }
}

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
        );
        return { ok: true, ...result };
      },
    })
  ),
});

export default http;
