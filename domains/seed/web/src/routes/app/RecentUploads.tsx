import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DeleteSeedDialog } from "@/components/DeleteSeedDialog";
import { SeedStatusBadge } from "@/components/SeedStatusBadge";
import { SeedValueTableCell } from "@/components/SeedValueTableCell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getSeedStatus } from "@/lib/seedStatus";
import { EditRecentSeedDialog } from "./EditRecentSeedDialog";

type RecentUpload = FunctionReturnType<
  typeof api.seeds.listRecentUploads
>[number];

const UPLOAD_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function RecentUploads({
  enableJunglePyramidSeeds,
}: {
  enableJunglePyramidSeeds: boolean;
}) {
  const uploads = useQuery(api.seeds.listRecentUploads);
  const deleteSeed = useMutation(api.seeds.deleteSeed);
  const [editingSeed, setEditingSeed] = useState<RecentUpload>();
  const [deletingSeed, setDeletingSeed] = useState<RecentUpload>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  const handleDelete = async () => {
    if (!deletingSeed) return;

    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      await deleteSeed({ seedId: deletingSeed._id });
      toast.success("Seed deleted");
      setDeletingSeed(undefined);
    } catch (error) {
      setDeleteError(getErrorMessage(error, "Could not delete this seed"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (uploads === undefined) {
    return <RecentUploadsSkeleton />;
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <p className="text-sm text-muted-foreground">
            Your five newest uploads from the current tournament week.
          </p>
        </div>

        {uploads.length === 0 ? (
          <Empty className="min-h-32 rounded-md border">
            <EmptyHeader>
              <EmptyTitle>No uploads from you this week.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table
            className="min-w-5xl table-fixed"
            containerClassName="rounded-md border"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">Seed</TableHead>
                <TableHead className="w-40 border-r border-l">League</TableHead>
                <TableHead className="w-24 border-r">Week</TableHead>
                <TableHead className="w-44 border-r">Seed type</TableHead>
                <TableHead className="border-r">Overworld</TableHead>
                <TableHead className="border-r">Nether</TableHead>
                <TableHead className="border-r">Uploaded</TableHead>
                <TableHead className="w-24 border-r">Status</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((seed) => (
                <TableRow key={seed._id}>
                  <TableCell className="text-right font-mono tabular-nums">
                    <Link
                      className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
                      to={`/app/league/${seed.leagueId}/seed/${seed._id}`}
                    >
                      #{seed.seedNumber ?? "unknown"}
                    </Link>
                  </TableCell>
                  <TableCell className="border-r border-l font-medium">
                    {seed.leagueName}
                  </TableCell>
                  <TableCell className="border-r">
                    {seed.assignedWeekNumber}
                  </TableCell>
                  <TableCell className="border-r">
                    {seed.type ? SEED_TYPES[seed.type] : "Unknown"}
                  </TableCell>
                  <SeedValueTableCell value={seed.overworld} />
                  <SeedValueTableCell value={seed.nether} />
                  <TableCell className="border-r">
                    <time dateTime={new Date(seed._creationTime).toISOString()}>
                      {UPLOAD_TIME_FORMATTER.format(seed._creationTime)}
                    </time>
                  </TableCell>
                  <TableCell className="border-r">
                    <SeedStatusBadge status={getSeedStatus(seed)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <RecentUploadAction
                        disabled={!seed.canEdit}
                        disabledReason={seed.editDisabledReason}
                        onClick={() => setEditingSeed(seed)}
                      >
                        <Pencil />
                        Edit
                      </RecentUploadAction>
                      <RecentUploadAction
                        disabled={!seed.canEdit}
                        disabledReason={seed.editDisabledReason}
                        onClick={() => {
                          setDeleteError(undefined);
                          setDeletingSeed(seed);
                        }}
                        variant="destructive"
                      >
                        <Trash2 />
                        Delete
                      </RecentUploadAction>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {editingSeed && (
        <EditRecentSeedDialog
          enableJunglePyramidSeeds={enableJunglePyramidSeeds}
          onOpenChange={(open) => {
            if (!open) setEditingSeed(undefined);
          }}
          open={true}
          seed={editingSeed}
        />
      )}

      <DeleteSeedDialog
        deleting={isDeleting}
        error={deleteError}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSeed(undefined);
            setDeleteError(undefined);
          }
        }}
        open={deletingSeed !== undefined}
      />
    </>
  );
}

function RecentUploadAction({
  children,
  disabled,
  disabledReason,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
  variant?: "destructive" | "outline";
}) {
  const button = (
    <Button
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant={variant}
    >
      {children}
    </Button>
  );

  if (!disabled || !disabledReason) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {button}
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

function RecentUploadsSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Table
        className="min-w-5xl table-fixed"
        containerClassName="rounded-md border"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Seed</TableHead>
            <TableHead className="w-40">League</TableHead>
            <TableHead className="w-24">Week</TableHead>
            <TableHead className="w-44">Seed type</TableHead>
            <TableHead>Overworld</TableHead>
            <TableHead>Nether</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-40">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }, (_, index) => (
            <TableRow key={index}>
              {Array.from({ length: 9 }, (__, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
