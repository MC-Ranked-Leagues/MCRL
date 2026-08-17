import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ErrorAlert,
  SeedNumberField,
} from "@/components/dialogs/AddSeedDialog";
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
import { getUploadSeedTypes, SEED_TYPES } from "@/lib/consts";
import { getErrorMessage } from "@/lib/errors";
import {
  getManualSeedFormErrors,
  sanitizeSeedNumber,
  type SeedFormErrors,
  type SeedFormValues,
} from "@/lib/seedFormUtils";
import { validateManualSeedForm } from "@/lib/validators";

type RecentUpload = FunctionReturnType<
  typeof api.seeds.listRecentUploads
>[number];

export function EditRecentSeedDialog({
  enableJunglePyramidSeeds,
  onOpenChange,
  open,
  seed,
}: {
  enableJunglePyramidSeeds: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  seed: RecentUpload;
}) {
  const updateSeed = useMutation(api.seeds.updateRecentSeed);
  const availableTypes = getUploadSeedTypes(enableJunglePyramidSeeds);
  const initialType =
    seed.type && availableTypes.includes(seed.type) ? seed.type : null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<SeedFormValues>({
    type: initialType,
    leagueId: seed.leagueId ?? null,
    overworld: seed.overworld,
    nether: seed.nether,
    end: seed.end,
    rng: seed.rng,
  });
  const [errors, setErrors] = useState<SeedFormErrors>({});
  const typeItems = availableTypes.map((type) => ({
    label: SEED_TYPES[type],
    value: type,
  }));

  const updateValue = <Key extends keyof SeedFormValues>(
    key: Key,
    value: SeedFormValues[Key]
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
      await updateSeed({
        seedId: seed._id,
        overworld: validated.data.overworld,
        nether: validated.data.nether,
        end: validated.data.end,
        rng: validated.data.rng,
        type: validated.data.type,
      });
      toast.success("Seed updated");
      onOpenChange(false);
    } catch (error) {
      setErrors({
        form: getErrorMessage(error, "Could not update this seed"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const idPrefix = `edit-recent-${seed._id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit seed</DialogTitle>
          <DialogDescription>
            Update seed #{seed.seedNumber ?? "unknown"} in {seed.leagueName},
            week {seed.assignedWeekNumber}.
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
          </FieldGroup>

          {errors.form && (
            <ErrorAlert message={errors.form} title="Seed not updated" />
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
