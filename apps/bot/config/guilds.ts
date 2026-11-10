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
  // Set this to give registered players a role until /unreg or /em.
  currentWeekRoleId?: string;
  leagues: Readonly<Record<number, LeagueConfiguration>>;
}

export const guildConfiguration: Readonly<Record<string, GuildConfiguration>> =
  {
    "1559925008116097196": {
      dev: false,
      developerId: "843901903213428816",
      signup: {
        channelId: "1566236429443661965",
        reviewerId: "1108291604248277062",
      },
      logChannelId: "1559931280723017899",
      commandRoleId: "1559925312794665010",
      currentWeekRoleId: "1569780942124359690",
      leagues: {
        1: {
          infoChannelId: "1559929620403331122",
          chatChannelId: "1559929641136038018",
          leagueRoleId: "1559925745684451328",
          maxTimeLimitMs: 13 * 60 * 1000,
        },
        2: {
          infoChannelId: "1559929751903408198",
          chatChannelId: "1559929765983690822",
          leagueRoleId: "1559925786239045763",
          maxTimeLimitMs: 15 * 60 * 1000,
        },
        3: {
          infoChannelId: "1559929836422701196",
          chatChannelId: "1559929852734472293",
          leagueRoleId: "1559925818413555863",
          maxTimeLimitMs: 17 * 60 * 1000,
        },
        4: {
          infoChannelId: "1559929939698909316",
          chatChannelId: "1559929954953728010",
          leagueRoleId: "1559925842606297198",
          maxTimeLimitMs: 20 * 60 * 1000,
        },
        5: {
          infoChannelId: "1559930057810645053",
          chatChannelId: "1559930073518313493",
          leagueRoleId: "1559925867998609518",
          maxTimeLimitMs: 25 * 60 * 1000,
        },
        6: {
          infoChannelId: "1559930160805847082",
          chatChannelId: "1559925895177830440",
          leagueRoleId: "1559925895177830440",
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
