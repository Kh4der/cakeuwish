import { getSupabase } from '../../lib/supabase'
import type { CakeContent, Inquiry, InquiryStatus, PricingItemContent, ShowcaseContent } from '../../content/types'

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase is not configured')
  return c
}

// ---- mapping between camelCase app types and snake_case DB rows ----
function rowToCake(r: Record<string, unknown>): CakeContent {
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    blurb: (r.blurb as string) ?? '',
    category: (r.category as string) ?? '',
    bg: (r.bg as string) ?? '#F3EDE1',
    panel: (r.panel as string) ?? (r.bg as string) ?? '#F1EDE8',
    accent: (r.accent as string) ?? '#A16207',
    dark: Boolean(r.dark),
    image: (r.image as string) ?? '',
    sortOrder: (r.sort_order as number) ?? 0,
    visible: r.visible == null ? true : Boolean(r.visible),
    flavor: (r.flavor as string) ?? '',
    servings: (r.servings as string) ?? '',
    tags: (r.tags as string[]) ?? [],
    extraImages: (r.extra_images as string[]) ?? [],
  }
}

function cakeToRow(c: CakeContent) {
  return {
    id: c.id,
    title: c.title,
    blurb: c.blurb,
    category: c.category,
    bg: c.bg,
    panel: c.panel,
    accent: c.accent,
    dark: c.dark,
    image: c.image,
    sort_order: c.sortOrder,
    visible: c.visible,
    flavor: c.flavor,
    servings: c.servings,
    tags: c.tags,
    extra_images: c.extraImages,
  }
}

function rowToShowcase(r: Record<string, unknown>): ShowcaseContent {
  return {
    id: r.id as string,
    src: (r.src as string) ?? '',
    alt: (r.alt as string) ?? '',
    sortOrder: (r.sort_order as number) ?? 0,
    visible: r.visible == null ? true : Boolean(r.visible),
    mediaType: r.media_type === 'video' ? 'video' : 'image',
  }
}

function showcaseToRow(s: ShowcaseContent) {
  return {
    id: s.id,
    src: s.src,
    alt: s.alt,
    sort_order: s.sortOrder,
    visible: s.visible,
    media_type: s.mediaType,
  }
}

// ---- cakes ----
export async function listCakes(): Promise<CakeContent[]> {
  const { data, error } = await sb().from('cakes').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToCake)
}

export async function saveCake(c: CakeContent): Promise<void> {
  const { error } = await sb().from('cakes').upsert(cakeToRow(c))
  if (error) throw error
}

export async function deleteCake(id: string): Promise<void> {
  const { error } = await sb().from('cakes').delete().eq('id', id)
  if (error) throw error
}

// ---- showcase ----
export async function listShowcase(): Promise<ShowcaseContent[]> {
  const { data, error } = await sb()
    .from('showcase_photos')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToShowcase)
}

export async function saveShowcase(s: ShowcaseContent): Promise<void> {
  const { error } = await sb().from('showcase_photos').upsert(showcaseToRow(s))
  if (error) throw error
}

export async function deleteShowcase(id: string): Promise<void> {
  const { error } = await sb().from('showcase_photos').delete().eq('id', id)
  if (error) throw error
}

/** Persist new sort_order for a batch of rows (used by reordering). */
export async function reorderCakes(items: CakeContent[]): Promise<void> {
  await Promise.all(items.map((c, i) => saveCake({ ...c, sortOrder: i })))
}

export async function reorderShowcase(items: ShowcaseContent[]): Promise<void> {
  await Promise.all(items.map((s, i) => saveShowcase({ ...s, sortOrder: i })))
}

// ---- inquiries ----
function rowToInquiry(r: Record<string, unknown>): Inquiry {
  return {
    id: r.id as string,
    kind: (r.kind as Inquiry['kind']) ?? 'quote',
    name: (r.name as string) ?? '',
    phone: (r.phone as string) ?? '',
    email: (r.email as string) ?? '',
    eventDate: (r.event_date as string) ?? '',
    pickupDate: (r.pickup_date as string) ?? '',
    occasion: (r.occasion as string) ?? '',
    theme: (r.theme as string) ?? '',
    servings: (r.servings as string) ?? '',
    flavor: (r.flavor as string) ?? '',
    budget: (r.budget as string) ?? '',
    dietary: (r.dietary as string) ?? '',
    message: (r.message as string) ?? '',
    cakeId: (r.cake_id as string) ?? null,
    cakeTitle: (r.cake_title as string) ?? '',
    photos: (r.photos as string[]) ?? [],
    pickupSlot: (r.pickup_slot as string) ?? '',
    preferredTime: (r.preferred_time as string) ?? '',
    status: (r.status as InquiryStatus) ?? 'new',
    adminNotes: (r.admin_notes as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
  }
}

export async function listInquiries(): Promise<Inquiry[]> {
  const { data, error } = await sb()
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInquiry)
}

export async function updateInquiry(
  id: string,
  patch: { status?: InquiryStatus; adminNotes?: string },
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.adminNotes !== undefined) row.admin_notes = patch.adminNotes
  const { error } = await sb().from('inquiries').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteInquiry(id: string): Promise<void> {
  const { error } = await sb().from('inquiries').delete().eq('id', id)
  if (error) throw error
}

// ---- pricing ----
function rowToPricing(r: Record<string, unknown>): PricingItemContent {
  return {
    id: r.id as string,
    section: r.section === 'addon' ? 'addon' : 'starting',
    item: (r.item as string) ?? '',
    detail: (r.detail as string) ?? '',
    price: (r.price as string) ?? null,
    sortOrder: (r.sort_order as number) ?? 0,
    visible: r.visible == null ? true : Boolean(r.visible),
  }
}

export async function listPricing(): Promise<PricingItemContent[]> {
  const { data, error } = await sb()
    .from('pricing_items')
    .select('*')
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToPricing)
}

export async function savePricingItem(p: PricingItemContent): Promise<void> {
  const { error } = await sb().from('pricing_items').upsert({
    id: p.id,
    section: p.section,
    item: p.item,
    detail: p.detail,
    price: p.price === '' ? null : p.price,
    sort_order: p.sortOrder,
    visible: p.visible,
  })
  if (error) throw error
}

export async function deletePricingItem(id: string): Promise<void> {
  const { error } = await sb().from('pricing_items').delete().eq('id', id)
  if (error) throw error
}

export async function reorderPricing(items: PricingItemContent[]): Promise<void> {
  await Promise.all(items.map((p, i) => savePricingItem({ ...p, sortOrder: i })))
}
