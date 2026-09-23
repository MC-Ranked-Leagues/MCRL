export interface LeagueConfiguration {
  infoChannelId: string;
  chatChannelId: string;
  leagueRoleId: string;
  maxTimeLimitMs: number;
}

export interface GuildConfiguration {
  dev: boolean;
  developerId?: string;
  // Configure both IDs to enable signup and account migration review.
  signup?: { channelId: string; reviewerId: string };
  logChannelId: string;
  commandRoleId: string;
  // Set this to give registered players a role until /advance_week.
  currentWeekRoleId?: string;
  leagues: Readonly<Record<number, LeagueConfiguration>>;
}

export const guildConfiguration: Readonly<Record<string, GuildConfiguration>> =
  {
    "1511365088718880788": {
      dev: true,
      developerId: "843901903213428816",
      signup: {
        channelId: "1548812812820676749",
        reviewerId: "843901903213428816",
      },
      logChannelId: "1548812861269082283",
      commandRoleId: "1548811856133496903",
      currentWeekRoleId: "1548813276429811772",
      leagues: {
        1: {
          infoChannelId: "1548810942882779287",
          chatChannelId: "1548810782760902856",
          leagueRoleId: "1548810356280008834",
          maxTimeLimitMs: 13 * 60 * 1000,
        },
        2: {
          infoChannelId: "1548810999208091678",
          chatChannelId: "1548810889866649682",
          leagueRoleId: "1548811540470431815",
          maxTimeLimitMs: 15 * 60 * 1000,
        },
        3: {
          infoChannelId: "1548811031340392499",
          chatChannelId: "1548810913564336169",
          leagueRoleId: "1548811660310089858",
          maxTimeLimitMs: 17 * 60 * 1000,
        },
        4: {
          infoChannelId: "1548811059786289162",
          chatChannelId: "1548811084956172418",
          leagueRoleId: "1548811717994225704",
          maxTimeLimitMs: 20 * 60 * 1000,
        },
        5: {
          infoChannelId: "1548811111040557196",
          chatChannelId: "1548811134902079628",
          leagueRoleId: "1548811763766530088",
          maxTimeLimitMs: 25 * 60 * 1000,
        },
        6: {
          infoChannelId: "1548811162009993298",
          chatChannelId: "1548811181999792138",
          leagueRoleId: "1548811806334783588",
          maxTimeLimitMs: 30 * 60 * 1000,
        },
        7: {
          infoChannelId: "1548812988226609275",
          chatChannelId: "1548813006278893609",
          leagueRoleId: "1548813124537163836",
          maxTimeLimitMs: 60 * 60 * 1000,
        },
      },
    },
  };
