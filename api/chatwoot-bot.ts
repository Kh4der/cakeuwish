import type { VercelRequest, VercelResponse } from '@vercel/node'
import { waitUntil } from '@vercel/functions'

// Chatwoot agent-bot bridge — the omnichannel half of the AI assistant.
//
// Chatwoot POSTs conversation events here; we answer with the SAME brain that
// powers the website widget by self-calling /api/chat on this deployment. One
// knowledge base (chat.ts static doc + admin "AI Facts"), every channel:
// website, and — once their inboxes are connected in Chatwoot — Facebook
// Messenger, Instagram DMs, and WhatsApp, identically.
//
// FRAMEWORK NOTE: nothing client-specific lives in this file. Client knowledge
// stays in /api/chat + the kb_entries table; this adapter is pure plumbing and
// ships unchanged to every deployment — only the env values differ.
//
// Env (server-only):
//   CHATWOOT_BOT_TOKEN      — the agent bot's access_token (Settings → Bots)
//   CHATWOOT_ACCOUNT_ID     — the number in app.chatwoot.com/app/accounts/<N>/
//   CHATWOOT_WEBHOOK_SECRET — any long random string; the bot's webhook URL is
//                             https://<domain>/api/chatwoot-bot?secret=<value>
//   CHATWOOT_BASE_URL       — optional; defaults to https://app.chatwoot.com
// All absent → {configured:false} (bot simply not wired; nothing breaks).
//
// Contract facts this file depends on (verified against the Chatwoot source):
// - Webhook `message_type` is the STRING "incoming"/"outgoing"/"template";
//   the REST history API returns it as an INTEGER (0/1/2/3). Both handled.
// - The webhook also fires for the bot's OWN outgoing messages — the
//   incoming-only guard below is the loop protection, never remove it.
// - Chatwoot's delivery timeout is ~5s and a failed delivery AUTO-OPENS a
//   pending conversation. LLM calls can exceed 5s, so we ACK 200 immediately
//   and do the actual work in waitUntil().
// - The bot token may call conversations#show + messages#create +
//   toggle_status, but NOT the messages index — history is read via show.
// - conversation.can_reply === false means Meta's 24h window is closed on
//   FB/IG/WhatsApp; a plain send would fail, so we hand off instead.

const BOT_TOKEN = process.env.CHATWOOT_BOT_TOKEN
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID
const SECRET = process.env.CHATWOOT_WEBHOOK_SECRET
const BASE_URL = (process.env.CHATWOOT_BASE_URL || 'https://app.chatwoot.com').replace(/\/$/, '')

const CONFIGURED = Boolean(BOT_TOKEN && ACCOUNT_ID && SECRET)

// ── webhook payload shapes (only the fields we read) ────────────────────────
interface WebhookConversation {
  id?: number // display_id — THE id used in API paths
  status?: string
  can_reply?: boolean
  channel?: string
}

interface WebhookPayload {
  event?: string
  content?: string | null
  message_type?: string
  private?: boolean
  content_attributes?: { image_type?: string }
  account?: { id?: number }
  conversation?: WebhookConversation
}

interface HistoryMessage {
  content?: string | null
  message_type?: number | string
  private?: boolean
  created_at?: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Customer asked for a human — hand off rather than let the AI talk in circles.
const HANDOFF_RE =
  /\b(human|real person|a person|someone real|agent|representative|staff|owner|manager|call me|call back|callback|phone call|speak (with|to)|talk (with|to))\b/i

// /api/chat's parser limits — stay inside them.
const MAX_TURNS = 10
const MAX_MSG_CHARS = 2000

// Dedupe retried deliveries per warm instance (X-Chatwoot-Delivery UUID).
const seen = new Set<string>()

// ── Chatwoot REST (bot token) ───────────────────────────────────────────────
async function cw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}/api/v1/accounts/${ACCOUNT_ID}${path}`, {
    ...init,
    headers: {
      api_access_token: BOT_TOKEN as string,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

async function sendReply(conversationId: number, content: string, isPrivate = false): Promise<void> {
  const res = await cw(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, message_type: 'outgoing', private: isPrivate }),
  })
  if (!res.ok) console.error('chatwoot send', res.status, (await res.text()).slice(0, 200))
}

/** Hand the conversation to a human: optional context note, then status → open. */
async function handoff(conversationId: number, note: string, customerMessage?: string): Promise<void> {
  if (note) await sendReply(conversationId, note, true).catch(() => {})
  if (customerMessage) {
    await sendReply(
      conversationId,
      'Got it — connecting you with the team now. Someone will reply right here shortly. 💬',
    ).catch(() => {})
  }
  const res = await cw(`/conversations/${conversationId}/toggle_status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'open' }),
  })
  if (!res.ok) console.error('chatwoot handoff', res.status, (await res.text()).slice(0, 200))
}

