import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { deleteKbEntry, listKbEntries, reorderKbEntries, saveKbEntry, type KbEntry } from './lib/kbDb'

function blankEntry(sortOrder: number): KbEntry {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '',
    visible: true,
    sortOrder,
    createdAt: '',
  }
}

export default function KnowledgeManager() {
  const [entries, setEntries] = useState<KbEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    listKbEntries()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const patch = (id: string, p: Partial<KbEntry>) =>
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)))

  const persist = async (entry: KbEntry) => {
    setSavingId(entry.id)
    setError(null)
    try {
      await saveKbEntry(entry)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const toggleVisible = async (entry: KbEntry) => {
    const v = !entry.visible
    patch(entry.id, { visible: v })
    try {
      await saveKbEntry({ ...entry, visible: v })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= entries.length) return
    const arr = [...entries]
    ;[arr[index], arr[next]] = [arr[next], arr[index]]
    const renumbered = arr.map((e, i) => ({ ...e, sortOrder: i }))
    setEntries(renumbered)
    try {
      await reorderKbEntries(renumbered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
    }
  }

  const remove = async (entry: KbEntry) => {
    if (!confirm(`Delete "${entry.title || 'this entry'}"? This can't be undone.`)) return
    setEntries((es) => es.filter((e) => e.id !== entry.id))
    try {
      await deleteKbEntry(entry.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const addEntry = () => setEntries((es) => [...es, blankEntry(es.length)])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading knowledge base…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">AI knowledge base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Extra facts fed to the website&rsquo;s AI chat assistant — seasonal specials, current
            lead times, holiday closures, new offerings.
          </p>
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
        >
          <Plus size={16} /> Add entry
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <span>
          The assistant already knows the site&rsquo;s pricing guide, sizing, FAQ, and ordering
          policies. Entries here are added on top and treated as the most recent info — great for
          things that change, like &ldquo;Booked out for December&rdquo; or &ldquo;New flavor:
          pistachio rose&rdquo;. Only <strong>visible</strong> entries reach the assistant.
        </span>
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          No entries yet. Click &ldquo;Add entry&rdquo; to teach the assistant something new.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {entries.map((entry, i) => (
            <div key={entry.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Title
                  <input
                    value={entry.title}
                    onChange={(e) => patch(entry.id, { title: e.target.value })}
                    placeholder="e.g. December availability"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>

                <label className="block text-sm font-medium">
                  What should the assistant know?
                  <textarea
                    value={entry.content}
                    onChange={(e) => patch(entry.id, { content: e.target.value })}
                    rows={3}
                    placeholder="e.g. We're fully booked Dec 20–31. Orders for January are open — lead time is currently 3 weeks."
                    className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                      aria-label="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === entries.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                      aria-label="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleVisible(entry)}
                      className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      {entry.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      {entry.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => remove(entry)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => persist(entry)}
                      disabled={savingId === entry.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
                    >
                      {savingId === entry.id && <Loader2 size={15} className="animate-spin" />}
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
