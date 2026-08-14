import type { Doc } from "../../../../convex/_generated/dataModel";
import { UserDetailValue } from "@/components/UserDetailValue";
import { UserRoleBadges } from "@/components/UserRoleBadges";
import { getLeagueListLabel } from "@/lib/userAccess";

export function UserIdentitySummary({
  leagues,
  user,
}: {
  leagues: Doc<"leagues">[];
  user: Doc<"users">;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <UserDetailValue
        label="Discord ID"
        value={user.discordId ?? "No Discord ID"}
      />
      <UserDetailValue label="Status" value={user.status} />
      <UserDetailValue
        label="Host leagues"
        value={getLeagueListLabel(leagues, user.hostLeagueId)}
      />
      <UserDetailValue
        className="sm:col-span-2"
        label="Roles"
        value={<UserRoleBadges roles={user.roles} />}
      />
    </div>
  );
}
