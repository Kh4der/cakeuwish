import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react'
import type { PricingItemContent } from '../content/types'
import { deletePricingItem, listPricing, reorderPricing, savePricingItem } from './lib/db'

const SECTIONS: { key: PricingItemContent['section']; title: string; hint: string }[] = [
  { key: 'starting', title: 'Starting prices', hint: 'The big cards at the top of the pricing page.' },
  { key: 'addon', title: 'Add-ons', hint: 'The smaller add-on rows further down.' },
]

const input =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent'

function blank(section: PricingItemContent['section'], sortOrder: number): PricingItemContent {
  return {
    id: crypto.randomUUID(),
    section,
    item: 'New item',
    detail: '',
    price: null,
    sortOrder,
    visible: false,
  }
}

export default function PricingManager() {
  const [items, setItems] = useState<PricingItemContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    listPricing()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const patch = (id: string, p: Partial<PricingItemContent>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const persist = async (item: PricingItemContent) => {
    setSavingId(item.id)
    setError(null)
    try {
      await savePricingItem(item)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const move = async (section: PricingItemContent['section'], index: number, dir: -1 | 1) => {
    const rows = items.filter((x) => x.section === section)
    const next = index + dir
    if (next < 0 || next >= rows.length) return
    const arr = [...rows]
    ;[arr[index], arr[next]] = [arr[next], arr[index]]
    const renumbered = arr.map((x, i) => ({ ...x, sortOrder: i }))
    setItems((xs) => [...xs.filter((x) => x.section !== section), ...renumbered])
    try {
      await reorderPricing(renumbered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
    }
  }

  const remove = async (item: PricingItemContent) => {
    if (!confirm(`Delete "${item.item}"? This can't be undone.`)) return
    setItems((xs) => xs.filter((x) => x.id !== item.id))
    try {
      await deletePricingItem(item.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading pricing…
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Pricing guide</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        These rows drive the public pricing page. Leave a price empty to show a
        "Request a quote" button instead of a number. The AI assistant quotes these as
        starting prices only.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {SECTIONS.map((sec) => {
        const rows = items
          .filter((x) => x.section === sec.key)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        return (
          <section key={sec.key} className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">{sec.title}</h2>
                <p className="text-sm text-muted-foreground">{sec.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setItems((xs) => [...xs, blank(sec.key, rows.length)])}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
              >
                <Plus size={15} /> Add
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((p, i) => (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_170px]">
                    <label className="block text-sm font-medium">
                      Item
                      <input value={p.item} onChange={(e) => patch(p.id, { item: e.target.value })} className={input} />
                    </label>
                    <label className="block text-sm font-medium">
                      Description
                      <input value={p.detail} onChange={(e) => patch(p.id, { detail: e.target.value })} className={input} />
                    </label>
                    <label className="block text-sm font-medium">
                      Price
                      <input
                        value={p.price ?? ''}
                        onChange={(e) => patch(p.id, { price: e.target.value || null })}
                        placeholder="e.g. From $95"
                        className={input}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(sec.key, i, -1)}
                        disabled={i === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                        aria-label="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(sec.key, i, 1)}
                        disabled={i === rows.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const v = !p.visible
                          patch(p.id, { visible: v })
                          persist({ ...p, visible: v })
                        }}
                        className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
                      >
                        {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        {p.visible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => persist(p)}
                        disabled={savingId === p.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
                      >
                        {savingId === p.id && <Loader2 size={13} className="animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nothing here yet — run migration 0006 to seed the defaults, or add a row.
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
