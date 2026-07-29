import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react'
import {
  deleteOrder,
  getMaxOrdersPerDay,
  listOrders,
  saveOrder,
  type Order,
  type OrderStatus,
} from './lib/ordersDb'

const STATUSES: { value: OrderStatus; label: string; cls: string }[] = [
  { value: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-900' },
  { value: 'confirmed', label: 'Confirmed', cls: 'bg-green-100 text-green-900' },
  { value: 'ready', label: 'Ready', cls: 'bg-blue-100 text-blue-900' },
  { value: 'completed', label: 'Completed', cls: 'bg-stone-200 text-stone-700' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-red-100 text-red-900' },
]

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'ready']

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Local-time yyyy-mm-dd, matching how <input type="date"> and date columns store days. */
function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function blankOrder(): Order {
  return {
    id: crypto.randomUUID(),
    inquiryId: null,
    name: '',
    phone: '',
    email: '',
    eventDate: '',
    pickupDate: '',
    pickupSlot: '',
    description: '',
    price: null,
    depositPaid: false,
    status: 'pending',
    adminNotes: '',
    createdAt: new Date().toISOString(), // local sort key; DB assigns its own on insert
  }
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([])
  const [maxPerDay, setMaxPerDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listOrders(), getMaxOrdersPerDay()])
      .then(([os, cap]) => {
        setOrders(os)
        setMaxPerDay(cap)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    for (const s of STATUSES) c[s.value] = orders.filter((o) => o.status === s.value).length
    return c
  }, [orders])

  // Next 7 pickup days; cancelled orders don't count toward the day's load.
  const week = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      const iso = isoDay(d)
      return {
        iso,
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
        count: orders.filter((o) => o.status !== 'cancelled' && o.pickupDate === iso).length,
      }
    })
  }, [orders])

  // Active orders: soonest pickup first (unscheduled ones surface at the top).
  // Completed/cancelled: newest first.
  const { active, done } = useMemo(() => {
    const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
    const act = visible.filter((o) => ACTIVE_STATUSES.includes(o.status))
    const dn = visible.filter((o) => !ACTIVE_STATUSES.includes(o.status))
    act.sort((a, b) => {
      if (!a.pickupDate && !b.pickupDate) return b.createdAt.localeCompare(a.createdAt)
      if (!a.pickupDate) return -1
      if (!b.pickupDate) return 1
      return a.pickupDate.localeCompare(b.pickupDate)
    })
    dn.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { active: act, done: dn }
  }, [orders, filter])

  const patch = (id: string, p: Partial<Order>) =>
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)))

  const persist = async (o: Order) => {
    setSavingId(o.id)
    setError(null)
    try {
      await saveOrder(o)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (o: Order) => {
    if (!confirm(`Delete the order for "${o.name || 'unnamed customer'}"? This can't be undone.`)) return
    setOrders((os) => os.filter((x) => x.id !== o.id))
    try {
      await deleteOrder(o.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const addOrder = () => setOrders((os) => [blankOrder(), ...os])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading orders…
      </div>
    )
  }

  const inputCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent'

  const renderCard = (o: Order) => {
    const status = STATUSES.find((s) => s.value === o.status) ?? STATUSES[0]
    const waNumber = o.phone.replace(/[^\d+]/g, '')
    return (
      <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${status.cls}`}>
              {status.label}
            </span>
            {o.inquiryId && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                From inquiry
              </span>
            )}
            <h2 className="font-display text-lg font-bold">{o.name || 'New order'}</h2>
            {o.createdAt && <span className="text-sm text-muted-foreground">· {fmtDate(o.createdAt)}</span>}
          </div>
          <label className="text-sm text-muted-foreground">
            Status{' '}
            <select
              value={o.status}
              onChange={(e) => patch(o.id, { status: e.target.value as OrderStatus })}
              className="ml-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Name
            <input value={o.name} onChange={(e) => patch(o.id, { name: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-center justify-between">
              Phone
              {o.phone && (
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900 hover:bg-green-200"
                >
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
            </span>
            <input value={o.phone} onChange={(e) => patch(o.id, { phone: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              value={o.email}
              onChange={(e) => patch(o.id, { email: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Event date
            <input
              type="date"
              value={o.eventDate}
              onChange={(e) => patch(o.id, { eventDate: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium">
            Pickup date
            <input
              type="date"
              value={o.pickupDate}
              onChange={(e) => patch(o.id, { pickupDate: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium">
            Pickup slot
            <input
              value={o.pickupSlot}
              onChange={(e) => patch(o.id, { pickupSlot: e.target.value })}
              placeholder="e.g. 4–6 pm"
              className={inputCls}
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium">
          Order details
          <textarea
            value={o.description}
            onChange={(e) => patch(o.id, { description: e.target.value })}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="block text-sm font-medium">
            Price ($)
            <input
              type="number"
              min="0"
              step="0.01"
              value={o.price ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value)
                patch(o.id, { price: e.target.value === '' || Number.isNaN(n) ? null : n })
              }}
              className={`${inputCls} w-32`}
            />
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm font-medium">
            <input
              type="checkbox"
              checked={o.depositPaid}
              onChange={(e) => patch(o.id, { depositPaid: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Deposit paid
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium">
          Notes (only you see these)
          <textarea
            value={o.adminNotes}
            onChange={(e) => patch(o.id, { adminNotes: e.target.value })}
            rows={2}
            className={`${inputCls} resize-y`}
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => remove(o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            type="button"
            onClick={() => persist(o)}
            disabled={savingId === o.id}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {savingId === o.id && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed cakes — track pickup, payment, and progress.
          </p>
        </div>
        <button
          type="button"
          onClick={addOrder}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
        >
          <Plus size={16} /> New order
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={16} className="text-muted-foreground" /> This week
          {maxPerDay != null && (
            <span className="font-normal text-muted-foreground">· capacity {maxPerDay}/day</span>
          )}
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {week.map((d, i) => {
            // at capacity = amber ("full — block the day"), beyond = red (over-booked)
            const full = maxPerDay != null && d.count === maxPerDay
            const over = maxPerDay != null && d.count > maxPerDay
            return (
              <div
                key={d.iso}
                className={`min-w-[74px] flex-1 rounded-xl border px-2 py-2.5 text-center ${
                  over ? 'border-red-200 bg-red-50' : full ? 'border-amber-200 bg-amber-50' : 'border-border bg-background'
                } ${i === 0 ? 'ring-1 ring-accent/40' : ''}`}
              >
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {i === 0 ? 'Today' : d.weekday}
                </div>
                <div className="mt-0.5 font-display text-lg font-bold">{d.dayNum}</div>
                <div
                  className={`mt-0.5 text-xs font-semibold ${
                    over ? 'text-red-700' : full ? 'text-amber-800' : d.count > 0 ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {d.count === 0 ? '—' : `${d.count} order${d.count === 1 ? '' : 's'}`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {[{ value: 'all' as const, label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === s.value ? 'border-primary bg-primary text-on-primary' : 'border-border bg-card hover:bg-muted'
            }`}
          >
            {s.label} <span className="opacity-70">({counts[s.value] ?? 0})</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {active.length + done.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          No {filter === 'all' ? '' : `${filter} `}orders yet. Convert an inquiry or add one with “New order”.
        </div>
      ) : (
        <>
          {active.length > 0 && <div className="mt-6 space-y-5">{active.map(renderCard)}</div>}
          {filter === 'all' && done.length > 0 && (
            <div className="mb-1 mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Completed & cancelled
            </div>
          )}
          {done.length > 0 && <div className="mt-4 space-y-5">{done.map(renderCard)}</div>}
        </>
      )}
    </div>
  )
}
