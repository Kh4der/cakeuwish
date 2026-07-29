/**
 * yyyy-mm-dd for the LOCAL calendar day (+ optional offset). Deliberately not
 * toISOString(): late-evening Eastern time is already "tomorrow" in UTC, which
 * would make date-min / lead-time checks a day stricter than intended.
 */
export function localIsoDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
