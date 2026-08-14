import { useMutation, useQuery } from "convex/react";
import {
  CircleAlert,
  MessageCircle,
  MoreVertical,
  Plus,
  Sprout,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { SeedStatusBadge } from "@/components/SeedStatusBadge";
import { SeedValueTableCell } from "@/components/SeedValueTableCell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEED_TYPES, type SeedType } from "@/lib/consts";
import { cn } from "@/lib/utils";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AddSeedDialog from "@/components/dialogs/AddSeedDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type SeedDistributionRequirement = {
  required: number;
  types: SeedType[];
};

const LEAGUE_SEED_DISTRIBUTIONS: Partial<
  Record<number, SeedDistributionRequirement[]>
> = {
  1: [
    { required: 3, types: ["BURIED_TREASURE", "SHIPWRECK"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 2, types: ["RUINED_PORTAL"] },
  ],
  2: [
    { required: 3, types: ["BURIED_TREASURE", "SHIPWRECK"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 2, types: ["RUINED_PORTAL"] },
  ],
  3: [
    { required: 3, types: ["BURIED_TREASURE", "SHIPWRECK"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 2, types: ["RUINED_PORTAL"] },
  ],
  4: [
    { required: 2, types: ["SHIPWRECK", "BURIED_TREASURE"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 1, types: ["RUINED_PORTAL"] },
  ],
  5: [
    { required: 1, types: ["SHIPWRECK"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 1, types: ["RUINED_PORTAL"] },
  ],
  6: [
    { required: 1, types: ["SHIPWRECK"] },
    { required: 3, types: ["VILLAGE", "DESERT_TEMPLE"] },
    { required: 1, types: ["RUINED_PORTAL"] },
  ],
  7: [
    { required: 1, types: ["VILLAGE"] },
    { required: 1, types: ["DESERT_TEMPLE"] },
  ],
};

export function LeaguePage() {
  const moveSeed = useMutation(api.seeds.moveSeed);

  const { leagueId } = useParams();
  const navigate = useNavigate();
  const selectedLeagueId = leagueId as Id<"leagues"> | undefined;
  const leagues = useQuery(api.leagues.listLeagues);
  const uploadLeagues = useQuery(api.leagues.listSeedUploadLeagueOptions);
  const seeds = useQuery(
    api.seeds.listSeedsByLeague,
    selectedLeagueId ? { leagueId: selectedLeagueId } : "skip",
  )?.sort((a, b) => (a.seedNumber ?? 0) - (b.seedNumber ?? 0));
  const league = useMemo(
    () => leagues?.find((item) => item._id === selectedLeagueId),
    [leagues, selectedLeagueId],
  );

  const user = useQuery(api.users.currentUser);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const closeAddDialog = () => setIsAddDialogOpen(false);

  const canAddSeedToLeague = useMemo(() => {
    if (!user) return false;
    if (user.roles.includes("admin")) return true;
    if (user.roles.includes("uploader") && selectedLeagueId) {
      return (user.uploaderLeagues ?? []).includes(selectedLeagueId);
    }
    if (user.roles.includes("host") && selectedLeagueId) {
      return (user.hostLeagueId ?? []).includes(selectedLeagueId);
    }
    return false;
  }, [user, selectedLeagueId]);

  const moveUp = (id: Id<"seeds">) => {
    void moveSeed({ seedId: id, movement: "UP" });
  };
  const moveDown = (id: Id<"seeds">) => {
    void moveSeed({ seedId: id, movement: "DOWN" });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-6 overflow-hidden">
      <section className="flex min-h-0 min-w-0 flex-9 flex-col gap-4 overflow-hidden pr-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold">
              {league?.leagueName ?? "League"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Active-week seeds assigned to this league.
            </p>
          </div>
          {canAddSeedToLeague && league && (
            <div className="flex items-center gap-2">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger render={<Button type="button" size="sm" />}>
                  <Plus className="size-4" />
                  Add seed
                </DialogTrigger>
                {isAddDialogOpen && (
                  <AddSeedDialog
                    onClose={closeAddDialog}
                    leagues={uploadLeagues || []}
                    defaultLeagueId={league._id}
                    lockLeague={true}
                    allowUnassigned={false}
                  />
                )}
              </Dialog>
            </div>
          )}
        </div>

        {seeds === undefined || leagues === undefined ? (
          <>
            <SeedDistributionSkeleton />
            <SeedTableSkeleton />
          </>
        ) : (
          <>
            {league ? (
              <SeedDistributionCard league={league} seeds={seeds} />
            ) : null}
            <SeedTable
              seeds={seeds}
              onSeedSelect={(selectedId) =>
                void navigate(`/app/league/${leagueId}/seed/${selectedId}`)
              }
              moveUp={moveUp}
              moveDown={moveDown}
            />
          </>
        )}
      </section>

      <Separator orientation="vertical" />
      <aside className="flex min-h-0 min-w-0 flex-3 flex-col overflow-hidden p-2">
        <Outlet />
      </aside>
    </div>
  );
}

function SeedDistributionCard({
  league,
  seeds,
}: {
  league: Doc<"leagues">;
  seeds: Doc<"seeds">[];
}) {
  const requirements = LEAGUE_SEED_DISTRIBUTIONS[league.leagueNumber];

  if (!requirements) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>Seed type distribution</CardTitle>
          <CardDescription>{league.leagueName}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No distribution target configured for this league.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = requirements.map((requirement) => {
    const countsByType = Object.fromEntries(
      requirement.types.map((type) => [
        type,
        seeds.filter((seed) => seed.type === type).length,
      ]),
    ) as Record<SeedType, number>;
    const count = Object.values(countsByType).reduce(
      (total, typeCount) => total + typeCount,
      0,
    );
    const label = requirement.types.map((type) => SEED_TYPES[type]).join(" / ");
    const missingTypes = requirement.types.filter(
      (type) => countsByType[type] === 0,
    );

    return {
      count,
      label,
      missingTypes,
      required: requirement.required,
    };
  });
  const requiredTotal = rows.reduce((total, row) => total + row.required, 0);
  const filledTotal = rows.reduce(
    (total, row) => total + Math.min(row.count, row.required),
    0,
  );
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Seed type distribution</CardTitle>
            <CardDescription>{league.leagueName}</CardDescription>
          </div>
          <Badge
            variant={filledTotal >= requiredTotal ? "secondary" : "outline"}
          >
            {filledTotal} / {requiredTotal} filled
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {rows.map((row) => {
            const isFilled =
              row.count >= row.required && row.missingTypes.length === 0;
            const isOverfilled = row.count > row.required;
            const hasMissingTypeWarning =
              row.required > 1 &&
              row.missingTypes.length === 1 &&
              row.count >= row.required - 1;
            const progressValue = Math.min(
              Math.round((row.count / row.required) * 100),
              100,
            );

            return (
              <div
                key={row.label}
                className="flex min-w-0 flex-col gap-3 rounded-md border bg-muted/30 p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    {hasMissingTypeWarning ? (
                      <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <CircleAlert className="size-3 shrink-0" />
                        Missing {SEED_TYPES[row.missingTypes[0]]}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {row.required} required
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      isOverfilled
                        ? "destructive"
                        : isFilled
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {row.count} / {row.required}
                  </Badge>
                </div>
                <Progress
                  aria-label={`${row.label}: ${row.count} of ${row.required}`}
                  value={progressValue}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SeedTable({
  seeds,
  onSeedSelect,
  moveUp,
  moveDown,
}: {
  seeds: Doc<"seeds">[];
  onSeedSelect: (seedId: Id<"seeds">) => void;
  moveUp: (id: Id<"seeds">) => void;
  moveDown: (id: Id<"seeds">) => void;
}) {
  const { seedId } = useParams();

  if (seeds.length === 0) {
    return (
      <Empty className="min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sprout />
          </EmptyMedia>
          <EmptyTitle>No seeds in this league</EmptyTitle>
          <EmptyDescription>
            Active seeds assigned to this league will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table containerClassName="max-h-[calc(100svh-20rem)] overflow-auto rounded-md border">
      <TableHeader>
        <TableRow>
          <TableHead className="border-r w-6">#</TableHead>
          <TableHead className="border-r text-left">Seed Type</TableHead>
          <TableHead className="border-r">Overworld</TableHead>
          <TableHead className="border-r">Nether</TableHead>
          <TableHead className="border-r">End</TableHead>
          <TableHead className="border-r">RNG</TableHead>
          <TableHead className="w-20 border-r text-center">Status</TableHead>
          <TableHead className="w-12 border-r text-center">
            <MessageCircle />
          </TableHead>
          <TableHead className="w-12 " />
        </TableRow>
      </TableHeader>
      <TableBody>
        {seeds.map((seed, index) => {
          const isSelected = seed._id === seedId;

          return (
            <TableRow
              key={seed._id}
              className={cn("cursor-pointer", isSelected && "bg-muted")}
              onClick={() => onSeedSelect(seed._id)}
            >
              <TableCell className="border-r text-center tabular-nums">
                {seed.seedNumber ?? "-"}
              </TableCell>
              <TableCell className="border-r text-left font-medium">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span>
                    {seed.type ? SEED_TYPES[seed.type] : "Unspecified"}
                  </span>
                </div>
              </TableCell>

              <SeedValueTableCell value={seed.overworld} />
              <SeedValueTableCell value={seed.nether} />
              <SeedValueTableCell value={seed.end} />
              <SeedValueTableCell value={seed.rng} />

              <TableCell className="border-r text-center">
                <SeedStatusBadge status={seed.isUsed ? "used" : "open"} />
              </TableCell>

              <TableCell className="border-r text-center tabular-nums">
                {seed.commentCount}
              </TableCell>

              <TableCell className="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div>
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Open actions</span>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onClick={() => moveUp(seed._id)}
                    >
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === seeds.length - 1}
                      onClick={() => moveDown(seed._id)}
                    >
                      Move down
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SeedDistributionSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SeedTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-48" />
      <div className="overflow-hidden rounded-md border">
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
