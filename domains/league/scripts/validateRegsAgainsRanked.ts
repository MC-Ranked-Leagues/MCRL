import REGS from "./data/week4regs"
import fs from "fs"

type RegType = (typeof REGS)[number]

export type UserProfile = {
  uuid: string
  nickname: string
  roleType: string
  eloRate: number
  eloRank: number
  country: string
  statistics: {
    season: {
      bestTime: {
        ranked: number | null
        casual: number | null
      }
      [key: string]: {
        ranked: number | null
        casual: number | null
      }
    }
    total: {
      bestTime: {
        ranked: number | null
        casual: number | null
      }
      [key: string]: {
        ranked: number | null
        casual: number | null
      }
    }
  }
  connections: {
    twitch: {
      id: string
      name: string
    }
    discord: {
      id: string
      name: string
    }
  }
  seasonResult: {
    last: {
      eloRate: number
      eloRank: number
      phasePoint: number
    }
    highest: number
    lowest: number
  }
}

// Check for duplicate registration names
const names = REGS.map((reg) => reg.name)
const dedupedNames = [...new Set(names)]

console.log(
  `There are ${dedupedNames.length} unique registration names out of ${names.length} total registrations.`
)

if (dedupedNames.length !== names.length) {
  console.error("Duplicate regs found:")
  const seen = new Set()
  for (const name of names) {
    if (seen.has(name)) {
      console.error(`- ${name}`)
    } else {
      seen.add(name)
    }
  }
} else {
  console.log("No duplicate regs found.")
}

// Call the ranked api and get all the user data

const url = "https://api.mcsrranked.com/users/"
const BATCH_SIZE = 10
const DELAY_MS = 500

async function fetchInBatches<T>(
  items: string[],
  fn: (item: string) => Promise<T | null | undefined>,
  batchSize: number,
  delayMs: number
): Promise<(T | null)[]> {
  const results: (T | null)[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults.map((r) => r ?? null))
    console.log(
      `Fetched batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`
    )
    if (i + batchSize < items.length) {
      await new Promise((res) => setTimeout(res, delayMs))
    }
  }
  return results
}

async function fetchRankedUser(username: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`${url}${encodeURIComponent(username)}`)
    if (!response.ok) {
      console.error(
        `Failed to fetch [${response.status}] ${username}: ${response.statusText}`
      )
      return null
    }
    const msg = (await response.json()) as { status: string; data: UserProfile }
    if (msg.status !== "success") {
      console.error(`API error for ${username}: ${msg.status}`)
      return null
    }
    return msg.data
  } catch (error) {
    console.error(`Network error for ${username}:`, error)
    return null
  }
}

const allData = await fetchInBatches(
  dedupedNames,
  fetchRankedUser,
  BATCH_SIZE,
  DELAY_MS
)
const validData = allData.filter(Boolean)

const filteredData = validData.map((data, i) => {
  if (!data) {
    return null
  }

  return {
    id: i + 1,
    uuid: data.uuid,
    name: data.nickname,
    elo: data.eloRate,
    peakElo: data.seasonResult.highest,
    bestTime: data.statistics.season.bestTime.ranked,
    twitch: data.connections.twitch,
    discord: data.connections.discord,
  }
})

console.log(
  `Fetched data for ${filteredData.length} users. Missing data for ${allData.length - filteredData.length} users.`
)

console.log("Writing to file...")

fs.writeFileSync(
  "./scripts/data/validatedRegs.ts",
  JSON.stringify(filteredData, null, 2),
  "utf-8"
)
