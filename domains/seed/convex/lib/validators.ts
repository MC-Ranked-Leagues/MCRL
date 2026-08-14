import z from "zod";

export const UpdatePlayerRolesSchema = z
  .object({
    discordId: z.string().trim().min(1),
    role: z.enum(["admin", "host", "uploader"]),
    operation: z.enum(["add", "remove"]),
    leagueNumbers: z.array(z.number().int().positive()).min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.role === "admin" && value.leagueNumbers !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["leagueNumbers"],
        message: "The admin role cannot be assigned to leagues",
      });
    }
  });

export const DiscordUserInfoQuerySchema = z.object({
  discordId: z.string().trim().min(1),
});

export const DiscordUserStatusSchema = z.object({
  discordId: z.string().trim().min(1),
});

export const SeedHistoryQuerySchema = z.object({
  leagueNumber: z.coerce.number().int().positive(),
  weekNumber: z.coerce.number().int().positive(),
});

export const SeedOrderQuerySchema = z.object({
  leagueNumber: z.coerce.number().int().positive(),
});
