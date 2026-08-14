import fs from "node:fs"
import path from "node:path"

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL
const MY_API_KEY = process.env.WRITER_API_KEY || "test_key_placeholder"

// CONFIGURATION
const WEEK_NUMBER = 5
const DATA_DIR = path.resolve(process.cwd(), "scripts/data/weekTwomatches")
const DRY_RUN = false

const getLeagueTierFromFilename = (filename: string): number => {
  const match = filename.match(/league(\d+)/i)
  return match ? parseInt(match[1], 10) : 1
}

const DNF_TIMES = {
  league1: 13 * 60 * 1000,
  league2: 15 * 60 * 1000,
  league3: 17 * 60 * 1000,
  league4: 20 * 60 * 1000,
  league5: 25 * 60 * 1000,
  league6: 30 * 60 * 1000,
}

async function run() {
  if (!CONVEX_SITE_URL) {
    console.error(
      "ERROR: PRODUCTION_CONVEX_SITE environment variable is not set."
    )
    process.exit(1)
  }

  console.log(`Scanning directory: ${DATA_DIR}`)
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`ERROR: Directory not found: ${DATA_DIR}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json"))

  if (files.length === 0) {
    console.warn("No .json files found in the directory.")
    return
  }

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const leagueTier = getLeagueTierFromFilename(file)
    console.log(
      `\n--- Processing file: ${file} (League Tier: ${leagueTier}) ---`
    )

    const fileContent = fs.readFileSync(filePath, "utf-8")
    let matches
    try {
      matches = JSON.parse(fileContent)
    } catch (e) {
      console.error(`Failed to parse JSON in ${file}:`, e)
      continue
    }

    if (!Array.isArray(matches)) {
      console.error(
        `Expected an array of matches in ${file}, but got ${typeof matches}`
      )
      continue
    }

    // Start Competition
    try {
      const res = await fetch(`${CONVEX_SITE_URL}/api/write/competition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": MY_API_KEY,
        },
        body: JSON.stringify({
          leagueTier,
          weekNumber: WEEK_NUMBER,
          maxTimeLimitMs:
            DNF_TIMES[`league${leagueTier}` as keyof typeof DNF_TIMES] || null,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error(
          `Error starting competition for League ${leagueTier}: ${res.status} ${res.statusText}`
        )
        console.error(`Response: ${errorText}`)
        continue
      } else {
        console.log(`Successfully started competition for League ${leagueTier}`)
      }
    } catch (error) {
      console.error(
        `Error starting competition for League ${leagueTier}`,
        error
      )
    }

    const regMap = new Map<string, string>()

    matches.forEach((match) => {
      match.results.forEach((result: { playerName: string }) => {
        regMap.set(result.playerName as string, crypto.randomUUID())
      })
    })

    for (const [playerName, regId] of regMap.entries()) {
      console.log(`Registering player: ${playerName} with regId: ${regId}`)
      if (DRY_RUN) {
        console.log(
          `[DRY RUN] Would register player ${playerName} with regId ${regId}`
        )
        continue
      }
      try {
        const res = await fetch(`${CONVEX_SITE_URL}/api/write/player`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": MY_API_KEY,
          },
          body: JSON.stringify({
            leagueTier,
            weekNumber: WEEK_NUMBER,
            uuid: regId,
            ign: playerName,
          }),
        })
        if (!res.ok) {
          const errorText = await res.text()
          console.error(
            `Error registering player ${playerName}: ${res.status} ${res.statusText}`
          )
          console.error(`Response: ${errorText}`)
        } else {
          console.log(`Successfully registered player ${playerName}`)
        }
      } catch (error) {
        console.error(`Error registering player ${playerName}:`, error)
      }
    }

    const relegationsPerMatch = new Map<
      number,
      { promotedUUIDs: string; demotedUUIDs: string }
    >()
    const resultsByPlayer = new Map<string, number>()
    for (const match of matches) {
      console.log(
        `Ingesting Week ${WEEK_NUMBER}, League ${leagueTier}, Match ${match.matchNumber}...`
      )

      if (!DRY_RUN) {
        try {
          const res = await fetch(`${CONVEX_SITE_URL}/api/write/match/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": MY_API_KEY,
            },
            body: JSON.stringify({
              leagueTier,
              weekNumber: WEEK_NUMBER,
              matchNumber: match.matchNumber,
            }),
          })

          const resultText = await res.text()
          if (!res.ok) {
            console.error(
              `Error ingesting match ${match.matchNumber}: ${res.status} ${res.statusText}`
            )
            console.log(resultText)
          } else {
            console.log(`Successfully ingested match ${match.matchNumber}`)
            try {
              console.log(JSON.parse(resultText))
            } catch {
              console.log(resultText)
            }
          }
        } catch (error) {
          console.error(`Fetch error for match ${match.matchNumber}:`, error)
        }
      }

      type resultType = {
        playerName: string
        timeMs: number
        placement: number
        pointsWon: number
      }
      const matchData = {
        weekNumber: WEEK_NUMBER,
        matchNumber: match.matchNumber,
        rankedMatchId: match.matchId,
        leagueTier,
        results: match.results.map((result: resultType) => {
          const dnfTime =
            DNF_TIMES[`league${leagueTier}` as keyof typeof DNF_TIMES] || null

          if (!dnfTime) {
            throw new Error(
              `No DNF time configured for league tier ${leagueTier}`
            )
          }

          const isDnf = result.timeMs >= dnfTime

          return {
            uuid: regMap.get(result.playerName) || null,
            timeMs: isDnf ? null : result.timeMs,
            dnf: isDnf,
            placement: result.placement,
            pointsWon: isDnf ? 0 : result.pointsWon,
          }
        }),
      }

      if (DRY_RUN) {
        console.log(
          `[DRY RUN] Would send match data for match ${match.matchNumber}`
        )
        // console.log(JSON.stringify(matchData, null, 2));
        continue
      }

      try {
        const res = await fetch(`${CONVEX_SITE_URL}/api/write/match/results`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": MY_API_KEY,
          },
          body: JSON.stringify(matchData),
        })

        const resultText = await res.text()
        if (!res.ok) {
          console.error(
            `Error ingesting match ${match.matchNumber}: ${res.status} ${res.statusText}`
          )
          console.log(resultText)
        } else {
          console.log(`Successfully ingested match ${match.matchNumber}`)
          try {
            console.log(JSON.parse(resultText))
          } catch {
            console.log(resultText)
          }
        }
      } catch (error) {
        console.error(`Fetch error for match ${match.matchNumber}:`, error)
      }

      for (const result of match.results) {
        const playerName = result.playerName
        const uuid = regMap.get(playerName)
        if (!uuid) {
          console.error(
            `No registration UUID found for player ${playerName}, skipping registration.`
          )
          continue
        }
        resultsByPlayer.set(
          uuid,
          (resultsByPlayer.get(uuid) || 0) + result.pointsWon
        )
      }
    }
    const RELEGATION_PERCENTAGE = 0.1

    // Relegate Players
    const movementPlan: {
      leagueTier: number
      weekNumber: number
      promotedUuids: string[]
      demotedUuids: string[]
    } = {
      leagueTier,
      weekNumber: WEEK_NUMBER,
      promotedUuids: [],
      demotedUuids: [],
    }

    const sortedByPointsAsc = Array.from(resultsByPlayer.entries()).sort(
      (a, b) => a[1] - b[1]
    )
    const sortedByPointsDesc = Array.from(resultsByPlayer.entries()).sort(
      (a, b) => b[1] - a[1]
    )

    const numToDemote = Math.floor(
      sortedByPointsAsc.length * RELEGATION_PERCENTAGE
    )
    const numToPromote = Math.floor(
      sortedByPointsDesc.length * RELEGATION_PERCENTAGE
    )

    const MAX_LEAGUE_TIER = 6
    const MIN_LEAGUE_TIER = 1

    movementPlan.demotedUuids =
      leagueTier === MAX_LEAGUE_TIER // league 6 nowhere to demote to
        ? []
        : sortedByPointsAsc.slice(0, numToDemote).map(([uuid]) => uuid)

    movementPlan.promotedUuids =
      leagueTier === MIN_LEAGUE_TIER // league 1 nowhere to promote to
        ? []
        : sortedByPointsDesc.slice(0, numToPromote).map(([uuid]) => uuid)

    if (DRY_RUN) {
      console.log(
        `[DRY RUN] Would process relegations for League ${leagueTier}. Movement Plan: `,
        movementPlan
      )
    }

    try {
      const res = await fetch(`${CONVEX_SITE_URL}/api/write/movements`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": MY_API_KEY,
        },
        body: JSON.stringify(movementPlan),
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error(
          `Error processing relegations for League ${leagueTier}: ${res.status} ${res.statusText}`
        )
        console.error(`Response: ${errorText}`)
      } else {
        console.log(
          `Successfully processed relegations for League ${leagueTier}`
        )
      }
    } catch (error) {
      console.error(
        `Error processing relegations for League ${leagueTier}`,
        error
      )
    }
  }
}

run().catch((error) => {
  console.error("Execution error:", error)
  process.exit(1)
})
