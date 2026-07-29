import type { VercelRequest, VercelResponse } from '@vercel/node'

// Snap-a-bill: extracts vendor / date / amount / category from a receipt photo
// using Claude vision. ADMIN-ONLY — the caller must present a valid Supabase
// session token, verified against the auth server before any money is spent.
//
// Env (server-only): ANTHROPIC_API_KEY — absent → {configured:false} and the
// admin fills the payment fields by hand (the photo still gets stored).

const MAX_IMAGE_B64 = 6 * 1024 * 1024 // ~4.5MB binary
const MEDIA_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])
const CATEGORIES = ['Ingredients', 'Packaging', 'Equipment', 'Marketing', 'Software & hosting', 'Other']

/** True only when the bearer token belongs to a real signed-in admin. */
async function verifyAdmin(token: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon || !token) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!(await verifyAdmin(token))) {
    return res.status(401).json({ error: 'Sign in to the admin panel first.' })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ configured: false })

  const body = req.body as { image?: unknown; mediaType?: unknown } | undefined
  const image = typeof body?.image === 'string' ? body.image : ''
  const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : ''
  if (!image || image.length > MAX_IMAGE_B64 || !MEDIA_TYPES.has(mediaType)) {
    return res.status(400).json({ error: 'Send a webp/jpeg/png image under 4 MB.' })
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              {
                type: 'text',
                text: `This is a photo of a bill, receipt, or invoice for a home bakery's bookkeeping. Extract and reply with ONLY a JSON object (no markdown fences): {"vendor": string (business paid), "date": string yyyy-mm-dd (bill date; empty string if unreadable), "amount": number (grand total paid), "category": one of ${JSON.stringify(CATEGORIES)}, "note": string (max 60 chars, e.g. what was bought)}. If the image is not a bill/receipt/invoice, reply exactly {"error":"not a receipt"}.`,
              },
            ],
          },
        ],
      }),
    })
    if (!upstream.ok) {
      console.error('anthropic receipt error', upstream.status, (await upstream.text()).slice(0, 300))
      return res.status(502).json({ error: 'Could not read the bill — fill the fields manually.' })
    }
    const json = (await upstream.json()) as { content?: { type: string; text?: string }[] }
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .replace(/^```(?:json)?|```$/gm, '')
      .trim()
    const parsed = JSON.parse(text) as {
      error?: string
      vendor?: unknown
      date?: unknown
      amount?: unknown
      category?: unknown
      note?: unknown
    }
    if (parsed.error) return res.status(200).json({ configured: true, receipt: null })
    const amount = Number(parsed.amount)
    return res.status(200).json({
      configured: true,
      receipt: {
        vendor: typeof parsed.vendor === 'string' ? parsed.vendor.slice(0, 80) : '',
        date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : '',
        amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0,
        category: CATEGORIES.includes(String(parsed.category)) ? String(parsed.category) : 'Other',
        note: typeof parsed.note === 'string' ? parsed.note.slice(0, 60) : '',
      },
    })
  } catch (e) {
    console.error('parse-receipt error', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Could not read the bill — fill the fields manually.' })
  }
}
