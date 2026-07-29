import { getSupabase } from './supabase'
import { fileToWebp } from './image'
import { WHATSAPP_URL } from '../data/cakes'

// Public-side inquiry submission (quote requests + contact messages).
// Reached only via dynamic import from the forms, so supabase-js stays out of
// the public entry chunk. When Supabase isn't configured the forms fall back
// to composing a WhatsApp message instead (see waLink below).

export const BUCKET_INSPIRATION = 'inspiration'

export interface InquiryDraft {
  kind: 'quote' | 'contact' | 'callback'
  name: string
  phone: string
  email: string
  eventDate: string
  pickupDate: string
  occasion: string
  theme: string
  servings: string
  flavor: string
  budget: string
  dietary: string
  message: string
  cakeId: string | null
  cakeTitle: string
  photos: string[]
  /** Preferred pickup window — optional so older draft call sites keep compiling. */
  pickupSlot?: string
  /** Callback time window (kind 'callback') — optional, column from migration 0007. */
  preferredTime?: string
}

/** Resize + upload one inspiration photo; returns its public URL. */
export async function uploadInspirationPhoto(file: File): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('Uploads are not available right now')
  const webp = await fileToWebp(file, 1600, 0.82)
  const name = `${crypto.randomUUID()}.webp`
  const { error } = await sb.storage.from(BUCKET_INSPIRATION).upload(name, webp, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw error
  return sb.storage.from(BUCKET_INSPIRATION).getPublicUrl(name).data.publicUrl
}

/** Insert the inquiry. Throws when Supabase is unconfigured or rejects it. */
export async function submitInquiry(d: InquiryDraft): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('not-configured')
  const { error } = await sb.from('inquiries').insert({
    kind: d.kind,
    name: d.name,
    phone: d.phone,
    email: d.email,
    event_date: d.eventDate || null,
    pickup_date: d.pickupDate || null,
    occasion: d.occasion,
    theme: d.theme,
    servings: d.servings,
    flavor: d.flavor,
    budget: d.budget,
    dietary: d.dietary,
    message: d.message,
    cake_id: d.cakeId,
    cake_title: d.cakeTitle,
    photos: d.photos,
    // Optional columns sent only when set — keeps inserts working on a DB that
    // hasn't run the later migrations that add them.
    ...(d.pickupSlot ? { pickup_slot: d.pickupSlot } : {}),
    ...(d.preferredTime ? { preferred_time: d.preferredTime } : {}),
  })
  if (error) throw error
}

/** Compose a WhatsApp deep link carrying the whole request as text. */
export function waLink(d: InquiryDraft): string {
  const lines =
    d.kind === 'callback'
      ? [
          `Hi! Please call me back about a cake.`,
          d.preferredTime && `Best time: ${d.preferredTime}`,
          d.message && `About: ${d.message}`,
          `— ${d.name}${d.phone ? ` (${d.phone})` : ''}`,
        ]
      : d.kind === 'contact'
      ? [
          `Hi! I'm ${d.name}.`,
          d.message,
          d.email && `Email: ${d.email}`,
        ]
      : [
          `Hi! I'd like a quote for a custom cake.`,
          d.cakeTitle && `Inspired by: "${d.cakeTitle}"`,
          d.occasion && `Occasion: ${d.occasion}`,
          d.theme && `Theme: ${d.theme}`,
          d.eventDate && `Event date: ${d.eventDate}`,
          d.pickupDate && `Pickup: ${d.pickupDate}`,
          d.pickupSlot && `Pickup window: ${d.pickupSlot}`,
          d.servings && `Servings: ${d.servings}`,
          d.flavor && `Flavor: ${d.flavor}`,
          d.dietary && `Dietary: ${d.dietary}`,
          d.budget && `Budget: ${d.budget}`,
          d.message && `Notes: ${d.message}`,
          `— ${d.name}${d.phone ? ` (${d.phone})` : ''}`,
        ]
  const text = lines.filter(Boolean).join('\n')
  return `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`
}
