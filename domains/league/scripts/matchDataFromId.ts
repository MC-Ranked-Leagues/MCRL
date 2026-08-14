import fs from "fs"

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

function parseResponse(response: MatchAPIResponseType, dnfTime: number) {
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
    const completedData = completionByUuid.get(player.uuid)

    return {
      playerName: player.nickname,
      timeMs: completedData?.time ?? dnfTime,
    }
  })

  const basePoints = times.length

  times.sort((a, b) => a.timeMs - b.timeMs)

  const results = times.map((time, index) => {
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

// const DNF_TIMES = {
//   league1: 13 * 60 * 1000,
//   league2: 15 * 60 * 1000,
//   league3: 17 * 60 * 1000,
//   league4: 20 * 60 * 1000,
//   league5: 25 * 60 * 1000,
//   league6: 30 * 60 * 1000,
// }

const main = async () => {
  const args = process.argv.slice(2)
  const matchIdArg = args.find((a) => a.startsWith("--matchId="))?.split("=")[1]
  const dnfTimeArg = args.find((a) => a.startsWith("--dnfTime="))?.split("=")[1]

  if (!matchIdArg || !dnfTimeArg) {
    console.error(
      "Usage: ts-node matchDataFromId.ts --matchId=<matchId> --dnfTime=<dnfTime>"
    )
    process.exit(1)
  }

  if (isNaN(Number(dnfTimeArg))) {
    console.error("Invalid dnfTime")
    process.exit(1)
  }

  const DNF_TIME = Number(dnfTimeArg)
  const filename = `./scripts/data/match_${matchIdArg}.json`

  try {
    console.log(`Fetching match ${matchIdArg}...`)
    const response = await getMatchData(matchIdArg)
    const results = parseResponse(response, DNF_TIME)
    await fs.promises.writeFile(
      filename,
      JSON.stringify(results, null, 2),
      "utf-8"
    )
    console.log(`\nDone! Results written to ${filename}`)
  } catch (err) {
    console.error(`Error on match ${matchIdArg}: ${(err as Error).message}`)
  }
}

main()
