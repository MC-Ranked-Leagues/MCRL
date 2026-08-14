import { useEffect, useMemo, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

type MatchAPIResponseType = {
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

type MatchPayload = Exclude<MatchAPIResponseType["data"], null | string>

const formatTime = (ms: number) => {
  if (ms === 0) return "0:00.00"
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths
    .toString()
    .padStart(2, "0")}`
}

type Phase =
  | "overworld"
  | "nether"
  | "bastion"
  | "fortress"
  | "blind"
  | "stronghold"
  | "end"
  | "complete"

// Map each timeline event type to its major phase
const getMajorPhase = (type: string): Phase | null => {
  if (type === "projectelo.timeline.reset") return "overworld"
  if (type === "story.enter_the_nether") return "nether"
  if (type === "nether.find_bastion" || type === "nether.loot_bastion")
    return "bastion"
  if (type === "nether.find_fortress" || type === "nether.obtain_blaze_rod")
    return "fortress"
  if (type === "projectelo.timeline.blind_travel") return "blind"
  if (type === "story.follow_ender_eye") return "stronghold"
  if (type === "story.enter_the_end") return "end"
  // Deaths, minor events, etc. → not a major phase change
  return null
}

const phaseColors: Record<Phase, string> = {
  overworld: "bg-[#55ff55]", // Green
  nether: "bg-[#FF5555]", // Pinkish
  bastion: "bg-[#222222]", // Near black
  fortress: "bg-[#660000]", // dark red
  blind: "bg-[#7755EE]", // purple
  stronghold: "bg-[#77AA88]", // greenish
  end: "bg-[#e2e2aa]", // Pale yellow
  complete: "bg-[#e2e2aa]", // Pale yellow
}

const phaseNames: Record<Phase | "forfeit", string> = {
  overworld: "Overworld",
  nether: "Nether",
  bastion: "Bastion",
  fortress: "Fortress",
  blind: "Blind Travel",
  stronghold: "Stronghold",
  end: "The End",
  complete: "Finished",
  forfeit: "Forfeited",
}

const matchDataCache = new Map<string, MatchAPIResponseType["data"] | null>()

const MatchData = ({ matchId }: { matchId: string | null }) => {
  const [loadedMatchData, setLoadedMatchData] = useState<{
    matchId: string
    data: MatchAPIResponseType["data"] | null
  } | null>(null)

  const matchData = useMemo(() => {
    if (!matchId) return undefined

    const cached = matchDataCache.get(matchId)
    if (cached !== undefined) return cached

    if (loadedMatchData?.matchId === matchId) return loadedMatchData.data

    return undefined
  }, [matchId, loadedMatchData])

  useEffect(() => {
    if (!matchId || matchDataCache.has(matchId)) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch(
          `https://api.mcsrranked.com/matches/${matchId}`,
          { signal: controller.signal }
        )
        const data: MatchAPIResponseType = await response.json()
        const payload = data.data ?? null
        matchDataCache.set(matchId, payload)
        if (!cancelled) {
          setLoadedMatchData({ matchId, data: payload })
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error("Error fetching match data:", error)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [matchId])

  const playerDataIndexes = useMemo(() => {
    if (!matchData || typeof matchData === "string") return null

    const timelinesByUuid = new Map<string, MatchPayload["timelines"]>()
    for (const timeline of matchData.timelines) {
      const current = timelinesByUuid.get(timeline.uuid)
      if (current) {
        current.push(timeline)
      } else {
        timelinesByUuid.set(timeline.uuid, [timeline])
      }
    }
    for (const timelines of timelinesByUuid.values()) {
      timelines.sort((a, b) => a.time - b.time)
    }

    const completionsByUuid = new Map(
      (matchData.completions ?? []).map((completion) => [
        completion.uuid,
        completion,
      ])
    )

    return {
      timelinesByUuid,
      completionsByUuid,
    }
  }, [matchData])

  const processedPlayers = useMemo(() => {
    if (!matchData || typeof matchData === "string" || !playerDataIndexes) {
      return []
    }

    const playersWithRawData = matchData.players.map((player) => {
      const pTimelines =
        playerDataIndexes.timelinesByUuid.get(player.uuid) ?? []

      const completion = playerDataIndexes.completionsByUuid.get(player.uuid)
      const finishEvent = pTimelines.find(
        (t) => t.type === "projectelo.timeline.complete"
      )
      const dragonDeathEvent = pTimelines.find(
        (t) => t.type === "projectelo.timeline.dragon_death"
      )
      const isFinished = !!(completion || finishEvent)
      const finalTime = isFinished
        ? completion?.time || finishEvent?.time || 0
        : pTimelines[pTimelines.length - 1]?.time || 0
      const finishStartTime =
        isFinished && dragonDeathEvent && dragonDeathEvent.time < finalTime
          ? dragonDeathEvent.time
          : null
      const phaseEndTime = finishStartTime ?? finalTime

      let currentPhase: Phase = "overworld"
      let currentStartTime: number = 0
      let lastMajorPhaseReached: Phase = "overworld"

      const rawBlocks: {
        phase: Phase
        startTime: number
        endTime: number
        duration: number
      }[] = []

      for (const event of pTimelines) {
        // Keep the post-dragon-death stretch as the finished block.
        if (event.time > phaseEndTime) continue

        const next = getMajorPhase(event.type)
        if (next && next !== currentPhase) {
          rawBlocks.push({
            phase: currentPhase,
            startTime: currentStartTime,
            endTime: event.time,
            duration: event.time - currentStartTime,
          })
          currentPhase = next
          currentStartTime = event.time
          lastMajorPhaseReached = next
        }
      }

      // Close the last active phase before the finish animation starts.
      rawBlocks.push({
        phase: currentPhase,
        startTime: currentStartTime,
        endTime: phaseEndTime,
        duration: phaseEndTime - currentStartTime,
      })

      if (finishStartTime !== null && finishStartTime < finalTime) {
        rawBlocks.push({
          phase: "complete",
          startTime: finishStartTime,
          endTime: finalTime,
          duration: finalTime - finishStartTime,
        })
      }

      // Filter out zero duration segments
      const blocks = rawBlocks.filter((b) => b.duration > 0)

      const statusText = isFinished
        ? "finish"
        : phaseNames[lastMajorPhaseReached]

      return { ...player, isFinished, finalTime, statusText, blocks }
    })

    const maxTime = Math.max(...playersWithRawData.map((p) => p.finalTime), 1)

    return playersWithRawData
      .map((player) => ({
        ...player,
        blocks: player.blocks.map((b) => ({
          ...b,
          width: (b.duration / maxTime) * 100,
        })),
      }))
      .sort((a, b) => {
        if (a.isFinished && !b.isFinished) return -1
        if (!a.isFinished && b.isFinished) return 1
        if (a.isFinished && b.isFinished) return a.finalTime - b.finalTime
        return b.finalTime - a.finalTime
      })
  }, [matchData, playerDataIndexes])

  if (!matchId) return <div>No match ID provided.</div>
  if (matchData === undefined) return <div>Loading match data...</div>
  if (matchData === null)
    return <div>No match data found for ID: {matchId}</div>
  if (typeof matchData === "string") return <div>Error: {matchData}</div>

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col gap-5 rounded-xl font-sans text-white">
        {processedPlayers.map((player) => (
          <div key={player.uuid} className="flex flex-row items-center gap-3">
            <img
              src={`https://mc-heads.net/avatar/${player.uuid}/40`}
              alt={player.nickname}
              className="h-10 w-10 rounded-md bg-[#1e1f22] object-cover"
            />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <div className="flex flex-row items-baseline gap-2 text-sm leading-none">
                <a
                  className="text-[15px] font-medium text-gray-100 hover:underline"
                  href={`https://mcsrranked.com/stats/${player.nickname}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {player.nickname}
                </a>
                <span className="font-medium tracking-wide text-gray-400">
                  {formatTime(player.finalTime)}
                </span>
                <span className="font-medium text-gray-500 lowercase">
                  {player.statusText}
                </span>
              </div>

              <div className="flex h-3 w-full items-center">
                {player.blocks.map((block, idx) => (
                  <PhaseBlockTooltip
                    key={`${block.phase}-${idx}`}
                    block={block}
                    isFirst={idx === 0}
                    isLast={idx === player.blocks.length - 1}
                    idx={idx}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}

export default MatchData

type PhaseBlock = {
  phase: Phase
  startTime: number
  endTime: number
  duration: number
  width: number
}

const PhaseBlockTooltip = ({
  block,
  isFirst,
  isLast,
  idx,
}: {
  block: PhaseBlock
  isFirst: boolean
  isLast: boolean
  idx: number
}) => {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <div
            key={`${block.phase}-${idx}`}
            className={[
              "relative h-full cursor-pointer transition-all duration-150",
              "hover:z-10 hover:scale-y-[1.5]",
              !isLast ? "border-r-2 border-[#2b2d31]" : "",
              isFirst ? "rounded-l-full" : "",
              isLast ? "rounded-r-full" : "",
              phaseColors[block.phase],
            ].join(" ")}
            style={{ width: `${block.width}%` }}
            // toggle open on tap
            onTouchStart={(e) => {
              e.preventDefault() // prevent ghost mouse events
              setOpen((prev) => !prev)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              setOpen((prev) => !prev)
            }}
          />
        }
      />
      <TooltipContent side="top">
        <p className="text-xs font-medium">
          {phaseNames[block.phase]} — {formatTime(block.duration)} (at{" "}
          {formatTime(block.startTime)})
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
