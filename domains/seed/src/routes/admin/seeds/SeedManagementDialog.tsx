import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  ErrorAlert,
  SeedNumberField,
} from "@/components/dialogs/AddSeedDialog";
import { getUploadSeedTypes, SEED_TYPES } from "@/lib/consts";
import { getErrorMessage } from "@/lib/errors";
import {
  getManualSeedFormErrors,
  sanitizeSeedNumber,
  type SeedFormErrors,
  type SeedFormValues,
} from "@/lib/seedFormUtils";
import { validateManualSeedForm } from "@/lib/validators";

type ManagedSeed = FunctionReturnType<
  typeof api.seedManagement.listSeeds
>[number];

export function SeedManagementDialog({
  enableJunglePyramidSeeds,
  league,
  onOpenChange,
  open,
  seed,
  weekNumber,
}: {
  enableJunglePyramidSeeds: boolean;
  league: Doc<"leagues">;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  seed?: ManagedSeed;
  weekNumber: number;
}) {
  const addSeed = useMutation(api.seedManagement.addSeed);
  const updateSeed = useMutation(api.seedManagement.updateSeed);
  const isEditing = seed !== undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsed, setIsUsed] = useState(seed?.isUsed ?? true);
  const [values, setValues] = useState<SeedFormValues>({
    type: seed?.type ?? null,
    leagueId: league._id,
    overworld: seed?.overworld ?? "",
    nether: seed?.nether ?? "",
    end: seed?.end ?? "",
    rng: seed?.rng ?? "",
  });
  const [errors, setErrors] = useState<SeedFormErrors>({});
  const availableTypes = getUploadSeedTypes(enableJunglePyramidSeeds);
  if (seed?.type && !availableTypes.includes(seed.type)) {
    availableTypes.push(seed.type);
  }
  const typeItems = availableTypes.map((type) => ({
    label: SEED_TYPES[type],
    value: type,
  }));

  const updateValue = <Key extends keyof SeedFormValues>(
    key: Key,
    value: SeedFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validated = validateManualSeedForm.safeParse(values);
    if (!validated.success) {
      setErrors(getManualSeedFormErrors(validated.error.issues));
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      if (seed) {
        await updateSeed({
          seedId: seed._id,
          overworld: validated.data.overworld,
          nether: validated.data.nether,
          end: validated.data.end,
          rng: validated.data.rng,
          type: validated.data.type,
          isUsed,
        });
        toast.success("Seed updated");
      } else {
        await addSeed({
          leagueId: league._id,
          weekNumber,
          overworld: validated.data.overworld,
          nether: validated.data.nether,
          end: validated.data.end,
          rng: validated.data.rng,
          type: validated.data.type,
        });
        toast.success("Historical seed added");
      }
      onOpenChange(false);
    } catch (error) {
      setErrors({
        form: getErrorMessage(
          error,
          isEditing ? "Could not update this seed" : "Could not add this seed",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const idPrefix = seed ? `edit-${seed._id}` : "add-historical-seed";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit seed" : "Add historical seed"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update seed #${seed.seedNumber ?? "unknown"} in ${league.leagueName}, week ${weekNumber}.`
              : `Append a used seed to ${league.leagueName}, week ${weekNumber}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.type)}>
              <FieldLabel htmlFor={`${idPrefix}-type`}>Seed type</FieldLabel>
              <Select
                items={typeItems}
                itemToStringLabel={(type) => SEED_TYPES[type]}
                onValueChange={(type) => updateValue("type", type)}
                value={values.type}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.type)}
                  className="w-full"
                  id={`${idPrefix}-type`}
                >
                  <SelectValue placeholder="Choose seed type" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {typeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.type}</FieldError>
            </Field>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <SeedNumberField
                error={errors.overworld}
                id={`${idPrefix}-overworld`}
                label="Overworld seed"
                onChange={(value) =>
                  updateValue("overworld", sanitizeSeedNumber(value))
                }
                value={values.overworld}
              />
              <SeedNumberField
                error={errors.nether}
                id={`${idPrefix}-nether`}
                label="Nether seed"
                onChange={(value) =>
                  updateValue("nether", sanitizeSeedNumber(value))
                }
                value={values.nether}
              />
              <SeedNumberField
                error={errors.end}
                id={`${idPrefix}-end`}
                label="End seed"
                onChange={(value) =>
                  updateValue("end", sanitizeSeedNumber(value))
                }
                value={values.end}
              />
              <SeedNumberField
                error={errors.rng}
                id={`${idPrefix}-rng`}
                label="RNG seed"
                onChange={(value) =>
                  updateValue("rng", sanitizeSeedNumber(value))
                }
                value={values.rng}
              />
            </FieldGroup>

            {isEditing && (
              <Field orientation="horizontal">
                <Checkbox
                  checked={isUsed}
                  id={`${idPrefix}-used`}
                  onCheckedChange={(checked) => setIsUsed(checked === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${idPrefix}-used`}>
                    Used seed
                  </FieldLabel>
                  <FieldDescription>
                    Controls whether this seed is recorded as played.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          </FieldGroup>

          {errors.form && (
            <ErrorAlert
              message={errors.form}
              title={isEditing ? "Seed not updated" : "Seed not added"}
            />
          )}

          <DialogFooter>
            <DialogClose
              disabled={isSubmitting}
              render={<Button variant="outline" />}
              type="button"
            >
              Cancel
            </DialogClose>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isEditing ? "Save changes" : "Add seed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
