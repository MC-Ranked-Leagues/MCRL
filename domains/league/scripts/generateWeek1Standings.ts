import week3Registrations from "./data/week4regs"

const CONVEX_SITE_URL = process.env.PRODUCTION_CONVEX_SITE
const MY_API_KEY = process.env.WRITER_API_KEY || "test_key_placeholder"

const ENDPOINT = `${CONVEX_SITE_URL}/api/write/weeks/transition`

console.log(`Preparing standings data for week 3...`)

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": MY_API_KEY,
  },
  body: JSON.stringify({
    weekNumber: 3,
    newWeek: 4,
    players: week3Registrations.map((p) => ({
      name: p.name,
      elo: p.elo,
      leagueTier: p.league,
    })),
  }),
})
console.log(await res.json())
