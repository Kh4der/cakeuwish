import { getSupabase } from '../lib/supabase'
import type { CakeContent, ShowcaseContent, SiteContent } from './types'

// DB row shapes (snake_case columns).
interface CakeRow {
  id: string
  title: string
  blurb: string | null
  category: string | null
  bg: string | null
  panel: string | null
  accent: string | null
  dark: boolean | null
  image: string
  sort_order: number | null
  visible: boolean | null
  flavor: string | null
  servings: string | null
  tags: string[] | null
  extra_images: string[] | null
}

interface ShowcaseRow {
  id: string
  src: string
  alt: string | null
  sort_order: number | null
  visible: boolean | null
  media_type: string | null
}

function toCake(r: CakeRow): CakeContent {
  return {
    id: r.id,
    title: r.title ?? '',
    blurb: r.blurb ?? '',
    category: r.category ?? '',
    bg: r.bg ?? '#F3EDE1',
    panel: r.panel ?? r.bg ?? '#F1EDE8',
    accent: r.accent ?? '#A16207',
    dark: Boolean(r.dark),
    image: r.image,
    sortOrder: r.sort_order ?? 0,
    visible: r.visible ?? true,
    flavor: r.flavor ?? '',
    servings: r.servings ?? '',
    tags: r.tags ?? [],
    extraImages: r.extra_images ?? [],
  }
}

function toShowcase(r: ShowcaseRow): ShowcaseContent {
  return {
    id: r.id,
    src: r.src,
    alt: r.alt ?? 'Custom celebration cake by CakeUWish',
    sortOrder: r.sort_order ?? 0,
    visible: r.visible ?? true,
    mediaType: r.media_type === 'video' ? 'video' : 'image',
  }
}

/**
 * Fetch the live, visible site content from Supabase. Returns null on any
 * failure or when nothing is seeded, so callers keep the bundled seed content.
 */
export async function fetchPublicContent(): Promise<SiteContent | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const [cakesRes, showRes] = await Promise.all([
      sb.from('cakes').select('*').eq('visible', true).order('sort_order', { ascending: true }),
      sb.from('showcase_photos').select('*').eq('visible', true).order('sort_order', { ascending: true }),
    ])
    if (cakesRes.error || showRes.error) return null
    const cakeRows = (cakesRes.data ?? []) as CakeRow[]
    const showRows = (showRes.data ?? []) as ShowcaseRow[]
    // If the cakes table is empty, the project isn't seeded yet — keep the seed.
    if (cakeRows.length === 0) return null
    return {
      cakes: cakeRows.map(toCake),
      showcase: showRows.map(toShowcase),
    }
  } catch {
    return null
  }
}
