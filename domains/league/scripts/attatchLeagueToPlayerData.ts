import fs from "fs"

import data from "./data/validatedRegs"
import oldData from "./data/week4regs"

const rows = []
let count = 0
for (const player of data) {
  count++
  console.log(`Processing player ${count} of ${data.length}: ${player.name}`)
  const oldPlayer = oldData.find(
    (p) => p.name.toLowerCase() === player.name.toLocaleLowerCase()
  )
  if (oldPlayer) {
    rows.push({
      id: count,
      name: player.name,
      elo: player.elo ?? 0,
      league: oldPlayer.league,
    })
  } else {
    console.warn(`No matching player found for ${player.name}`)
  }
}

fs.writeFileSync(
  "./scripts/data/week4regs.ts",
  JSON.stringify(rows, null, 2),
  "utf-8"
)
