import { useMutation, useQuery } from "convex/react";
import { Beaker, CalendarClock, PauseCircle, PlayCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/errors";

type AdminWeekAction = "pause" | "resume" | "advance";

export function AdminIndexPage() {
  const settings = useQuery(api.settings.current);
  const pauseSeedTesting = useMutation(api.settings.pauseSeedTesting);
  const resumeSeedTesting = useMutation(api.settings.resumeSeedTesting);
  const advanceWeek = useMutation(api.settings.advanceWeek);
  const setJunglePyramidSeedsEnabled = useMutation(
    api.settings.setJunglePyramidSeedsEnabled
  );

  const [pendingAction, setPendingAction] = useState<AdminWeekAction | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [experimentalError, setExperimentalError] = useState<string | null>(
    null
  );
  const [isSavingExperimental, setIsSavingExperimental] = useState(false);

  const runAction = async (
    action: AdminWeekAction,
    callback: () => Promise<unknown>
  ) => {
    setError(null);
    setPendingAction(action);

    try {
      await callback();
      if (action === "advance") {
        setIsAdvanceDialogOpen(false);
      }
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Could not update week settings"));
    } finally {
      setPendingAction(null);
    }
  };

  const handleJunglePyramidChange = async (enabled: boolean) => {
    setExperimentalError(null);
    setIsSavingExperimental(true);

    try {
      await setJunglePyramidSeedsEnabled({ enabled });
    } catch (actionError) {
      setExperimentalError(
        getErrorMessage(actionError, "Could not update experimental features")
      );
    } finally {
      setIsSavingExperimental(false);
    }
  };

  return (
    <section className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="mt-2 text-2xl font-semibold">Admin dashboard</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage weekly testing state before players change home leagues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Weekly controls</CardTitle>
              <CardDescription>
                Pause and resume testing, or advance to the next week.
              </CardDescription>
            </div>
            {settings === undefined ? (
              <Skeleton className="h-6 w-28" />
            ) : settings === null ? (
              <Badge variant="outline">Not initialized</Badge>
            ) : (
              <Badge
                variant={settings.seedTestingPaused ? "outline" : "secondary"}
              >
                {settings.seedTestingPaused ? "Paused" : "Running"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {settings === undefined ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : settings === null ? (
            <Alert>
              <PauseCircle />
              <AlertTitle>Settings not initialized</AlertTitle>
              <AlertDescription>
                Run the internal settings initializer before weekly controls can
                be used.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">Current week</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {settings.currentWeekNumber}
                </p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">Testing state</p>
                <p className="text-3xl font-semibold">
                  {settings.seedTestingPaused ? "Paused" : "Running"}
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <PauseCircle />
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            disabled={
              settings === undefined ||
              settings === null ||
              settings.seedTestingPaused ||
              pendingAction !== null
            }
            onClick={() => {
              void runAction("pause", () => pauseSeedTesting({}));
            }}
            type="button"
            variant="outline"
          >
            <PauseCircle data-icon="inline-start" />
            {pendingAction === "pause" ? "Pausing" : "Pause testing"}
          </Button>

          <Button
            disabled={
              settings === undefined ||
              settings === null ||
              !settings.seedTestingPaused ||
              pendingAction !== null
            }
            onClick={() => {
              void runAction("resume", () => resumeSeedTesting({}));
            }}
            type="button"
            variant="outline"
          >
            <PlayCircle data-icon="inline-start" />
            {pendingAction === "resume" ? "Resuming" : "Resume testing"}
          </Button>

          <AlertDialog
            open={isAdvanceDialogOpen}
            onOpenChange={setIsAdvanceDialogOpen}
          >
            <Button
              disabled={
                settings === undefined ||
                settings === null ||
                pendingAction !== null
              }
              onClick={() => {
                setError(null);
                setIsAdvanceDialogOpen(true);
              }}
              type="button"
              variant="destructive"
            >
              <CalendarClock data-icon="inline-start" />
              Advance week
            </Button>
            <AlertDialogContent>
              <AlertDialogTitle>Advance to the next week?</AlertDialogTitle>
              <AlertDialogDescription>
                This pauses testing and expires active seeds from the current
                week.
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingAction === "advance"}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={pendingAction === "advance"}
                  onClick={() => {
                    void runAction("advance", () => advanceWeek({}));
                  }}
                  variant="destructive"
                >
                  {pendingAction === "advance" ? "Advancing" : "Advance week"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md border bg-muted p-2 text-muted-foreground">
              <Beaker className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>Experimental features</CardTitle>
              <CardDescription>
                Controll experimental features (not unstable code, just not yet
                ready to push)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {settings === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : settings === null ? (
            <Alert>
              <PauseCircle />
              <AlertTitle>Settings not initialized</AlertTitle>
              <AlertDescription>
                Initialize global settings before enabling experimental
                features.
              </AlertDescription>
            </Alert>
          ) : (
            <FieldGroup>
              <Field
                orientation="horizontal"
                data-disabled={isSavingExperimental}
              >
                <Switch
                  id="enable-jungle-pyramid-seeds"
                  checked={settings.enableJunglePyramidSeeds ?? false}
                  disabled={isSavingExperimental}
                  onCheckedChange={(checked) => {
                    void handleJunglePyramidChange(checked);
                  }}
                />
                <FieldContent>
                  <FieldLabel htmlFor="enable-jungle-pyramid-seeds">
                    Enable jungle pyramid seeds
                  </FieldLabel>
                  <FieldDescription>
                    Adds Jungle Pyramid to every seed upload form. Turn it off
                    to hide and reject new jungle pyramid uploads.
                  </FieldDescription>
                </FieldContent>
              </Field>

              {experimentalError && (
                <FieldError>{experimentalError}</FieldError>
              )}
            </FieldGroup>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
