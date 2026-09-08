import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { buildPlayerListEntry } from "./lib/playerListEntry";

export const listPlayersInLeague = query({
  args: {
    leagueTier: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_league", (q) =>
        q.eq("currentLeagueNumber", args.leagueTier)
      )
      .collect();
  },
});

export const getPlayerByName = internalQuery({
  args: {
    ign: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_ign", (q) => q.eq("ign", args.ign))
      .unique();
  },
});

export const findPlayerByName = query({
  args: {
    ign: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_lowercase_ign", (q) =>
        q.eq("lowercaseIgn", args.ign.trim().toLocaleLowerCase())
      )
      .unique();

    if (!player) return null;

    return buildPlayerListEntry(player, null);
  },
});

export const searchPlayers = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.searchTerm.trim().toLocaleLowerCase();
    if (!searchTerm) return [];

    const players = await ctx.db
      .query("players")
      .withSearchIndex("search_lowercase_ign", (q) =>
        q.search("lowercaseIgn", searchTerm)
      )
      .take(20);

    return players.map((player) => buildPlayerListEntry(player, null));
  },
});
