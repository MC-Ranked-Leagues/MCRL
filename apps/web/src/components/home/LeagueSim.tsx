import { Fragment, useEffect, useState } from "react";

// A made-up season that loops forever, with mob heads as the players so nobody
// mistakes it for real results.
const LEAGUES = [1, 2, 3];
const TOP_LEAGUE = 1;
const BOTTOM_LEAGUE = 3;
const MATCHES_PER_WEEK = 4;
const MATCH_POINTS = [10, 7, 5, 3];
const STARTING_MOBS = [
  ["Creeper", "Blaze", "Enderman", "Zombie"],
  ["Skeleton", "Spider", "Villager", "Pig"],
  ["Slime", "PigZombie", "Cow", "Sheep"],
];

// What each league's players scored the week before the simulation starts.
const STARTING_LAST_WEEK = [
  [10, 5, 10, 7],
  [7, 10, 3, 5],
  [5, 3, 7, 10],
  [3, 7, 5, 3],
];

const HEADER = 30;
const ROW = 32;
const GAP = 12;
const HOVER_CARD = 100;
const NAVBAR = 64;
const CARD = HEADER + ROW * MATCH_POINTS.length;

type Player = {
  mob: string;
  league: number;
  points: number;
  matches: number[];
  lastWeek: number[];
  gain: number;
  move: "up" | "down" | null;
};

type Sim = { week: number; matchesPlayed: number; players: Player[] };

