import { expect, test } from "bun:test";

import { formatRankedRegistrationExport } from "./list";

test("ranked exports include Twitch usernames only for streaming registrations", () => {
  expect(
    JSON.parse(
      formatRankedRegistrationExport([
        {
          ign: "Streamer",
          streaming: true,
          twitch: "streamer_live",
        },
        {
          ign: "PrivatePlayer",
          streaming: false,
          twitch: "private_channel",
        },
        { ign: "NoTwitch", streaming: false, twitch: null },
      ])
    )
  ).toEqual([
    {
      ign: "Streamer",
      twitch_username: "streamer_live",
      display_name: "Streamer",
    },
    {
      ign: "PrivatePlayer",
      twitch_username: "",
      display_name: "PrivatePlayer",
    },
    {
      ign: "NoTwitch",
      twitch_username: "",
      display_name: "NoTwitch",
    },
  ]);
});
