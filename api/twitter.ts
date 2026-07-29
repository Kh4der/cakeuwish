import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomBytes } from 'node:crypto'

// X / Twitter for the admin Social page. ADMIN-ONLY (session-token verified).
//
// Env (server-only) — from the client's app at developer.x.com with
// "Read and write" user authentication set up:
//   TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET   (API key + secret)
//   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET     (the account's tokens)
//
// Billing reality (surfaced to the UI): X retired its free tier on 6 Feb 2026
// and now meters per request, so posting draws down a credit balance — a 402
// means the balance is empty, and returns {creditsExhausted:true}. READING
// mentions additionally requires a paid plan; those calls return
// {tierBlocked:true} instead of failing loudly.

const CK = process.env.TWITTER_CONSUMER_KEY
const CS = process.env.TWITTER_CONSUMER_SECRET
const AT = process.env.TWITTER_ACCESS_TOKEN
const AS = process.env.TWITTER_ACCESS_SECRET

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

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** OAuth 1.0a HMAC-SHA1 Authorization header (query params join the signature; JSON bodies don't). */
function oauthHeader(method: 'GET' | 'POST', url: string, query: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CK!,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: AT!,
    oauth_version: '1.0',
  }
  const all = { ...oauth, ...query }
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join('&')
  const base = `${method}&${enc(url)}&${enc(paramString)}`
  const signingKey = `${enc(CS!)}&${enc(AS!)}`
  const signature = createHmac('sha1', signingKey).update(base).digest('base64')
  const header = { ...oauth, oauth_signature: signature }
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${enc(k)}="${enc(header[k as keyof typeof header]!)}"`)
    .join(', ')}`
}

async function xFetch(method: 'GET' | 'POST', url: string, query: Record<string, string> = {}, body?: unknown) {
  const qs = Object.keys(query).length
    ? '?' + Object.entries(query).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&')
    : ''
  return fetch(url + qs, {
    method,
    headers: {
      Authorization: oauthHeader(method, url, query),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!(await verifyAdmin(token))) return res.status(401).json({ error: 'Sign in to the admin panel first.' })

  if (!CK || !CS || !AT || !AS) return res.status(200).json({ configured: false })

  try {
    // ── GET ?action=me|mentions ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const action = String(req.query.action ?? 'me')

      const meRes = await xFetch('GET', 'https://api.twitter.com/2/users/me')
      if (meRes.status === 401) return res.status(200).json({ configured: true, authFailed: true })
      if (meRes.status === 402) return res.status(200).json({ configured: true, creditsExhausted: true })
      if (!meRes.ok) {
        console.error('x /users/me', meRes.status, (await meRes.text()).slice(0, 300))
        return res.status(200).json({ configured: true, tierBlocked: meRes.status === 403 || meRes.status === 429 })
      }
      const me = (await meRes.json()) as { data?: { id: string; username: string; name: string } }
      if (action === 'me' || !me.data) {
        return res.status(200).json({ configured: true, user: me.data ?? null })
      }

      // mentions — paid Basic tier territory
      const mRes = await xFetch('GET', `https://api.twitter.com/2/users/${me.data.id}/mentions`, {
        max_results: '20',
        'tweet.fields': 'created_at,author_id,conversation_id',
        expansions: 'author_id',
        'user.fields': 'username,name',
      })
      if (mRes.status === 402 || mRes.status === 403 || mRes.status === 429) {
        return res.status(200).json({ configured: true, user: me.data, tierBlocked: true })
      }
      if (!mRes.ok) {
        console.error('x mentions', mRes.status, (await mRes.text()).slice(0, 300))
        return res.status(200).json({ configured: true, user: me.data, tierBlocked: true })
      }
      const mentions = (await mRes.json()) as {
        data?: { id: string; text: string; author_id?: string; created_at?: string }[]
        includes?: { users?: { id: string; username: string; name: string }[] }
      }
      const users = new Map((mentions.includes?.users ?? []).map((u) => [u.id, u]))
      return res.status(200).json({
        configured: true,
        user: me.data,
        mentions: (mentions.data ?? []).map((t) => ({
          id: t.id,
          text: t.text,
          createdAt: t.created_at ?? '',
          author: users.get(t.author_id ?? '') ?? null,
        })),
      })
    }

    // ── POST {text, replyToId?} — tweet or reply ────────────────────────────
    if (req.method === 'POST') {
      const body = req.body as { text?: unknown; replyToId?: unknown } | undefined
      const text = typeof body?.text === 'string' ? body.text.trim() : ''
      const replyToId = typeof body?.replyToId === 'string' ? body.replyToId : ''
      if (!text || text.length > 280) {
        return res.status(400).json({ error: 'Tweet text must be 1–280 characters.' })
      }
      const payload: Record<string, unknown> = { text }
      if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }
      const postRes = await xFetch('POST', 'https://api.twitter.com/2/tweets', {}, payload)
      if (!postRes.ok) {
        console.error('x post', postRes.status, (await postRes.text()).slice(0, 300))
        return res.status(502).json({
          error:
            postRes.status === 401
              ? 'X rejected the keys — regenerate the access token with Read and Write permissions.'
              : postRes.status === 402
                ? 'X is out of API credits — top up the balance in the X developer console.'
                : postRes.status === 429
                  ? 'X rate limit hit — try again in a bit.'
                  : 'Posting failed — check the X developer portal.',
        })
      }
      const json = (await postRes.json()) as { data?: { id: string } }
      return res.status(200).json({ posted: true, id: json.data?.id ?? '' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('twitter handler', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'X request failed.' })
  }
}
