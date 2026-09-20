import { expect, test } from "bun:test";

import { normalizeTwitchUsername } from "./twitch";

test("normalizes usernames, handles, and Twitch profile URLs", () => {
  for (const input of [
    "  Some_Name123  ",
    "@Some_Name123",
    "https://www.twitch.tv/Some_Name123/",
    "http://twitch.tv/Some_Name123",
    "twitch.tv/Some_Name123?ref=share#about",
    "www.twitch.tv/Some_Name123",
    "https://m.twitch.tv/Some_Name123",
    "HTTPS://TWITCH.TV/Some_Name123",
  ]) {
    expect(normalizeTwitchUsername(input)).toBe("some_name123");
  }
  expect(normalizeTwitchUsername("ab")).toBe("ab");
  expect(normalizeTwitchUsername("a".repeat(25))).toBe("a".repeat(25));
});

test("rejects invalid names and URLs instead of changing the account", () => {
  for (const input of [
    "",
    "   ",
    "@",
    "@@someone",
    "some name",
    "some-name",
    "some.name",
    "soméname",
    "name!",
    "a".repeat(26),
    "https://example.com/someone",
    "https://twitch.tv.example.com/someone",
    "https://twitch.tv@evil.com/someone",
    "https://user@twitch.tv/someone",
    "https://twitch.tv:8080/someone",
    "https://twitch.tv/",
    "https://twitch.tv/videos/123456",
    "https://clips.twitch.tv/SomeClip",
    "ftp://twitch.tv/someone",
    "https://",
  ]) {
    expect(normalizeTwitchUsername(input)).toBeNull();
  }
});
