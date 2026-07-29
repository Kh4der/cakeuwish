import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw, TrendingUp, MessageCircle, MousePointerClick, Users, ExternalLink } from 'lucide-react'

interface AnalyticsResponse {
  ok: boolean
  configured: boolean
  totals: { visits: number; visitors: number; whatsappClicks: number; enquireClicks: number }
  byLocation: { location: string; count: number }[]
  topCakes: { cake: string; count: number }[]
  daily: { date: string; visits: number }[]
  posthogUrl?: string
  error?: string
}

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function Card({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function BarChart({ data }: { data: { date: string; visits: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No visits in this range yet.</p>
  const max = Math.max(1, ...data.map((d) => d.visits))
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="group flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.visits}`}>
          <div
            className="w-full rounded-t bg-accent/80 transition-all group-hover:bg-accent"
            style={{ height: `${(d.visits / max) * 100}%`, minHeight: d.visits ? 2 : 0 }}
          />
        </div>
      ))}
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate pr-2 font-medium capitalize">{r.label || 'unknown'}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unconfigured' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')

  const load = useCallback(async (d: number) => {
    setState('loading')
    try {
      const res = await fetch(`/api/analytics?days=${d}`)
      if (res.status === 501) {
        setState('unconfigured')
        return
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const json = (await res.json()) as AnalyticsResponse
      if (!json.configured) {
        setState('unconfigured')
        return
      }
      if (json.ok === false) {
        setErrMsg(json.error || 'PostHog query failed')
        setState('error')
        return
      }
      setData(json)
      setState('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not load analytics')
      setState('error')
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  const totals = data?.totals
  const conversions = (totals?.whatsappClicks ?? 0) + (totals?.enquireClicks ?? 0)
  const convRate = totals && totals.visits > 0 ? ((conversions / totals.visits) * 100).toFixed(1) + '%' : '—'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Visitor activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visits and WhatsApp / Enquire conversions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === r.days ? 'bg-primary text-on-primary' : 'text-foreground/70 hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(days)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground/70 hover:bg-muted"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={state === 'loading' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {state === 'unconfigured' && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Connect PostHog to see analytics</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a free PostHog project and set <code className="rounded bg-muted px-1.5 py-0.5">VITE_POSTHOG_KEY</code>{' '}
            (capture) plus <code className="rounded bg-muted px-1.5 py-0.5">POSTHOG_API_KEY</code> and{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">POSTHOG_PROJECT_ID</code> (dashboard) in your env. See{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">SETUP.md</code>.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-red-700">{errMsg}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If you're running locally with <code className="rounded bg-muted px-1.5 py-0.5">vite dev</code>, the
            analytics API only runs on Vercel (or via <code className="rounded bg-muted px-1.5 py-0.5">vercel dev</code>).
          </p>
        </div>
      )}

      {(state === 'ready' || state === 'loading') && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card icon={<TrendingUp size={16} />} label="Visits" value={totals ? totals.visits.toLocaleString() : '—'} />
            <Card icon={<Users size={16} />} label="Unique visitors" value={totals ? totals.visitors.toLocaleString() : '—'} />
            <Card
              icon={<MessageCircle size={16} />}
              label="WhatsApp clicks"
              value={totals ? totals.whatsappClicks.toLocaleString() : '—'}
            />
            <Card
              icon={<MousePointerClick size={16} />}
              label="Enquire clicks"
              value={totals ? totals.enquireClicks.toLocaleString() : '—'}
              hint={`${convRate} of visits convert`}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold">Daily visits</h3>
            <div className="mt-4">{data ? <BarChart data={data.daily} /> : <div className="h-40" />}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Breakdown
              title="Where people click WhatsApp"
              rows={(data?.byLocation ?? []).map((r) => ({ label: r.location, count: r.count }))}
            />
            <Breakdown
              title="Most-requested cakes"
              rows={(data?.topCakes ?? []).map((r) => ({ label: r.cake, count: r.count }))}
            />
          </div>

          {data?.posthogUrl && (
            <a
              href={data.posthogUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline"
            >
              Open full analytics in PostHog <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </div>
  )
}
