import { useEffect, useMemo, useState } from 'react'
import { Coins, Loader2, RefreshCw } from 'lucide-react'
import {
  listUsageSince,
  summarizeUsage,
  USAGE_LABEL,
  type UsageRow,
  type UsageService,
} from './lib/vendorDb'

// Itemized API spend. Every metered endpoint writes a usage_log row; this is the
// per-service, per-provider breakdown plus the raw line items behind it, so the
// owner can see exactly what each integration costs rather than one lump total.

const RANGES = [
  { label: 'This month', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const

const money = (n: number) => (n === 0 ? '$0.00' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)

/** What the owner is actually billed for, and where. */
const BILLED_BY: Record<UsageService, string> = {
  chat: 'Free tier (Groq) — or Anthropic if switched',
  image: 'Free (Pollinations) — or OpenAI if switched',
  social: 'X charges per post; Meta posting is free',
  voice: 'Vapi credits',
  email: 'Resend free tier',
  receipt: 'Anthropic',
}

export default function CostsManager() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [rangeIdx, setRangeIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sinceIso = useMemo(() => {
    const r = RANGES[rangeIdx]
    if (r.days === 0) {
      const d = new Date()
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString()
    }
    return new Date(Date.now() - r.days * 86400000).toISOString()
  }, [rangeIdx])

  const load = () => {
    setLoading(true)
    setError('')
    listUsageSince(sinceIso)
      .then(setRows)
      .catch((e) =>
        setError(
          e instanceof Error && /column|schema|does not exist/i.test(e.message)
            ? 'Run migration 0013_api_costs.sql in the Supabase SQL editor to enable itemized costs.'
            : e instanceof Error
              ? e.message
              : 'Failed to load',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [sinceIso])

  const totals = useMemo(() => summarizeUsage(rows), [rows])
  const grand = useMemo(() => totals.reduce((s, t) => s + t.cost, 0), [totals])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Coins size={22} className="text-accent" /> API costs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What each integration costs, itemized. Estimates from usage — each provider's own invoice is the
            final word.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRangeIdx(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              i === rangeIdx ? 'bg-primary text-on-primary' : 'border border-border hover:bg-muted'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Total for this period</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{money(grand)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} metered {rows.length === 1 ? 'call' : 'calls'}
            </p>
          </div>

          <h2 className="mt-6 font-display text-lg font-bold">By service</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Service</th>
                  <th className="px-4 py-2.5 font-semibold">Provider</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Calls</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                  <th className="px-4 py-2.5 font-semibold">Billed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {totals.map((t) => (
                  <tr key={`${t.service}-${t.provider}`}>
                    <td className="px-4 py-2.5 font-medium">{t.label}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.provider || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{t.calls}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(t.cost)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{BILLED_BY[t.service]}</td>
                  </tr>
                ))}
                {totals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Nothing metered in this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-6 font-display text-lg font-bold">Line items</h2>
          <p className="mt-1 text-xs text-muted-foreground">Most recent first — the individual calls behind the totals.</p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Service</th>
                  <th className="px-4 py-2.5 font-semibold">Detail</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tokens</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.happenedAt}-${i}`}>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {r.happenedAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2">{USAGE_LABEL[r.service]}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.detail || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {r.inputTokens + r.outputTokens > 0 ? (r.inputTokens + r.outputTokens).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(r.estCost)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No metered calls yet in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="mt-2 text-xs text-muted-foreground">Showing the 200 most recent of {rows.length} line items.</p>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Not shown here: fixed monthly bills (Vapi phone number rental, Supabase/Vercel plans). Add those in{' '}
            <strong>Vendors &amp; bills</strong> so the business overview stays accurate.
          </p>
        </>
      )}
    </div>
  )
}
