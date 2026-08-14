import type { Doc } from "../_generated/dataModel"

type WeekStandingRegistration = Pick<
  Doc<"registrations">,
  "averageTimeMs" | "playerIgn" | "totalPoints"
>

export function compareWeekStandingRegistrations(
  a: WeekStandingRegistration,
  b: WeekStandingRegistration
): number {
  if (a.averageTimeMs === null && b.averageTimeMs !== null) return 1
  if (a.averageTimeMs !== null && b.averageTimeMs === null) return -1

  if (a.averageTimeMs !== null && b.averageTimeMs !== null) {
    const pointsDiff = b.totalPoints - a.totalPoints
    if (pointsDiff !== 0) return pointsDiff

    const averageTimeDiff = a.averageTimeMs - b.averageTimeMs
    if (averageTimeDiff !== 0) return averageTimeDiff
  }

  return a.playerIgn.localeCompare(b.playerIgn)
}
