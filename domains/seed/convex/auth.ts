import Discord from "@auth/core/providers/discord";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import {
  createPendingDiscordUser,
  getDiscordAvatarUrl,
  updateUserFromDiscordProfile,
} from "./lib/authUsers";
import type { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Discord({
      authorization: "https://discord.com/oauth2/authorize?scope=identify",
      profile(profile) {
        const name = profile.username;

        return {
          id: profile.id,
          discordId: profile.id,
          name,
          username: name,
          image: getDiscordAvatarUrl(profile),
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Fully replace Convex Auth's default upsert logic.
     * Must return either an existing user ID or the newly inserted one.
     */
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.provider.id !== "discord") {
        throw new ConvexError("Unsupported sign-in provider");
      }

      if (args.existingUserId) {
        await updateUserFromDiscordProfile(
          ctx,
          args.existingUserId,
          args.profile,
        );
        return args.existingUserId;
      }

      return await createPendingDiscordUser(ctx, args.profile);
    },
  },
});
