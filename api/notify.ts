import type { VercelRequest, VercelResponse } from '@vercel/node'

// New-inquiry email notifications. A Supabase Database Webhook POSTs here on
// every INSERT into public.inquiries; we forward a readable summary to the
// bakery's email via Resend.
//
// Env (all server-only):
//   NOTIFY_WEBHOOK_SECRET — shared secret; the webhook URL carries ?secret=...
//   RESEND_API_KEY        — from resend.com (free tier is plenty)
//   NOTIFY_EMAIL          — where the notifications go
// Missing RESEND_API_KEY / NOTIFY_EMAIL → the endpoint no-ops (200) so the
// webhook never retries into a wall.

interface InquiryRecord {
  kind?: string
  name?: string
  phone?: string
  email?: string
  event_date?: string | null
  pickup_date?: string | null
  pickup_slot?: string
  preferred_time?: string
  occasion?: string
  theme?: string
  servings?: string
  flavor?: string
  budget?: string
  dietary?: string
  message?: string
  cake_title?: string
  photos?: string[]
}

const line = (label: string, v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? `${label}: ${v.trim()}` : null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.NOTIFY_WEBHOOK_SECRET
  if (!secret || req.query.secret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.RESEND_API_KEY
  // Destination is configurable in Admin → Setup (site_config.notify_email),
  // with the NOTIFY_EMAIL env var as fallback.
  let to = process.env.NOTIFY_EMAIL ?? ''
  try {
    const url = process.env.VITE_SUPABASE_URL
    const anon = process.env.VITE_SUPABASE_ANON_KEY
    if (url && anon) {
      const cfg = await fetch(`${url}/rest/v1/site_config?id=eq.1&select=notify_email`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      })
      if (cfg.ok) {
        const rows = (await cfg.json()) as { notify_email?: string }[]
        if (rows[0]?.notify_email) to = rows[0].notify_email
      }
    }
  } catch {
    /* fall back to env */
  }
  if (!apiKey || !to) return res.status(200).json({ sent: false, reason: 'not-configured' })

  const body = req.body as { type?: string; table?: string; record?: InquiryRecord } | undefined
  const r = body?.record
  if (body?.type !== 'INSERT' || body?.table !== 'inquiries' || !r) {
    return res.status(200).json({ sent: false, reason: 'ignored' })
  }

  const kind = r.kind === 'callback' ? 'Callback request' : r.kind === 'contact' ? 'Message' : 'Quote request'
  const subject = `🎂 ${kind} from ${r.name || 'a website visitor'}`
  const text = [
    `${kind} just came in on the website.`,
    '',
    line('Name', r.name),
    line('Phone', r.phone),
    line('Email', r.email),
    line('Best time to call', r.preferred_time),
    line('Event date', r.event_date),
    line('Pickup date', r.pickup_date),
    line('Pickup window', r.pickup_slot),
    line('Occasion', r.occasion),
    line('Theme', r.theme),
    line('Servings', r.servings),
    line('Flavor', r.flavor),
    line('Budget', r.budget),
    line('Dietary', r.dietary),
    line('Inspired by', r.cake_title),
    line('Message', r.message),
    Array.isArray(r.photos) && r.photos.length > 0 ? `Inspiration photos:\n${r.photos.join('\n')}` : null,
    '',
    'Reply from the admin inbox: https://cakeuwish.vercel.app/admin/inbox',
    r.phone ? `WhatsApp them: https://wa.me/${String(r.phone).replace(/[^\d]/g, '')}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'CakeUWish Website <onboarding@resend.dev>',
        to,
        subject,
        text,
      }),
    })
    if (!upstream.ok) {
      console.error('resend error', upstream.status, (await upstream.text()).slice(0, 300))
      return res.status(200).json({ sent: false, reason: 'send-failed' })
    }
    return res.status(200).json({ sent: true })
  } catch (e) {
    console.error('notify error', e instanceof Error ? e.message : e)
    return res.status(200).json({ sent: false, reason: 'error' })
  }
}
