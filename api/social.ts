import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomBytes } from 'node:crypto'

// Cross-posting fan-out. The admin composes once; this advances each platform's
// own little state machine, one step per call, writing progress to Postgres so
// nothing lives in a function's memory. ADMIN-ONLY (session-token verified).
//
// Every adapter is independently env-gated and independently wrapped: a missing
// key marks that platform 'skipped', a thrown adapter marks it 'failed', and
// neither can stop the others from publishing.
//
// Env (server-only):
//   TWITTER_CONSUMER_KEY/SECRET, TWITTER_ACCESS_TOKEN/SECRET  — X, already deployed
//   FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, [FB_GRAPH_VERSION]      — Facebook Page
//   IG_USER_ID, IG_ACCESS_TOKEN, [IG_USE_FACEBOOK_LOGIN]      — Instagram
// WhatsApp has no publishing API at any tier — it is modelled as a manual step.

const CK = process.env.TWITTER_CONSUMER_KEY
const CS = process.env.TWITTER_CONSUMER_SECRET
const AT = process.env.TWITTER_ACCESS_TOKEN
const AS = process.env.TWITTER_ACCESS_SECRET
const X_READY = Boolean(CK && CS && AT && AS)

const FB_PAGE_ID = process.env.FB_PAGE_ID
const FB_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const FB_READY = Boolean(FB_PAGE_ID && FB_TOKEN)

const IG_USER_ID = process.env.IG_USER_ID
const IG_TOKEN = process.env.IG_ACCESS_TOKEN
const IG_READY = Boolean(IG_USER_ID && IG_TOKEN)

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v25.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
// The Instagram-Login path talks to graph.instagram.com and needs no linked
// Facebook Page; the Facebook-Login path goes through the Graph API host.
const IG_GRAPH = process.env.IG_USE_FACEBOOK_LOGIN ? GRAPH : `https://graph.instagram.com/${GRAPH_VERSION}`

const SB_URL = process.env.VITE_SUPABASE_URL
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY

type Platform = 'x' | 'facebook' | 'instagram' | 'whatsapp'
const PLATFORMS: Platform[] = ['x', 'facebook', 'instagram', 'whatsapp']

interface PostRow {
  id: string
  caption: string
  alt_text: string
  media_type: 'image' | 'video'
  media_url: string
  image_jpeg_url: string
  cover_url: string
  duration_secs: number
}

interface TargetRow {
  id: string
  post_id: string
  platform: Platform
  status: string
  remote_id: string
  remote_url: string
  upload_ref: string
  attempts: number
  error: string
  next_poll_at: string | null
  posted_at: string | null
}

type Patch = Partial<Omit<TargetRow, 'id' | 'post_id' | 'platform'>>

// ── admin auth ──────────────────────────────────────────────────────────────
async function verifyAdmin(token: string): Promise<boolean> {
  if (!SB_URL || !SB_ANON || !token) return false
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

// ── PostgREST, using the admin's OWN jwt (resolves to `authenticated`) ───────
async function db<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_ANON as string,
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`db ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : null) as T
}

const patchTarget = (id: string, token: string, patch: Patch) =>
  db<TargetRow[]>(`social_targets?id=eq.${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) })

/** Keep messages short and RAW — the platform's own words debug faster than ours. */
const fail = (e: unknown): Patch => ({
  status: 'failed',
  error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
})

// X bills per request since Feb 2026: a plain post is ~$0.015, but a post whose
// text contains a URL is charged at the much higher link rate. Meta publishing
// is free. Estimates only — the provider's invoice is the source of truth.
const X_POST_COST = 0.015
const X_LINK_POST_COST = 0.2

/** Fire-and-forget cost metering into usage_log (Admin → Insights → API costs). */
function logUsage(provider: string, detail: string, cost: number): void {
  if (!SB_URL || !SB_ANON) return
  fetch(`${SB_URL}/rest/v1/usage_log`, {
    method: 'POST',
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      service: 'social',
      quantity: 1,
      est_cost: Math.min(100, cost),
      provider,
      detail: detail.slice(0, 200),
    }),
  }).catch(() => {})
}

// ── OAuth 1.0a (same signer as api/twitter.ts; api/* cannot import from src) ─
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/**
 * OAuth 1.0a HMAC-SHA1 header. Query params join the signature base string;
 * JSON *and multipart* bodies do not — which is why the media upload calls can
 * reuse this untouched, and why the STATUS poll (a GET with real query params)
 * is the one call that must pass them in.
 */
