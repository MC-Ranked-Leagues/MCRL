import { data } from "./data/week8l4"

type Fetcher = typeof fetch

export type ReplayWrite = {
  savedAt?: string
  endpoint: string
  method: string
  payload: unknown
}

type ReplayOptions = {
  siteUrl: string
  apiKey: string
  dryRun?: boolean
  fetcher?: Fetcher
}

type ReplaySummary = {
  attempted: number
  succeeded: number
  failed: number
}

function getFlag(name: string) {
  return process.argv.includes(name)
}

function getArg(name: string) {
  const prefix = `${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, "")
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json())
  }

  return await response.text()
}

export async function replayWrites(
  writes: ReplayWrite[],
  options: ReplayOptions
): Promise<ReplaySummary> {
  const fetcher = options.fetcher ?? fetch
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  let succeeded = 0

  for (const [index, write] of writes.entries()) {
    const writeNumber = index + 1
    const url = `${siteUrl}${write.endpoint}`
    const label = `${write.method} ${write.endpoint}`

    console.log(
      `[${writeNumber}/${writes.length}] ${options.dryRun ? "DRY RUN " : ""}${label}`
    )

    if (options.dryRun) continue

    const response = await fetcher(url, {
      method: write.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey,
      },
      body: JSON.stringify(write.payload),
    })

    if (!response.ok) {
      const responseBody = await readResponseBody(response)
      throw new Error(
        `Write ${writeNumber} failed: ${label} returned ${response.status} ${response.statusText}\n${responseBody}`
      )
    }

    succeeded += 1
  }

  return {
    attempted: writes.length,
    succeeded,
    failed: 0,
  }
}

function printUsage() {
  console.log(
    `
Usage:
  bun scripts/replayWeek8l4.ts [--execute] [--site-url=<url>] [--api-key=<key>]

Defaults:
  --site-url=$CONVEX_SITE_URL or http://localhost:3210
  --api-key=$WRITER_API_KEY or test_api_key_123

Notes:
  Without --execute this is a dry run.
  Writes are sent sequentially in the exact order from scripts/data/week8l4.ts.
`.trim()
  )
}

async function main() {
  if (getFlag("--help") || getFlag("-h")) {
    printUsage()
    return
  }

  const siteUrl =
    getArg("--site-url") ||
    process.env.PRODUCTION_CONVEX_SITE ||
    "http://localhost:3210"
  const apiKey =
    getArg("--api-key") || process.env.WRITER_API_KEY || "test_api_key_123"
  const dryRun = !getFlag("--execute")

  const summary = await replayWrites(data.writes, {
    siteUrl,
    apiKey,
    dryRun,
  })

  console.log(
    `Done. Attempted ${summary.attempted}, succeeded ${summary.succeeded}, failed ${summary.failed}.`
  )
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
