/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as development from "../development.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as leagues from "../leagues.js";
import type * as lib_playerFastestTime from "../lib/playerFastestTime.js";
import type * as lib_playerListEntry from "../lib/playerListEntry.js";
import type * as lib_readModels from "../lib/readModels.js";
import type * as lib_registrationAverage from "../lib/registrationAverage.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_weekStandings from "../lib/weekStandings.js";
import type * as migrations from "../migrations.js";
import type * as playerStats from "../playerStats.js";
import type * as players from "../players.js";
import type * as readAPI from "../readAPI.js";
import type * as weekView from "../weekView.js";
import type * as weeks from "../weeks.js";
import type * as writeApi from "../writeApi.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  development: typeof development;
  http: typeof http;
  leaderboard: typeof leaderboard;
  leagues: typeof leagues;
  "lib/playerFastestTime": typeof lib_playerFastestTime;
  "lib/playerListEntry": typeof lib_playerListEntry;
  "lib/readModels": typeof lib_readModels;
  "lib/registrationAverage": typeof lib_registrationAverage;
  "lib/utils": typeof lib_utils;
  "lib/validators": typeof lib_validators;
  "lib/weekStandings": typeof lib_weekStandings;
  migrations: typeof migrations;
  playerStats: typeof playerStats;
  players: typeof players;
  readAPI: typeof readAPI;
  weekView: typeof weekView;
  weeks: typeof weeks;
  writeApi: typeof writeApi;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
