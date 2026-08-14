import { Badge } from "@/components/ui/badge";
import type { SeedStatus } from "@/lib/seedStatus";

export function SeedStatusBadge({ status }: { status: SeedStatus }) {
  if (status === "expired") {
    return <Badge variant="outline">Expired</Badge>;
  }

  if (status === "used") {
    return <Badge variant="destructive">Used</Badge>;
  }

  if (status === "open") {
    return <Badge variant="outline">Open</Badge>;
  }

  if (status === "assigned") {
    return <Badge variant="secondary">Assigned</Badge>;
  }

  if (status === "claimed") {
    return <Badge variant="outline">Claimed</Badge>;
  }

  return <Badge variant="outline">Unassigned</Badge>;
}
