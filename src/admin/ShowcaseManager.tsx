import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Film, Loader2, Share2, Trash2, Upload } from 'lucide-react'
import type { ShowcaseContent } from '../content/types'
import { BUCKET_SHOWCASE } from '../lib/supabase'
import { uploadImage, uploadVideo } from '../lib/image'
import { deleteShowcase, listShowcase, reorderShowcase, saveShowcase } from './lib/db'

export default function ShowcaseManager() {
  const [photos, setPhotos] = useState<ShowcaseContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    listShowcase()
      .then(setPhotos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const patch = (id: string, p: Partial<ShowcaseContent>) =>
    setPhotos((ps) => ps.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const onUpload = async (files: FileList) => {
    setUploading(true)
    setError(null)
    try {
      let order = photos.length
      const added: ShowcaseContent[] = []
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/')
        const url = isVideo
          ? await uploadVideo(BUCKET_SHOWCASE, file)
          : await uploadImage(BUCKET_SHOWCASE, file, 1400, 0.8)
        const row: ShowcaseContent = {
          id: crypto.randomUUID(),
          src: url,
          alt: isVideo ? 'Cake video by CakeUWish' : 'Custom celebration cake by CakeUWish',
          sortOrder: order++,
          visible: true,
          mediaType: isVideo ? 'video' : 'image',
        }
        await saveShowcase(row)
        added.push(row)
      }
      setPhotos((ps) => [...ps, ...added])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const saveAlt = async (s: ShowcaseContent) => {
    setSavingId(s.id)
    try {
      await saveShowcase(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  const toggleVisible = async (s: ShowcaseContent) => {
    const v = !s.visible
    patch(s.id, { visible: v })
    try {
      await saveShowcase({ ...s, visible: v })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= photos.length) return
    const arr = [...photos]
    ;[arr[index], arr[next]] = [arr[next], arr[index]]
    const renumbered = arr.map((s, i) => ({ ...s, sortOrder: i }))
    setPhotos(renumbered)
    try {
      await reorderShowcase(renumbered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
    }
  }

  const remove = async (s: ShowcaseContent) => {
    if (!confirm('Delete this photo? This can’t be undone.')) return
    setPhotos((ps) => ps.filter((p) => p.id !== s.id))
    try {
      await deleteShowcase(s.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading photos…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Showcase wall</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The home scatter gallery + the gallery page's photo wall. {photos.length} items.
            Videos (MP4/WebM/MOV, under 50 MB) appear on the gallery page with a play button.
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading…' : 'Upload photos / videos'}
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((s, i) => (
          <div key={s.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-[4/5] bg-muted">
              {s.mediaType === 'video' ? (
                <video src={s.src} className="h-full w-full object-cover" muted playsInline controls preload="metadata" />
              ) : (
                <img src={s.src} alt={s.alt} className="h-full w-full object-cover" />
              )}
              {s.mediaType === 'video' && (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                  <Film size={11} /> Video
                </span>
              )}
              {!s.visible && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                  Hidden
                </span>
              )}
            </div>
            <div className="space-y-2 p-3">
              <label className="block text-xs font-medium text-muted-foreground">
                Alt text (description)
                <input
                  value={s.alt}
                  onChange={(e) => patch(s.id, { alt: e.target.value })}
                  onBlur={() => saveAlt(s)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                    aria-label="Move earlier"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === photos.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                    aria-label="Move later"
                  >
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisible(s)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted"
                    aria-label={s.visible ? 'Hide' : 'Show'}
                  >
                    {s.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {savingId === s.id && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                  <button
                    type="button"
                    onClick={() => navigate(`/compose?media=${s.id}`)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:border-accent hover:text-accent"
                    aria-label="Share to social"
                    title="Share to social networks"
                  >
                    <Share2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-red-700 hover:bg-red-50"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No photos yet. Click “Upload photos” to add some.
        </p>
      )}
    </div>
  )
}
