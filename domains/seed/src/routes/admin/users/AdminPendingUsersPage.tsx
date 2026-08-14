import { useQuery } from "convex/react";
import { Clock, Users } from "lucide-react";
import { Outlet, useNavigate, useParams } from "react-router";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserIdentifierLabel, getUserLabel } from "@/lib/userAccess";
import { cn } from "@/lib/utils";

export function AdminPendingUsersPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const pendingUsers = useQuery(api.users.listPendingUsers);
  const isLoading = pendingUsers === undefined;
  const isUserSheetOpen = Boolean(userId);

  const handleUserSheetOpenChange = (open: boolean) => {
    if (!open) {
      void navigate("/app/admin/users/pending");
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <section className="flex h-full min-h-0 min-w-0 flex-col gap-5 overflow-y-auto overscroll-contain pr-2 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="mt-2 text-2xl font-semibold">Pending users</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review signed-in accounts that are waiting for approval.
            </p>
          </div>
          <Badge variant="outline">
            {isLoading
              ? "Loading"
              : getPendingUserCountLabel(pendingUsers.length)}
          </Badge>
        </div>

        {isLoading ? (
          <AdminPendingUsersTableSkeleton />
        ) : pendingUsers.length === 0 ? (
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No pending users</EmptyTitle>
              <EmptyDescription>
                Pending users will appear here after they sign in for the first
                time.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <AdminPendingUsersTable
            activeUserId={userId as Id<"users"> | undefined}
            onUserSelect={(selectedUserId) =>
              void navigate(`/app/admin/users/pending/${selectedUserId}`)
            }
            users={pendingUsers}
          />
        )}
      </section>

      <Sheet open={isUserSheetOpen} onOpenChange={handleUserSheetOpenChange}>
        <SheetContent
          className="overflow-y-auto p-6 data-[side=right]:sm:max-w-xl"
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Pending user details</SheetTitle>
          </SheetHeader>
          <Outlet />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AdminPendingUsersTable({
  activeUserId,
  onUserSelect,
  users,
}: {
  activeUserId?: Id<"users">;
  onUserSelect: (userId: Id<"users">) => void;
  users: Doc<"users">[];
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table containerClassName="max-h-[calc(100svh-12rem)]">
        <TableHeader>
          <TableRow>
            <TableHead className="border-r text-left">User</TableHead>
            <TableHead className="border-r">Discord ID</TableHead>
            <TableHead className="border-r">Signed in</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user._id}
              className={cn(
                "cursor-pointer",
                activeUserId === user._id && "bg-muted/50",
              )}
              onClick={() => onUserSelect(user._id)}
            >
              <TableCell className="border-r">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{getUserLabel(user)}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {getUserIdentifierLabel(user)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="border-r text-muted-foreground">
                {user.discordId ?? "No Discord ID"}
              </TableCell>
              <TableCell className="border-r text-muted-foreground">
                {formatUserCreatedAt(user._creationTime)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  <Clock data-icon="inline-start" />
                  Pending
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminPendingUsersTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border" aria-busy="true">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="border-r text-left">User</TableHead>
            <TableHead className="border-r">Discord ID</TableHead>
            <TableHead className="border-r">Signed in</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="border-r">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </TableCell>
              <TableCell className="border-r">
                <Skeleton className="h-5 w-40" />
              </TableCell>
              <TableCell className="border-r">
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatUserCreatedAt(creationTime: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(creationTime));
}

function getPendingUserCountLabel(userCount: number) {
  return userCount === 1 ? "1 pending user" : `${userCount} pending users`;
}
