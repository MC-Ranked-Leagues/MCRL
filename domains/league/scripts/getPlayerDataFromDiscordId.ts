import DATA from "./data/players"
import fs from "fs"

const PLAYERS = DATA.players
const url = "https://api.mcsrranked.com/users/"

type DiscordId = keyof typeof PLAYERS & string

async function fetchRankedUser(discordId: string, label: string) {
  try {
    const res = await fetch(`${url}${encodeURIComponent(discordId)}`)

    if (!res.ok) {
      console.error(`[${res.status}] Failed: ${label}`)
      return null
    }

    const json = await res.json()

    if (json.status !== "success") {
      console.error(`API error: ${label} -> ${json.status}`)
      return null
    }

    console.log(`Fetched: ${json.data.nickname} (${label})`)
    return json.data
  } catch (err) {
    console.error(`Network error: ${label}`, err)
    return null
  }
}

async function main() {
  const ids = Object.keys(PLAYERS) as DiscordId[]

  console.log(`Starting fetch for ${ids.length} players...\n`)

  let success = 0
  let failed = 0

  const results = await Promise.all(
    ids.map(async (id, index) => {
      const label = PLAYERS[id].discordUsername

      console.log(`[${index + 1}/${ids.length}] Fetching ${label}`)

      const data = await fetchRankedUser(`discord.${id}`, label)

      if (!data) {
        failed++
        return null
      }

      success++

      return {
        currentLeagueNumber: PLAYERS[id].league,
        uuid: data.uuid,
        ign: data.nickname,
        lowercaseIgn: data.nickname.toLowerCase(),
        elo: data.seasonResult.highest,
      }
    })
  )

  const filtered = results.filter(Boolean)

  console.log("\nSummary:")
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)

  console.log("\nWriting file...")

  fs.writeFileSync(
    "./scripts/data/validatedRegs.ts",
    JSON.stringify(filtered, null, 2),
    "utf-8"
  )

  console.log("Done. File saved as preparedPlayers.json")
}

main()
