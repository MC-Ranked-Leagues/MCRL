import z from "zod";
import { seedTypesArray } from "./consts";
import type { Id } from "@/convex/_generated/dataModel";

export const seedTypeValidator = z.enum(seedTypesArray);
export const seedValueValidator = z
  .string("Seed values must be strings")
  .trim()
  .min(1, "Seed value is required")
  .regex(/^-?[0-9]+$/, "Seed values must be a whole number");

export const validateManualSeedForm = z.object({
  leagueId: z.string("Select a league").transform((s) => s as Id<"leagues">),
  overworld: seedValueValidator,
  nether: seedValueValidator,
  end: seedValueValidator,
  rng: seedValueValidator,
  type: seedTypeValidator,
});
