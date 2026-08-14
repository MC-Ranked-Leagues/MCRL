import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-semibold">Route not found</h1>
        <p className="text-sm text-muted-foreground">
          You messing with the url bar huhh?
        </p>
        <Link className="text-sm underline underline-offset-4" to="/">
          Back to login
        </Link>
      </div>
    </div>
  );
}
