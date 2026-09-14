export interface LeagueConfiguration {
  infoChannelId: string;
  maxTimeLimitMs: number;
}

export interface GuildConfiguration {
  logChannelId: string;
  commandRoleId: string;
  leagues: Readonly<Record<number, LeagueConfiguration>>;
}

export const guildConfiguration: Readonly<Record<string, GuildConfiguration>> =
  {
    "1511365088718880788": {
      logChannelId: "1548812861269082283",
      commandRoleId: "1548811856133496903",
      leagues: {
        1: {
          infoChannelId: "1548810942882779287",
          maxTimeLimitMs: 13 * 60 * 1000,
        },
        2: {
          infoChannelId: "1548810999208091678",
          maxTimeLimitMs: 15 * 60 * 1000,
        },
        3: {
          infoChannelId: "1548811031340392499",
          maxTimeLimitMs: 17 * 60 * 1000,
        },
        4: {
          infoChannelId: "1548811059786289162",
          maxTimeLimitMs: 20 * 60 * 1000,
        },
        5: {
          infoChannelId: "1548811111040557196",
          maxTimeLimitMs: 25 * 60 * 1000,
        },
        6: {
          infoChannelId: "1548811162009993298",
          maxTimeLimitMs: 30 * 60 * 1000,
        },
        7: {
          infoChannelId: "1548812988226609275",
          maxTimeLimitMs: 60 * 60 * 1000,
        },
      },
    },
  };
