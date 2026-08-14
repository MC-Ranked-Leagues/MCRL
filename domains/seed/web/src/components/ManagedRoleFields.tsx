import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { type ManagedRole, updateManagedRole } from "@/lib/userAccess";

export function ManagedRoleFields({
  description,
  disabled = false,
  idPrefix,
  onRolesChange,
  roles,
}: {
  description: string;
  disabled?: boolean;
  idPrefix: string;
  onRolesChange: (roles: ManagedRole[]) => void;
  roles: ManagedRole[];
}) {
  const setRole = (role: ManagedRole, checked: boolean) => {
    onRolesChange(updateManagedRole(roles, role, checked));
  };

  return (
    <FieldSet>
      <FieldLegend>Roles</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <FieldGroup data-slot="checkbox-group">
        <Field orientation="horizontal">
          <Checkbox
            checked={roles.includes("host")}
            disabled={disabled}
            id={`${idPrefix}-role-host`}
            onCheckedChange={(checked) => setRole("host", checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${idPrefix}-role-host`}>Host</FieldLabel>
            <FieldDescription>
              Can manage seeds in their host leagues.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            checked={roles.includes("uploader")}
            disabled={disabled}
            id={`${idPrefix}-role-uploader`}
            onCheckedChange={(checked) => setRole("uploader", checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${idPrefix}-role-uploader`}>
              Uploader
            </FieldLabel>
            <FieldDescription>
              Can add seeds to the pool or to non-home leagues.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
