import type { VercelRequest, VercelResponse } from '@vercel/node'

// Cake Builder image generation, locked to cakes only.
//
// The customer NEVER writes the prompt. Their choices (tiers, style, colors,
// theme, topper) are slotted into a fixed template that can only describe a
// celebration cake; free-text fields are screened and injected as decoration
// details. Generated images are uploaded to the public 'inspiration' bucket so
// the resulting quote request carries a plain URL through the normal pipeline.
//
// PROVIDER-AGNOSTIC (server-only env). Pick with IMAGE_PROVIDER, or leave it
// unset and the first configured one is used:
//   openai       — OPENAI_API_KEY (gpt-image-1, paid, best quality)
//   cloudflare   — CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Flux, free tier)
//   pollinations — no key at all (free public service; opt in with IMAGE_PROVIDER=pollinations)
// None configured → {configured:false}: the builder still submits the written
// spec to the admin inbox, just without a preview image.

const OPENAI_KEY = process.env.OPENAI_API_KEY
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN

type ImageProvider = 'openai' | 'cloudflare' | 'pollinations' | 'none'

/** Explicit IMAGE_PROVIDER wins; otherwise auto-pick the first keyed provider. */
function pickProvider(): ImageProvider {
  const forced = (process.env.IMAGE_PROVIDER || '').toLowerCase()
  if (forced === 'openai') return OPENAI_KEY ? 'openai' : 'none'
  if (forced === 'cloudflare') return CF_ACCOUNT && CF_TOKEN ? 'cloudflare' : 'none'
  if (forced === 'pollinations') return 'pollinations' // keyless by design
  if (OPENAI_KEY) return 'openai'
  if (CF_ACCOUNT && CF_TOKEN) return 'cloudflare'
  return 'none'
}

const MAX_TEXT = 160
const MAX_PROMPT = 400

// Words that have no business in a cake decoration description. Not a safety
// boundary on its own — the fixed template is — but cheap early rejection.
const BLOCKLIST =
  /\b(nude|naked|nsfw|gore|blood|weapon|gun|knife|kill|violence|drug|politic|celebrit|logo|trademark|brand|photo of (a )?(person|man|woman|child)|realistic (person|face)|passport|license)\b/i

interface BuilderSpec {
  prompt?: unknown
  tiers?: unknown
  style?: unknown
  colors?: unknown
  occasion?: unknown
  addons?: unknown
}

function cleanText(v: unknown, max = MAX_TEXT): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[^\p{L}\p{N}\s.,!?'’&()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

// Selected add-ons become fixed decoration phrases — never free text.
const ADDON_PHRASES: Record<string, string> = {
  'Custom cake toppers': 'a custom decorative cake topper',
  'Hand-sculpted figures': 'small hand-sculpted edible sugar figures on the cake',
  'Matching cupcakes': 'a few matching decorated cupcakes arranged beside the cake stand',
  'Delivery & setup': '', // service add-on — nothing to depict
}

const TIERS = new Set(['1', '2', '3'])
const STYLES = new Set([
  'smooth buttercream',
  'textured buttercream',
  'fondant',
  'semi-naked',
  'drip cake',
  'floral cascade',
])

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 4
const hits = new Map<string, { count: number; windowStart: number }>()
function rateLimited(ip: string, now: number): boolean {
  if (hits.size > 5000) hits.clear()
  const h = hits.get(ip)
  if (!h || now - h.windowStart > RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  h.count += 1
  return h.count > RATE_MAX
}

// gpt-image-1, 1024², medium quality — approximate per-image cost. Free
// providers (cloudflare/pollinations) log $0.
const OPENAI_IMAGE_COST = 0.045

/** Fire-and-forget cost metering into usage_log (Admin → Insights → API costs). */
function logUsage(cost: number, provider: ImageProvider): void {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return
  fetch(`${url}/rest/v1/usage_log`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      service: 'image',
      images: 1,
      quantity: 1,
      est_cost: cost,
      provider,
      detail: 'Cake builder preview',
    }),
  }).catch(() => {})
}

interface GeneratedImage {
  bytes: Buffer
  contentType: string
  ext: string
}

