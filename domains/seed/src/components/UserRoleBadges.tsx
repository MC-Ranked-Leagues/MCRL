import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/userAccess";

export function UserRoleBadges({ roles }: { roles: UserRole[] }) {
  if (roles.length === 0) {
    return <Badge variant="outline">No roles</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge
          key={role}
          variant={role === "admin" ? "destructive" : "secondary"}
        >
          {role}
        </Badge>
      ))}
    </div>
  );
}
