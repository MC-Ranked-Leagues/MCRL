import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Navigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import { Button } from "../../components/ui/button";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn } = useAuthActions();

  if (isLoading || (isAuthenticated && user === undefined)) {
    return <AuthScreen label="Checking session" />;
  }

  if (isAuthenticated && user?.status === "pending") {
    return <Navigate replace to="/pending" />;
  }

  if (isAuthenticated && user?.status === "active") {
    return <Navigate replace to="/app" />;
  }

  return (
    <AuthScreen
      action={
        <Button
          className="self-center"
          onClick={() => void signIn("discord")}
          size="lg"
        >
          Log in with Discord
        </Button>
      }
      description="Sign in with Discord to access the app."
      title="Seed Manager"
    />
  );
}

function AuthScreen({
  action,
  description,
  label,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  label?: string;
  title?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold">{title ?? label}</h1>
        <p className="text-sm text-muted-foreground">
          {description ?? label ?? "Loading"}
        </p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}
