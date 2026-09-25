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
    "1282908945274638347": {
      dev: false,
      developerId: "843901903213428816",
      signup: {
        channelId: "1477876959462690869",
        reviewerId: "1108291604248277062",
      },
      logChannelId: "1483969111720595620",
      commandRoleId: "1478250767281553408",
      currentWeekRoleId: "1323786883188260864",
      leagues: {
        1: {
          infoChannelId: "1483548240807727200",
          chatChannelId: "1477931318565146784",
          leagueRoleId: "1477663316531744828",
          maxTimeLimitMs: 13 * 60 * 1000,
        },
        2: {
          infoChannelId: "1483548929684410421",
          chatChannelId: "1477931603866161256",
          leagueRoleId: "1477663343031488582",
          maxTimeLimitMs: 15 * 60 * 1000,
        },
        3: {
          infoChannelId: "1483549774291403015",
          chatChannelId: "1477931653102833747",
          leagueRoleId: "1477663367735808113",
          maxTimeLimitMs: 17 * 60 * 1000,
        },
        4: {
          infoChannelId: "1483550605925421067",
          chatChannelId: "1477931691304816703",
          leagueRoleId: "1477663392335663277",
          maxTimeLimitMs: 20 * 60 * 1000,
        },
        5: {
          infoChannelId: "1483551190422782214",
          chatChannelId: "1477931729363796081",
          leagueRoleId: "1477663419871002625",
          maxTimeLimitMs: 25 * 60 * 1000,
        },
        6: {
          infoChannelId: "1483551761699442790",
          chatChannelId: "1477931763203440731",
          leagueRoleId: "1477929059185856672",
          maxTimeLimitMs: 30 * 60 * 1000,
        },
        7: {
          infoChannelId: "1491881029164863670",
          chatChannelId: "1491881089650786364",
          leagueRoleId: "1492987738490933408",
          maxTimeLimitMs: 60 * 60 * 1000,
        },
      },
    },
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
