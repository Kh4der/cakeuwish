import { getSupabase } from './supabase'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function fit(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h }
  const r = Math.min(max / w, max / h)
  return { width: Math.round(w * r), height: Math.round(h * r) }
}

/**
 * Resize + re-encode an uploaded image to webp in the browser. Transparency is
 * preserved (canvas webp keeps the alpha channel), so transparent cake cutouts
 * stay transparent.
 */
export async function fileToWebp(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const img = await loadImage(file)
  const { width, height } = fit(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, width, height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))),
      'image/webp',
      quality,
    )
  })
}

// ── social derivatives ──────────────────────────────────────────────────────
// Instagram rejects webp and png outright, and refuses anything outside a
// 4:5–1.91:1 aspect window; Facebook doesn't list webp either. So every image
// that might be cross-posted gets a JPEG sibling, padded into that window when
// the original falls outside it. All in-browser — no server transcode, no sharp.

const IG_MIN_ASPECT = 0.8 // 4:5, the tallest Instagram accepts
const IG_MAX_ASPECT = 1.91 // 1.91:1, the widest

/** Canvas box that holds `w`×`h` inside Instagram's aspect window. */
function socialBox(w: number, h: number, max: number) {
  const aspect = w / h
  let boxW = w
  let boxH = h
  if (aspect < IG_MIN_ASPECT) boxW = Math.round(h * IG_MIN_ASPECT)
  else if (aspect > IG_MAX_ASPECT) boxH = Math.round(w / IG_MAX_ASPECT)
  const scale = Math.min(1, max / boxW, max / boxH)
  return {
    boxW: Math.round(boxW * scale),
    boxH: Math.round(boxH * scale),
    drawW: Math.round(w * scale),
    drawH: Math.round(h * scale),
    padded: boxW !== w || boxH !== h,
  }
}

function drawSocialJpeg(img: HTMLImageElement | HTMLVideoElement, w: number, h: number, max: number, quality: number) {
  const { boxW, boxH, drawW, drawH, padded } = socialBox(w, h, max)
  const canvas = document.createElement('canvas')
  canvas.width = boxW
  canvas.height = boxH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  // JPEG has no alpha: without this, transparent cake cutouts render black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, boxW, boxH)
  ctx.drawImage(img, Math.round((boxW - drawW) / 2), Math.round((boxH - drawH) / 2), drawW, drawH)
  return new Promise<{ blob: Blob; padded: boolean; width: number; height: number }>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve({ blob: b, padded, width: boxW, height: boxH }) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export interface SocialImage {
  blob: Blob
  /** true when the source was letterboxed/pillarboxed to fit Instagram */
  padded: boolean
  width: number
  height: number
}

/** Meta-safe JPEG derivative of a freshly picked file. */
export async function fileToSocialJpeg(file: File, maxDim = 1440, quality = 0.85): Promise<SocialImage> {
  const img = await loadImage(file)
  return drawSocialJpeg(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim, quality)
}

/**
 * Same, but for an image already sitting in storage — legacy showcase rows have
 * only a webp. Needs a CORS-readable URL or the canvas is tainted.
 */
export async function urlToSocialJpeg(src: string, maxDim = 1440, quality = 0.85): Promise<SocialImage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not read that image for cross-posting'))
    el.src = src
  })
  return drawSocialJpeg(img, img.naturalWidth, img.naturalHeight, maxDim, quality)
}

export async function uploadSocialJpeg(bucket: string, blob: Blob): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const name = `${crypto.randomUUID()}-social.jpg`
  const { error } = await sb.storage.from(bucket).upload(name, blob, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw error
  return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl
}

export interface VideoProbe {
  durationSecs: number
  width: number
  height: number
  /** poster frame as a Meta-safe JPEG, or null when the frame couldn't be read */
  poster: Blob | null
}

/**
 * Read a clip's duration and dimensions, and grab a poster frame — the pre-flight
 * checks (Instagram's 3s floor, X's 140s ceiling) need these before we spend an
 * API round trip, and Instagram wants a cover image.
 */
export async function videoProbe(file: File): Promise<VideoProbe> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.muted = true
  v.playsInline = true
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve()
      v.onerror = () => reject(new Error('Could not read that video'))
      v.src = url
    })
    const durationSecs = Number.isFinite(v.duration) ? v.duration : 0
    const width = v.videoWidth
    const height = v.videoHeight
    let poster: Blob | null = null
    try {
      await new Promise<void>((resolve, reject) => {
        v.onseeked = () => resolve()
        v.onerror = () => reject(new Error('seek failed'))
        v.currentTime = Math.min(1, durationSecs / 2)
      })
      poster = (await drawSocialJpeg(v, width, height, 1440, 0.85)).blob
    } catch {
      // A poster is a nice-to-have; Instagram picks its own frame without one.
    }
    return { durationSecs, width, height, poster }
  } finally {
    URL.revokeObjectURL(url)
    v.src = ''
  }
}

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // Supabase free-tier per-file ceiling

/**
 * Upload a short video clip as-is (no transcoding in the browser). Returns the
 * public URL. Keep clips small — they stream straight to visitors.
 */
export async function uploadVideo(bucket: string, file: File): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  if (!VIDEO_TYPES.includes(file.type)) throw new Error('Use an MP4, WebM, or MOV video')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Videos must be under 50 MB — trim or compress the clip')
  const ext = file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4'
  const name = `${crypto.randomUUID()}.${ext}`
  const { error } = await sb.storage.from(bucket).upload(name, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw error
  return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl
}

/**
 * Optimize + upload an image to a Supabase Storage bucket. Returns the public
 * URL to store in the cakes/showcase row.
 */
export async function uploadImage(
  bucket: string,
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase is not configured')
  const webp = await fileToWebp(file, maxDim, quality)
  const name = `${crypto.randomUUID()}.webp`
  const { error } = await sb.storage.from(bucket).upload(name, webp, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw error
  return sb.storage.from(bucket).getPublicUrl(name).data.publicUrl
}
