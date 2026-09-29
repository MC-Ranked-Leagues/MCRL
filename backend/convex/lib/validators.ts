import { z } from "zod";

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
  });
