import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { getLeagueLabel } from "@/lib/userAccess";

export function LeagueAccessMultiSelect({
  description,
  disabled = false,
  id,
  label,
  leagues,
  onValueChange,
  value,
}: {
  description: string;
  disabled?: boolean;
  id: string;
  label: string;
  leagues: Doc<"leagues">[];
  onValueChange: (leagueIds: Id<"leagues">[]) => void;
  value: Id<"leagues">[];
}) {
  const anchorRef = useComboboxAnchor();
  const leagueIds = leagues.map((league) => league._id);
  const getLabel = (leagueId: Id<"leagues">) =>
    getLeagueLabel(leagues, leagueId);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        disabled={disabled}
        itemToStringLabel={getLabel}
        itemToStringValue={getLabel}
        items={leagueIds}
        multiple
        onValueChange={onValueChange}
        value={value}
      >
        <ComboboxChips ref={anchorRef}>
          <ComboboxValue>
            {value.map((leagueId) => (
              <ComboboxChip key={leagueId}>{getLabel(leagueId)}</ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            disabled={disabled}
            id={id}
            placeholder={value.length === 0 ? "Add league" : "Add another"}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No leagues found.</ComboboxEmpty>
          <ComboboxList>
            {(leagueId: Id<"leagues">) => (
              <ComboboxItem key={leagueId} value={leagueId}>
                {getLabel(leagueId)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}
