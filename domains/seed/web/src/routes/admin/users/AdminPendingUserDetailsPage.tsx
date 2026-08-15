import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldAlert, UserCheck, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

export function AdminPendingUserDetailsPage() {
  const { userId } = useParams();
  const pendingUsers = useQuery(api.users.listPendingUsers);
  const allLeagues = useQuery(api.leagues.listLeagues);
  const leagues = useMemo(
    () => sortLeaguesByNumberAndName(allLeagues ?? []),
    [allLeagues]
  );
  const selectedUserId = userId as Id<"users"> | undefined;
  const user = pendingUsers?.find(
    (pendingUser) => pendingUser._id === selectedUserId
  );

  if (pendingUsers === undefined || allLeagues === undefined) {
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
            This user is not in the pending user list.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasDiscordId = Boolean(user.discordId);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">{getUserLabel(user)}</h2>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {getUserIdentifierLabel(user)}
        </p>
      </div>

      <Separator />

      <UserIdentitySummary leagues={leagues} user={user} />

      {!hasDiscordId ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Discord ID missing</AlertTitle>
          <AlertDescription>
            This account cannot be activated from this screen because the
            activation requires a Discord user ID.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Separator />

          <PendingActivationForm
            disabled={!hasDiscordId}
            key={user._id}
            leagues={leagues}
            user={user}
          />
        </>
      )}
    </div>
  );
}

function PendingActivationForm({
  disabled,
  leagues,
  user,
}: {
  disabled: boolean;
  leagues: Doc<"leagues">[];
  user: Doc<"users">;
}) {
  const navigate = useNavigate();
  const activateUser = useMutation(api.users.activateUserByDiscordId);
  const savedValues = useMemo(() => getManagedUserValues(user), [user]);
  const [roles, setRoles] = useState<ManagedRole[]>(savedValues.roles);
  const [makeAdmin, setMakeAdmin] = useState(user.roles.includes("admin"));
  const [uploaderLeagueIds, setUploaderleagueIds] = useState<Id<"leagues">[]>(
    savedValues.uploaderLeagueIds
  );
  const [hostLeagueId, setHostLeagueId] = useState<Id<"leagues">[]>(
    savedValues.hostLeagueId
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasChanges =
    !haveSameManagedRoles(roles, savedValues.roles) ||
    makeAdmin !== user.roles.includes("admin") ||
    !haveSameLeagueIds(uploaderLeagueIds, savedValues.uploaderLeagueIds) ||
    !haveSameLeagueIds(hostLeagueId, savedValues.hostLeagueId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disabled || isSubmitting) {
      return;
    }

    if (!user.discordId) {
      setFormError("This user does not have a Discord ID.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await activateUser({
        discordId: user.discordId,
        roles,
        makeAdmin,
        uploaderLeagueIds,
        hostLeagueId,
      });
      void navigate("/app/admin/users/pending");
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not activate this user"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetChanges = () => {
    setFormError(null);
    setRoles(savedValues.roles);
    setMakeAdmin(user.roles.includes("admin"));
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
          description="Choose host, and uploader access for this user."
          disabled={disabled || isSubmitting}
          idPrefix="pending"
          onRolesChange={setRoles}
          roles={roles}
        />

        <LeagueAccessMultiSelect
          description="An uploader can upload and see seeds in their uploader leagues."
          disabled={disabled || isSubmitting}
          id="pending-uploader-leagues"
          label="Uploader leagues"
          leagues={leagues}
          onValueChange={setUploaderleagueIds}
          value={uploaderLeagueIds}
        />

        <LeagueAccessMultiSelect
          description="A host can manage seeds only in their host leagues."
          disabled={disabled || isSubmitting}
          id="pending-host-league"
          label="Host leagues"
          leagues={leagues}
          onValueChange={setHostLeagueId}
          value={hostLeagueId}
        />

        <Field orientation="horizontal">
          <Switch
            checked={makeAdmin}
            disabled={disabled || isSubmitting}
            id="pending-make-admin"
            onCheckedChange={setMakeAdmin}
          />
          <FieldContent>
            <FieldLabel htmlFor="pending-make-admin">Make admin</FieldLabel>
            <FieldDescription>
              Admin users cannot be managed from this screen after activation.
            </FieldDescription>
          </FieldContent>
        </Field>

        {makeAdmin ? (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Admin access is elevated</AlertTitle>
            <AlertDescription>
              Admins can view any seed and can modify or delete data that
              affects the whole system. Admin users are not editable through the
              app.
            </AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>

      <FieldError>{formError}</FieldError>

      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || isSubmitting} type="submit">
          <UserCheck data-icon="inline-start" />
          {isSubmitting ? "Activating..." : "Activate user"}
        </Button>
        <Button
          disabled={disabled || isSubmitting || !hasChanges}
          onClick={resetChanges}
          type="button"
          variant="outline"
        >
          Reset access
        </Button>
      </div>
    </form>
  );
}
