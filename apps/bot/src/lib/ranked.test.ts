import { expect, test } from "bun:test";
import { RankedClient } from "mcsrranked-sdk";

import { rankedLookupErrorMessage } from "./ranked";

// Replay the server's error through the real SDK, including misleading HTTP statuses.
test.each([200, 400, 404, 500])(
  "missing user is recognized with HTTP %i",
  async (status) => {
    const client = new RankedClient({
      retries: 0,
      fetch: Object.assign(
        async () =>
          Response.json(
            { status: "error", data: { error: "User is not exists." } },
            { status }
          ),
        { preconnect() {} }
      ),
    });
    const error: unknown = await client.users
      .get("discord.test")
      .catch((failure: unknown) => failure);
    expect(rankedLookupErrorMessage(error, true)).toContain(
      "Ask the player to link Discord"
    );
    expect(rankedLookupErrorMessage(error)).toContain(
      "No Minecraft account is linked"
    );
  }
);

test("an unrelated 404 does not tell the player to link their account", async () => {
  const client = new RankedClient({
    retries: 0,
    fetch: Object.assign(
      async () =>
        Response.json(
          { status: "error", data: { error: "Route not found" } },
          { status: 404 }
        ),
      { preconnect() {} }
    ),
  });
  const error: unknown = await client.users
    .get("discord.test")
    .catch((failure: unknown) => failure);
  expect(rankedLookupErrorMessage(error)).toContain(
    "An unexpected error occurred."
  );
});
