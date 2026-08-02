import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import type { CakeContent } from '../content/types'
import { CATEGORIES } from '../data/cakes'
import { BUCKET_CAKES } from '../lib/supabase'
import { uploadImage } from '../lib/image'
import { deleteCake, listCakes, reorderCakes, saveCake } from './lib/db'

function blankCake(sortOrder: number): CakeContent {
  return {
    id: crypto.randomUUID(),
    title: 'New cake',
    blurb: '',
    category: CATEGORIES[0],
    bg: '#F3EDE1',
    panel: '#F4E9DC',
    accent: '#96601A',
    dark: false,
    image: '',
    sortOrder,
    visible: false,
    flavor: '',
    servings: '',
    tags: [],
    extraImages: [],
  }
}

export default function CakesManager() {
  const [cakes, setCakes] = useState<CakeContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const extraInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    listCakes()
      .then(setCakes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const patch = (id: string, p: Partial<CakeContent>) =>
    setCakes((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const persist = async (cake: CakeContent) => {
    setSavingId(cake.id)
    setError(null)
    try {
      await saveCake(cake)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const onUpload = async (cake: CakeContent, file: File) => {
    setUploadingId(cake.id)
    setError(null)
    try {
      const url = await uploadImage(BUCKET_CAKES, file, 1600, 0.85)
      const updated = { ...cake, image: url }
      patch(cake.id, { image: url })
      await saveCake(updated) // photo changes go live immediately
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  const onUploadExtras = async (cake: CakeContent, files: FileList) => {
    setUploadingId(cake.id)
    setError(null)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        urls.push(await uploadImage(BUCKET_CAKES, f, 1600, 0.85))
      }
      const updated = { ...cake, extraImages: [...cake.extraImages, ...urls] }
      patch(cake.id, { extraImages: updated.extraImages })
      await saveCake(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  const removeExtra = async (cake: CakeContent, url: string) => {
    const updated = { ...cake, extraImages: cake.extraImages.filter((u) => u !== url) }
    patch(cake.id, { extraImages: updated.extraImages })
    try {
      await saveCake(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= cakes.length) return
    const arr = [...cakes]
    ;[arr[index], arr[next]] = [arr[next], arr[index]]
    const renumbered = arr.map((c, i) => ({ ...c, sortOrder: i }))
    setCakes(renumbered)
    try {
      await reorderCakes(renumbered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
    }
  }

  const remove = async (cake: CakeContent) => {
    if (!confirm(`Delete "${cake.title}"? This can't be undone.`)) return
    setCakes((cs) => cs.filter((c) => c.id !== cake.id))
    try {
      await deleteCake(cake.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const addCake = () => setCakes((cs) => [...cs, blankCake(cs.length)])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading cakes…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Featured cakes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown in the hero and the “A taste of what's possible” gallery. Drag order with the arrows.
          </p>
        </div>
        <button
          type="button"
          onClick={addCake}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
        >
          <Plus size={16} /> Add cake
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Tip: for the hero, upload a PNG of the cake on a <strong>transparent background</strong> (a cutout) so it floats
        cleanly on the colored backdrop. Photos with a background still work in the gallery.
      </p>

      {/* free-text category suggestions (type anything to create a new category) */}
      <datalist id="cake-categories">
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      <div className="mt-6 space-y-5">
        {cakes.map((c, i) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
              {/* image */}
              <div>
                <div
                  className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl"
                  style={{ backgroundColor: c.bg }}
                >
                  {c.image ? (
                    <img src={c.image} alt={c.title} className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-3 text-center text-xs text-foreground/40">No image yet</span>
                  )}
                </div>
                <input
                  ref={(el) => {
                    fileInputs.current[c.id] = el
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUpload(c, f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputs.current[c.id]?.click()}
                  disabled={uploadingId === c.id}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {uploadingId === c.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {uploadingId === c.id ? 'Uploading…' : 'Replace photo'}
                </button>
              </div>

              {/* fields */}
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Title
                    <input
                      value={c.title}
                      onChange={(e) => patch(c.id, { title: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Category
                    <input
                      value={c.category}
                      onChange={(e) => patch(c.id, { category: e.target.value })}
                      list="cake-categories"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Blurb
                  <textarea
                    value={c.blurb}
                    onChange={(e) => patch(c.id, { blurb: e.target.value })}
                    rows={2}
                    className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Flavor <span className="font-normal text-muted-foreground">(shown on the cake's page)</span>
                    <input
                      value={c.flavor}
                      onChange={(e) => patch(c.id, { flavor: e.target.value })}
                      placeholder="e.g. Butterscotch (eggless)"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Servings
                    <input
                      value={c.servings}
                      onChange={(e) => patch(c.id, { servings: e.target.value })}
                      placeholder="e.g. Serves 25–30"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Tags <span className="font-normal text-muted-foreground">(comma-separated — power the gallery search)</span>
                  <input
                    value={c.tags.join(', ')}
                    onChange={(e) => patch(c.id, { tags: e.target.value.split(',').map((s) => s.trimStart()) })}
                    onBlur={() => patch(c.id, { tags: c.tags.map((t) => t.trim()).filter(Boolean) })}
                    placeholder="e.g. wedding, floral, two tier"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>

                <div>
                  <span className="block text-sm font-medium">
                    More photos <span className="font-normal text-muted-foreground">(detail-page carousel)</span>
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {c.extraImages.map((url) => (
                      <div key={url} className="relative">
                        <img src={url} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExtra(c, url)}
                          aria-label="Remove photo"
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary shadow"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={(el) => {
                        extraInputs.current[c.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) onUploadExtras(c, e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => extraInputs.current[c.id]?.click()}
                      disabled={uploadingId === c.id}
                      className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-60"
                      aria-label="Add photos"
                    >
                      {uploadingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    Background
                    <input
                      type="color"
                      value={c.bg}
                      onChange={(e) => patch(c.id, { bg: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                    />
                    <input
                      value={c.bg}
                      onChange={(e) => patch(c.id, { bg: e.target.value })}
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={c.dark}
                      onChange={(e) => patch(c.id, { dark: e.target.checked })}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    Dark background (light text)
                  </label>
                </div>

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
                      disabled={i === cakes.length - 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                      aria-label="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const v = !c.visible
                        patch(c.id, { visible: v })
                        persist({ ...c, visible: v })
                      }}
                      className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      {c.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      {c.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => persist(c)}
                      disabled={savingId === c.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
                    >
                      {savingId === c.id && <Loader2 size={15} className="animate-spin" />}
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
