import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldAlert, UserCog, Users } from "lucide-react";
import { useParams } from "react-router";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { LeagueAccessMultiSelect } from "@/components/LeagueAccessMultiSelect";
import { ManagedRoleFields } from "@/components/ManagedRoleFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/errors";
import {
  getManagedUserValues,
  getUserIdentifierLabel,
  getUserLabel,
  haveSameLeagueIds,
  haveSameManagedRoles,
  type ManagedRole,
} from "@/lib/userAccess";
import { sortLeaguesByNumberAndName } from "@/lib/utils";
import { AdminUserDetailsSkeleton } from "./AdminUserDetailsSkeleton";
import { UserIdentitySummary } from "./UserIdentitySummary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AdminActiveUserDetailsPage() {
  const { userId } = useParams();
  const activeUsers = useQuery(api.users.listActiveUsers);
  const allLeagues = useQuery(api.leagues.listLeagues);
  const leagues = useMemo(
    () => sortLeaguesByNumberAndName(allLeagues ?? []),
    [allLeagues],
  );
  const selectedUserId = userId as Id<"users"> | undefined;
  const user = activeUsers?.find(
    (activeUser) => activeUser._id === selectedUserId,
  );

  if (activeUsers === undefined || allLeagues === undefined) {
    return <AdminUserDetailsSkeleton />;
  }

  if (!user) {
    return (
      <Empty className="min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>User not found</EmptyTitle>
          <EmptyDescription>
            This user is not in the active user list.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const isAdmin = user.roles.includes("admin");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex gap-2 justify-start items-center">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.image} />
          <AvatarFallback>
            {user.lowercaseName?.slice(0, 1) ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{getUserLabel(user)}</h2>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {getUserIdentifierLabel(user)}
          </p>
        </div>
      </div>

      <Separator />

      <UserIdentitySummary leagues={leagues} user={user} />

      {isAdmin ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Admin user is read-only</AlertTitle>
          <AlertDescription>
            Admin accounts are managed through the database dashboard.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Separator />
          <ManagedUserForm key={user._id} leagues={leagues} user={user} />
        </>
      )}
    </div>
  );
}

function ManagedUserForm({
  leagues,
  user,
}: {
  leagues: Doc<"leagues">[];
  user: Doc<"users">;
}) {
  const updateManagedUser = useMutation(api.users.updateManagedUser);
  const savedValues = useMemo(() => getManagedUserValues(user), [user]);
  const [roles, setRoles] = useState<ManagedRole[]>(savedValues.roles);
  const [uploaderLeagueIds, setUploaderleagueIds] = useState<Id<"leagues">[]>(
    savedValues.uploaderLeagueIds,
  );
  const [hostLeagueId, setHostLeagueId] = useState<Id<"leagues">[]>(
    savedValues.hostLeagueId,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasChanges =
    !haveSameManagedRoles(roles, savedValues.roles) ||
    !haveSameLeagueIds(uploaderLeagueIds, savedValues.uploaderLeagueIds) ||
    !haveSameLeagueIds(hostLeagueId, savedValues.hostLeagueId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasChanges || isSubmitting) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await updateManagedUser({
        userId: user._id,
        roles,
        uploaderLeagueIds,
        hostLeagueId,
      });
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not update this user"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetChanges = () => {
    setFormError(null);
    setRoles(savedValues.roles);
    setUploaderleagueIds(savedValues.uploaderLeagueIds);
    setHostLeagueId(savedValues.hostLeagueId);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <FieldGroup>
        <ManagedRoleFields
          description="Admin access is not editable here."
          disabled={isSubmitting}
          idPrefix="managed"
          onRolesChange={setRoles}
          roles={roles}
        />

        <LeagueAccessMultiSelect
          description="An uploader can upload and see seeds in their uploader leagues."
          disabled={isSubmitting}
          id="pending-uploader-leagues"
          label="Uploader leagues"
          leagues={leagues}
          onValueChange={setUploaderleagueIds}
          value={uploaderLeagueIds}
        />

        <LeagueAccessMultiSelect
          description="A host can manage seeds only in their host leagues."
          disabled={isSubmitting}
          id="managed-host-league"
          label="Host leagues"
          leagues={leagues}
          onValueChange={setHostLeagueId}
          value={hostLeagueId}
        />
      </FieldGroup>

      <FieldError>{formError}</FieldError>

      <div className="flex flex-wrap gap-2">
        <Button disabled={isSubmitting || !hasChanges} type="submit">
          <UserCog data-icon="inline-start" />
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
        <Button
          disabled={isSubmitting || !hasChanges}
          onClick={resetChanges}
          type="button"
          variant="outline"
        >
          Reset changes
        </Button>
      </div>
    </form>
  );
}
