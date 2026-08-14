import { AlertCircleIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { getErrorMessage } from "@/lib/errors";
import {
  getManualSeedFormErrors,
  preventNonNumericSeedInput,
  sanitizeSeedNumber,
  type SeedFormErrors,
  type SeedFormValues,
} from "@/lib/seedFormUtils";
import { validateManualSeedForm } from "@/lib/validators";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const EMPTY_SEED_FORM_VALUES: SeedFormValues = {
  type: null,
  leagueId: null,
  overworld: "",
  nether: "",
  end: "",
  rng: "",
};

type SeedUploadLeague = Doc<"leagues"> & {
  seedUploadDisabled?: boolean;
  seedUploadDisabledReason?: string;
};

function AddSeedDialog({
  leagues,
  onClose,
  defaultLeagueId = null,
  lockLeague = false,
}: {
  leagues: SeedUploadLeague[];
  onClose: () => void;
  defaultLeagueId?: Id<"leagues"> | null;
  lockLeague?: boolean;
  allowUnassigned?: boolean;
}) {
  const importSeeds = useMutation(api.seeds.importSeeds);
  const settings = useQuery(api.settings.current);

  const [manualValues, setManualValues] = useState<SeedFormValues>(() => ({
    ...EMPTY_SEED_FORM_VALUES,
    leagueId: defaultLeagueId,
  }));
  const [manualErrors, setManualErrors] = useState<SeedFormErrors>({});
  const selectedManualLeague = leagues.find(
    (league) => league._id === manualValues.leagueId,
  );
  const selectedLeagueRestriction =
    selectedManualLeague?.seedUploadDisabledReason;
  const uploadSeedTypes = getUploadSeedTypes(
    settings?.enableJunglePyramidSeeds ?? false,
  );
  const selectedSeedType =
    manualValues.type === "JUNGLE_PYRAMID" &&
    !settings?.enableJunglePyramidSeeds
      ? null
      : manualValues.type;

  const resetForm = () => {
    setManualValues({
      ...EMPTY_SEED_FORM_VALUES,
      leagueId: defaultLeagueId,
    });
    setManualErrors({});
  };

  const closeDialog = () => {
    resetForm();
    onClose();
  };

  const updateManualValue = <Key extends keyof SeedFormValues>(
    key: Key,
    value: SeedFormValues[Key],
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

      closeDialog();
    } catch (error) {
      setManualErrors({
        form: getErrorMessage(error, "Could not add this seed"),
      });
    } finally {
      // TODO: Add submitting state and disable inputs while submitting
    }
  };

  return (
    <DialogContent
      className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
      showCloseButton={false}
    >
      <DialogClose
        aria-label="Close"
        onClick={closeDialog}
        render={
          <Button
            className="absolute top-2 right-2"
            size="icon-sm"
            variant="ghost"
          />
        }
        type="button"
      >
        <XIcon />
      </DialogClose>

      <DialogHeader>
        <DialogTitle>Add seed</DialogTitle>
        <DialogDescription>
          Add a seed manually to the league.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleManualImport(event);
        }}
      >
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
              disabled={lockLeague}
              value={manualValues.leagueId}
              itemToStringLabel={(leagueId) =>
                leagues.find((league) => league._id === leagueId)?.leagueName ??
                "Unknown league"
              }
              onValueChange={(value) => updateManualValue("leagueId", value)}
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
                  {leagues.map((league) => (
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

        <DialogFooter>
          <DialogClose
            onClick={closeDialog}
            render={<Button variant="outline" />}
            type="button"
          >
            Close
          </DialogClose>
          <Button type="submit">Add seed</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function SeedNumberField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        inputMode="numeric"
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={preventNonNumericSeedInput}
        pattern="-?[0-9]*"
        placeholder="-198106162748994949"
        required
        type="text"
        value={value}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function ErrorAlert({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="whitespace-pre-line">
        {message}
      </AlertDescription>
    </Alert>
  );
}

export default AddSeedDialog;
