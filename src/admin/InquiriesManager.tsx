import { useEffect, useMemo, useState } from 'react'
import {
  Cake,
  CalendarDays,
  Loader2,
  Mail,
  MessageCircle,
  PackagePlus,
  Phone,
  Trash2,
  Users,
} from 'lucide-react'
import type { Inquiry, InquiryStatus } from '../content/types'
import { deleteInquiry, listInquiries, updateInquiry } from './lib/db'
import { createFromInquiry } from './lib/ordersDb'

const STATUSES: { value: InquiryStatus; label: string; cls: string }[] = [
  { value: 'new', label: 'New', cls: 'bg-amber-100 text-amber-900' },
  { value: 'quoted', label: 'Quoted', cls: 'bg-blue-100 text-blue-900' },
  { value: 'confirmed', label: 'Confirmed', cls: 'bg-green-100 text-green-900' },
  { value: 'closed', label: 'Closed', cls: 'bg-stone-200 text-stone-700' },
]

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  )
}

export default function InquiriesManager() {
  const [items, setItems] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | InquiryStatus>('all')
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [converted, setConverted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    listInquiries()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const s of STATUSES) c[s.value] = items.filter((i) => i.status === s.value).length
    return c
  }, [items])

  const visible = filter === 'all' ? items : items.filter((i) => i.status === filter)

  const setStatus = async (inq: Inquiry, status: InquiryStatus) => {
    setItems((xs) => xs.map((x) => (x.id === inq.id ? { ...x, status } : x)))
    try {
      await updateInquiry(inq.id, { status })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const saveNotes = async (inq: Inquiry) => {
    const adminNotes = notesDraft[inq.id] ?? inq.adminNotes
    setSavingId(inq.id)
    try {
      await updateInquiry(inq.id, { adminNotes })
      setItems((xs) => xs.map((x) => (x.id === inq.id ? { ...x, adminNotes } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const convertToOrder = async (inq: Inquiry) => {
    setConvertingId(inq.id)
    setError(null)
    try {
      const description = [
        inq.occasion && `Occasion: ${inq.occasion}`,
        inq.theme && `Theme: ${inq.theme}`,
        inq.servings && `Servings: ${inq.servings}`,
        inq.flavor && `Flavor: ${inq.flavor}`,
        inq.dietary && `Dietary: ${inq.dietary}`,
        inq.message && `Notes: ${inq.message}`,
      ]
        .filter(Boolean)
        .join('\n')
      try {
        await createFromInquiry({
          inquiryId: inq.id,
          name: inq.name,
          phone: inq.phone,
          email: inq.email,
          eventDate: inq.eventDate,
          pickupDate: inq.pickupDate,
          pickupSlot: inq.pickupSlot ?? '',
          description,
        })
      } catch (e) {
        // 23505 = an order for this inquiry already exists (unique index) —
        // that's the outcome the admin wanted, so treat it as success.
        const code = (e as { code?: string } | null)?.code
        if (code !== '23505') throw e
      }
      await updateInquiry(inq.id, { status: 'confirmed' })
      setItems((xs) => xs.map((x) => (x.id === inq.id ? { ...x, status: 'confirmed' } : x)))
      setConverted((c) => ({ ...c, [inq.id]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Convert failed')
    } finally {
      setConvertingId(null)
    }
  }

  const remove = async (inq: Inquiry) => {
    if (!confirm(`Delete the inquiry from "${inq.name || 'unknown'}"? This can't be undone.`)) return
    setItems((xs) => xs.filter((x) => x.id !== inq.id))
    try {
      await deleteInquiry(inq.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading inquiries…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Inquiries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quote requests and contact messages from the website.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          No {filter === 'all' ? '' : `${filter} `}inquiries yet. New quote requests from the website will appear here.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {visible.map((inq) => {
            const status = STATUSES.find((s) => s.value === inq.status) ?? STATUSES[0]
            const waNumber = inq.phone.replace(/[^\d+]/g, '')
            return (
              <div key={inq.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${status.cls}`}>
                      {status.label}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                      {inq.kind}
                    </span>
                    <h2 className="font-display text-lg font-bold">{inq.name || 'No name'}</h2>
                    <span className="text-sm text-muted-foreground">· {fmtDate(inq.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {converted[inq.id] ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-900">
                        Order created — see Orders tab
                      </span>
                    ) : (
                      inq.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => convertToOrder(inq)}
                          disabled={convertingId === inq.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                        >
                          {convertingId === inq.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <PackagePlus size={15} />
                          )}
                          Convert to order
                        </button>
                      )
                    )}
                    <label className="text-sm text-muted-foreground">
                      Status{' '}
                      <select
                        value={inq.status}
                        onChange={(e) => setStatus(inq, e.target.value as InquiryStatus)}
                        className="ml-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(inq)}
                      aria-label="Delete inquiry"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {inq.message.startsWith('Cake Builder design') && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-900">
                      ✨ Cake Builder — accept &amp; set a date via Convert to order
                    </span>
                  )}
                  {inq.kind === 'callback' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                      <Phone size={12} /> Call back{inq.preferredTime ? `: ${inq.preferredTime}` : ''}
                    </span>
                  )}
                  {inq.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} className="text-muted-foreground" /> {inq.phone}
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900 hover:bg-green-200"
                      >
                        <MessageCircle size={12} /> WhatsApp
                      </a>
                    </span>
                  )}
                  {inq.email && (
                    <a href={`mailto:${inq.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                      <Mail size={14} className="text-muted-foreground" /> {inq.email}
                    </a>
                  )}
                  {inq.eventDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-muted-foreground" /> Event {fmtDate(inq.eventDate)}
                      {inq.pickupDate && ` · pickup ${fmtDate(inq.pickupDate)}`}
                      {inq.pickupSlot && ` · ${inq.pickupSlot}`}
                    </span>
                  )}
                  {inq.servings && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} className="text-muted-foreground" /> {inq.servings} servings
                    </span>
                  )}
                  {inq.cakeTitle && (
                    <span className="inline-flex items-center gap-1.5">
                      <Cake size={14} className="text-muted-foreground" /> Inspired by “{inq.cakeTitle}”
                    </span>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Field label="Occasion" value={inq.occasion} />
                  <Field label="Theme" value={inq.theme} />
                  <Field label="Flavor" value={inq.flavor} />
                  <Field label="Budget" value={inq.budget} />
                  <Field label="Dietary" value={inq.dietary} />
                </dl>

                {inq.message && (
                  <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/60 p-4 text-sm" style={{ lineHeight: 1.6 }}>
                    {inq.message}
                  </p>
                )}

                {inq.photos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {inq.photos.map((src, i) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer">
                        <img
                          src={src}
                          alt={`Inspiration ${i + 1} from ${inq.name}`}
                          className="h-20 w-20 rounded-lg border border-border object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-end gap-2">
                  <label className="block flex-1 text-sm font-medium">
                    Notes (only you see these)
                    <textarea
                      value={notesDraft[inq.id] ?? inq.adminNotes}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [inq.id]: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveNotes(inq)}
                    disabled={savingId === inq.id || (notesDraft[inq.id] ?? inq.adminNotes) === inq.adminNotes}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
                  >
                    {savingId === inq.id && <Loader2 size={14} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
