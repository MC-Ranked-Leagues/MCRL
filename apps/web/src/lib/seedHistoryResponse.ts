import { z } from "zod";

export const PublishedSeedTypeSchema = z.enum([
  "BURIED_TREASURE",
  "VILLAGE",
  "DESERT_TEMPLE",
  "JUNGLE_PYRAMID",
  "RUINED_PORTAL",
  "SHIPWRECK",
]);

export const PublishedSeedSchema = z.object({
  order: z.number().int().positive(),
  overworld: z.string(),
  nether: z.string(),
  end: z.string(),
  rng: z.string(),
  type: PublishedSeedTypeSchema.nullable(),
});

export const SeedHistoryResponseSchema = z.array(PublishedSeedSchema);

export type PublishedSeed = z.infer<typeof PublishedSeedSchema>;
