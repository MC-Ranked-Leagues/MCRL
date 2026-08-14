import { ConvexError } from "convex/values";

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    const data = error.data;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }

    if (typeof data === "string") {
      return data;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