function oauthHeader(method: 'GET' | 'POST', url: string, query: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CK as string,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: AT as string,
    oauth_version: '1.0',
  }
  const all: Record<string, string> = { ...oauth, ...query }
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join('&')
  const base = `${method}&${enc(url)}&${enc(paramString)}`
  const signingKey = `${enc(CS as string)}&${enc(AS as string)}`
  const signature = createHmac('sha1', signingKey).update(base).digest('base64')
  const header: Record<string, string> = { ...oauth, oauth_signature: signature }
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${enc(k)}="${enc(header[k])}"`)
    .join(', ')}`
}

/** X request. Pass FormData to send multipart — we must NOT set content-type
 *  ourselves, or fetch can't append the boundary it generates. */
async function xFetch(
  method: 'GET' | 'POST',
  url: string,
  query: Record<string, string> = {},
  body?: unknown,
): Promise<Response> {
  const qs = Object.keys(query).length
    ? '?' + Object.entries(query).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&')
    : ''
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  return fetch(url + qs, {
    method,
    headers: {
      Authorization: oauthHeader(method, url, query),
      ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
    },
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  })
}

async function xJson(res: Response, what: string): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!res.ok) {
    if (res.status === 402) {
      throw new Error(`X ${what}: out of API credits — top up in the X developer console (no free tier since Feb 2026).`)
    }
    if (res.status === 403) {
      throw new Error(
        `X ${what}: 403 — the app must sit in a Project on a PRODUCTION environment with Read+Write, and the access token must be regenerated after any permission change. ${text.slice(0, 200)}`,
      )
    }
    throw new Error(`X ${what}: ${res.status} ${text.slice(0, 300)}`)
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

const MEDIA_BASE = 'https://api.x.com/2/media/upload'
const CHUNK = 4 * 1024 * 1024 // under X's 5 MB per-append hard cap

async function fetchMedia(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not read the media from storage (${res.status})`)
  return { bytes: await res.arrayBuffer(), type: res.headers.get('content-type') || 'application/octet-stream' }
}

/** Upload bytes to X and return the media id (a STRING — these are 64-bit). */
async function xUploadMedia(post: PostRow): Promise<{ mediaId: string; processing: boolean }> {
  const isVideo = post.media_type === 'video'
  const src = isVideo ? post.media_url : post.image_jpeg_url || post.media_url
  const { bytes, type } = await fetchMedia(src)

  if (!isVideo) {
    const form = new FormData()
    form.append('media', new Blob([bytes], { type }), 'image.jpg')
    form.append('media_category', 'tweet_image')
    const json = await xJson(await xFetch('POST', MEDIA_BASE, {}, form), 'media upload')
    const id = (json.data as { id?: string } | undefined)?.id
    if (!id) throw new Error('X media upload returned no id')
    return { mediaId: String(id), processing: false }
  }

  const init = await xJson(
    await xFetch('POST', `${MEDIA_BASE}/initialize`, {}, {
      media_type: type,
      total_bytes: bytes.byteLength,
      media_category: 'tweet_video',
    }),
    'media initialize',
  )
  const mediaId = String((init.data as { id?: string } | undefined)?.id ?? '')
  if (!mediaId) throw new Error('X media initialize returned no id')

  for (let i = 0, seg = 0; i < bytes.byteLength; i += CHUNK, seg++) {
    const form = new FormData()
    form.append('media', new Blob([bytes.slice(i, i + CHUNK)], { type: 'application/octet-stream' }), 'chunk')
    form.append('segment_index', String(seg))
    await xJson(await xFetch('POST', `${MEDIA_BASE}/${mediaId}/append`, {}, form), `media append ${seg}`)
  }

  const fin = await xJson(await xFetch('POST', `${MEDIA_BASE}/${mediaId}/finalize`, {}, {}), 'media finalize')
  const state = ((fin.data as { processing_info?: { state?: string } } | undefined)?.processing_info?.state) ?? ''
  return { mediaId, processing: state !== '' && state !== 'succeeded' }
}

async function xSetAltText(mediaId: string, alt: string): Promise<void> {
  // Metered separately from the post write, so this is opt-in from the UI.
  await xFetch('POST', 'https://api.x.com/2/media/metadata', {}, {
    id: mediaId,
    metadata: { alt_text: { text: alt.slice(0, 1000) } },
  })
}

async function xTweet(post: PostRow, mediaId: string): Promise<Patch> {
  const payload: Record<string, unknown> = { text: post.caption.slice(0, 280) }
  if (mediaId) payload.media = { media_ids: [mediaId] }
  const json = await xJson(await xFetch('POST', 'https://api.x.com/2/tweets', {}, payload), 'post')
  const id = String((json.data as { id?: string } | undefined)?.id ?? '')
  const hasLink = /https?:\/\//.test(post.caption)
  logUsage('x', hasLink ? 'Post with link (link rate)' : 'Post', hasLink ? X_LINK_POST_COST : X_POST_COST)
  return {
    status: 'posted',
    remote_id: id,
    remote_url: id ? `https://x.com/i/web/status/${id}` : '',
    posted_at: new Date().toISOString(),
    error: '',
  }
}

