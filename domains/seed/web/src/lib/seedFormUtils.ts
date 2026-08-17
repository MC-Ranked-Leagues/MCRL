import type { KeyboardEvent } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { SeedType } from "./consts";

export const MAX_SEED_IMPORT_COUNT = 500;

export type SeedFormValues = {
  type: SeedType | null;
  leagueId: Id<"leagues"> | null;
  overworld: string;
  nether: string;
  end: string;
  rng: string;
};

export type SeedFormErrors = Partial<Record<keyof SeedFormValues, string>> & {
  form?: string;
  file?: string;
};

export type SeedDimensionValues = Pick<
  SeedFormValues,
  "overworld" | "nether" | "end" | "rng"
>;

export type SeedUploadInput = {
  type: SeedType;
  leagueId?: Id<"leagues">;
  overworld: string;
  nether: string;
  end: string;
  rng: string;
};

export type SeedJsonUploadInput = Omit<SeedUploadInput, "leagueId">;

export function sanitizeSeedNumber(value: string) {
  const sign = value.startsWith("-") ? "-" : "";
  const digits = value.replace(/\D/g, "");

  return `${sign}${digits}`;
}

export function parseMinecraftSeedClipboard(
  value: string
): SeedDimensionValues | null {
  const labelToField = {
    Overworld: "overworld",
    Nether: "nether",
    "The End": "end",
    RNG: "rng",
  } as const;
  const seeds: Partial<SeedDimensionValues> = {};
  const lines = value.trim().split(/\r?\n/);

  if (lines.length !== 4) {
    return null;
  }

  for (const line of lines) {
    const match = line.match(
      /^\s*(Overworld|Nether|The End|RNG):\s*(-?\d+)\s*$/
    );

    if (!match) {
      return null;
    }

    const [, label, seed] = match;
    const field = labelToField[label as keyof typeof labelToField];

    if (seeds[field] !== undefined) {
      return null;
    }

    seeds[field] = seed;
  }

  if (
    seeds.overworld === undefined ||
    seeds.nether === undefined ||
    seeds.end === undefined ||
    seeds.rng === undefined
  ) {
    return null;
  }

  return seeds as SeedDimensionValues;
}

export function preventNonNumericSeedInput(
  event: KeyboardEvent<HTMLInputElement>
) {
  if (event.ctrlKey || event.metaKey) {
    return;
  }

  const allowedKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
  ];

  const isDigit = /^[0-9]$/.test(event.key);
  const isMinusSign =
    event.key === "-" &&
    event.currentTarget.selectionStart === 0 &&
    !event.currentTarget.value.includes("-");

  if (!isDigit && !isMinusSign && !allowedKeys.includes(event.key)) {
    event.preventDefault();
  }
}

export function getManualSeedFormErrors(
  issues: Array<{ message: string; path: PropertyKey[] }>
) {
  const errors: SeedFormErrors = {};

  for (const issue of issues) {
    const field = issue.path.find(isSeedFormField);

    if (field) {
      errors[field] ??= issue.message;
      continue;
    }

    errors.form ??= issue.message;
  }

  return errors;
}

export function isSeedFormField(value: unknown): value is keyof SeedFormValues {
  return (
    value === "type" ||
    value === "leagueId" ||
    value === "overworld" ||
    value === "nether" ||
    value === "end" ||
    value === "rng"
  );
}
