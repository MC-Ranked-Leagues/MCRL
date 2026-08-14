import { useAuthActions } from "@convex-dev/auth/react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConvexAuth, useQuery } from "convex/react";
import { Navigate } from "react-router";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";

export function PendingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  if (isLoading || user === undefined) {
    return <PendingShell label="Checking account state" />;
  }

  if (!isAuthenticated || user === null) {
    return <Navigate replace to="/" />;
  }

  if (user.status !== "pending") {
    return <Navigate replace to="/app" />;
  }

  const pendingUser = user;

  return (
    <PendingShell>
      <Pending user={pendingUser} />
    </PendingShell>
  );
}

function Pending({ user }: { user: Doc<"users"> }) {
  const { signOut } = useAuthActions();

  return (
    <div className="space-y-6 text-center text-lg">
      <p>
        Your account is currently unverified and pending approval. Dm a seed
        manager to get approved.
      </p>

      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            {user.name}
            {user.discordId ? ` - ${user.discordId}` : null}
          </CardDescription>
        </CardHeader>

        <CardFooter className="w-full flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            onClick={() => void signOut()}
          >
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function PendingShell({
  children,
  label,
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        {children ?? (
          <p className="text-sm text-muted-foreground">{label ?? "Loading"}</p>
        )}
      </div>
    </div>
  );
}
