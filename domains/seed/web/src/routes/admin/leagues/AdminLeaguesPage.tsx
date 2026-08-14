import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { AddLeagueDialog } from "@/components/dialogs/AddLeagueDialog";
import {
  LeagueTable,
  LeagueTableSkeleton,
} from "../../../components/LeagueTable";
import { getLeagueCountLabel, sortLeaguesByNumberAndName } from "@/lib/utils";

export function AdminLeaguesPage() {
  const allLeagues = useQuery(api.leagues.listLeagues);
  const leagues = useMemo(
    () => sortLeaguesByNumberAndName(allLeagues ?? []),
    [allLeagues]
  );
  const isLoading = allLeagues === undefined;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="mt-2 text-2xl font-semibold">Manage leagues</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            League groups for seed review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {isLoading ? "Loading" : getLeagueCountLabel(leagues.length)}
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button />}>
              <Plus data-icon="inline-start" />
              Add league
            </DialogTrigger>
            <AddLeagueDialog isOpen={isDialogOpen} onClose={closeDialog} />
          </Dialog>
        </div>
      </div>

      {isLoading ? <LeagueTableSkeleton /> : <LeagueTable leagues={leagues} />}
    </section>
  );
}
