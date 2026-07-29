import { getSupabase } from '../../lib/supabase'

// Reads for the cross-post history. All *writes* go through /api/social, which
// holds the platform keys — the browser never talks to X or Meta directly.

export type SocialPlatform = 'x' | 'facebook' | 'instagram' | 'whatsapp'
export type TargetStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'posted'
  | 'failed'
  | 'skipped'
  | 'manual'

export interface SocialTarget {
  id: string
  postId: string
  platform: SocialPlatform
  status: TargetStatus
  remoteId: string
  remoteUrl: string
  attempts: number
  error: string
  postedAt: string | null
}

export interface SocialPost {
  id: string
  createdAt: string
  caption: string
  altText: string
  mediaType: 'image' | 'video'
  mediaUrl: string
  imageJpegUrl: string
  coverUrl: string
  durationSecs: number
  showcaseId: string | null
  status: 'pending' | 'running' | 'done' | 'partial' | 'failed'
  targets: SocialTarget[]
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: 'X / Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
}

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

export function rowToTarget(r: Record<string, unknown>): SocialTarget {
  return {
    id: String(r.id ?? ''),
    postId: String(r.post_id ?? ''),
    platform: (r.platform as SocialPlatform) ?? 'x',
    status: (r.status as TargetStatus) ?? 'pending',
    remoteId: (r.remote_id as string) ?? '',
    remoteUrl: (r.remote_url as string) ?? '',
    attempts: Number(r.attempts) || 0,
    error: (r.error as string) ?? '',
    postedAt: (r.posted_at as string) ?? null,
  }
}

function rowToPost(r: Record<string, unknown>): SocialPost {
  const targets = Array.isArray(r.social_targets) ? (r.social_targets as Record<string, unknown>[]) : []
  return {
    id: String(r.id ?? ''),
    createdAt: (r.created_at as string) ?? '',
    caption: (r.caption as string) ?? '',
    altText: (r.alt_text as string) ?? '',
    mediaType: r.media_type === 'video' ? 'video' : 'image',
    mediaUrl: (r.media_url as string) ?? '',
    imageJpegUrl: (r.image_jpeg_url as string) ?? '',
    coverUrl: (r.cover_url as string) ?? '',
    durationSecs: Number(r.duration_secs) || 0,
    showcaseId: (r.showcase_id as string) ?? null,
    status: (r.status as SocialPost['status']) ?? 'pending',
    targets: targets.map(rowToTarget),
  }
}

/** Recent cross-posts with their per-platform rows, newest first. */
export async function listRecentPosts(limit = 20): Promise<SocialPost[]> {
  const { data, error } = await sb()
    .from('social_posts')
    .select('*, social_targets(*)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => rowToPost(r as Record<string, unknown>))
}

export async function getShowcaseItem(id: string) {
  const { data, error } = await sb().from('showcase_photos').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    src: (r.src as string) ?? '',
    alt: (r.alt as string) ?? '',
    mediaType: r.media_type === 'video' ? ('video' as const) : ('image' as const),
  }
}
