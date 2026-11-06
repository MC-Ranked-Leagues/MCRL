import type { api } from "@mcrl/backend/api";
import type { FunctionReturnType } from "convex/server";

export type WeekStanding = FunctionReturnType<
  typeof api.weekView.getWeekStandings
>[number];

export type WeekMatch = FunctionReturnType<
  typeof api.weekView.getWeekMatches
>[number];

export type League = FunctionReturnType<typeof api.leagues.listLeagues>[number];

export type Week = FunctionReturnType<typeof api.weekView.getAllWeeks>[number];
