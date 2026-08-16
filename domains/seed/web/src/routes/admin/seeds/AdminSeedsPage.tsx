import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowDown,
  ArrowUp,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Sprout,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { SeedValueTableCell } from "@/components/SeedValueTableCell";
import { DeleteSeedDialog } from "@/components/DeleteSeedDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SEED_TYPES } from "@/lib/consts";
import { getErrorMessage } from "@/lib/errors";
import { SEED_MODIFICATIONS_SESSION_KEY } from "@/lib/seedManagement";
import { getSeedCountLabel } from "@/lib/utils";
import { SeedManagementDialog } from "./SeedManagementDialog";

type ManagedSeed = FunctionReturnType<
  typeof api.seedManagement.listSeeds
>[number];

export function AdminSeedsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const leagues = useQuery(api.leagues.listLeagues);
  const settings = useQuery(api.settings.current);
  const reorderSeed = useMutation(api.seedManagement.reorderSeed);
  const deleteSeed = useMutation(api.seedManagement.deleteSeed);
  const [modificationsEnabled, setModificationsEnabled] = useState(
    () => sessionStorage.getItem(SEED_MODIFICATIONS_SESSION_KEY) === "enabled"
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSeed, setEditingSeed] = useState<ManagedSeed | null>(null);
  const [deletingSeed, setDeletingSeed] = useState<ManagedSeed | null>(null);
  const [reordering, setReordering] = useState<{
    seedId: ManagedSeed["_id"];
    movement: "UP" | "DOWN";
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestedLeagueId = searchParams.get("league");
  const requestedWeekNumber = Number(searchParams.get("week"));
  const selectedLeague =
    leagues?.find((league) => league._id === requestedLeagueId) ?? leagues?.[0];
  const selectedWeekNumber =
    settings &&
    Number.isSafeInteger(requestedWeekNumber) &&
    requestedWeekNumber >= 1 &&
    requestedWeekNumber <= settings.currentWeekNumber
      ? requestedWeekNumber
      : settings?.currentWeekNumber;

  useEffect(() => {
    const firstLeague = leagues?.[0];
    if (!settings || !firstLeague) return;

    const nextParams = new URLSearchParams(searchParams);
    const hasValidLeague = leagues.some(
      (league) => league._id === requestedLeagueId
    );
    const hasValidWeek =
      Number.isSafeInteger(requestedWeekNumber) &&
      requestedWeekNumber >= 1 &&
      requestedWeekNumber <= settings.currentWeekNumber;

    if (!hasValidLeague) nextParams.set("league", firstLeague._id);
    if (!hasValidWeek) {
      nextParams.set("week", String(settings.currentWeekNumber));
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    leagues,
    requestedLeagueId,
    requestedWeekNumber,
    searchParams,
    setSearchParams,
    settings,
  ]);

  const seeds = useQuery(
    api.seedManagement.listSeeds,
    selectedLeague && selectedWeekNumber !== undefined
      ? {
          leagueId: selectedLeague._id,
          weekNumber: selectedWeekNumber,
        }
      : "skip"
  );
  const leagueItems = useMemo(
    () =>
      (leagues ?? []).map((league) => ({
        label: league.leagueName,
        value: league._id,
      })),
    [leagues]
  );
  const weekItems = useMemo(
    () =>
      Array.from({ length: settings?.currentWeekNumber ?? 0 }, (_, index) => ({
        label: `Week ${index + 1}`,
        value: index + 1,
      })),
    [settings?.currentWeekNumber]
  );
  const isCurrentWeek =
    selectedWeekNumber !== undefined &&
    selectedWeekNumber === settings?.currentWeekNumber;
  const addDisabled =
    !modificationsEnabled || isCurrentWeek || selectedLeague === undefined;
  const addTooltip = !modificationsEnabled
    ? "Enable modifications before adding seeds."
    : isCurrentWeek
      ? "Current week seeds are added through the existing workflows."
      : "Add a used seed to this historical week.";

  const updateModificationMode = (enabled: boolean) => {
    setModificationsEnabled(enabled);
    if (enabled) {
      sessionStorage.setItem(SEED_MODIFICATIONS_SESSION_KEY, "enabled");
    } else {
      sessionStorage.removeItem(SEED_MODIFICATIONS_SESSION_KEY);
    }
  };

  const updateSelection = (key: "league" | "week", value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(key, value);
    setSearchParams(nextParams, { replace: true });
  };

  const handleReorder = async (seed: ManagedSeed, movement: "UP" | "DOWN") => {
    setReordering({ seedId: seed._id, movement });
    try {
      await reorderSeed({ seedId: seed._id, movement });
      toast.success(`Seed moved ${movement === "UP" ? "up" : "down"}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not reorder this seed"));
    } finally {
      setReordering(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingSeed) return;
    setIsDeleting(true);
    try {
      await deleteSeed({ seedId: deletingSeed._id });
      toast.success("Seed permanently deleted");
      setDeletingSeed(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete this seed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="mt-2 text-2xl font-semibold">Manage seeds</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse and correct the ordered seed list for any league and week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={modificationsEnabled ? "secondary" : "outline"}>
            {modificationsEnabled ? <ShieldCheck /> : <LockKeyhole />}
            {modificationsEnabled ? "Modifications enabled" : "Read only"}
          </Badge>
          <Button
            onClick={() => updateModificationMode(!modificationsEnabled)}
            type="button"
            variant={modificationsEnabled ? "outline" : "default"}
          >
            {modificationsEnabled ? (
              <LockKeyhole data-icon="inline-start" />
            ) : (
              <ShieldCheck data-icon="inline-start" />
            )}
            {modificationsEnabled
              ? "Lock modifications"
              : "Enable modifications"}
          </Button>
        </div>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Seed archive</CardTitle>
          <CardDescription>
            Every row belongs to the selected league and assigned week.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              {seeds === undefined
                ? "Loading"
                : getSeedCountLabel(seeds.length)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field data-disabled={!selectedLeague}>
              <FieldLabel htmlFor="managed-seed-league">League</FieldLabel>
              <Select
                disabled={!selectedLeague}
                items={leagueItems}
                onValueChange={(leagueId) => {
                  if (leagueId) updateSelection("league", leagueId);
                }}
                value={selectedLeague?._id ?? null}
              >
                <SelectTrigger className="w-full" id="managed-seed-league">
                  <SelectValue placeholder="Choose a league" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {leagueItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field data-disabled={selectedWeekNumber === undefined}>
              <FieldLabel htmlFor="managed-seed-week">Week</FieldLabel>
              <Select
                disabled={selectedWeekNumber === undefined}
                items={weekItems}
                onValueChange={(weekNumber) => {
                  if (weekNumber !== null) {
                    updateSelection("week", String(weekNumber));
                  }
                }}
                value={selectedWeekNumber ?? null}
              >
                <SelectTrigger className="w-full" id="managed-seed-week">
                  <SelectValue placeholder="Choose a week" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {weekItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <p className="text-xs text-muted-foreground">
            {selectedLeague && selectedWeekNumber
              ? `${selectedLeague.leagueName} · Week ${selectedWeekNumber}`
              : "Choose a league and week"}
          </p>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                disabled={addDisabled}
                onClick={() => setAddDialogOpen(true)}
                type="button"
              >
                <Plus data-icon="inline-start" />
                Add seed
              </Button>
            </TooltipTrigger>
            <TooltipContent>{addTooltip}</TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>

      {leagues === undefined || settings === undefined ? (
        <AdminSeedTableSkeleton />
      ) : settings === null ? (
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sprout />
            </EmptyMedia>
            <EmptyTitle>Tournament settings unavailable</EmptyTitle>
            <EmptyDescription>
              Initialize tournament settings before browsing seed history.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : seeds === undefined ? (
        <AdminSeedTableSkeleton />
      ) : leagues.length === 0 ? (
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sprout />
            </EmptyMedia>
            <EmptyTitle>No leagues yet</EmptyTitle>
            <EmptyDescription>
              Create a league before managing its seed history.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : seeds.length === 0 ? (
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sprout />
            </EmptyMedia>
            <EmptyTitle>No seeds in this week</EmptyTitle>
            <EmptyDescription>
              Choose another league or week, or add a historical seed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table
          className="min-w-5xl table-fixed"
          containerClassName="max-h-[calc(100svh-23rem)] rounded-md border"
        >
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-right">#</TableHead>
              <TableHead className="w-40 border-r border-l">
                Seed type
              </TableHead>
              <TableHead className="border-r">Overworld</TableHead>
              <TableHead className="border-r">Nether</TableHead>
              <TableHead className="border-r">End</TableHead>
              <TableHead className="border-r">RNG</TableHead>
              <TableHead className="w-24 border-r">Status</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seeds.map((seed, index) => {
              const isMovingUp =
                reordering?.seedId === seed._id && reordering.movement === "UP";
              const isMovingDown =
                reordering?.seedId === seed._id &&
                reordering.movement === "DOWN";
              const reorderDisabled =
                !modificationsEnabled || reordering !== null;

              return (
                <TableRow key={seed._id}>
                  <TableCell className="text-right font-mono tabular-nums">
                    {seed.seedNumber ?? index + 1}
                  </TableCell>
                  <TableCell className="border-r border-l font-medium">
                    {seed.type ? SEED_TYPES[seed.type] : "Unspecified"}
                  </TableCell>
                  <SeedValueTableCell value={seed.overworld} />
                  <SeedValueTableCell value={seed.nether} />
                  <SeedValueTableCell value={seed.end} />
                  <SeedValueTableCell value={seed.rng} />
                  <TableCell className="border-r">
                    <Badge variant={seed.isUsed ? "secondary" : "outline"}>
                      {seed.isUsed ? "Used" : "Unused"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`Move seed ${seed.seedNumber ?? index + 1} up`}
                        disabled={reorderDisabled || index === 0}
                        onClick={() => void handleReorder(seed, "UP")}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        {isMovingUp ? <Spinner /> : <ArrowUp />}
                      </Button>
                      <Button
                        aria-label={`Move seed ${seed.seedNumber ?? index + 1} down`}
                        disabled={reorderDisabled || index === seeds.length - 1}
                        onClick={() => void handleReorder(seed, "DOWN")}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        {isMovingDown ? <Spinner /> : <ArrowDown />}
                      </Button>
                      <Button
                        aria-label={`Edit seed ${seed.seedNumber ?? index + 1}`}
                        disabled={!modificationsEnabled}
                        onClick={() => setEditingSeed(seed)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        aria-label={`Delete seed ${seed.seedNumber ?? index + 1}`}
                        disabled={!modificationsEnabled}
                        onClick={() => setDeletingSeed(seed)}
                        size="icon-sm"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {selectedLeague && selectedWeekNumber !== undefined && addDialogOpen && (
        <SeedManagementDialog
          enableJunglePyramidSeeds={settings?.enableJunglePyramidSeeds ?? false}
          league={selectedLeague}
          onOpenChange={setAddDialogOpen}
          open={addDialogOpen}
          weekNumber={selectedWeekNumber}
        />
      )}
      {selectedLeague && selectedWeekNumber !== undefined && editingSeed && (
        <SeedManagementDialog
          enableJunglePyramidSeeds={settings?.enableJunglePyramidSeeds ?? false}
          league={selectedLeague}
          onOpenChange={(open) => {
            if (!open) setEditingSeed(null);
          }}
          open
          seed={editingSeed}
          weekNumber={selectedWeekNumber}
        />
      )}
      <DeleteSeedDialog
        deleting={isDeleting}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeletingSeed(null);
        }}
        open={deletingSeed !== null}
      />
    </section>
  );
}

function AdminSeedTableSkeleton() {
  return (
    <Table
      className="min-w-5xl table-fixed"
      containerClassName="max-h-[calc(100svh-23rem)] rounded-md border"
    >
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead className="w-40">Seed type</TableHead>
          <TableHead>Overworld</TableHead>
          <TableHead>Nether</TableHead>
          <TableHead>End</TableHead>
          <TableHead>RNG</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="w-44">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 6 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-5 w-6" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-28" />
            </TableCell>
            {Array.from({ length: 4 }).map((__, valueIndex) => (
              <TableCell key={valueIndex}>
                <Skeleton className="h-5 w-32" />
              </TableCell>
            ))}
            <TableCell>
              <Skeleton className="h-5 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-6 w-36" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
