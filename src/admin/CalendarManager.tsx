import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Palmtree, Plus, Settings2, X } from 'lucide-react'
import {
  blockDate,
  blockRange,
  getSettings,
  listBlockedDates,
  saveSettings,
  toIsoDay,
  unblockDate,
  type ShopSettings,
} from './lib/availabilityDb'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const input =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent'

/** null-padded so the 1st lands on its weekday column. */
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null)
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) cells.push(toIsoDay(new Date(year, month, d)))
  return cells
}

export default function CalendarManager() {
  const [blocked, setBlocked] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [reason, setReason] = useState('')
  const [pendingDays, setPendingDays] = useState<Set<string>>(new Set())

  const [vacStart, setVacStart] = useState('')
  const [vacEnd, setVacEnd] = useState('')
  const [vacReason, setVacReason] = useState('Away on vacation')
  const [blockingRange, setBlockingRange] = useState(false)

  const [settingsSave, setSettingsSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const settingsHydrated = useRef(false)
  const saveTimer = useRef<number | undefined>(undefined)

  const today = toIsoDay(new Date())

  useEffect(() => {
    Promise.all([listBlockedDates(), getSettings()])
      .then(([dates, s]) => {
        setBlocked(Object.fromEntries(dates.map((d) => [d.day, d.reason])))
        setSettings(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Debounced auto-save: settings persist ~600ms after the last edit.
  useEffect(() => {
    if (!settings) return
    if (!settingsHydrated.current) {
      settingsHydrated.current = true
      return
    }
    window.clearTimeout(saveTimer.current)
    setSettingsSave('saving')
    saveTimer.current = window.setTimeout(async () => {
      setError(null)
      try {
        await saveSettings(settings)
        setSettingsSave('saved')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        setSettingsSave('error')
      }
    }, 600)
    return () => window.clearTimeout(saveTimer.current)
  }, [settings])

  const patchSettings = (p: Partial<ShopSettings>) => setSettings((s) => (s ? { ...s, ...p } : s))

  const toggleDay = async (iso: string) => {
    if (pendingDays.has(iso)) return
    const wasBlocked = iso in blocked
    setPendingDays((p) => new Set(p).add(iso))
    setError(null)
    try {
      if (wasBlocked) {
        await unblockDate(iso)
        setBlocked((b) => {
          const next = { ...b }
          delete next[iso]
          return next
        })
      } else {
        const r = reason.trim()
        await blockDate(iso, r)
        setBlocked((b) => ({ ...b, [iso]: r }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setPendingDays((p) => {
        const next = new Set(p)
        next.delete(iso)
        return next
      })
    }
  }

  const onBlockRange = async () => {
    if (!vacStart || !vacEnd) {
      setError('Pick both a start and an end date for the vacation block.')
      return
    }
    if (vacEnd < vacStart) {
      setError('The vacation end date must be on or after the start date.')
      return
    }
    setBlockingRange(true)
    setError(null)
    try {
      await blockRange(vacStart, vacEnd, vacReason.trim())
      const dates = await listBlockedDates()
      setBlocked(Object.fromEntries(dates.map((d) => [d.day, d.reason])))
      setVacStart('')
      setVacEnd('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Block failed')
    } finally {
      setBlockingRange(false)
    }
  }

  const shiftMonth = (dir: -1 | 1) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + dir, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading calendar…
      </div>
    )
  }

  const cells = monthCells(cursor.year, cursor.month)
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold">Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Block days you can't take orders — the quote form warns customers who pick them.
        </p>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* ── month calendar ── */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold capitalize">{monthLabel}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-muted"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium">
            Reason for new blocks <span className="font-normal text-muted-foreground">(optional — applied when you click a day)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Fully booked, Family event…"
              className={input}
            />
          </label>

          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`pad-${i}`} />
              const isPast = iso < today
              const isBlocked = iso in blocked
              const isPending = pendingDays.has(iso)
              const dayNum = Number(iso.slice(8))
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isPast || isPending}
                  onClick={() => toggleDay(iso)}
                  title={isBlocked ? blocked[iso] || 'Blocked' : undefined}
                  aria-label={`${iso}${isBlocked ? ` — blocked${blocked[iso] ? `: ${blocked[iso]}` : ''}` : ''}`}
                  aria-pressed={isBlocked}
                  className={`relative flex h-11 items-center justify-center rounded-lg border text-sm transition-colors sm:h-14 ${
                    isPast
                      ? 'cursor-default border-transparent text-muted-foreground/40'
                      : isBlocked
                        ? 'border-red-200 bg-red-100 font-semibold text-red-900 hover:bg-red-200'
                        : 'border-border bg-background hover:bg-muted'
                  } ${iso === today ? 'ring-2 ring-accent' : ''} ${isPending ? 'opacity-50' : ''}`}
                >
                  {dayNum}
                  {isPending && <Loader2 size={12} className="absolute right-1 top-1 animate-spin" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-red-200 bg-red-100" /> Blocked (click to reopen)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-border bg-background ring-2 ring-accent" /> Today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-border bg-background" /> Open (click to block)
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {/* ── vacation mode ── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Palmtree size={18} className="text-accent" /> Vacation mode
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Block a whole stretch of days at once.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                From
                <input type="date" min={today} value={vacStart} onChange={(e) => setVacStart(e.target.value)} className={input} />
              </label>
              <label className="block text-sm font-medium">
                To
                <input type="date" min={vacStart || today} value={vacEnd} onChange={(e) => setVacEnd(e.target.value)} className={input} />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium">
              Reason
              <input value={vacReason} onChange={(e) => setVacReason(e.target.value)} className={input} />
            </label>
            <button
              type="button"
              onClick={onBlockRange}
              disabled={blockingRange}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
            >
              {blockingRange && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Block range
            </button>
          </div>

          {/* ── booking settings ── */}
          {settings && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Settings2 size={18} className="text-accent" /> Booking settings
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${settingsSave === 'error' ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}
                  aria-live="polite"
                >
                  {settingsSave === 'saving' && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                  {settingsSave === 'saving' ? 'Saving…' : settingsSave === 'saved' ? 'Saved' : settingsSave === 'error' ? 'Save failed — check connection' : ''}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Max orders / day
                  <input
                    type="number"
                    min={1}
                    value={settings.maxOrdersPerDay}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber
                      if (Number.isFinite(v)) patchSettings({ maxOrdersPerDay: Math.max(1, Math.round(v)) })
                    }}
                    className={input}
                  />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Shown as capacity on the Orders tab — customers aren't auto-blocked yet, so block full days here.
                  </span>
                </label>
                <label className="block text-sm font-medium">
                  Min lead days
                  <input
                    type="number"
                    min={0}
                    value={settings.minLeadDays}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber
                      if (Number.isFinite(v)) patchSettings({ minLeadDays: Math.max(0, Math.round(v)) })
                    }}
                    className={input}
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="text-sm font-medium">Pickup time slots</span>
                <div className="mt-2 space-y-2">
                  {settings.pickupSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={slot}
                        aria-label={`Pickup slot ${i + 1}`}
                        onChange={(e) => {
                          const next = [...settings.pickupSlots]
                          next[i] = e.target.value
                          patchSettings({ pickupSlots: next })
                        }}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={() => patchSettings({ pickupSlots: settings.pickupSlots.filter((_, j) => j !== i) })}
                        aria-label={`Remove pickup slot ${i + 1}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => patchSettings({ pickupSlots: [...settings.pickupSlots, ''] })}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Plus size={14} /> Add slot
                </button>
              </div>

              <label className="mt-4 block text-sm font-medium">
                Vacation note <span className="font-normal text-muted-foreground">(shown on the quote form when set)</span>
                <textarea
                  value={settings.vacationNote}
                  onChange={(e) => patchSettings({ vacationNote: e.target.value })}
                  rows={3}
                  placeholder="e.g. We're away July 4–12 — orders reopen for pickups from July 20!"
                  className={`${input} resize-y`}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
