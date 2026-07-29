import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  ExternalLink,
  Film,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Upload,
  XCircle,
} from 'lucide-react'
import { FacebookIcon, InstagramIcon, type BrandIconProps } from './BrandIcons'
import { BUCKET_SHOWCASE } from '../lib/supabase'
import {
  fileToSocialJpeg,
  uploadImage,
  uploadSocialJpeg,
  uploadVideo,
  urlToSocialJpeg,
  videoProbe,
} from '../lib/image'
import { listShowcase, saveShowcase } from './lib/db'
import { accessToken, getConfig } from './lib/configDb'
import {
  getShowcaseItem,
  listRecentPosts,
  PLATFORM_LABEL,
  rowToTarget,
  type SocialPlatform,
  type SocialPost,
  type SocialTarget,
} from './lib/socialDb'

// Compose once, publish everywhere. Deliberately its own page rather than
// checkboxes on the showcase uploader: that one loops a whole FileList and
// inserts rows the moment files are picked, so bolting publishing onto it would
// fire N irreversible public posts from a single multi-select.

const ORDER: SocialPlatform[] = ['x', 'facebook', 'instagram', 'whatsapp']

const ICON: Record<SocialPlatform, ComponentType<BrandIconProps>> = {
  x: AtSign,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  whatsapp: MessageCircle,
}

const IN_FLIGHT = ['pending', 'uploading', 'processing']

interface PlatformInfo {
  available: boolean
  manual: boolean
}

interface Asset {
  mediaUrl: string
  imageJpegUrl: string
  coverUrl: string
  mediaType: 'image' | 'video'
  durationSecs: number
  fileType: string
  padded: boolean
  alt: string
}

const CAPTION_LIMIT: Partial<Record<SocialPlatform, number>> = { x: 280, instagram: 2200 }

