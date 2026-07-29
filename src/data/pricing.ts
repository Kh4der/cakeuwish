// ─────────────────────────────────────────────────────────────────────────────
// PRICING GUIDE CONTENT — bundled fallback + quote-form options.
//
// Starting prices and add-ons are ADMIN-EDITABLE at /admin → Pricing (the
// pricing_items table overrides these at runtime); the values below are the
// no-backend fallback and the DB seed, kept in sync with migration 0006.
// Prices are "starting at" guides — every cake is still quoted individually.
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceLine {
  item: string
  detail: string
  /** e.g. 'From $85' — null renders as "Request a quote" */
  price: string | null
}

export const STARTING_PRICES: PriceLine[] = [
  {
    item: 'Single-tier custom cakes',
    detail: 'One tier, fully custom design — most birthdays and small parties.',
    price: 'From $95',
  },
  {
    item: 'Two-tier celebration cakes',
    detail: 'Bigger centerpiece for milestones, showers, and larger parties.',
    price: 'From $185',
  },
  {
    item: 'Wedding & multi-tier cakes',
    detail: 'Three or more tiers, delivery & setup available.',
    price: 'From $325',
  },
  {
    item: 'Sculpted & novelty cakes',
    detail: 'Shaped cakes — purses, characters, cars, anything you can dream up.',
    price: 'From $165',
  },
  {
    item: 'Cupcakes & cake pops',
    detail: 'By the dozen — great alongside a cake when the guest list grows.',
    price: 'From $35 / dozen',
  },
]

export interface Flavor {
  name: string
  note?: string
}

// Every flavor can be made eggless — it's one of CakeUWish's specialties.
export const FLAVORS: Flavor[] = [
  { name: 'Vanilla', note: 'Classic, light, and never boring' },
  { name: 'Chocolate', note: 'Rich without being overly sweet' },
  { name: 'Chocolate Truffle', note: 'For serious chocolate people' },
  { name: 'Butterscotch', note: 'A milestone-birthday favorite' },
  { name: 'Raspberry & Dark Chocolate', note: 'Fruity meets decadent, with ganache' },
]

export interface SizeRow {
  size: string
  servings: string
  bestFor: string
}

// Typical party-serving counts; Parul confirms exact numbers per design.
export const SIZING: SizeRow[] = [
  { size: '6″ round', servings: '10–12', bestFor: 'Intimate birthdays & anniversaries' },
  { size: '8″ round', servings: '20–24', bestFor: 'Family parties' },
  { size: '10″ round', servings: '30–38', bestFor: 'Big birthday bashes' },
  { size: 'Two tier (6″ + 8″)', servings: '30–36', bestFor: 'Showers & milestone birthdays' },
  { size: 'Three tier (6″ + 8″ + 10″)', servings: '60–70', bestFor: 'Weddings & grand celebrations' },
]

export const ADDONS: PriceLine[] = [
  { item: 'Custom cake toppers', detail: 'Names, numbers, figurines, and acrylic toppers.', price: 'From $15' },
  { item: 'Hand-sculpted figures', detail: 'Edible characters and keepsake figurines.', price: 'From $30' },
  { item: 'Matching cupcakes', detail: 'Extend servings without changing the centerpiece.', price: 'From $35 / dozen' },
  { item: 'Delivery & setup', detail: 'To your venue, with CakeUWish handling transport liability.', price: 'From $35' },
]

export const OCCASIONS = [
  'Birthday',
  'Kids Birthday',
  'Milestone Birthday (16th, 21st, 30th, 40th, 50th…)',
  'Wedding',
  'Engagement',
  'Anniversary',
  'Baby Shower',
  'Gender Reveal',
  'Bridal Shower',
  'Graduation',
  'Religious Celebration',
  'Corporate Event',
  'Holiday',
  'Other',
]

export const SERVING_OPTIONS = ['10–15', '15–25', '25–40', '40–60', '60+', 'Not sure yet']
