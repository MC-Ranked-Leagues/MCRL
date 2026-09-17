import { RankedClient, RankedError } from "mcsrranked-sdk";

export const ranked = new RankedClient({ validation: "error" });

export const normalizeUuid = (uuid: string) =>
  uuid.replaceAll("-", "").toLowerCase();

export function rankedLookupErrorMessage(
  error: unknown,
  admin = false
): string {
  const details = (error instanceof RankedError ? error.details : undefined) as
    { error?: unknown; data?: { error?: unknown } } | undefined;
  const message = details?.data?.error ?? details?.error;
  return typeof message === "string" && message.includes("not exists")
    ? admin
      ? "No Minecraft account is linked to this Discord user on MCSR Ranked. Ask the player to link Discord in their Ranked profile settings."
      : "No Minecraft account is linked to your Discord on MCSR Ranked. Link Discord in your MCSR Ranked profile settings, then try again."
    : "An unexpected error occurred.";
}
