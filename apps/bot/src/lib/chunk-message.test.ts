import { expect, test } from "bun:test";
import { chunkMessage } from "./chunk-message";

test("keeps rows and blank lines together at the Discord limit", () => {
  const first = "a".repeat(1998);
  expect(chunkMessage(`${first}\n\nb`)).toEqual([`${first}\n`, "b"]);
  expect(chunkMessage("a".repeat(2000))).toEqual(["a".repeat(2000)]);
  expect(chunkMessage("")).toEqual([]);
});

test("splits an oversized line without emitting empty messages or losing text", () => {
  const content = "a".repeat(4500);
  const chunks = chunkMessage(content);
  expect(chunks.map((chunk) => chunk.length)).toEqual([2000, 2000, 500]);
  expect(chunks.join("")).toBe(content);
});
