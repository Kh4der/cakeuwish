import type { CakeContent } from '../content/types'

// Bundled SEED content. This is what the site shows out of the box and the
// fallback whenever Supabase isn't configured / returns nothing. Once Supabase
// is seeded (see supabase/migrations), the live content overrides this at runtime.
//
// Each cake renders from a single transparent `full.webp` (the hero used to
// stack per-cake layer slices for an explode effect that HERO v2 dropped — the
// stacked slices simply reconstructed this same full image).

const img = (id: string) => `/cakes/${id}/full.webp`

// flavor/servings stay empty in the seed (the UI shows "any flavor from the
// menu" style fallbacks); the admin panel fills real values per cake.
type Seed = Omit<CakeContent, 'image' | 'sortOrder' | 'visible' | 'flavor' | 'servings' | 'extraImages'>

const SEED: Seed[] = [
  {
    id: '5d2ec516-28dc-4e17-8801-5391e8a2f0c8',
    title: 'Farm Day, Reyaan',
    blurb:
      'A golden barnyard brought to life — cow-print tiers, miniature animals, and a red barn topper for a very happy fifth birthday.',
    category: 'Kids & Character',
    bg: '#EAD6A0',
    panel: '#EBDFC4',
    accent: '#A16207',
    dark: false,
    tags: ['kids birthday', 'farm animals', 'barnyard', '5th birthday'],
  },
  {
    id: '25e166a0-4076-4378-91d2-fd62b1890e46',
    title: 'She Has Range',
    blurb:
      'Ballet poise meets music royalty — hot-pink petal ruffles, designer accents, and a silhouette topper that knows exactly who the guest of honour is.',
    category: 'Birthday Cakes',
    bg: '#F0CBD6',
    panel: '#EAD4D8',
    accent: '#A16207',
    dark: false,
    tags: ['birthday', 'ballet', 'pink ruffles', 'designer'],
  },
  {
    id: 'a99e9e06-dbb2-4bde-8d13-f33521d03dfb',
    title: 'Fifty Golden Years',
    blurb:
      'Hand-piped gold lace, velvet-red roses, and lehenga grace as fine as the day they said yes — a golden anniversary deserves nothing less.',
    category: 'Milestone & Anniversary',
    bg: '#E8CFC4',
    panel: '#E4D2CB',
    accent: '#A16207',
    dark: false,
    tags: ['50th anniversary', 'gold lace', 'roses', 'indian'],
  },
  {
    id: 'ba90402b-d98e-4f7d-ab25-53200a10595b',
    title: 'Midnight Geode',
    blurb:
      'Matte black fondant, rose-gold geometry, fairy-lit acrylic, and hand-placed geode shards — for a milestone that refuses to be subtle.',
    category: 'Milestone & Anniversary',
    bg: '#1C1917',
    panel: '#2A2522',
    accent: '#CE8066',
    dark: true,
    tags: ['milestone birthday', 'geode', 'black fondant', 'rose gold'],
  },
  {
    id: 'e135e65c-bac5-40fa-9acd-1dd74cc189ca',
    title: 'Together in Red & Gold',
    blurb:
      'A lehenga-draped silhouette cascading down ivory tiers, crowned with hand-sculpted bride and groom figurines — a cake that looks like their love story.',
    category: 'Wedding Cakes',
    bg: '#EDDBB4',
    panel: '#EBDCC2',
    accent: '#A16207',
    dark: false,
    tags: ['wedding', 'indian wedding', 'lehenga', 'figurines'],
  },
  {
    id: '6a8115e3-88ee-4506-bda0-a6f4e7ec579c',
    title: 'Simply, Always',
    blurb:
      'Ivory buttercream, hand-ridged tiers, and a cascade of white garden roses — timeless, soft, and exactly right for the couple who lets the moment speak.',
    category: 'Wedding Cakes',
    bg: '#F3EDE1',
    panel: '#F1EDE8',
    accent: '#A16207',
    dark: false,
    tags: ['wedding', 'buttercream', 'garden roses', 'classic'],
  },
  {
    id: '8bf75c40-ca3c-4686-8f3c-70ff4bf73a6c',
    title: 'Semper Fi',
    blurb:
      'A tribute as sharp as dress blues — the Marine Corps emblem, a draped flag tier, and gold rope detailing for someone who earned every star.',
    category: 'Theme & Novelty',
    bg: '#CBD6E6',
    panel: '#D8DCE2',
    accent: '#44403C',
    dark: false,
    tags: ['military', 'marine corps', 'retirement', 'tribute'],
  },
]

export const SEED_CAKES: CakeContent[] = SEED.map((c, i) => ({
  ...c,
  image: img(c.id),
  sortOrder: i,
  visible: true,
  flavor: '',
  servings: '',
  extraImages: [],
}))

/** Backwards-friendly alias used by a few callers. */
export const CAKES = SEED_CAKES

/** The hero opens on this cake ("Simply, Always"); falls back to the first cake. */
export const START_ID = '6a8115e3-88ee-4506-bda0-a6f4e7ec579c'

export const CATEGORIES = [
  'Birthday Cakes',
  'Wedding Cakes',
  'Kids & Character',
  'Milestone & Anniversary',
  'Theme & Novelty',
  'Cupcakes & Desserts',
  'Bespoke & Custom',
]

// Contact/channel settings live in ONE place now — src/config/site.ts.
// These re-exports keep every existing import working.
import { CHANNELS, PHONE_TEL as TEL, WHATSAPP_URL as WA } from '../config/site'

export const WHATSAPP_URL = WA
export const WHATSAPP_DISPLAY = CHANNELS.phoneDisplay
export const PHONE_TEL = TEL
export const FACEBOOK_URL = CHANNELS.facebookUrl
export const WHATSAPP_ENABLED = CHANNELS.whatsappEnabled
