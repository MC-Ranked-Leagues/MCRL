export type CreditRole = {
  name: string;
  leaders: readonly string[];
  members: readonly string[];
};

export const TEAM = {
  roles: [
    {
      name: "Admins",
      leaders: ["Croissant"],
      members: [
        "Mirai",
        "Buzzaboo",
        "mvisi",
        "lazycaps",
        "releasethelist",
      ],
    },
    {
      name: "Game hosts",
      leaders: ["Buzzaboo"],
      members: [
        "Awen",
        "Skepty",
        "Mirai",
        "Snuppe",
        "addy",
        "lazycaps",
        "ryvelina",
        "no_watergate",
        "rocket",
        "nate",
        "Adverse101",
        "releasethelist",
        "Jessedie1",
      ],
    },
    {
      name: "Mainstreams",
      leaders: ["Mirai"],
      members: [
        "lazycaps",
        "Adverse101",
        "releasethelist",
      ],
    },
    {
      name: "Seeds",
      leaders: ["aryan", "Mirai"],
      members: [
        "Skepty",
        "lazycaps",
      ],
    },
    {
      name: "Developers",
      leaders: [],
      members: [
        "mvisi", 
        "aryan", 
        "Mirai", 
        "releasethelist",
      ],
    },
  ] satisfies readonly CreditRole[],
} as const;
