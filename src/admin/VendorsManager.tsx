import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Camera, ImageIcon, Loader2, Plus, ReceiptText, Sparkles, Trash2 } from 'lucide-react'
import { localIsoDay } from '../lib/dates'
import {
  PAYMENT_CATEGORIES,
  PAYMENT_METHODS,
  deleteVendorPayment,
  listUsageSince,
  listVendorPayments,
  receiptSignedUrl,
  receiptToBase64,
  saveVendorPayment,
  sessionToken,
  uploadReceipt,
  type UsageRow,
  type VendorPayment,
} from './lib/vendorDb'

const fmtMoney = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })

const input =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent'

export default function VendorsManager() {
  const [payments, setPayments] = useState<VendorPayment[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // form (prefilled by snap-a-bill)
  const [payDate, setPayDate] = useState(localIsoDay())
  const [payVendor, setPayVendor] = useState('')
  const [payCategory, setPayCategory] = useState(PAYMENT_CATEGORIES[0])
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [payNote, setPayNote] = useState('')
  const [receiptPath, setReceiptPath] = useState('')
  const [receiptPreview, setReceiptPreview] = useState('')
  const [saving, setSaving] = useState(false)

  // snap-a-bill
  const cameraInput = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState('')

  useEffect(() => {
    const monthStart = `${localIsoDay().slice(0, 7)}-01T00:00:00Z`
    Promise.all([listVendorPayments(), listUsageSince(monthStart)])
      .then(([p, u]) => {
        setPayments(p)
        setUsage(u)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const month = localIsoDay().slice(0, 7)
  const stats = useMemo(() => {
    const monthPayments = payments.filter((p) => p.paidOn.startsWith(month))
    const byVendor = new Map<string, number>()
    for (const p of payments) byVendor.set(p.vendor, (byVendor.get(p.vendor) ?? 0) + p.amount)
    const chatCost = usage.filter((u) => u.service === 'chat').reduce((n, u) => n + u.estCost, 0)
    const imageCost = usage.filter((u) => u.service === 'image').reduce((n, u) => n + u.estCost, 0)
    return {
      monthTotal: monthPayments.reduce((n, p) => n + p.amount, 0),
      allTotal: payments.reduce((n, p) => n + p.amount, 0),
      topVendors: [...byVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      chatCost,
      imageCost,
      chatCalls: usage.filter((u) => u.service === 'chat').length,
      images: usage.filter((u) => u.service === 'image').length,
      apiMonth: chatCost + imageCost,
    }
  }, [payments, usage, month])

  const onSnap = async (file: File) => {
    setScanning(true)
    setScanNote('')
    setError(null)
    try {
      // Store the photo first — even if AI reading fails, the bill is saved.
      const path = await uploadReceipt(file)
      setReceiptPath(path)
      setReceiptPreview(URL.createObjectURL(file))

      const [b64, token] = await Promise.all([receiptToBase64(file), sessionToken()])
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: b64, mediaType: 'image/webp' }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        configured?: boolean
        receipt?: { vendor: string; date: string; amount: number; category: string; note: string } | null
        error?: string
      }
      if (!res.ok) {
        setScanNote(data.error ?? 'Photo saved — fill the fields and hit record.')
        return
      }
      if (data.configured === false) {
        setScanNote('Photo saved. Auto-reading needs the ANTHROPIC_API_KEY — fill the fields manually for now.')
        return
      }
      if (!data.receipt) {
        setScanNote("That didn't look like a bill — photo saved anyway, fill the fields manually.")
        return
      }
      if (data.receipt.vendor) setPayVendor(data.receipt.vendor)
      if (data.receipt.date) setPayDate(data.receipt.date)
      if (data.receipt.amount > 0) setPayAmount(String(data.receipt.amount))
      setPayCategory(data.receipt.category)
      if (data.receipt.note) setPayNote(data.receipt.note)
      setScanNote('Read it! Check the fields below, then hit record.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setScanning(false)
    }
  }

  const record = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(payAmount)
    if (!payVendor.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Vendor name and a positive amount are needed to record a payment.')
      return
    }
    setSaving(true)
    setError(null)
    const row: VendorPayment = {
      id: crypto.randomUUID(),
      paidOn: payDate || localIsoDay(),
      vendor: payVendor.trim(),
      category: payCategory,
      amount: Math.round(amount * 100) / 100,
      method: payMethod,
      note: payNote.trim(),
      receiptUrl: receiptPath,
    }
    try {
      await saveVendorPayment(row)
      setPayments((ps) => [row, ...ps])
      setPayVendor('')
      setPayAmount('')
      setPayNote('')
      setReceiptPath('')
      setReceiptPreview('')
      setScanNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: VendorPayment) => {
    if (!confirm(`Delete the ${fmtMoney(p.amount, 2)} payment to "${p.vendor}"?`)) return
    setPayments((ps) => ps.filter((x) => x.id !== p.id))
    try {
      await deleteVendorPayment(p.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const viewReceipt = async (path: string) => {
    const url = await receiptSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else setError('Could not open the receipt right now.')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading vendors & bills…
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Vendors & bills</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every dollar going out — vendor payments, hosting, and the AI features' own running costs.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* totals strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid out this month</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmtMoney(stats.monthTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid out all-time</p>
          <p className="mt-1 font-display text-2xl font-bold">{fmtMoney(stats.allTotal)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bot size={13} /> AI chat (month)
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{fmtMoney(stats.chatCost, 2)}</p>
          <p className="text-[11px] text-muted-foreground">{stats.chatCalls} replies</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles size={13} /> AI images (month)
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{fmtMoney(stats.imageCost, 2)}</p>
          <p className="text-[11px] text-muted-foreground">{stats.images} previews</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        AI costs are metered per call from this site. Provider dashboards (OpenAI / Anthropic / Vercel) stay the
        billing source of truth — record those invoices below under “Software &amp; hosting”.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* snap-a-bill + form */}
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-accent/50 bg-card p-5 text-center">
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onSnap(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              disabled={scanning}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60"
            >
              {scanning ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
              {scanning ? 'Reading the bill…' : 'Snap a bill'}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Photograph any receipt or invoice — it's stored and the fields below fill themselves.
            </p>
            {scanNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900">{scanNote}</p>}
            {receiptPreview && (
              <img src={receiptPreview} alt="Receipt preview" className="mx-auto mt-3 max-h-40 rounded-xl border border-border" />
            )}
          </div>

          <form onSubmit={record} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Record a payment</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Date
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={input} />
              </label>
              <label className="block text-sm font-medium">
                Amount ($) *
                <input type="number" min="0.01" step="0.01" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={input} />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium">
              Paid to *
              <input value={payVendor} onChange={(e) => setPayVendor(e.target.value)} placeholder="e.g. Restaurant Depot, Vercel" className={input} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Category
                <select value={payCategory} onChange={(e) => setPayCategory(e.target.value)} className={input}>
                  {PAYMENT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Method
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={input}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium">
              Note
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="optional" className={input} />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Record payment
            </button>
          </form>

          {/* per-vendor totals */}
          {stats.topVendors.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">By vendor (all-time)</h2>
              <ul className="mt-3 space-y-2">
                {stats.topVendors.map(([vendor, total]) => (
                  <li key={vendor} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{vendor}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{fmtMoney(total, 2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ledger */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">All payments</h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing recorded yet — snap your first bill.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-3 text-sm">
                  <div className="min-w-0 flex-1 basis-52">
                    <p className="truncate font-medium">
                      {p.vendor}
                      {p.category && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p.category}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.paidOn}
                      {p.method && ` · ${p.method}`}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => viewReceipt(p.receiptUrl)}
                        aria-label={`View receipt from ${p.vendor}`}
                        title="View receipt"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-accent hover:bg-muted"
                      >
                        <ImageIcon size={15} />
                      </button>
                    )}
                    <span className="font-semibold tabular-nums">{fmtMoney(p.amount, 2)}</span>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      aria-label={`Delete payment to ${p.vendor}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ReceiptText size={13} /> Receipts are stored privately — only signed-in admins can open them.
          </p>
        </div>
      </div>
    </div>
  )
}
