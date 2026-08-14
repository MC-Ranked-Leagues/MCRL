import MATCH_IDS from "./data/matchIds"
import fs from "fs"
import registeredPlayers from "./data/week1regs"

type UserProfile = {
  uuid: string
  nickname: string
  roleType: number
  eloRate?: number
  eloRank?: number
  country?: string
}

type MatchSeed = {
  id?: string
  overworld?: string
  nether?: string
  endTowers?: number[]
  variations?: string[]
}

export type MatchAPIResponseType = {
  status: string
  data:
    | {
        id: string
        type: number
        season: number
        category?: string
        date: string
        players: UserProfile[]
        spectators: UserProfile[]
        seed?: MatchSeed
        result: {
          uuid: string
          time: string
        }
        forefeited: boolean
        decayed: boolean
        rank: {
          season?: number
          allTime?: number
        }
        tag?: string
        beginner: boolean
        vod: {
          uuid: string
          url: string
          startsAt: string
        }[]
        completions: {
          uuid: string
          time: number
        }[]
        timelines: {
          uuid: string
          time: number
          type: string
        }[]
        replayExist: boolean
      }
    | null
    | string
    | "Too many requests"
}

const BASE_URL = "https://api.mcsrranked.com/matches/"

async function getMatchData(matchId: string) {
  try {
    const response = await fetch(`${BASE_URL}${matchId}`)
    if (!response.ok) {
      throw new Error(
        `Network error: ${response.status} ${response.statusText}`
      )
    }
    const data = (await response.json()) as MatchAPIResponseType
    return data
  } catch (err) {
    throw new Error(
      `Failed to fetch match ${matchId}: ${(err as Error).message}`
    )
  }
}

function parseResponse(
  response: MatchAPIResponseType,
  dnfTime: number,
  ignoreUnregistered: boolean
) {
  if (response.status === "error") {
    if (typeof response.data === "string") {
      throw new Error(response.data)
    }
    throw new Error("Invalid data")
  }
  const matchData = response.data
  if (!matchData || typeof matchData === "string") {
    throw new Error("No match data")
  }

  const completionByUuid = new Map<string, (typeof matchData.completions)[0]>()
  for (const c of matchData.completions) {
    if (c && typeof c.uuid === "string") completionByUuid.set(c.uuid, c)
  }

  const times = matchData.players.map((player) => {
    if (ignoreUnregistered && !(player.nickname in registeredPlayers)) {
      console.warn(
        `Warning: Player "${player.nickname}" (UUID: ${player.uuid}) not found in registered players list. Dropping player from results.`
      )
      return
    }
    const completedData = completionByUuid.get(player.uuid)

    return {
      playerName: player.nickname,
      timeMs: completedData?.time ?? dnfTime,
    }
  })

  const timesFiltered = times.filter(
    (t): t is NonNullable<typeof t> => t !== undefined
  )

  const basePoints = timesFiltered.length

  timesFiltered.sort((a, b) => a.timeMs - b.timeMs)

  const results = timesFiltered.map((time, index) => {
    const pointsWon = time.timeMs === dnfTime ? 0 : basePoints - index

    return {
      playerName: time.playerName,
      timeMs: time.timeMs,
      placement: index + 1,
      pointsWon,
    }
  })

  return results
}

const DNF_TIMES = {
  league1: 13 * 60 * 1000,
  league2: 15 * 60 * 1000,
  league3: 17 * 60 * 1000,
  league4: 20 * 60 * 1000,
  league5: 25 * 60 * 1000,
  league6: 30 * 60 * 1000,
}

const main = async () => {
  const args = process.argv.slice(2)
  const weekArg = args.find((a) => a.startsWith("--week="))?.split("=")[1]
  const leagueArg = args.find((a) => a.startsWith("--league="))?.split("=")[1]
  const ignoreUnregistered = args
    .find((a) => a.startsWith("--ignoreUnreg="))
    ?.split("=")[1]
    .toLowerCase()

  if (!weekArg || !leagueArg) {
    console.error(
      "Usage: ts-node matchDataFromRanked.ts --week=<weekOne|weekTwo> --league=<1-6>"
    )
    process.exit(1)
  }

  if (
    ignoreUnregistered &&
    ignoreUnregistered !== "true" &&
    ignoreUnregistered !== "false"
  ) {
    console.error(
      `Invalid value for --ignoreUnreg: "${ignoreUnregistered}". Valid options: true, false`
    )
    process.exit(1)
  }

  const ignoreUnregBool = ignoreUnregistered === "true"
  if (ignoreUnregBool) {
    console.log("Ignoring unregistered players in results.")
  }

  const weekKey = weekArg as keyof typeof MATCH_IDS
  const leagueKey =
    `league${leagueArg}` as keyof (typeof MATCH_IDS)[typeof weekKey]

  if (!MATCH_IDS[weekKey]) {
    console.error(
      `Invalid week: "${weekArg}". Valid options: ${Object.keys(MATCH_IDS).join(", ")}`
    )
    process.exit(1)
  }

  const leagueMatches = MATCH_IDS[weekKey][leagueKey]
  if (!leagueMatches) {
    console.error(`Invalid league: "${leagueArg}". Valid options: 1-6`)
    process.exit(1)
  }

  const filledMatches = leagueMatches.filter((m) => m.matchId !== "")
  if (filledMatches.length === 0) {
    console.error(`No match IDs found for ${weekArg} / league${leagueArg}`)
    process.exit(1)
  }

  console.log(
    `Fetching ${filledMatches.length} matches for ${weekArg} / league${leagueArg}...`
  )

  const DNF_TIME = DNF_TIMES[leagueKey]

  const output: {
    matchNumber: number
    matchId: string
    results: ReturnType<typeof parseResponse>
  }[] = []

  for (const match of filledMatches) {
    try {
      console.log(
        `  Fetching match #${match.matchNumber} (ID: ${match.matchId})...`
      )
      const response = await getMatchData(match.matchId)
      const results = parseResponse(response, DNF_TIME, ignoreUnregBool)
      output.push({
        matchNumber: match.matchNumber,
        matchId: match.matchId,
        results,
      })
    } catch (err) {
      console.error(
        `  Error on match #${match.matchNumber}: ${(err as Error).message}`
      )
    }
  }

  const filename = `./scripts/data/${weekArg}matches/${weekArg}_league${leagueArg}.json`
  await fs.promises.writeFile(
    filename,
    JSON.stringify(output, null, 2),
    "utf-8"
  )
  console.log(`\nDone! Results written to ${filename}`)
}

main()
