import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, timingSafeEqual } from 'node:crypto'

// Vapi voice-assistant webhook — the phone channel of the omni setup.
//
// The AI phone call itself lives entirely on Vapi (their number + assistant).
// Our side is deliberately one job: when a call ends, capture what the caller
// wanted and drop it into the EXISTING inquiry pipeline as a callback request.
// From there the normal machinery takes over — it shows up in Admin → Inbox,
// and the inquiries INSERT webhook sends the owner the email notification
// (once RESEND_API_KEY is configured), identical to a website quote request.
// One pipeline, no parallel email path. (Pattern mirrored from the KITCHENHOOD
// voice route, minus the TCPA/outbound-compliance machinery a bakery's
// inbound-only line doesn't need.)
//
// Env (server-only):
//   VAPI_WEBHOOK_SECRET — set the same value as the assistant's server-url
//                         secret in the Vapi dashboard; arrives as x-vapi-secret.
// Vapi setup (documented in Admin → Setup): assistant → Advanced → Server URL
//   https://<domain>/api/vapi   with that secret.

const SECRET = process.env.VAPI_WEBHOOK_SECRET
const SB_URL = process.env.VITE_SUPABASE_URL
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
function str(v: unknown, maxLen = 1000): string {
  return typeof v === 'string' ? v.trim().slice(0, maxLen) : ''
}
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
/** analysis.structuredData arrives as an object or a JSON string — accept both. */
function parseStructured(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      return obj(JSON.parse(v))
    } catch {
      return {}
    }
  }
  return obj(v)
}

function secretOk(header: string | undefined): boolean {
  if (!SECRET) return false
  const a = createHash('sha256').update(String(header ?? '')).digest()
  const b = createHash('sha256').update(SECRET).digest()
  return timingSafeEqual(a, b)
}

// Vapi retries webhooks — don't file the same call twice (per warm instance).
const seen = new Set<string>()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!SECRET) return res.status(200).json({ configured: false })
  if (!secretOk(req.headers['x-vapi-secret'] as string | undefined)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const msg = obj((req.body as Record<string, unknown> | undefined)?.message)
  const type = str(msg.type, 100)
  // Everything except the final report is acknowledged and ignored.
  if (type !== 'end-of-call-report') return res.status(200).json({ ok: true })

  const call = obj(msg.call)
  const callId = str(call.id, 200)
  if (callId) {
    if (seen.has(callId)) return res.status(200).json({ ok: true, deduped: true })
    if (seen.size > 2000) seen.clear()
    seen.add(callId)
  }

  const analysis = obj(msg.analysis)
  const sd = parseStructured(analysis.structuredData)
  const artifact = obj(msg.artifact)

  const summary = str(msg.summary, 4000) || str(analysis.summary, 4000)
  const transcript = str(artifact.transcript, 6000) || str(msg.transcript, 6000)
  const durationS = num(msg.durationSeconds) ?? 0
  const callerNumber = str(obj(call.customer).number, 40) || str(obj(msg.customer).number, 40)

  const name = str(sd.name, 200)
  const phone = str(sd.phone, 40) || callerNumber
  const email = str(sd.email, 200)
  const wants = str(sd.message, 2000) || str(sd.request, 2000)
  const preferred = str(sd.callback_time, 200) || str(sd.preferredTime, 200)

  // Misdials and instant hangups don't become inbox rows.
  const worthFiling = Boolean(summary || wants || name || (durationS >= 10 && transcript))
  if (!worthFiling || !SB_URL || !SB_ANON) {
    return res.status(200).json({ ok: true, filed: false })
  }

  const messageText = [
    '📞 AI phone call summary:',
    summary || wants || '(no summary — see transcript)',
    wants && summary ? `\nCaller's request: ${wants}` : null,
    durationS ? `\nCall length: ${Math.round(durationS)}s` : null,
    transcript ? `\n— Transcript —\n${transcript}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
    .slice(0, 9000)

  try {
    // Into the normal inquiry pipeline: Admin → Inbox row + the owner email via
    // the existing inquiries INSERT webhook. Same anon-insert path as the
    // public quote form.
    const upstream = await fetch(`${SB_URL}/rest/v1/inquiries`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        kind: 'callback',
        name: name || 'Phone caller',
        phone,
        email,
        message: messageText,
        preferred_time: preferred,
      }),
    })
    if (!upstream.ok) {
      console.error('vapi inquiry insert', upstream.status, (await upstream.text()).slice(0, 200))
      if (callId) seen.delete(callId) // let Vapi's retry try again
      return res.status(500).json({ ok: false })
    }
    return res.status(200).json({ ok: true, filed: true })
  } catch (e) {
    console.error('vapi handler', e instanceof Error ? e.message : e)
    if (callId) seen.delete(callId)
    return res.status(500).json({ ok: false })
  }
}
