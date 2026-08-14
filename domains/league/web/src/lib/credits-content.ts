export type CreditRole = {
  name: string
  leaders: readonly string[]
  members: readonly string[]
}

export const TEAM = {
  title: "The team behind Ranked Leagues",
  roles: [
    {
      name: "Seed checking team",
      leaders: ["mirailuv", "notavailable2074"],
      members: [
        "potatoetac0",
        "dexta101.",
        "itzalexmewo",
        "lawnmobius",
        "dinotnt",
      ],
    },
    {
      name: "Content team",
      leaders: ["croissantgamer"],
      members: ["squar_1", "timorat", "its_lenom", "kilbykeel", ".6dwa"],
    },
    {
      name: "Streaming team",
      leaders: ["lazycaps."],
      members: [
        "dinotnt",
        "natebridge314",
        "arakitsu",
        "unor1ginalname",
        "swaeshy",
        "qazickz",
        "fourthdylan",
      ],
    },
    {
      name: "Developers",
      leaders: ["notavailable2074", "iamovertheageofthirteen"],
      members: ["lazycaps.", "dinotnt"],
    },
    {
      name: "Game hosts",
      leaders: ["buzzaboo"],
      members: [
        "njplayswhat",
        "skeptyhere",
        "f1nndegamer",
        "natebridge314",
        "mirailuv",
        "no_wategate",
        "croissantgamer",
      ],
    },
    {
      name: "Organizers",
      leaders: ["croissantgamer"],
      members: [
        "puggoboi",
        "mirailuv",
        "notavailable2074",
        "lazycaps",
        "buzzaboo",
        "iamovertheageofthirteen",
      ],
    },
  ] satisfies readonly CreditRole[],
} as const
