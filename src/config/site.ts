// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION — the ONE place a new deployment gets customized.
//
// Deploying this framework for a new bakery client:
//   1. Edit every value in this file (business identity, channels, reviews).
//   2. Copy .env.example → set the API keys (see CONFIG.md for the full list).
//   3. Run supabase/setup.sql in the client's Supabase project.
// Business COPY (FAQ answers, policies, flavors, prices) lives in the files
// listed at the bottom of this config — CONFIG.md has the checklist.
// ═══════════════════════════════════════════════════════════════════════════

export const SITE = {
  /** Legal/display business name — used in titles, footer, policies. */
  businessName: 'CakeUWish',
  legalName: 'CakeUWish LLC',
  /** The baker/owner customers hear about ("Parul replies personally"). */
  ownerName: 'Parul',
  /** Where the bakery operates. */
  city: 'Chantilly',
  region: 'VA',
  serviceArea: 'the DMV (DC, Maryland, Northern Virginia)',
  /** Production URL — used in sitemap/robots and email links. */
  productionUrl: 'https://cakeuwish.vercel.app',
} as const

export const CHANNELS = {
  /** E.164 digits only — drives tel: links and wa.me. */
  phoneE164: '+15717625848',
  phoneDisplay: '+1 (571) 762-5848',
  /**
   * Master switch for every WhatsApp affordance on the public site (FAB,
   * header button, CTAs, chat handoffs). Flip true to restore in one move.
   */
  whatsappEnabled: false,
  facebookUrl: 'https://facebook.com/CakeUWishVA',
  /** '' hides any Instagram affordances. */
  instagramUrl: '',
} as const

export const REVIEWS_CONFIG = {
  /** Headline figures from the Google Business Profile. */
  rating: '4.9',
  count: 194,
  /** SociableKit "Google Reviews" widget embed id — sociablekit.com. */
  sociableKitEmbedId: '25410301',
  /** Google Place ID enables the direct write-a-review deep link; '' = search fallback. */
  googlePlaceId: '',
  /** Fallback link to the business's reviews on Google. */
  googleReviewsUrl: 'https://www.google.com/search?q=CakeUWish+LLC+Chantilly+reviews',
} as const

// Derived — don't edit below this line.
export const WHATSAPP_URL = `https://wa.me/${CHANNELS.phoneE164.replace(/\D/g, '')}`
export const PHONE_TEL = `tel:${CHANNELS.phoneE164}`

// ── Where the rest of a client's customization lives ────────────────────────
// src/data/pricing.ts   → flavors, sizing chart, occasion list, bundled prices
//                         (live prices are admin-edited in /admin → Pricing)
// src/data/faq.ts       → FAQ questions & answers
// src/data/cakes.ts     → seed cakes (replaced via /admin → Cakes)
// src/pages/TermsPage.tsx / PrivacyPage.tsx → policies
// api/chat.ts           → STATIC_KNOWLEDGE for the AI assistant
// index.html            → <title> + meta description + fonts
// public/sitemap.xml    → domain