export default function ComposeManager() {
  const [params, setParams] = useSearchParams()
  const [platforms, setPlatforms] = useState<Record<SocialPlatform, PlatformInfo> | null>(null)
  const [selected, setSelected] = useState<Set<SocialPlatform>>(new Set())
  const [channelUrl, setChannelUrl] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [prepping, setPrepping] = useState(false)
  const [asset, setAsset] = useState<Asset | null>(null)

  const [caption, setCaption] = useState('')
  const [altText, setAltText] = useState('')
  const [sendAltToX, setSendAltToX] = useState(false)
  const [addToGallery, setAddToGallery] = useState(true)

  const [publishing, setPublishing] = useState(false)
  const [postId, setPostId] = useState('')
  const [targets, setTargets] = useState<SocialTarget[]>([])
  const [ticking, setTicking] = useState(false)
  const [stalled, setStalled] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [history, setHistory] = useState<SocialPost[]>([])

  const fileInput = useRef<HTMLInputElement | null>(null)
  const startedAt = useRef(0)

  // ── which networks this deployment can reach ──────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const token = await accessToken()
        const res = await fetch('/api/social', { headers: { Authorization: `Bearer ${token}` } })
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean
          platforms?: Record<SocialPlatform, PlatformInfo>
        }
        // Under plain `vite dev` the /api route doesn't exist and this returns
        // the SPA's own HTML — only an explicit configured:true counts.
        if (!res.ok || data.configured !== true || !data.platforms) {
          setPlatforms({
            x: { available: false, manual: false },
            facebook: { available: false, manual: false },
            instagram: { available: false, manual: false },
            whatsapp: { available: true, manual: true },
          })
          return
        }
        setPlatforms(data.platforms)
        setSelected(new Set(ORDER.filter((p) => data.platforms?.[p]?.available)))
      } catch {
        setPlatforms({
          x: { available: false, manual: false },
          facebook: { available: false, manual: false },
          instagram: { available: false, manual: false },
          whatsapp: { available: true, manual: true },
        })
      }
    })()
    getConfig()
      .then((c) => setChannelUrl(c.whatsappChannelUrl ?? ''))
      .catch(() => setChannelUrl(''))
    listRecentPosts(20).then(setHistory).catch(() => setHistory([]))
  }, [])

  // ── prefill from the Showcase "share" button ──────────────────────────────
  const shareId = params.get('media')
  useEffect(() => {
    if (!shareId) return
    ;(async () => {
      setPrepping(true)
      setError('')
      try {
        const item = await getShowcaseItem(shareId)
        if (!item) throw new Error('That gallery item no longer exists.')
        if (!/^https?:\/\//.test(item.src)) {
          throw new Error('That is a built-in sample image — upload your own photo to share it.')
        }
        setPreview(item.src)
        setCaption(item.alt)
        setAltText(item.alt)
        let imageJpegUrl = ''
        if (item.mediaType === 'image') {
          // Legacy rows only ever stored a webp, which Meta refuses outright.
          const jpeg = await urlToSocialJpeg(item.src)
          imageJpegUrl = await uploadSocialJpeg(BUCKET_SHOWCASE, jpeg.blob)
        }
        setAsset({
          mediaUrl: item.src,
          imageJpegUrl,
          coverUrl: '',
          mediaType: item.mediaType,
          durationSecs: 0,
          fileType: item.mediaType === 'video' ? 'video/mp4' : 'image/webp',
          padded: false,
          alt: item.alt,
        })
        setAddToGallery(false) // it is already on the wall
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load that item.')
      } finally {
        setPrepping(false)
      }
    })()
  }, [shareId])

  // ── one file → website asset + Meta-safe derivatives, all in the browser ──
  const onPick = async (f: File) => {
    setFile(f)
    setError('')
    setNotice('')
    setPostId('')
    setTargets([])
    setPreview(URL.createObjectURL(f))
    setPrepping(true)
    try {
      if (f.type.startsWith('video/')) {
        const probe = await videoProbe(f)
        const mediaUrl = await uploadVideo(BUCKET_SHOWCASE, f)
        const coverUrl = probe.poster ? await uploadSocialJpeg(BUCKET_SHOWCASE, probe.poster) : ''
        setAsset({
          mediaUrl,
          imageJpegUrl: '',
          coverUrl,
          mediaType: 'video',
          durationSecs: probe.durationSecs,
          fileType: f.type,
          padded: false,
          alt: '',
        })
      } else {
        const [mediaUrl, jpeg] = await Promise.all([
          uploadImage(BUCKET_SHOWCASE, f, 1400, 0.8),
          fileToSocialJpeg(f),
        ])
        const imageJpegUrl = await uploadSocialJpeg(BUCKET_SHOWCASE, jpeg.blob)
        setAsset({
          mediaUrl,
          imageJpegUrl,
          coverUrl: '',
          mediaType: 'image',
          durationSecs: 0,
          fileType: f.type,
          padded: jpeg.padded,
          alt: '',
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare that file.')
      setAsset(null)
    } finally {
      setPrepping(false)
    }
  }

  // ── pre-flight: disable individual platforms, never the whole form ────────
  const blockers = useMemo(() => {
    const b: Partial<Record<SocialPlatform, string>> = {}
    if (!platforms) return b
    for (const p of ORDER) {
      if (!platforms[p]?.available) {
        b[p] = 'Not connected — add the keys in Setup.'
        continue
      }
      if (!asset) continue
      if (asset.mediaType === 'video') {
        if (p === 'instagram') {
          if (asset.fileType === 'video/webm') b[p] = 'Instagram accepts MP4 or MOV only.'
          else if (asset.durationSecs && asset.durationSecs < 3) b[p] = 'Instagram reels must be at least 3 seconds.'
        }
        if (p === 'x' && asset.durationSecs > 140) b[p] = 'X caps video at 140 seconds.'
      } else if (p === 'instagram' && !asset.imageJpegUrl) {
        b[p] = 'Needs a JPEG version — re-pick the file.'
      }
    }
    return b
  }, [platforms, asset])

  const publishable = useMemo(
    () => ORDER.filter((p) => selected.has(p) && !blockers[p]),
    [selected, blockers],
  )

  const toggle = (p: SocialPlatform) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })

  // ── publish ───────────────────────────────────────────────────────────────
  const publish = async () => {
    if (!asset || !publishable.length) return
    setPublishing(true)
    setError('')
    setNotice('')
    try {
      if (addToGallery) {
        const existing = await listShowcase().catch(() => [])
        await saveShowcase({
          id: crypto.randomUUID(),
          src: asset.mediaUrl,
          alt: altText || caption.slice(0, 120) || 'Custom celebration cake by CakeUWish',
          sortOrder: existing.length,
          visible: true,
          mediaType: asset.mediaType,
        })
      }
      const token = await accessToken()
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'publish',
          platforms: publishable,
          caption,
          altTextValue: altText,
          altText: sendAltToX,
          mediaType: asset.mediaType,
          mediaUrl: asset.mediaUrl,
          imageJpegUrl: asset.imageJpegUrl,
          coverUrl: asset.coverUrl,
          durationSecs: asset.durationSecs,
          showcaseId: shareId || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { targets?: Record<string, unknown>[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Publishing failed.')
      const rows = (data.targets ?? []).map(rowToTarget)
      setTargets(rows)
      setPostId(rows[0]?.postId ?? '')
      startedAt.current = Date.now()
      setStalled(false)
      setNotice('Sent — watch the status below.')
      listRecentPosts(20).then(setHistory).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publishing failed.')
    } finally {
      setPublishing(false)
    }
  }

  // ── the tick loop: advance in-flight platforms without blocking the page ──
  const tick = useCallback(
    async (act: 'tick' | 'retry' | 'manualDone' = 'tick', platform?: SocialPlatform) => {
      if (!postId) return
      setTicking(true)
      try {
        const token = await accessToken()
        const res = await fetch('/api/social', {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: act, postId, platform, altText: sendAltToX }),
        })
        const data = (await res.json().catch(() => ({}))) as { targets?: Record<string, unknown>[]; error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Status check failed.')
        setTargets((data.targets ?? []).map(rowToTarget))
        if (act !== 'tick') listRecentPosts(20).then(setHistory).catch(() => {})
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Status check failed.')
      } finally {
        setTicking(false)
      }
    },
    [postId, sendAltToX],
  )

  const busy = targets.some((t) => IN_FLIGHT.includes(t.status))
  useEffect(() => {
    if (!postId || !busy || stalled) return
    const id = setInterval(() => {
      // Nothing is lost when we stop — all state lives in Postgres, so "Check
      // again" picks up wherever the platforms got to.
      if (Date.now() - startedAt.current > 6 * 60 * 1000) {
        setStalled(true)
        return
      }
      tick()
    }, 5000)
    return () => clearInterval(id)
  }, [postId, busy, stalled, tick])

  const reset = () => {
    setFile(null)
    setAsset(null)
    setPreview('')
    setCaption('')
    setAltText('')
    setPostId('')
    setTargets([])
    setNotice('')
    setError('')
    if (shareId) setParams({}, { replace: true })
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (!platforms) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading…
      </div>
    )
  }

  const anyConnected = ORDER.some((p) => platforms[p]?.available && p !== 'whatsapp')

  return (
    <div>
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Send size={22} className="text-accent" /> Share a post
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload once — it goes to every connected network, and optionally onto the website gallery too.
        </p>
      </div>

      {!anyConnected && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          No networks are connected yet. Add the keys in <strong>Agency → Setup</strong>; until then you can still
          prepare a post and publish it by hand.
        </p>
      )}
      {notice && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ── composer ── */}
        <div className="h-fit rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">1. Pick a photo or video</h2>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onPick(e.target.files[0])
              e.target.value = ''
            }}
          />

          {preview ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted">
              {asset?.mediaType === 'video' || file?.type.startsWith('video/') ? (
                <video src={preview} className="max-h-72 w-full object-contain" controls muted playsInline />
              ) : (
                <img src={asset?.imageJpegUrl || preview} alt="" className="max-h-72 w-full object-contain" />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-sm text-muted-foreground hover:border-accent hover:text-accent"
            >
              <Upload size={22} /> Choose a file
            </button>
          )}

          {prepping && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={13} className="animate-spin" /> Preparing versions for each network…
            </p>
          )}
          {asset?.padded && (
            <p className="mt-2 text-xs text-muted-foreground">
              Instagram only accepts 4:5 to 1.91:1 — this is the padded version that will post.
            </p>
          )}
          {asset && asset.durationSecs > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Clip length: {asset.durationSecs.toFixed(1)}s</p>
          )}
          {preview && (
            <button type="button" onClick={reset} className="mt-2 text-xs text-muted-foreground underline">
              Start over
            </button>
          )}

          <h2 className="mt-6 font-display text-lg font-bold">2. Caption</h2>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Fresh out of the oven — a two-tier buttercream for Priya's 30th…"
            className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {ORDER.filter((p) => selected.has(p) && CAPTION_LIMIT[p]).map((p) => {
              const limit = CAPTION_LIMIT[p] as number
              const over = caption.length > limit
              return (
                <span key={p} className={over ? 'font-semibold text-amber-600' : 'text-muted-foreground'}>
                  {PLATFORM_LABEL[p]} {caption.length}/{limit}
                  {over ? ' — will be trimmed' : ''}
                </span>
              )
            })}
          </div>

          <label className="mt-3 block text-sm font-medium">
            Alt text <span className="font-normal text-muted-foreground">(accessibility)</span>
            <input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Two-tier ivory buttercream cake with gold leaf"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          {selected.has('x') && (
            <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={sendAltToX}
                onChange={(e) => setSendAltToX(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-accent)]"
              />
              Also send alt text to X — X bills this as a separate request (about $0.005).
            </label>
          )}
          {selected.has('x') && /https?:\/\//.test(caption) && (
            <p className="mt-2 text-xs text-amber-700">A link makes the X post cost roughly $0.20 instead of $0.015.</p>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={addToGallery}
              onChange={(e) => setAddToGallery(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Also add to the website gallery
          </label>
        </div>

        {/* ── destinations + status ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">3. Where it goes</h2>
            <ul className="mt-3 space-y-2">
              {ORDER.map((p) => {
                const Icon = ICON[p]
                const blocked = blockers[p]
                const manual = platforms[p]?.manual
                return (
                  <li key={p}>
                    <label
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                        blocked ? 'border-border bg-muted/40 opacity-70' : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p) && !blocked}
                        disabled={Boolean(blocked)}
                        onChange={() => toggle(p)}
                        className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Icon size={14} className="text-accent" /> {PLATFORM_LABEL[p]}
                          {manual && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              by hand
                            </span>
                          )}
                        </span>
                        {blocked && <span className="mt-0.5 block text-xs text-muted-foreground">{blocked}</span>}
                        {!blocked && manual && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            WhatsApp has no posting API — you'll get a copy-and-paste card.
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <button
              type="button"
              onClick={publish}
              disabled={publishing || prepping || !asset || !publishable.length}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {publishing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {publishing
                ? 'Publishing…'
                : publishable.length
                  ? `Publish to ${publishable.length} ${publishable.length === 1 ? 'place' : 'places'}`
                  : 'Publish'}
            </button>
          </div>

          {targets.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">Status</h2>
                {(busy || stalled) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStalled(false)
                      startedAt.current = Date.now()
                      tick()
                    }}
                    disabled={ticking}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={ticking ? 'animate-spin' : ''} /> Check again
                  </button>
                )}
              </div>
              {stalled && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Stopped watching after 6 minutes — nothing is lost, click “Check again” whenever you like.
                </p>
              )}
              <ul className="mt-3 divide-y divide-border">
                {targets.map((t) => (
                  <StatusRow
                    key={t.platform}
                    target={t}
                    caption={caption}
                    mediaUrl={asset?.mediaUrl ?? ''}
                    channelUrl={channelUrl}
                    busy={ticking}
                    onRetry={() => tick('retry', t.platform)}
                    onManualDone={() => tick('manualDone')}
                  />
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">Recent posts</h2>
              <ul className="mt-3 space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {h.mediaType === 'video' ? (
                        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Film size={16} />
                        </span>
                      ) : (
                        <img src={h.imageJpegUrl || h.mediaUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{h.caption || <em className="text-muted-foreground">No caption</em>}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {h.targets.map((t) => (
                          <span
                            key={t.platform}
                            title={t.error || t.status}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chipClass(t.status)}`}
                          >
                            {PLATFORM_LABEL[t.platform].split(' ')[0]} {t.status}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{h.createdAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function chipClass(status: string) {
  if (status === 'posted') return 'bg-green-100 text-green-900'
  if (status === 'failed') return 'bg-red-100 text-red-900'
  if (status === 'skipped') return 'bg-muted text-muted-foreground'
  if (status === 'manual') return 'bg-amber-100 text-amber-900'
  return 'bg-blue-100 text-blue-900'
}

function StatusRow({
  target,
  caption,
  mediaUrl,
  channelUrl,
  busy,
  onRetry,
  onManualDone,
}: {
  target: SocialTarget
  caption: string
  mediaUrl: string
  channelUrl: string
  busy: boolean
  onRetry: () => void
  onManualDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const Icon = ICON[target.platform]
  const inFlight = IN_FLIGHT.includes(target.status)

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {target.status === 'posted' ? (
          <CheckCircle2 size={16} className="shrink-0 text-green-700" />
        ) : target.status === 'failed' ? (
          <XCircle size={16} className="shrink-0 text-red-700" />
        ) : inFlight ? (
          <Loader2 size={16} className="shrink-0 animate-spin text-blue-700" />
        ) : (
          <Circle size={16} className="shrink-0 text-muted-foreground" />
        )}
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon size={14} className="text-accent" /> {PLATFORM_LABEL[target.platform]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${chipClass(target.status)}`}>{target.status}</span>
        {target.remoteUrl && (
          <a
            href={target.remoteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View post <ExternalLink size={11} />
          </a>
        )}
        {target.status === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={11} /> Retry {PLATFORM_LABEL[target.platform].split(' ')[0]}
          </button>
        )}
      </div>

      {target.error && <p className="mt-1.5 text-xs text-red-700">{target.error}</p>}

      {target.status === 'manual' && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p className="font-semibold">WhatsApp has no posting API — this one is 20 seconds by hand.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(caption).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
            >
              <Copy size={12} /> {copied ? 'Copied!' : 'Copy caption'}
            </button>
            {mediaUrl && (
              <a
                href={mediaUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
              >
                <Download size={12} /> Download media
              </a>
            )}
            {channelUrl && (
              <a
                href={channelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
              >
                <ExternalLink size={12} /> Open channel
              </a>
            )}
            <button
              type="button"
              onClick={onManualDone}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <CheckCircle2 size={12} /> Posted it
            </button>
          </div>
        </div>
      )}

      {target.status === 'skipped' && (
        <p className="mt-1 text-xs text-muted-foreground">Not connected on this site — add the keys in Setup.</p>
      )}
    </li>
  )
}
