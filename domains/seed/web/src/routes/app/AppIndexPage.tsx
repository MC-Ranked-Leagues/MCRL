import { useMutation, useQuery } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { SeedFormErrors, SeedFormValues } from "@/lib/seedFormUtils";
import {
  getManualSeedFormErrors,
  sanitizeSeedNumber,
} from "@/lib/seedFormUtils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ErrorAlert,
  SeedNumberField,
} from "@/components/dialogs/AddSeedDialog";
import { validateManualSeedForm } from "@/lib/validators";
import { getErrorMessage } from "@/lib/errors";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUploadSeedTypes, SEED_TYPES } from "@/lib/consts";
import { Button } from "@/components/ui/button";
import { RecentUploads } from "./RecentUploads";

const EMPTY_SEED_FORM_VALUES: SeedFormValues = {
  type: null,
  leagueId: null,
  overworld: "",
  nether: "",
  end: "",
  rng: "",
};

export function AppIndexPage() {
  const importSeeds = useMutation(api.seeds.importSeeds);

  const [manualValues, setManualValues] = useState<SeedFormValues>(() => ({
    ...EMPTY_SEED_FORM_VALUES,
    leagueId: null,
  }));
  const [manualErrors, setManualErrors] = useState<SeedFormErrors>({});

  const user = useQuery(api.users.currentUser);
  const settings = useQuery(api.settings.current);
  const accessableLeagues = useQuery(api.leagues.listSeedUploadLeagueOptions);
  const isLoading =
    user === undefined ||
    accessableLeagues === undefined ||
    settings === undefined;
  const uploadSeedTypes = getUploadSeedTypes(
    settings?.enableJunglePyramidSeeds ?? false
  );
  const selectedSeedType =
    manualValues.type === "JUNGLE_PYRAMID" &&
    !settings?.enableJunglePyramidSeeds
      ? null
      : manualValues.type;

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isUploader = user?.roles.includes("uploader") ?? false;
  const isHost = user?.roles.includes("host") ?? false;
  const canUploadAsHost =
    isHost && accessableLeagues.some((league) => !league.seedUploadDisabled);
  const canUpload = isAdmin || isUploader || canUploadAsHost;

  if (!canUpload) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-lg bg-card p-4 text-center text-card-foreground">
        <h2 className="text-lg font-semibold">You are not an uploader</h2>
      </div>
    );
  }

  const selectedManualLeague = accessableLeagues.find(
    (league) => league._id === manualValues.leagueId
  );

  const selectedLeagueRestriction =
    selectedManualLeague?.seedUploadDisabledReason;

  const resetForm = () => {
    setManualValues({
      ...EMPTY_SEED_FORM_VALUES,
      leagueId: null,
    });
    setManualErrors({});
  };

  const updateManualValue = <Key extends keyof SeedFormValues>(
    key: Key,
    value: SeedFormValues[Key]
  ) => {
    setManualValues((current) => ({ ...current, [key]: value }));
  };

  const handleManualImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const preparedData = {
      ...manualValues,
      type: selectedSeedType,
      leagueId: manualValues.leagueId || undefined,
    };

    const validatedData = validateManualSeedForm.safeParse(preparedData);
    if (!validatedData.success) {
      setManualErrors(getManualSeedFormErrors(validatedData.error.issues));
      return;
    }

    try {
      await importSeeds({ seed: validatedData.data });

      resetForm();
    } catch (error) {
      setManualErrors({
        form: getErrorMessage(error, "Could not add this seed"),
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Add seed</CardTitle>
          <CardDescription>Add a seed to a league</CardDescription>
        </CardHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleManualImport(event);
          }}
        >
          <CardContent>
            <FieldGroup>
              <Field data-invalid={Boolean(manualErrors.type)}>
                <FieldLabel htmlFor="seed-type">Seed type</FieldLabel>
                <Select
                  value={selectedSeedType}
                  itemToStringLabel={(type) => SEED_TYPES[type]}
                  onValueChange={(value) => updateManualValue("type", value)}
                >
                  <SelectTrigger
                    id="seed-type"
                    aria-invalid={Boolean(manualErrors.type)}
                    className="w-full"
                  >
                    <SelectValue placeholder="Choose seed type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Seed types</SelectLabel>
                      {uploadSeedTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {SEED_TYPES[type]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{manualErrors.type}</FieldError>
              </Field>

              <Field data-invalid={Boolean(manualErrors.leagueId)}>
                <FieldLabel htmlFor="seed-league">League</FieldLabel>
                <Select
                  disabled={false}
                  value={manualValues.leagueId}
                  itemToStringLabel={(leagueId) =>
                    accessableLeagues.find((league) => league._id === leagueId)
                      ?.leagueName ?? "Unknown league"
                  }
                  onValueChange={(value) =>
                    updateManualValue("leagueId", value)
                  }
                >
                  <SelectTrigger
                    id="seed-league"
                    aria-invalid={Boolean(manualErrors.leagueId)}
                    className="w-full"
                  >
                    <SelectValue placeholder="No league" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>League assignment</SelectLabel>

                      {accessableLeagues.map((league) => (
                        <SelectItem
                          key={league._id}
                          disabled={league.seedUploadDisabled}
                          value={league._id}
                        >
                          {league.seedUploadDisabledReason
                            ? `${league.leagueName} - unavailable`
                            : league.leagueName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{selectedLeagueRestriction}</FieldDescription>
                <FieldError>{manualErrors.leagueId}</FieldError>
              </Field>

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <SeedNumberField
                  id="overworld-seed"
                  label="Overworld seed"
                  error={manualErrors.overworld}
                  onSeedBundlePaste={(seeds) =>
                    setManualValues((current) => ({ ...current, ...seeds }))
                  }
                  value={manualValues.overworld}
                  onChange={(value) =>
                    updateManualValue("overworld", sanitizeSeedNumber(value))
                  }
                />
                <SeedNumberField
                  id="nether-seed"
                  label="Nether seed"
                  error={manualErrors.nether}
                  value={manualValues.nether}
                  onChange={(value) =>
                    updateManualValue("nether", sanitizeSeedNumber(value))
                  }
                />
                <SeedNumberField
                  id="end-seed"
                  label="End seed"
                  error={manualErrors.end}
                  value={manualValues.end}
                  onChange={(value) =>
                    updateManualValue("end", sanitizeSeedNumber(value))
                  }
                />
                <SeedNumberField
                  id="rng-seed"
                  label="RNG seed"
                  error={manualErrors.rng}
                  value={manualValues.rng}
                  onChange={(value) =>
                    updateManualValue("rng", sanitizeSeedNumber(value))
                  }
                />
              </FieldGroup>
            </FieldGroup>

            {manualErrors.form && (
              <ErrorAlert title="Seed not saved" message={manualErrors.form} />
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit">Add seed</Button>
          </CardFooter>
        </form>
      </Card>
      <RecentUploads
        enableJunglePyramidSeeds={settings?.enableJunglePyramidSeeds ?? false}
      />
    </div>
  );
}
