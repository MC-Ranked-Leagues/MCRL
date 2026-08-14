export const Z_SCORE_FORMULA = "(league_avg - player_avg) / league_std"

export const SWISS_RULES = [
  { label: "Rounds", value: "7" },
  { label: "Time limit", value: "13 min" },
  { label: "Win / loss", value: "1 / 0 pts" },
  { label: "Advance", value: "Top 4" },
] as const

export const TIEBREAKS = ["Opponent score", "Avg completion time"] as const

export const BRACKET_RULES = [
  { label: "Robin #1", value: "Picks R1 opponent" },
  { label: "Semis", value: "Bo5" },
  { label: "Grand final", value: "Bo7" },
] as const

type PrizeEntry = {
  place: string
  amount: number
  each?: boolean
}

export const PRIZES: PrizeEntry[] = [
  { place: "1st", amount: 225 },
  { place: "2nd", amount: 125 },
  { place: "3rd-4th", amount: 20, each: true },
  { place: "Fastest seed", amount: 10 },
]

type QualificationSlot = {
  seed: number
  title: string
  type: "weekly" | "zscore" | "lcq"
  week?: number
  criteria: string
  player: {
    name: string
    status: string
    twitchUsername?: string
    avatarUrl?: string
  } | null
}

export const QUAL_SLOTS: QualificationSlot[] = [
  {
    seed: 1,
    title: "Week 1 Winner",
    type: "weekly",
    week: 1,
    criteria: "Autoqualify: Highest placed unqualified player in Week 1",
    player: {
      name: "Steez",
      status: "Qualified",
      twitchUsername: "steezsr",
    },
  },
  {
    seed: 2,
    title: "Week 2 Winner",
    type: "weekly",
    week: 2,
    criteria: "Autoqualify: Highest placed unqualified player in Week 2",
    player: {
      name: "retropog",
      status: "Qualified",
      twitchUsername: "retropog",
    },
  },
  {
    seed: 3,
    title: "Week 3 Winner",
    type: "weekly",
    week: 3,
    criteria: "Autoqualify: Highest placed unqualified player in Week 3",
    player: {
      name: "okshey",
      status: "Qualified",
      twitchUsername: "okshey",
    },
  },
  {
    seed: 4,
    title: "Week 4 Winner",
    type: "weekly",
    week: 4,
    criteria: "Autoqualify: Highest placed unqualified player in Week 4",
    player: {
      name: "BlazeMind",
      status: "Qualified",
      twitchUsername: "blazemind",
    },
  },
  {
    seed: 5,
    title: "Z-Score Rank #1",
    type: "zscore",
    criteria: "Top unqualified by weekly z-score after Week 4",
    player: {
      name: "Kohout",
      status: "Qualified",
      twitchUsername: "kohout135",
    },
  },
  {
    seed: 6,
    title: "Z-Score Rank #2",
    type: "zscore",
    criteria: "Second unqualified by weekly z-score after Week 4",
    player: {
      name: "staremc",
      status: "Qualified",
      twitchUsername: "staremc",
    },
  },
  {
    seed: 7,
    title: "LCQ Winner",
    type: "lcq",
    week: 5,
    criteria: "Week 5 bracket: 1st Place finisher",
    player: {
      name: "romuxii",
      status: "Qualified",
      twitchUsername: "romuxii",
    },
  },
  {
    seed: 8,
    title: "LCQ Runner-Up",
    type: "lcq",
    week: 5,
    criteria: "Week 5 bracket: 2nd Place finisher",
    player: {
      name: "cornflakesmcsr",
      status: "Qualified",
      twitchUsername: "cornflakesmcsr",
    },
  },
]

type StreamCardData = {
  platform: "twitch" | "youtube"
  channelName: string
  title: string
  url: string
  isLive: boolean
  viewers?: number
  caster?: string
}

export const STREAMS: StreamCardData[] = [
  {
    platform: "twitch",
    channelName: "mcrankedleagues",
    title: "MSRL Championship - Official Main Stream",
    url: "https://www.twitch.tv/mcrankedleagues",
    isLive: true,
    viewers: 1420,
    caster: "Official Broadcast",
  },
  {
    platform: "youtube",
    channelName: "MCRankedLeagues",
    title: "Ranked Leagues YouTube - Live & VODs",
    url: "https://www.youtube.com/@MCRankedLeagues",
    isLive: false,
    caster: "Official VODs",
  },
  {
    platform: "twitch",
    channelName: "couriway",
    title: "Couriway co-streaming the finals!",
    url: "https://www.twitch.tv/couriway",
    isLive: true,
    viewers: 2850,
    caster: "Couriway",
  },
  {
    platform: "twitch",
    channelName: "feinberg",
    title: "Feinberg - Tournament Runner POV",
    url: "https://www.twitch.tv/feinberg",
    isLive: false,
    caster: "Feinberg",
  },
]
