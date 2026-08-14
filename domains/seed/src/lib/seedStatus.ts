export type SeedStatus =
  | "expired"
  | "used"
  | "open"
  | "assigned"
  | "claimed"
  | "unassigned";

export function getSeedStatus(seed: {
  isUsed: boolean;
  isExpired?: boolean;
  leagueId?: string;
}): SeedStatus {
  if (seed.isExpired) {
    return "expired";
  }

  if (seed.isUsed) {
    return "used";
  }

  if (seed.leagueId) {
    return "assigned";
  }

  return "unassigned";
}
