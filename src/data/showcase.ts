import type { ShowcaseContent } from '../content/types'

// Bundled SEED for the scroll-driven scatter→arc showcase wall. Overridden at
// runtime by Supabase once configured + seeded (see supabase/migrations).
const FILES = [
  'image_0.webp', 'image_10.webp', 'image_11.webp', 'image_12.webp', 'image_13.webp',
  'image_14.webp', 'image_16.webp', 'image_17.webp', 'image_18.webp', 'image_19.webp',
  'image_2.webp', 'image_21.webp', 'image_22.webp', 'image_23.webp', 'image_24.webp',
  'image_25.webp', 'image_3.webp', 'image_4.webp', 'image_5.webp', 'image_6.webp',
  'image_7.webp', 'image_8.webp', 'image_9.webp',
]

const KNOWN: Record<string, string> = {
  'image_4.webp': 'Frozen castle birthday cake by CakeUWish',
  'image_19.webp': 'Paw Patrol birthday cake by CakeUWish',
  'image_12.webp': 'Anniversary and Indian wedding cakes by CakeUWish',
}

export const SEED_SHOWCASE: ShowcaseContent[] = FILES.map((f, i) => ({
  id: f.replace('.webp', ''),
  src: `/showcase/${f}`,
  alt: KNOWN[f] ?? 'Custom celebration cake by CakeUWish',
  sortOrder: i,
  visible: true,
  mediaType: 'image',
}))

export const SHOWCASE = SEED_SHOWCASE