/**
 * Conversation history via conversations#show (the bot-accessible read; the
 * messages index rejects bot tokens). Returns /api/chat-shaped turns: private
 * notes and activity rows dropped, consecutive same-role turns merged, first
 * and last guaranteed to be the customer.
 */
async function fetchHistory(conversationId: number, fallback: string): Promise<ChatMessage[]> {
  const single: ChatMessage[] = [{ role: 'user', content: fallback.slice(0, MAX_MSG_CHARS) }]
  try {
    const res = await cw(`/conversations/${conversationId}`)
    if (!res.ok) return single
    const json = (await res.json()) as { messages?: HistoryMessage[]; payload?: { messages?: HistoryMessage[] } }
    const raw = json.messages ?? json.payload?.messages ?? []
    const turns: ChatMessage[] = []
    for (const m of [...raw].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0))) {
      if (m.private) continue
      const text = (m.content ?? '').trim()
      if (!text) continue
      // REST returns the integer enum; the webhook the string — accept both.
      const t = m.message_type
      const role: ChatMessage['role'] | null =
        t === 0 || t === 'incoming' ? 'user' : t === 1 || t === 'outgoing' ? 'assistant' : null
      if (!role) continue // activity/template rows are not conversation turns
      const prev = turns[turns.length - 1]
      if (prev && prev.role === role) {
        prev.content = `${prev.content}\n\n${text}`.slice(0, MAX_MSG_CHARS)
      } else {
        turns.push({ role, content: text.slice(0, MAX_MSG_CHARS) })
      }
    }
    while (turns.length && turns[0].role !== 'user') turns.shift()
    if (!turns.length || turns[turns.length - 1].role !== 'user') {
      const prev = turns[turns.length - 1]
      if (prev && prev.role === 'user') prev.content = `${prev.content}\n\n${fallback}`.slice(0, MAX_MSG_CHARS)
      else turns.push({ role: 'user', content: fallback.slice(0, MAX_MSG_CHARS) })
    }
    return turns.slice(-MAX_TURNS)
  } catch {
    return single
  }
}

/** The actual work, run inside waitUntil after the 200 has been sent. */
async function respond(host: string, p: WebhookPayload): Promise<void> {
  const conversationId = p.conversation?.id
  const content = (p.content ?? '').trim()
  if (!conversationId || !content) return

  try {
    // Meta's messaging window is closed → a send would fail; give it to a human.
    if (p.conversation?.can_reply === false) {
      await handoff(conversationId, 'AI assistant: messaging window closed on this channel — needs a human follow-up.')
      return
    }

    if (HANDOFF_RE.test(content)) {
      await handoff(conversationId, 'AI assistant: customer asked for a human — handing off.', content)
      return
    }

    const messages = await fetchHistory(conversationId, content)
    const upstream = await fetch(`https://${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const data = (await upstream.json().catch(() => ({}))) as { configured?: boolean; reply?: string }

    // AI missing or down → seamless human transfer, never silence.
    if (!upstream.ok || data.configured === false || !data.reply?.trim()) {
      await handoff(conversationId, 'AI assistant: no answer available (AI unconfigured or upstream error) — handing off.')
      return
    }

    await sendReply(conversationId, data.reply.trim())
  } catch (e) {
    console.error('chatwoot-bot respond', e instanceof Error ? e.message : e)
    await handoff(conversationId, 'AI assistant: internal error — handing off.').catch(() => {})
  }
}

// ── handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!CONFIGURED) return res.status(200).json({ configured: false })

  // Same trust model as /api/notify: the secret lives in the webhook URL.
  if (req.query.secret !== SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const p = (req.body ?? {}) as WebhookPayload

  // The loop guard. The webhook fires for our own outgoing replies too — only
  // fresh customer text in a bot-owned (pending) conversation gets a response.
  const shouldRespond =
    p.event === 'message_created' &&
    p.message_type === 'incoming' &&
    p.private !== true &&
    p.conversation?.status === 'pending' &&
    String(p.account?.id ?? '') === String(ACCOUNT_ID) &&
    p.content_attributes?.image_type !== 'story_mention' // IG story tags aren't questions

  // Retried deliveries (Chatwoot retries on our 5xx) must not double-reply.
  const delivery = String(req.headers['x-chatwoot-delivery'] ?? '')
  if (delivery) {
    if (seen.has(delivery)) return res.status(200).json({ ok: true, deduped: true })
    if (seen.size > 2000) seen.clear()
    seen.add(delivery)
  }

  // ACK within Chatwoot's ~5s window NO MATTER WHAT — a timeout would make
  // Chatwoot auto-open the conversation as a bot failure. The LLM work
  // continues in the background via waitUntil.
  if (shouldRespond) {
    waitUntil(respond(String(req.headers.host ?? ''), p))
  }
  return res.status(200).json({ ok: true })
}
