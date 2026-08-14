import type { KeyboardEvent } from "react";

export const MIN_LEAGUE_NAME_LENGTH = 3;
export const MAX_LEAGUE_NAME_LENGTH = 20;

export type LeagueFormValues = {
  leagueNumber: string;
  leagueName: string;
};

export type LeagueFormErrors = Partial<
  Record<keyof LeagueFormValues, string>
> & {
  form?: string;
};

export function sanitizeLeagueNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function limitLeagueName(value: string) {
  return value.slice(0, MAX_LEAGUE_NAME_LENGTH);
}

export function validateLeagueForm({
  leagueNumber,
  leagueName,
}: LeagueFormValues) {
  const errors: LeagueFormErrors = {};
  const numericLeagueNumber = Number(leagueNumber);
  const trimmedLeagueName = leagueName.trim();

  if (
    leagueNumber.length === 0 ||
    !Number.isSafeInteger(numericLeagueNumber) ||
    numericLeagueNumber < 1
  ) {
    errors.leagueNumber = "League number must be a positive whole number";
  }

  if (
    trimmedLeagueName.length < MIN_LEAGUE_NAME_LENGTH ||
    trimmedLeagueName.length > MAX_LEAGUE_NAME_LENGTH
  ) {
    errors.leagueName = "League name must be between 3 and 20 characters";
  }

  return errors;
}

export function getLeagueMutationArgs({
  leagueNumber,
  leagueName,
}: LeagueFormValues) {
  return {
    leagueNumber: Number(leagueNumber),
    leagueName: leagueName.trim(),
  };
}

export function preventNonNumericInput(event: KeyboardEvent<HTMLInputElement>) {
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

  if (!isDigit && !allowedKeys.includes(event.key)) {
    event.preventDefault();
  }
}
