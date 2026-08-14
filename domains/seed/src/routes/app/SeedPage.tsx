import { useMutation, useQuery } from "convex/react";
import { ArrowRightLeft, CheckCircle2, Sprout, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeleteSeedDialog } from "@/components/DeleteSeedDialog";
import { SeedCommentsSection } from "@/components/SeedCommentsSection";
import { SeedStatusBadge } from "@/components/SeedStatusBadge";
import { SeedValueDisplay } from "@/components/SeedValueDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SEED_TYPES } from "@/lib/consts";
import { getErrorMessage } from "@/lib/errors";
import { getLeagueListLabel } from "@/lib/userAccess";

export function SeedPage() {
  const { leagueId, seedId } = useParams();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [usedError, setUsedError] = useState<string | null>(null);
  const [leagueChangeError, setLeagueChangeError] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingUsed, setIsMarkingUsed] = useState(false);
  const [isChangingLeague, setIsChangingLeague] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMarkUsedDialogOpen, setIsMarkUsedDialogOpen] = useState(false);
  const [isChangeLeagueDialogOpen, setIsChangeLeagueDialogOpen] =
    useState(false);
  const [targetLeagueId, setTargetLeagueId] = useState<Id<"leagues"> | null>(
    null,
  );
  const selectedLeagueId = leagueId as Id<"leagues"> | undefined;
  const selectedSeedId = seedId as Id<"seeds"> | undefined;
  const user = useQuery(api.users.currentUser);
  const settings = useQuery(api.settings.current);
  const leagues = useQuery(api.leagues.listLeagues);
  const seed = useQuery(
    api.seeds.getSeedForLeague,
    selectedLeagueId && selectedSeedId
      ? { leagueId: selectedLeagueId, seedId: selectedSeedId }
      : "skip",
  );
  const deleteSeed = useMutation(api.seeds.deleteSeed);
  const markSeedUsed = useMutation(api.seeds.markSeedUsed);
  const changeSeedLeague = useMutation(api.seeds.changeSeedLeague);

  const handleDelete = async () => {
    if (!selectedLeagueId || !selectedSeedId) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteSeed({ seedId: selectedSeedId });
      setIsDeleteDialogOpen(false);
      void navigate(`/app/league/${selectedLeagueId}`, { replace: true });
    } catch (error) {
      setDeleteError(getErrorMessage(error, "Could not delete this seed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkUsed = async () => {
    if (!selectedSeedId) {
      return;
    }

    setUsedError(null);
    setIsMarkingUsed(true);

    try {
      await markSeedUsed({ seedId: selectedSeedId });
      setIsMarkUsedDialogOpen(false);
    } catch (error) {
      setUsedError(getErrorMessage(error, "Could not mark this seed used"));
    } finally {
      setIsMarkingUsed(false);
    }
  };

  const handleChangeLeagueDialogOpen = (open: boolean) => {
    setIsChangeLeagueDialogOpen(open);
    setLeagueChangeError(null);

    if (!open) {
      setTargetLeagueId(null);
    }
  };

  const handleChangeLeague = async () => {
    if (!selectedSeedId || !targetLeagueId) {
      return;
    }

    setLeagueChangeError(null);
    setIsChangingLeague(true);

    try {
      await changeSeedLeague({
        seedId: selectedSeedId,
        leagueId: targetLeagueId,
      });
      setIsChangeLeagueDialogOpen(false);
      void navigate(`/app/league/${targetLeagueId}/seed/${selectedSeedId}`);
    } catch (error) {
      setLeagueChangeError(
        getErrorMessage(error, "Could not change this seed's league"),
      );
    } finally {
      setIsChangingLeague(false);
    }
  };

  if (seed === undefined || user === undefined || settings === undefined) {
    return <SeedDetailsSkeleton />;
  }

  if (!seed) {
    return (
      <Empty className="min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sprout />
          </EmptyMedia>
          <EmptyTitle>Seed not found</EmptyTitle>
          <EmptyDescription>
            This seed is not assigned to the current league.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const currentLeague = leagues?.find((league) => league._id === seed.leagueId);
  const canChangeLeagueAssignment =
    leagues !== undefined && canChangeLeague(seed, user);
  let deleteDisabledReason: string | null = null;
  if (!user) {
    deleteDisabledReason = "Sign in to delete this seed.";
  } else if (seed.isExpired) {
    deleteDisabledReason =
      "Expired seeds can only be deleted from the admin seed archive.";
  } else if (seed.isUsed) {
    deleteDisabledReason =
      "Used seeds can only be deleted from the admin seed archive.";
  } else if (!settings) {
    deleteDisabledReason = "Tournament settings are unavailable.";
  } else if (settings.seedTestingPaused) {
    deleteDisabledReason =
      "Seeds cannot be deleted while seed testing is paused.";
  } else {
    const hasDeletePermission =
      user.roles.includes("admin") ||
      seed.addedBy === user._id ||
      (seed.leagueId !== undefined &&
        user.roles.includes("host") &&
        (user.hostLeagueId ?? []).includes(seed.leagueId));

    if (!hasDeletePermission) {
      deleteDisabledReason = "You do not have permission to delete this seed.";
    }
  }
  const targetLeague = leagues?.find((league) => league._id === targetLeagueId);
  const addedByname = seed.addedByUser?.name ?? "an unknown user";
  const addedByUploadingLeagues = getLeagueListLabel(
    leagues ?? [],
    seed.addedByUser?.uploaderLeagueIds,
  );
  const addedByHostLeagues = getLeagueListLabel(
    leagues ?? [],
    seed.addedByUser?.hostLeagueIds,
  );
  const currentLeagueName = currentLeague?.leagueName ?? "this league";
  const targetLeagueName = targetLeague?.leagueName ?? "the selected league";

  return (
    <>
      <AlertDialog
        open={isMarkUsedDialogOpen}
        onOpenChange={setIsMarkUsedDialogOpen}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="min-w-0 text-xl font-semibold leading-tight">
                {seed.type ? SEED_TYPES[seed.type] : "Unspecified seed"}
              </h2>
              {user!.roles.includes("admin") && seed.addedByUser && (
                <span className="text-sm text-muted-foreground">
                  Added by {addedByname ?? "Unknown user"}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canChangeLeagueAssignment && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label="Change seed league"
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                    onClick={() => handleChangeLeagueDialogOpen(true)}
                    type="button"
                  >
                    <ArrowRightLeft />
                  </TooltipTrigger>
                  <TooltipContent>Change seed league</TooltipContent>
                </Tooltip>
              )}
              {seed.isUsed && <SeedStatusBadge status="used" />}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SeedValueDisplay label="Overworld" value={seed.overworld} />
            <SeedValueDisplay label="Nether" value={seed.nether} />
            <SeedValueDisplay label="End" value={seed.end} />
            <SeedValueDisplay label="RNG" value={seed.rng} />
          </div>

          <div className="flex w-full items-center justify-end gap-2">
            {canMarkUsed(seed, user) && (
              <Button
                aria-label={
                  seed.isUsed ? "Seed already used" : "Mark seed as used"
                }
                disabled={seed.isUsed || isMarkingUsed}
                onClick={() => {
                  setUsedError(null);
                  setIsMarkUsedDialogOpen(true);
                }}
                size="lg"
                type="button"
              >
                <CheckCircle2 data-icon="inline-start" />
                {seed.isUsed
                  ? "Seed used"
                  : isMarkingUsed
                    ? "Marking used"
                    : "Mark as used"}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  aria-label="Delete seed"
                  disabled={deleteDisabledReason !== null || isDeleting}
                  onClick={() => {
                    setDeleteError(null);
                    setIsDeleteDialogOpen(true);
                  }}
                  size="icon-lg"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {deleteDisabledReason ?? "Delete seed"}
              </TooltipContent>
            </Tooltip>
          </div>

          {deleteError && !isDeleteDialogOpen && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}
          {usedError && !isMarkUsedDialogOpen && (
            <p className="text-xs text-destructive">{usedError}</p>
          )}
          {leagueChangeError && !isChangeLeagueDialogOpen && (
            <p className="text-xs text-destructive">{leagueChangeError}</p>
          )}

          <div className="flex min-h-0 flex-1 flex-col border-t pt-3">
            <SeedCommentsSection
              autoFocus
              canCreateComments={
                user?.roles.includes("uploader") ||
                user?.roles.includes("host") ||
                false
              }
              className="min-h-0 flex-1"
              seedId={seed._id}
            />
          </div>
        </div>

        <AlertDialogContent>
          <AlertDialogTitle>Mark this seed as used?</AlertDialogTitle>
          <AlertDialogDescription>
            Warning: Marking a seed as used publishes it immediately. Only
            admins can reverse this action.
          </AlertDialogDescription>
          {usedError && <p className="text-xs text-destructive">{usedError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingUsed}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isMarkingUsed}
              onClick={() => void handleMarkUsed()}
            >
              {isMarkingUsed ? "Marking used" : "Mark used"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteSeedDialog
        deleting={isDeleting}
        error={deleteError}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeleteError(null);
        }}
        open={isDeleteDialogOpen}
      />

      <AlertDialog
        open={isChangeLeagueDialogOpen}
        onOpenChange={handleChangeLeagueDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Change this seed's league?</AlertDialogTitle>
          <AlertDialogDescription>
            <p>
              Moving a seed means that for the time this seed was in{" "}
              {currentLeagueName}, it was visible to uploaders who play in the
              target league.
            </p>
            <p className="mt-2">
              Added by <b>{addedByname}</b>.
            </p>
            <p className="mt-2">
              Uploader leagues: <b>{addedByUploadingLeagues}</b>.
            </p>
            <p className="mt-2">
              Host leagues: <b>{addedByHostLeagues}</b>.
            </p>
          </AlertDialogDescription>

          <Select
            value={targetLeagueId}
            itemToStringLabel={(leagueId) =>
              leagues?.find((league) => league._id === leagueId)?.leagueName ??
              "Unknown league"
            }
            onValueChange={setTargetLeagueId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a new league" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available leagues</SelectLabel>
                {(leagues ?? []).map((league) => (
                  <SelectItem
                    key={league._id}
                    disabled={league._id === seed.leagueId}
                    value={league._id}
                  >
                    {league.leagueName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {targetLeague && (
            <p className="text-xs text-muted-foreground">
              The seed will move to {targetLeagueName}.
            </p>
          )}
          {leagueChangeError && (
            <p className="text-xs text-destructive">{leagueChangeError}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isChangingLeague}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!targetLeagueId || isChangingLeague}
              onClick={() => void handleChangeLeague()}
              variant="destructive"
            >
              {isChangingLeague ? "Changing league" : "Change league"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function canMarkUsed(
  seed: {
    leagueId?: Id<"leagues">;
    isExpired?: boolean;
    isUsed: boolean;
  },
  user: {
    roles: Array<"admin" | "host" | "uploader">;
    hostLeagueId?: Id<"leagues">[];
  } | null,
) {
  if (!user || seed.leagueId === undefined || seed.isExpired) {
    return false;
  }

  if (user.roles.includes("admin")) {
    return true;
  }

  return (
    user.roles.includes("host") &&
    (user.hostLeagueId ?? []).includes(seed.leagueId)
  );
}

function canChangeLeague(
  seed: {
    leagueId?: Id<"leagues">;
    isExpired?: boolean;
    isUsed: boolean;
  },
  user: {
    roles: Array<"admin" | "host" | "uploader">;
  } | null,
) {
  return (
    Boolean(user?.roles.includes("admin")) &&
    seed.leagueId !== undefined &&
    seed.isExpired !== true &&
    !seed.isUsed
  );
}

function SeedDetailsSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Skeleton className="h-8 w-52" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="min-h-0 flex-1 w-full" />
    </div>
  );
}
