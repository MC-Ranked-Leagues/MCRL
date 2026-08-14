export function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}
