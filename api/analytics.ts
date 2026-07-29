import type { VercelRequest, VercelResponse } from '@vercel/node'

// Server-only env (NO VITE_ prefix → never shipped to the browser).
const HOST = process.env.POSTHOG_API_HOST || 'https://us.posthog.com'
const PROJECT = process.env.POSTHOG_PROJECT_ID
const KEY = process.env.POSTHOG_API_KEY

async function hogql(query: string): Promise<unknown[][]> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as { results?: unknown[][] }
  return json.results ?? []
}

const empty = {
  totals: { visits: 0, visitors: 0, whatsappClicks: 0, enquireClicks: 0 },
  byLocation: [] as { location: string; count: number }[],
  topCakes: [] as { cake: string; count: number }[],
  daily: [] as { date: string; visits: number }[],
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Not wired up yet → tell the dashboard to show the "connect PostHog" notice.
  if (!PROJECT || !KEY) {
    return res.status(200).json({ ok: true, configured: false, ...empty })
  }

  const raw = parseInt(String((req.query.days as string) ?? '30'), 10)
  const days = Math.min(365, Math.max(1, Number.isFinite(raw) ? raw : 30))
  const since = `now() - INTERVAL ${days} DAY`

  try {
    const [totalsR, eventsR, locR, cakeR, dailyR] = await Promise.all([
      hogql(
        `SELECT count() AS visits, count(DISTINCT person_id) AS visitors FROM events WHERE event = '$pageview' AND timestamp >= ${since}`,
      ),
      hogql(
        `SELECT event, count() AS c FROM events WHERE event IN ('whatsapp_click','enquire_click') AND timestamp >= ${since} GROUP BY event`,
      ),
      hogql(
        `SELECT properties.location AS loc, count() AS c FROM events WHERE event IN ('whatsapp_click','enquire_click') AND timestamp >= ${since} GROUP BY loc ORDER BY c DESC LIMIT 12`,
      ),
      hogql(
        `SELECT properties.cake AS cake, count() AS c FROM events WHERE event = 'enquire_click' AND properties.cake IS NOT NULL AND properties.cake != '' AND timestamp >= ${since} GROUP BY cake ORDER BY c DESC LIMIT 10`,
      ),
      hogql(
        `SELECT toDate(timestamp) AS d, count() AS c FROM events WHERE event = '$pageview' AND timestamp >= ${since} GROUP BY d ORDER BY d`,
      ),
    ])

    let whatsappClicks = 0
    let enquireClicks = 0
    for (const row of eventsR) {
      if (row[0] === 'whatsapp_click') whatsappClicks = Number(row[1])
      else if (row[0] === 'enquire_click') enquireClicks = Number(row[1])
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      ok: true,
      configured: true,
      totals: {
        visits: Number(totalsR[0]?.[0] ?? 0),
        visitors: Number(totalsR[0]?.[1] ?? 0),
        whatsappClicks,
        enquireClicks,
      },
      byLocation: locR.map((r) => ({ location: String(r[0] ?? 'unknown'), count: Number(r[1]) })),
      topCakes: cakeR.map((r) => ({ cake: String(r[0] ?? ''), count: Number(r[1]) })),
      daily: dailyR.map((r) => ({ date: String(r[0]).slice(0, 10), visits: Number(r[1]) })),
      posthogUrl: `${HOST}/project/${PROJECT}`,
    })
  } catch (e) {
    return res.status(200).json({
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : 'PostHog query failed',
      ...empty,
    })
  }
}
