import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Bot,
  CalendarDays,
  Inbox,
  Loader2,
  Phone,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import type { Inquiry } from '../content/types'
import { localIsoDay } from '../lib/dates'
import { listInquiries } from './lib/db'
import { listOrders, type Order } from './lib/ordersDb'
import { listUsageSince, listVendorPayments, type UsageRow, type VendorPayment } from './lib/vendorDb'

// Business overview — the page Parul lands on. Pure totals: revenue from the
// order history (50%-deposit policy), expenses from the vendor ledger + the
// AI features' metered API costs. Recording payments lives on /vendors.

const fmtMoney = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })

const orderDay = (o: Order) => o.pickupDate || o.eventDate

/** Cash actually received for an order under the 50%-deposit policy. */
function cashReceived(o: Order): number {
  if (o.price == null || o.status === 'cancelled') return 0
  if (o.status === 'completed') return o.price
  return o.depositPaid ? o.price * 0.5 : 0
}

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className={`mt-2 font-display text-3xl font-bold ${tone === 'down' ? 'text-red-700' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SalesChart({ orders }: { orders: Order[] }) {
  const days = useMemo(() => {
    const out: { iso: string; total: number }[] = []
    for (let i = 29; i >= 0; i--) out.push({ iso: localIsoDay(-i), total: 0 })
    const index = new Map(out.map((d, i) => [d.iso, i]))
    for (const o of orders) {
      if (o.status === 'cancelled' || o.price == null) continue
      const i = index.get(orderDay(o))
      if (i !== undefined) out[i].total += o.price
    }
    return out
  }, [orders])
  const max = Math.max(1, ...days.map((d) => d.total))
  const total = days.reduce((n, d) => n + d.total, 0)
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Sales — last 30 days</h2>
        <span className="text-sm font-semibold text-muted-foreground">{fmtMoney(total)} total</span>
      </div>
      {total === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No priced orders in the last 30 days yet — sales appear here as orders get prices on the{' '}
          <Link to="/orders" className="underline underline-offset-2">Orders</Link> page.
        </p>
      ) : (
        <div className="mt-4 flex h-36 items-end gap-1">
          {days.map((d) => (
            <div key={d.iso} className="group flex flex-1 flex-col items-center justify-end" title={`${d.iso}: ${fmtMoney(d.total)}`}>
              <div
                className="w-full rounded-t bg-accent/80 transition-all group-hover:bg-accent"
                style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 3 : 0 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Overview() {
  const [orders, setOrders] = useState<Order[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [payments, setPayments] = useState<VendorPayment[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const monthStart = `${localIsoDay().slice(0, 7)}-01T00:00:00Z`
    Promise.all([listOrders(), listInquiries(), listVendorPayments(), listUsageSince(monthStart)])
      .then(([o, i, p, u]) => {
        setOrders(o)
        setInquiries(i)
        setPayments(p)
        setUsage(u)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const today = localIsoDay()
  const month = today.slice(0, 7)

  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'cancelled')
    const priced = (o: Order) => o.price ?? 0
    const salesToday = active.filter((o) => orderDay(o) === today)
    const salesMonth = active.filter((o) => orderDay(o).startsWith(month))
    const revenueMonth = orders
      .filter((o) => orderDay(o).startsWith(month))
      .reduce((n, o) => n + cashReceived(o), 0)
    const vendorsMonth = payments
      .filter((p) => p.paidOn.startsWith(month))
      .reduce((n, p) => n + p.amount, 0)
    const apiMonth = usage.reduce((n, u) => n + u.estCost, 0)
    const expensesMonth = vendorsMonth + apiMonth
    return {
      salesTodayTotal: salesToday.reduce((n, o) => n + priced(o), 0),
      salesTodayCount: salesToday.length,
      salesMonthTotal: salesMonth.reduce((n, o) => n + priced(o), 0),
      salesMonthCount: salesMonth.length,
      revenueMonth,
      vendorsMonth,
      apiMonth,
      expensesMonth,
      net: revenueMonth - expensesMonth,
      pickupsToday: salesToday.length,
      newInquiries: inquiries.filter((i) => i.status === 'new' && i.kind !== 'callback').length,
      callbacksDue: inquiries.filter((i) => i.status === 'new' && i.kind === 'callback'),
      unpriced: active.filter((o) => o.price == null).length,
    }
  }, [orders, inquiries, payments, usage, today, month])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading overview…
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Business overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Revenue from the order history (50% deposit policy); expenses from vendor payments + metered AI costs.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={<ShoppingBag size={16} />}
          label="Sales today"
          value={fmtMoney(stats.salesTodayTotal)}
          hint={`${stats.salesTodayCount} pickup${stats.salesTodayCount === 1 ? '' : 's'} today`}
        />
        <Kpi
          icon={<TrendingUp size={16} />}
          label="Sales this month"
          value={fmtMoney(stats.salesMonthTotal)}
          hint={`${stats.salesMonthCount} order${stats.salesMonthCount === 1 ? '' : 's'}`}
        />
        <Kpi
          icon={<ArrowUpRight size={16} />}
          label="Revenue received (month)"
          value={fmtMoney(stats.revenueMonth)}
          hint="deposits + completed pickups"
        />
        <Kpi
          icon={<ArrowDownRight size={16} />}
          label="Expenses (month)"
          value={fmtMoney(stats.expensesMonth)}
          hint={`net ${fmtMoney(stats.net)}`}
          tone={stats.net < 0 ? 'down' : 'up'}
        />
      </div>

      {/* chart + right rail */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SalesChart orders={orders} />
        <div className="space-y-4">
          {/* money out summary → /vendors */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Money out (month)</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><ReceiptText size={15} className="text-accent" /> Vendors & bills</span>
                <span className="font-semibold tabular-nums">{fmtMoney(stats.vendorsMonth, 2)}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Bot size={15} className="text-accent" /> AI & API usage</span>
                <span className="font-semibold tabular-nums">{fmtMoney(stats.apiMonth, 2)}</span>
              </li>
            </ul>
            <Link
              to="/vendors"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              Record a payment or snap a bill <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {/* needs attention */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Needs attention</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link to="/inbox" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex items-center gap-2"><Inbox size={15} className="text-accent" /> New messages</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stats.newInquiries > 0 ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
                    {stats.newInquiries}
                  </span>
                </Link>
              </li>
              <li>
                <Link to="/inbox" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex items-center gap-2"><Phone size={15} className="text-accent" /> Callbacks to make</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stats.callbacksDue.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
                    {stats.callbacksDue.length}
                  </span>
                </Link>
              </li>
              <li>
                <Link to="/orders" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex items-center gap-2"><CalendarDays size={15} className="text-accent" /> Pickups today</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{stats.pickupsToday}</span>
                </Link>
              </li>
              <li>
                <Link to="/orders" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex items-center gap-2"><BadgeDollarSign size={15} className="text-accent" /> Orders without a price</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stats.unpriced > 0 ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
                    {stats.unpriced}
                  </span>
                </Link>
              </li>
            </ul>
            {stats.callbacksDue.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call first</p>
                <ul className="mt-2 space-y-1.5">
                  {stats.callbacksDue.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c.name || 'No name'}</span>
                      <a
                        href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                        className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 hover:bg-green-200"
                      >
                        {c.preferredTime || 'Anytime'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