// ── Meta helpers ────────────────────────────────────────────────────────────
async function graph(
  url: string,
  params: Record<string, string>,
  token: string,
  method: 'GET' | 'POST' = 'POST',
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: token })
  const res =
    method === 'GET'
      ? await fetch(`${url}?${body.toString()}`)
      : await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
  const text = await res.text()
  if (!res.ok) {
    let msg = text.slice(0, 300)
    try {
      const err = (JSON.parse(text) as { error?: { message?: string; code?: number; error_subcode?: number } }).error
      if (err) {
        msg = err.message ?? msg
        // 190 = token dead: password change, revoked app, lost Page role.
        if (err.code === 190) msg = `Reconnect required — the access token is no longer valid. (${msg})`
      }
    } catch {
      /* keep the raw text */
    }
    throw new Error(msg)
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

// ── per-platform forward step ───────────────────────────────────────────────
// Each returns the patch to write. Called for both the initial publish and each
// subsequent tick; the target's own status decides which branch runs.

async function stepX(post: PostRow, t: TargetRow, altText: boolean): Promise<Patch> {
  if (t.status === 'processing' && t.upload_ref) {
    const json = await xJson(
      await xFetch('GET', MEDIA_BASE, { command: 'STATUS', media_id: t.upload_ref }),
      'media status',
    )
    const info = (json.data as { processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } } } | undefined)
      ?.processing_info
    const state = info?.state ?? 'succeeded'
    if (state === 'failed') throw new Error(info?.error?.message ?? 'X could not process that video')
    if (state !== 'succeeded') {
      const wait = info?.check_after_secs ?? 5
      return { status: 'processing', next_poll_at: new Date(Date.now() + wait * 1000).toISOString() }
    }
    if (altText && post.alt_text) await xSetAltText(t.upload_ref, post.alt_text)
    return xTweet(post, t.upload_ref)
  }

  const { mediaId, processing } = await xUploadMedia(post)
  if (processing) {
    return { status: 'processing', upload_ref: mediaId, next_poll_at: new Date(Date.now() + 5000).toISOString() }
  }
  if (altText && post.alt_text) await xSetAltText(mediaId, post.alt_text)
  return xTweet(post, mediaId)
}

async function stepFacebook(post: PostRow, t: TargetRow): Promise<Patch> {
  const token = FB_TOKEN as string

  if (t.status === 'processing' && t.upload_ref) {
    const json = await graph(`${GRAPH}/${t.upload_ref}`, { fields: 'status,permalink_url' }, token, 'GET')
    const phase = (json.status as { publishing_phase?: { status?: string; publish_status?: string } } | undefined)
      ?.publishing_phase
    const st = phase?.publish_status ?? phase?.status ?? ''
    if (/error/i.test(st)) throw new Error(`Facebook could not process the video (${st})`)
    if (st !== 'published' && st !== 'complete') {
      return { status: 'processing', next_poll_at: new Date(Date.now() + 8000).toISOString() }
    }
    return {
      status: 'posted',
      remote_url: String(json.permalink_url ?? `https://facebook.com/${t.upload_ref}`),
      posted_at: new Date().toISOString(),
      error: '',
    }
  }

  if (post.media_type === 'video') {
    // Meta fetches the file itself from our public bucket — no upload protocol.
    const json = await graph(
      `${GRAPH}/${FB_PAGE_ID}/videos`,
      { file_url: post.media_url, description: post.caption },
      token,
    )
    const id = String(json.id ?? '')
    if (!id) throw new Error('Facebook returned no video id')
    return { status: 'processing', upload_ref: id, remote_id: id, next_poll_at: new Date(Date.now() + 8000).toISOString() }
  }

  const src = post.image_jpeg_url || post.media_url
  // `caption` — NOT `message`, which is deprecated on the /photos edge.
  const json = await graph(`${GRAPH}/${FB_PAGE_ID}/photos`, { url: src, caption: post.caption }, token)
  const postId = String(json.post_id ?? json.id ?? '')
  logUsage('facebook', 'Page photo post', 0) // Meta publishing is free
  return {
    status: 'posted',
    remote_id: postId,
    remote_url: postId ? `https://facebook.com/${postId}` : '',
    posted_at: new Date().toISOString(),
    error: '',
  }
}