function standings(players: Player[], league: number) {
  return players
    .filter((player) => player.league === league)
    .sort((a, b) => b.points - a.points || a.mob.localeCompare(b.mob));
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function advance(sim: Sim): Sim {
  const marked = sim.players.some(
    (player) => player.move && player.gain === -1
  );

  // The week's moves were announced last step, so now they happen.
  if (marked) {
    return {
      week: sim.week + 1,
      matchesPlayed: 0,
      players: sim.players.map((player) => ({
        ...player,
        league:
          player.league +
          (player.move === "up" ? -1 : player.move === "down" ? 1 : 0),
        points: 0,
        matches: [],
        lastWeek: player.matches,
        gain: 0,
      })),
    };
  }

  // Top of each league moves up and bottom moves down, except off the ends.
  if (sim.matchesPlayed === MATCHES_PER_WEEK) {
    const moves = new Map<string, Player["move"]>();
    for (const league of LEAGUES) {
      const table = standings(sim.players, league);
      const top = table[0];
      const bottom = table.at(-1);
      if (top && league > TOP_LEAGUE) moves.set(top.mob, "up");
      if (bottom && league < BOTTOM_LEAGUE) moves.set(bottom.mob, "down");
    }
    return {
      ...sim,
      players: sim.players.map((player) => ({
        ...player,
        move: moves.get(player.mob) ?? null,
        gain: moves.has(player.mob) ? -1 : 0,
      })),
    };
  }

  const gains = new Map<string, number>();
  for (const league of LEAGUES) {
    const finishOrder = shuffled(
      sim.players.filter((player) => player.league === league)
    );
    finishOrder.forEach((player, i) =>
      gains.set(player.mob, MATCH_POINTS[i] ?? 0)
    );
  }
  return {
    ...sim,
    matchesPlayed: sim.matchesPlayed + 1,
    players: sim.players.map((player) => {
      const gain = gains.get(player.mob) ?? 0;
      return {
        ...player,
        points: player.points + gain,
        matches: [...player.matches, gain],
        gain,
        move: null,
      };
    }),
  };
}

export function LeagueSim() {
  const [sim, setSim] = useState<Sim>({
    week: 12,
    matchesPlayed: 0,
    players: STARTING_MOBS.flatMap((mobs, i) =>
      mobs.map((mob, j) => ({
        mob,
        league: i + 1,
        points: 0,
        matches: [],
        lastWeek: STARTING_LAST_WEEK[j] ?? [],
        gain: 0,
        move: null,
      }))
    ),
  });

  // Hovering a row shows that player's match scores, and holds the season still
  // so they can be read.
  const [followed, setFollowed] = useState<string | null>(null);
  const [cardAbove, setCardAbove] = useState(false);
  const isPaused = followed !== null;

  // The card opens below the row unless that would run off the screen.
  function followRow(mob: string, row: HTMLElement) {
    const { top, bottom } = row.getBoundingClientRect();
    setCardAbove(
      bottom + HOVER_CARD > window.innerHeight && top - HOVER_CARD >= NAVBAR
    );
    setFollowed(mob);
  }

  useEffect(() => {
    if (isPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setSim(advance), 1700);
    return () => clearInterval(timer);
  }, [isPaused]);

  const moving = sim.players.some((player) => player.gain === -1);
  const status = moving
    ? `Week ${sim.week} is done. Top moves up, bottom moves down.`
    : sim.matchesPlayed === 0
      ? `Week ${sim.week} is about to start`
      : `Week ${sim.week}, match ${sim.matchesPlayed} of ${MATCHES_PER_WEEK}`;

  return (
    <div aria-hidden>
      <p className="mb-3 font-minecraft text-sm text-home-gold">{status}</p>
      {/* Rows sit on top of the cards rather than inside them, so a row can
          slide straight from one league to the next. */}
      <div
        className="relative"
        style={{ height: LEAGUES.length * (CARD + GAP) - GAP }}
      >
        {LEAGUES.map((league, i) => (
          <div
            key={league}
            className="absolute inset-x-0 border-3 border-obsidian-line bg-obsidian-deep/90 px-3 pt-1 font-minecraft text-sm text-home-muted"
            style={{ top: i * (CARD + GAP), height: CARD + 4 }}
          >
            League {league}
          </div>
        ))}

        {sim.players.map((player) => {
          const leagueIndex = LEAGUES.indexOf(player.league);
          const rank = standings(sim.players, player.league).indexOf(player);
          const y = leagueIndex * (CARD + GAP) + HEADER + rank * ROW;
          const isFollowed = followed === player.mob;

          return (
            <div
              key={player.mob}
              onMouseEnter={(event) =>
                followRow(player.mob, event.currentTarget)
              }
              onMouseLeave={() => setFollowed(null)}
              className={`absolute inset-x-1 flex items-center gap-2.5 px-2 duration-700 ease-in-out ${
                // The hovered row skips the fade, or its card would fade in with it.
                isFollowed
                  ? "transition-transform"
                  : "transition-[transform,opacity]"
              } ${
                player.move === "up"
                  ? "bg-promoted-tint text-promoted"
                  : player.move === "down"
                    ? "bg-demoted-tint text-demoted"
                    : isFollowed
                      ? "bg-obsidian-raised"
                      : ""
              } ${isPaused && !isFollowed ? "opacity-40" : ""}`}
              style={{
                height: ROW,
                transform: `translateY(${y}px)`,
                zIndex: isFollowed ? 20 : player.move ? 10 : 1,
              }}
            >
              <span className="w-4 font-minecraft text-xs text-home-muted">
                {rank + 1}
              </span>
              <img
                src={`https://mc-heads.net/avatar/MHF_${player.mob}/24`}
                alt=""
                width={24}
                height={24}
                className="size-6 [image-rendering:pixelated]"
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {player.mob}
                {player.move === "up" && " ▲"}
                {player.move === "down" && " ▼"}
              </span>
              {player.gain > 0 && (
                <span
                  key={sim.matchesPlayed}
                  className="animate-gain font-minecraft text-sm text-home-gold"
                >
                  +{player.gain}
                </span>
              )}
              <span className="w-8 text-right font-minecraft text-sm tabular-nums">
                {player.points}
              </span>
              {isFollowed && (
                <div
                  className={`mc-tooltip pointer-events-none absolute right-0 grid w-72 grid-cols-[1fr_repeat(4,1.5rem)_2.5rem] items-center gap-y-1 p-3 text-right font-minecraft text-xs text-home-text ${
                    cardAbove ? "bottom-full mb-2" : "top-full mt-2"
                  }`}
                >
                  <span className="text-left text-home-muted">Match</span>
                  {MATCH_POINTS.map((_, match) => (
                    <span key={match} className="text-home-muted">
                      {match + 1}
                    </span>
                  ))}
                  <span className="text-home-muted">Total</span>
                  {[
                    { label: "This week", matches: player.matches },
                    { label: "Last week", matches: player.lastWeek },
                  ].map(({ label, matches }) => (
                    <Fragment key={label}>
                      <span className="text-left">{label}</span>
                      {MATCH_POINTS.map((_, match) => (
                        <span key={match}>{matches[match] ?? "-"}</span>
                      ))}
                      <span className="text-home-gold">
                        {matches.reduce((total, points) => total + points, 0)}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
