export interface CakeLayer {
  /** optimized webp path */
  file: string
  /** png fallback path */
  filePng: string
  label: string
  /** vertical center of the layer band on the original 1536px-tall canvas */
  yCenter: number
}

export interface Cake {
  id: string
  title: string
  blurb: string
  category: string
  /** dynamic hero background tint */
  bg: string
  /** secondary panel tint */
  panel: string
  /** brand accent sampled from the cake */
  accent: string
  /** true when bg is dark and needs light text */
  dark: boolean
  layers: CakeLayer[]
}

/** Canvas height the layer geometry was authored against. */
export const CANVAS_H = 1536
export const CANVAS_W = 1024

const base = (id: string) => `/cakes/${id}`

// Premium / Elegant palette: soft desaturated backdrops (gentle per-cake mood,
// all reading elegant), gold accents throughout, with Midnight Geode kept as the
// one dramatic charcoal moment. Simply, Always (START) is off-white to sync with Intro.
export const CAKES: Cake[] = [
  {
    id: '5d2ec516-28dc-4e17-8801-5391e8a2f0c8',
    title: 'Farm Day, Reyaan',
    blurb:
      'A golden barnyard brought to life — cow-print tiers, miniature animals, and a red barn topper for a very happy fifth birthday.',
    category: 'Kids & Character',
    bg: '#F3EAD6',
    panel: '#EBDFC4',
    accent: '#A16207',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 170 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 580 },
      { file: '02-tier-bot.png', label: 'tier-bot', yCenter: 1085 },
      { file: '03-board.png', label: 'board', yCenter: 1443 },
    ],
  },
  {
    id: '25e166a0-4076-4378-91d2-fd62b1890e46',
    title: 'She Has Range',
    blurb:
      'Ballet poise meets music royalty — hot-pink petal ruffles, designer accents, and a silhouette topper that knows exactly who the guest of honour is.',
    category: 'Birthday Cakes',
    bg: '#F3E4E6',
    panel: '#EAD4D8',
    accent: '#A16207',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 140 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 550 },
      { file: '02-tier-bot.png', label: 'tier-bot', yCenter: 1100 },
      { file: '03-board.png', label: 'board', yCenter: 1458 },
    ],
  },
  {
    id: 'a99e9e06-dbb2-4bde-8d13-f33521d03dfb',
    title: 'Fifty Golden Years',
    blurb:
      'Hand-piped gold lace, velvet-red roses, and lehenga grace as fine as the day they said yes — a golden anniversary deserves nothing less.',
    category: 'Milestone & Anniversary',
    bg: '#EFE2DD',
    panel: '#E4D2CB',
    accent: '#A16207',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 125 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 425 },
      { file: '02-tier-mid.png', label: 'tier-mid', yCenter: 780 },
      { file: '03-tier-bot.png', label: 'tier-bot', yCenter: 1115 },
      { file: '04-board.png', label: 'board', yCenter: 1403 },
    ],
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
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 130 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 455 },
      { file: '02-tier-mid.png', label: 'tier-mid', yCenter: 865 },
      { file: '03-tier-bot.png', label: 'tier-bot', yCenter: 1240 },
      { file: '04-board.png', label: 'board', yCenter: 1468 },
    ],
  },
  {
    id: 'e135e65c-bac5-40fa-9acd-1dd74cc189ca',
    title: 'Together in Red & Gold',
    blurb:
      'A lehenga-draped silhouette cascading down ivory tiers, crowned with hand-sculpted bride and groom figurines — a cake that looks like their love story.',
    category: 'Wedding Cakes',
    bg: '#F3E8D7',
    panel: '#EBDCC2',
    accent: '#A16207',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 150 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 500 },
      { file: '02-tier-mid.png', label: 'tier-mid', yCenter: 915 },
      { file: '03-tier-bot.png', label: 'tier-bot', yCenter: 1275 },
      { file: '04-board.png', label: 'board', yCenter: 1478 },
    ],
  },
  {
    id: '6a8115e3-88ee-4506-bda0-a6f4e7ec579c',
    title: 'Simply, Always',
    blurb:
      'Ivory buttercream, hand-ridged tiers, and a cascade of white garden roses — timeless, soft, and exactly right for the couple who lets the moment speak.',
    category: 'Wedding Cakes',
    bg: '#FAF9F7',
    panel: '#F1EDE8',
    accent: '#A16207',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 65 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 385 },
      { file: '02-tier-mid.png', label: 'tier-mid', yCenter: 885 },
      { file: '03-tier-bot.png', label: 'tier-bot', yCenter: 1265 },
      { file: '04-board.png', label: 'board', yCenter: 1468 },
    ],
  },
  {
    id: '8bf75c40-ca3c-4686-8f3c-70ff4bf73a6c',
    title: 'Semper Fi',
    blurb:
      'A tribute as sharp as dress blues — the Marine Corps emblem, a draped flag tier, and gold rope detailing for someone who earned every star.',
    category: 'Theme & Novelty',
    bg: '#E6E8EC',
    panel: '#D8DCE2',
    accent: '#44403C',
    dark: false,
    layers: [
      { file: '00-topper.png', label: 'topper', yCenter: 160 },
      { file: '01-tier-top.png', label: 'tier-top', yCenter: 565 },
      { file: '02-tier-bot.png', label: 'tier-bot', yCenter: 1085 },
      { file: '03-board.png', label: 'board', yCenter: 1448 },
    ],
  },
].map((c) => ({
  ...c,
  layers: c.layers.map((l) => ({
    ...l,
    file: `${base(c.id)}/${l.file.replace('.png', '.webp')}`,
    filePng: `${base(c.id)}/${l.file}`,
  })),
}))

// The hero opens on "Simply, Always" (the white-rose wedding cake).
export const START_INDEX = Math.max(0, CAKES.findIndex((c) => c.id === '6a8115e3-88ee-4506-bda0-a6f4e7ec579c'))

export const CATEGORIES = [
  'Birthday Cakes',
  'Wedding Cakes',
  'Kids & Character',
  'Milestone & Anniversary',
  'Theme & Novelty',
  'Cupcakes & Desserts',
  'Bespoke & Custom',
]

export const WHATSAPP_URL = 'https://wa.me/15717625848'
export const WHATSAPP_DISPLAY = '+1 (571) 762-5848'
export const FACEBOOK_URL = 'https://facebook.com/CakeUWishVA'
