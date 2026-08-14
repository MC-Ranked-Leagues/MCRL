import data from "./data/match135week3data.ts"

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL
const MY_API_KEY = process.env.WRITER_API_KEY || "test_key_placeholder"

const ENDPOINT = `${CONVEX_SITE_URL}/api/write/match`

data.forEach(async (match) => {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MY_API_KEY,
      },
      body: JSON.stringify(match),
    })

    const resultText = await res.text()
    if (!res.ok) {
      console.error(
        `Error ingesting match ${match.matchNumber}: ${res.status} ${res.statusText}`
      )
      console.log(resultText)
    } else {
      console.log(`Successfully ingested match ${match.matchNumber}`)
      try {
        console.log(JSON.parse(resultText))
      } catch {
        console.log(resultText)
      }
    }
  } catch (error) {
    console.error(`Fetch error for match ${match.matchNumber}:`, error)
  }
})