async function stepInstagram(post: PostRow, t: TargetRow): Promise<Patch> {
  const token = IG_TOKEN as string
  const base = `${IG_GRAPH}/${IG_USER_ID}`

  if (t.status === 'processing' && t.upload_ref) {
    // `status` alongside `status_code` — the code alone never says WHY it failed.
    const json = await graph(`${IG_GRAPH}/${t.upload_ref}`, { fields: 'status_code,status' }, token, 'GET')
    const code = String(json.status_code ?? '')
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(String(json.status ?? `Instagram rejected the media (${code})`))
    }
    if (code !== 'FINISHED') {
      return { status: 'processing', next_poll_at: new Date(Date.now() + 10000).toISOString() }
    }
    const pub = await graph(`${base}/media_publish`, { creation_id: t.upload_ref }, token)
    const mediaId = String(pub.id ?? '')
    logUsage('instagram', post.media_type === 'video' ? 'Reel' : 'Photo post', 0) // free
    let link = ''
    try {
      const meta = await graph(`${IG_GRAPH}/${mediaId}`, { fields: 'permalink' }, token, 'GET')
      link = String(meta.permalink ?? '')
    } catch {
      /* the post is live either way — a missing permalink is cosmetic */
    }
    return { status: 'posted', remote_id: mediaId, remote_url: link, posted_at: new Date().toISOString(), error: '' }
  }

  const params: Record<string, string> = { caption: post.caption.slice(0, 2200) }
  if (post.media_type === 'video') {
    // REELS, not VIDEO — standalone feed video is deprecated and errors.
    params.media_type = 'REELS'
    params.video_url = post.media_url
    params.share_to_feed = 'true'
    if (post.cover_url) params.cover_url = post.cover_url
  } else {
    if (!post.image_jpeg_url) throw new Error('Instagram needs a JPEG version of this image — re-upload it from Compose.')
    params.image_url = post.image_jpeg_url
    if (post.alt_text) params.alt_text = post.alt_text.slice(0, 1000)
  }
  const json = await graph(`${base}/media`, params, token)
  const containerId = String(json.id ?? '')
  if (!containerId) throw new Error('Instagram returned no container id')
  // Always poll, photos included — publishing an unfinished container is the
  // classic "works for photos, breaks for reels" bug.
  return { status: 'processing', upload_ref: containerId, next_poll_at: new Date(Date.now() + 4000).toISOString() }
}

const READY: Record<Platform, boolean> = {
  x: X_READY,
  facebook: FB_READY,
  instagram: IG_READY,
  whatsapp: true, // always available — it is a manual checklist item
}

async function step(post: PostRow, t: TargetRow, altText: boolean): Promise<Patch> {
  if (t.platform === 'whatsapp') return { status: 'manual' }
  if (!READY[t.platform]) return { status: 'skipped', error: 'Not connected — add the keys in Setup.' }
  if (t.platform === 'x') return stepX(post, t, altText)
  if (t.platform === 'facebook') return stepFacebook(post, t)
  return stepInstagram(post, t)
}

/** Advance one target, swallowing its failure into its own row. */
async function advance(post: PostRow, t: TargetRow, token: string, altText: boolean): Promise<TargetRow> {
  let patch: Patch
  try {
    patch = await step(post, t, altText)
  } catch (e) {
    patch = fail(e)
  }
  patch.attempts = (t.attempts ?? 0) + 1
  const rows = await patchTarget(t.id, token, patch).catch(() => null)
  return rows?.[0] ?? { ...t, ...patch }
}

const rollup = (targets: TargetRow[]): string => {
  const live = targets.filter((t) => t.status !== 'skipped')
  if (live.some((t) => ['pending', 'uploading', 'processing'].includes(t.status))) return 'running'
  const done = live.filter((t) => t.status === 'posted' || t.status === 'manual').length
  if (done === 0) return 'failed'
  return done === live.length ? 'done' : 'partial'
}

