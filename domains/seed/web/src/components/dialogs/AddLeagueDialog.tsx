import { useMutation } from "convex/react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
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
import { XIcon } from "lucide-react";
import {
  getLeagueMutationArgs,
  limitLeagueName,
  MAX_LEAGUE_NAME_LENGTH,
  MIN_LEAGUE_NAME_LENGTH,
  preventNonNumericInput,
  sanitizeLeagueNumber,
  validateLeagueForm,
  type LeagueFormErrors,
} from "../../lib/leagueFormUtils";
import { getErrorMessage } from "@/lib/errors";

export function AddLeagueDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const addLeague = useMutation(api.leagues.addLeague);
  const [leagueNumber, setLeagueNumber] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [errors, setErrors] = useState<LeagueFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setLeagueNumber("");
    setLeagueName("");
    setErrors({});
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const closeDialog = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const values = { leagueNumber, leagueName };
    const validationErrors = validateLeagueForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await addLeague(getLeagueMutationArgs(values));
      closeDialog();
    } catch (error) {
      setErrors({
        form: getErrorMessage(error, "Could not add this league"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent showCloseButton={false}>
      <DialogClose
        aria-label="Close"
        disabled={isSubmitting}
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
        <DialogTitle>Add league</DialogTitle>
        <DialogDescription>
          Create a league group for seed review.
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.leagueNumber)}>
            <FieldLabel htmlFor="league-number">League number</FieldLabel>
            <Input
              id="league-number"
              aria-invalid={Boolean(errors.leagueNumber)}
              inputMode="numeric"
              min={1}
              onChange={(event) =>
                setLeagueNumber(sanitizeLeagueNumber(event.currentTarget.value))
              }
              onKeyDown={preventNonNumericInput}
              pattern="[0-9]*"
              placeholder="1"
              required
              step={1}
              type="number"
              value={leagueNumber}
            />
            <FieldDescription>Use a positive whole number.</FieldDescription>
            <FieldError>{errors.leagueNumber}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.leagueName)}>
            <FieldLabel htmlFor="league-name">League name</FieldLabel>
            <Input
              id="league-name"
              aria-invalid={Boolean(errors.leagueName)}
              maxLength={MAX_LEAGUE_NAME_LENGTH}
              minLength={MIN_LEAGUE_NAME_LENGTH}
              onChange={(event) =>
                setLeagueName(limitLeagueName(event.currentTarget.value))
              }
              placeholder="League 1"
              required
              type="text"
              value={leagueName}
            />
            <FieldDescription>
              {MIN_LEAGUE_NAME_LENGTH}-{MAX_LEAGUE_NAME_LENGTH} characters.
            </FieldDescription>
            <FieldError>{errors.leagueName}</FieldError>
          </Field>
        </FieldGroup>

        <FieldError>{errors.form}</FieldError>

        <DialogFooter>
          <DialogClose
            disabled={isSubmitting}
            onClick={closeDialog}
            render={<Button variant="outline" />}
            type="button"
          >
            Cancel
          </DialogClose>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Adding..." : "Add league"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
