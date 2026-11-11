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
  // Defaulted because browsers can hold cached responses from before Seed
  // Manager published this field.
  replayKey: z.string().nullable().default(null),
});

export const SeedHistoryResponseSchema = z.array(PublishedSeedSchema);

export type PublishedSeed = z.infer<typeof PublishedSeedSchema>;

export const SEED_TYPE_LABELS: Record<
  z.infer<typeof PublishedSeedTypeSchema>,
  string
> = {
  BURIED_TREASURE: "Buried Treasure",
  VILLAGE: "Village",
  DESERT_TEMPLE: "Desert Temple",
  JUNGLE_PYRAMID: "Jungle Pyramid",
  RUINED_PORTAL: "Ruined Portal",
  SHIPWRECK: "Shipwreck",
};
