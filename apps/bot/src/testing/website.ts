import { afterEach, beforeEach, spyOn } from "bun:test";

// Every website request in bot tests stays in-process, including production
// guild selection. Never use a developer's deployment or writer key in tests.
export function mockWebsite() {
  const requests: { url: string; path: string; args: unknown }[] = [];
  const mock = {
    requests,
    respond: async (): Promise<Response> =>
      Response.json({ status: "success", value: null }),
  };
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  const variables = [
    "DEV_CONVEX_URL",
    "PROD_CONVEX_URL",
    "DEV_CONVEX_WRITER_KEY",
    "PROD_CONVEX_WRITER_KEY",
  ];
  let previous: (string | undefined)[];
  beforeEach(() => {
    previous = variables.map((name) => process.env[name]);
    for (const prefix of ["DEV", "PROD"]) {
      process.env[`${prefix}_CONVEX_URL`] =
        `https://${prefix.toLowerCase()}-test.convex.cloud`;
      process.env[`${prefix}_CONVEX_WRITER_KEY`] =
        `${prefix.toLowerCase()}-test-key`;
    }
    requests.length = 0;
    mock.respond = async () =>
      Response.json({ status: "success", value: null });
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      url,
      init
    ) => {
      if (typeof url !== "string" || typeof init?.body !== "string")
        throw new Error("Expected a Convex JSON request.");
      const body = JSON.parse(init.body) as { path: string; args: unknown };
      requests.push({ url, path: body.path, args: body.args });
      return mock.respond();
    }) as typeof fetch);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    variables.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  });
  return mock;
}
