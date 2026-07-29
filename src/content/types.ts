// Shared content shapes for the public site + admin panel.
// These mirror the Supabase tables (snake_case columns are mapped in fetchContent.ts).

export interface CakeContent {
  id: string
  title: string
  blurb: string
  category: string
  /** dynamic hero background tint */
  bg: string
  /** secondary panel tint (legacy; kept for data parity) */
  panel: string
  /** brand accent sampled from the cake */
  accent: string
  /** true when bg is dark and needs light text */
  dark: boolean
  /** transparent full-cake image (webp) — a site-relative path or a full URL */
  image: string
  /** display order (ascending) */
  sortOrder: number
  /** hidden cakes are kept in the DB but not shown on the site */
  visible: boolean
  /** flavor(s) this design was made with — empty means "any flavor from the menu" */
  flavor: string
  /** serving guidance, e.g. "Serves 25–30" */
  servings: string
  /** occasion/search keywords shown on the detail page and matched by gallery search */
  tags: string[]
  /** additional photos beyond `image` (detail-page viewer) */
  extraImages: string[]
}

export interface ShowcaseContent {
  id: string
  /** image/video url — a site-relative path or a full URL */
  src: string
  alt: string
  sortOrder: number
  visible: boolean
  /** videos play in the gallery wall + lightbox; images everywhere */
  mediaType: 'image' | 'video'
}

/** Admin-editable pricing row (pricing_items table). */
export interface PricingItemContent {
  id: string
  section: 'starting' | 'addon'
  item: string
  detail: string
  /** e.g. 'From $95' — null renders "Request a quote" */
  price: string | null
  sortOrder: number
  visible: boolean
}

export interface SiteContent {
  cakes: CakeContent[]
  showcase: ShowcaseContent[]
}

export type InquiryKind = 'quote' | 'contact' | 'callback'
export type InquiryStatus = 'new' | 'quoted' | 'confirmed' | 'closed'

/** A quote request or contact-form message (public form → admin inbox). */
export interface Inquiry {
  id: string
  kind: InquiryKind
  name: string
  phone: string
  email: string
  /** ISO dates (yyyy-mm-dd) or empty */
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
  /** preferred pickup window — optional: column exists only from migration 0003 on */
  pickupSlot?: string
  /** callback time window — optional: column exists only from migration 0007 on */
  preferredTime?: string
  status: InquiryStatus
  adminNotes: string
  createdAt: string
}