/** Generate one cake image from the fixed prompt via the chosen provider. */
async function generate(provider: ImageProvider, prompt: string): Promise<GeneratedImage | null> {
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'medium', n: 1 }),
    })
    if (!r.ok) {
      console.error('openai image error', r.status, (await r.text()).slice(0, 300))
      return null
    }
    const json = (await r.json()) as { data?: { b64_json?: string }[] }
    const b64 = json.data?.[0]?.b64_json
    if (!b64) return null
    return { bytes: Buffer.from(b64, 'base64'), contentType: 'image/png', ext: 'png' }
  }

  if (provider === 'cloudflare') {
    // Workers AI Flux-1-schnell — free tier (neuron-metered), returns base64.
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, steps: 6 }),
      },
    )
    if (!r.ok) {
      console.error('cloudflare image error', r.status, (await r.text()).slice(0, 300))
      return null
    }
    const json = (await r.json()) as { result?: { image?: string } }
    const b64 = json.result?.image
    if (!b64) return null
    return { bytes: Buffer.from(b64, 'base64'), contentType: 'image/jpeg', ext: 'jpg' }
  }

  // pollinations — keyless public service; returns the image bytes directly.
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&model=flux`
  const r = await fetch(url)
  if (!r.ok) {
    console.error('pollinations image error', r.status)
    return null
  }
  const contentType = r.headers.get('content-type') || 'image/jpeg'
  return {
    bytes: Buffer.from(await r.arrayBuffer()),
    contentType,
    ext: contentType.includes('png') ? 'png' : 'jpg',
  }
}

/** Store the image in Supabase storage; returns a public URL (or null). */
async function storeImage(img: GeneratedImage): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
    const name = `builder-${crypto.randomUUID()}.${img.ext}`
    const res = await fetch(`${url}/storage/v1/object/inspiration/${name}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'content-type': img.contentType,
        'cache-control': 'max-age=31536000',
      },
      body: new Uint8Array(img.bytes),
    })
    if (!res.ok) return null
    return `${url}/storage/v1/object/public/inspiration/${name}`
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = (String(req.headers['x-forwarded-for'] ?? '').split(',')[0] || 'unknown').trim()
  if (rateLimited(ip, Date.now())) {
    return res.status(429).json({ error: 'Easy, Picasso — a few previews per minute is the limit. Try again shortly.' })
  }

  const provider = pickProvider()
  if (provider === 'none') return res.status(200).json({ configured: false })

  const spec = (req.body ?? {}) as BuilderSpec
  const tiers = TIERS.has(String(spec.tiers)) ? String(spec.tiers) : '1'
  const styleRaw = typeof spec.style === 'string' ? spec.style.toLowerCase() : ''
  const style = STYLES.has(styleRaw) ? styleRaw : 'smooth buttercream'
  const description = cleanText(spec.prompt, MAX_PROMPT)
  const colors = cleanText(spec.colors)
  const occasion = cleanText(spec.occasion)
  const addonPhrases = (Array.isArray(spec.addons) ? spec.addons : [])
    .map((a) => ADDON_PHRASES[String(a)])
    .filter((p): p is string => Boolean(p))

  for (const v of [description, colors, occasion]) {
    if (v && BLOCKLIST.test(v)) {
      return res.status(400).json({ error: 'Please keep the description about the cake itself.' })
    }
  }
  if (!description) {
    return res.status(400).json({ error: 'Describe your cake first — even a few words help.' })
  }

  // Fixed template — the customer's words can only ever DESCRIBE A CAKE: they
  // are injected as the decoration brief of a cake photograph, nothing else.
  const prompt = [
    `Professional bakery product photograph of a single ${tiers}-tier custom celebration cake with a ${style} finish.`,
    `The customer's decoration brief, to be expressed purely as cake decoration (piping, sugar work, edible decorations ON the cake — never scenes, people, or objects outside the cake): "${description}".`,
    colors && `Color palette: ${colors}.`,
    occasion && `The cake is for: ${occasion}.`,
    addonPhrases.length > 0 && `Also include: ${addonPhrases.join('; ')}.`,
    'The image must contain ONLY the cake on a simple cake stand against a soft, warm cream studio background with gentle natural light.',
    'No people, no hands, no text overlays, no logos, no background props beyond the stand (matching cupcakes beside the stand are the only allowed exception). Elegant, luxurious, realistic, appetizing.',
  ]
    .filter(Boolean)
    .join(' ')

  try {
    const img = await generate(provider, prompt)
    if (!img || img.bytes.byteLength === 0) {
      return res.status(502).json({ error: 'The oven hiccuped — try generating again.' })
    }
    logUsage(provider === 'openai' ? OPENAI_IMAGE_COST : 0, provider)

    const url = await storeImage(img)
    // Fall back to a data URL so the preview still shows if storage failed
    // (the quote submission needs the hosted URL though, so flag it).
    return res.status(200).json({
      configured: true,
      url,
      dataUrl: url ? undefined : `data:${img.contentType};base64,${img.bytes.toString('base64')}`,
    })
  } catch (e) {
    console.error('generate-cake error', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'The oven hiccuped — try generating again.' })
  }
}
