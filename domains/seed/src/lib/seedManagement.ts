export const SEED_MODIFICATIONS_SESSION_KEY =
  "seed-manager.admin-seed-modifications-enabled";

export function clearSeedModificationSession() {
  sessionStorage.removeItem(SEED_MODIFICATIONS_SESSION_KEY);
}