async function finish(postId: string, targets: TargetRow[], token: string, res: VercelResponse) {
  await db(`social_posts?id=eq.${postId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: rollup(targets) }),
  }).catch(() => null)
  return res.status(200).json({ ok: true, targets })
}

// ── handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!(await verifyAdmin(token))) return res.status(401).json({ error: 'Sign in to the admin panel first.' })

  try {
    if (req.method === 'GET') {
      // Which networks this deployment can reach — booleans only, never values.
      return res.status(200).json({
        configured: true,
        platforms: {
          x: { available: X_READY, manual: false },
          facebook: { available: FB_READY, manual: false },
          instagram: { available: IG_READY, manual: false },
          whatsapp: { available: true, manual: true },
        },
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const body = (req.body ?? {}) as Record<string, unknown>
    const action = String(body.action ?? '')
    const altText = Boolean(body.altText)

    // ── publish: create the post + one row per platform, then one step each ──
    if (action === 'publish') {
      const wanted = Array.isArray(body.platforms) ? (body.platforms as string[]).filter((p) => PLATFORMS.includes(p as Platform)) : []
      if (!wanted.length) return res.status(400).json({ error: 'Pick at least one platform.' })
      const mediaUrl = String(body.mediaUrl ?? '')
      if (!/^https?:\/\//.test(mediaUrl)) {
        return res.status(400).json({ error: 'That media is a built-in sample — upload your own photo to share it.' })
      }

      const [post] = await db<PostRow[]>('social_posts', token, {
        method: 'POST',
        body: JSON.stringify({
          caption: String(body.caption ?? ''),
          alt_text: String(body.altTextValue ?? ''),
          media_type: body.mediaType === 'video' ? 'video' : 'image',
          media_url: mediaUrl,
          image_jpeg_url: String(body.imageJpegUrl ?? ''),
          cover_url: String(body.coverUrl ?? ''),
          duration_secs: Number(body.durationSecs) || 0,
          showcase_id: body.showcaseId ? String(body.showcaseId) : null,
          status: 'running',
        }),
      })

      const created = await db<TargetRow[]>('social_targets', token, {
        method: 'POST',
        body: JSON.stringify(wanted.map((platform) => ({ post_id: post.id, platform }))),
      })

      const targets = await Promise.all(created.map((t) => advance(post, t, token, altText)))
      return finish(post.id, targets, token, res)
    }

    // ── tick: advance everything still in flight ────────────────────────────
    if (action === 'tick' || action === 'retry') {
      const postId = String(body.postId ?? '')
      if (!postId) return res.status(400).json({ error: 'Missing postId.' })
      const [post] = await db<PostRow[]>(`social_posts?id=eq.${postId}&select=*`, token)
      if (!post) return res.status(404).json({ error: 'Post not found.' })
      const all = await db<TargetRow[]>(`social_targets?post_id=eq.${postId}&select=*`, token)

      let due: TargetRow[]
      if (action === 'retry') {
        const platform = String(body.platform ?? '')
        const row = all.find((t) => t.platform === platform)
        if (!row) return res.status(404).json({ error: 'That platform is not on this post.' })
        // Retrying one platform never touches the others — that is what the
        // unique (post_id, platform) row is for.
        const [reset] = await patchTarget(row.id, token, {
          status: 'pending',
          error: '',
          upload_ref: '',
          next_poll_at: null,
        })
        due = [reset ?? row]
      } else {
        const now = Date.now()
        due = all.filter(
          (t) =>
            ['pending', 'uploading', 'processing'].includes(t.status) &&
            (!t.next_poll_at || Date.parse(t.next_poll_at) <= now),
        )
      }

      const advanced = await Promise.all(due.map((t) => advance(post, t, token, altText)))
      const merged = all.map((t) => advanced.find((a) => a.platform === t.platform) ?? t)
      return finish(postId, merged, token, res)
    }

    // ── manual: tick off the WhatsApp card ──────────────────────────────────
    if (action === 'manualDone') {
      const postId = String(body.postId ?? '')
      const [row] = await db<TargetRow[]>(
        `social_targets?post_id=eq.${postId}&platform=eq.whatsapp&select=*`,
        token,
      )
      if (!row) return res.status(404).json({ error: 'No WhatsApp step on this post.' })
      await patchTarget(row.id, token, { status: 'posted', posted_at: new Date().toISOString() })
      const all = await db<TargetRow[]>(`social_targets?post_id=eq.${postId}&select=*`, token)
      return finish(postId, all, token, res)
    }

    return res.status(400).json({ error: 'Unknown action.' })
  } catch (e) {
    console.error('social handler', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Cross-post request failed.' })
  }
}
