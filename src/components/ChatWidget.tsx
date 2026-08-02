import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Loader2, MessageCircle, MessageSquare, Phone, Send, Sparkles, X } from 'lucide-react'
import { PHONE_TEL, WHATSAPP_DISPLAY, WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'
import { track } from '../lib/analytics'

const BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

// AI assistant chat. Floats bottom-LEFT (the WhatsApp FAB owns bottom-right).
// Backend is /api/chat; when it reports {configured:false} — or the network
// fails — the composer is replaced by a WhatsApp + quote-form fallback, so the
// widget degrades gracefully with no backend at all.

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const STORE_KEY = 'cuw-chat-transcript'
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 2000
const MAX_TOTAL_CHARS = 12000

const SUGGESTIONS = [
  'How much do custom cakes cost?',
  'Do you make eggless cakes?',
  'How far ahead should I order?',
]

function loadTranscript(): ChatMsg[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is ChatMsg =>
        typeof m === 'object' &&
        m !== null &&
        ((m as ChatMsg).role === 'user' || (m as ChatMsg).role === 'assistant') &&
        typeof (m as ChatMsg).content === 'string',
    )
  } catch {
    return []
  }
}

/** Trim history to the API's limits, always keeping the newest messages. */
function clampHistory(msgs: ChatMsg[]): ChatMsg[] {
  let out = msgs.slice(-MAX_MESSAGES)
  let total = out.reduce((n, m) => n + m.content.length, 0)
  while (out.length > 1 && total >= MAX_TOTAL_CHARS) {
    total -= out[0].content.length
    out = out.slice(1)
  }
  // The API requires the history to start with a user turn.
  while (out.length > 1 && out[0].role !== 'user') out = out.slice(1)
  return out
}

const CALLBACK_TIMES = ['Anytime', 'Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–7)']

/** Callback request — lands in the admin Inquiries inbox (kind "callback"). */
function CallbackForm({ onDone, onCancel }: { onDone: (confirmation: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [time, setTime] = useState(CALLBACK_TIMES[0])
  const [topic, setTopic] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const input =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim()) {
      setError('Your name and number, so Parul knows who to call.')
      return
    }
    setSending(true)
    const draft = {
      kind: 'callback' as const,
      name: name.trim(),
      phone: phone.trim(),
      email: '',
      eventDate: '',
      pickupDate: '',
      occasion: '',
      theme: '',
      servings: '',
      flavor: '',
      budget: '',
      dietary: '',
      message: topic.trim(),
      cakeId: null,
      cakeTitle: '',
      photos: [],
      preferredTime: time,
    }
    try {
      const inquiries = await import('../lib/inquiries')
      if (!BACKEND) {
        if (WHATSAPP_ENABLED) {
          window.open(inquiries.waLink(draft), '_blank', 'noopener')
          track('callback_requested', { channel: 'whatsapp-fallback' })
          onDone('Your callback request opened in WhatsApp — hit send there and Parul will ring you back.')
        } else {
          onDone(`We couldn't save that just now — please call or text ${WHATSAPP_DISPLAY} and Parul will help directly.`)
        }
        return
      }
      await inquiries.submitInquiry(draft)
      track('callback_requested', { channel: 'chat' })
      onDone(
        `Done! Parul will call you back${time === 'Anytime' ? '' : ` in the ${time.toLowerCase()}`} at ${phone.trim()}. 📞`,
      )
    } catch {
      setError(`That didn’t go through — try again, or call/text ${WHATSAPP_DISPLAY}.`)
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto px-4 py-4">
      <p className="flex items-center gap-2 font-display text-base font-bold">
        <Phone size={16} className="text-accent" aria-hidden="true" /> Request a callback
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Parul calls you — usually the same day.</p>
      <label className="mt-3 block text-sm font-medium">
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
      </label>
      <label className="mt-3 block text-sm font-medium">
        Phone *
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={input} />
      </label>
      <label className="mt-3 block text-sm font-medium">
        Best time
        <select value={time} onChange={(e) => setTime(e.target.value)} className={input}>
          {CALLBACK_TIMES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm font-medium">
        What&rsquo;s it about? <span className="font-normal text-muted-foreground">(optional)</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. wedding cake for October"
          className={input}
        />
      </label>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {sending ? 'Sending…' : 'Request callback'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          Back to chat
        </button>
      </div>
    </form>
  )
}

export default function ChatWidget() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [show, setShow] = useState(!isHome)
  const [open, setOpen] = useState(false)
  // Omnichannel: when Chatwoot is configured in Admin → Setup, its bubble
  // replaces this widget entirely (one inbox for web/FB/IG/WhatsApp).
  const [chatwoot, setChatwoot] = useState(false)
  useEffect(() => {
    if (!BACKEND) return
    let active = true
    import('../lib/chatwoot').then(async (m) => {
      const cfg = await m.fetchChatwootConfig()
      if (active && cfg) {
        m.mountChatwoot(cfg)
        setChatwoot(true)
      }
    })
    return () => {
      active = false
    }
  }, [])
  const [messages, setMessages] = useState<ChatMsg[]>(loadTranscript)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [view, setView] = useState<'chat' | 'callback'>('chat')

  const callbackDone = (confirmation: string) => {
    setMessages((m) => [...m, { role: 'assistant', content: confirmation }])
    setView('chat')
  }
  const inputRef = useRef<HTMLInputElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Same reveal timing as the WhatsApp FAB: on home, wait until the hero passes.
  useEffect(() => {
    if (!isHome) {
      setShow(true)
      return
    }
    const onScroll = () => {
      const hero = document.getElementById('top')
      setShow(hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.6 : window.scrollY > window.innerHeight * 1.95)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages))
    } catch {
      /* storage full/blocked — transcript just won't persist */
    }
  }, [messages])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        fabRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open && !fallback) inputRef.current?.focus()
  }, [open, fallback])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, open])

  const send = async (text: string) => {
    const content = text.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!content || pending) return
    const next = clampHistory([...messages, { role: 'user' as const, content }])
    setMessages(next)
    setInput('')
    setPending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { configured?: boolean; reply?: string }
      const reply = typeof data.reply === 'string' ? data.reply.trim() : ''
      if (!data.configured || !reply) {
        setFallback(true)
        return
      }
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setFallback(true)
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const visible = show || open

  // Chatwoot mounted its own bubble — ours steps aside (after all hooks ran).
  if (chatwoot) return null

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close CakeUWish chat' : 'Ask CakeUWish — AI chat assistant'}
        aria-expanded={open}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className={`fixed z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary transition-all duration-300 hover:scale-110 ${
          visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'
        }`}
        style={{
          boxShadow: '0 4px 14px rgba(58,42,30,0.28), 0 0 0 1.5px #96601A',
          left: 'max(1.25rem, env(safe-area-inset-left))',
          bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <span className="relative" aria-hidden="true">
            <MessageSquare size={26} />
            <Sparkles size={13} className="absolute -right-1.5 -top-1.5 text-gold-soft" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ask CakeUWish — AI chat assistant"
          className="fixed inset-x-0 bottom-0 z-[95] flex max-h-[min(78vh,600px)] flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-cake sm:inset-x-auto sm:bottom-24 sm:left-[max(1.25rem,env(safe-area-inset-left))] sm:w-[380px] sm:rounded-3xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* header */}
          <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-on-primary">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="shrink-0 text-gold-soft" aria-hidden="true" />
              <div>
                <p className="font-display text-base font-bold leading-tight">Ask CakeUWish</p>
                <p className="text-[11px] leading-tight opacity-70">
                  AI assistant · Parul answers personally for quotes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                fabRef.current?.focus()
              }}
              aria-label="Close chat"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {view === 'callback' ? (
            <CallbackForm onDone={callbackDone} onCancel={() => setView('chat')} />
          ) : (
          <>
          {/* messages */}
          <div ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !fallback && (
              <div>
                <p className="text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                  Hi! Ask me anything about flavors, sizing, ordering, or policies. For an exact
                  price, I&rsquo;ll point you to a quick quote request.
                </p>
                <div className="mt-3 flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-background px-3.5 py-2 text-left text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setView('callback')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent px-3.5 py-2 text-left text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                  >
                    <Phone size={14} aria-hidden="true" /> Request a callback
                  </button>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <p
                key={`${i}-${m.role}`}
                className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto rounded-2xl rounded-br-md bg-primary text-on-primary'
                    : 'mr-auto rounded-2xl rounded-bl-md bg-muted text-foreground'
                }`}
                style={{ lineHeight: 1.55 }}
              >
                {m.content}
              </p>
            ))}
            {pending && (
              <div
                role="status"
                aria-label="Assistant is typing"
                className="mr-auto flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3"
              >
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${delay}ms` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
            {fallback && (
              <div className="mr-auto max-w-[95%] rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <p className="text-sm font-medium">Chat is warming up — meanwhile:</p>
                <div className="mt-2.5 flex flex-col items-start gap-2">
                  {!WHATSAPP_ENABLED && (
                    <a
                      href={PHONE_TEL}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
                    >
                      <Phone size={15} aria-hidden="true" /> Call or text {WHATSAPP_DISPLAY}
                    </a>
                  )}
                  {WHATSAPP_ENABLED && (
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-loc="chat-fallback"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                      style={{ backgroundColor: '#1A8A4E' }}
                    >
                      <MessageCircle size={16} fill="white" strokeWidth={0} aria-hidden="true" />
                      Chat on WhatsApp
                    </a>
                  )}
                  <Link
                    to="/order#request"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-[44px] items-center rounded-full border-2 border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary"
                  >
                    Request a quote
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView('callback')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 border-accent px-5 py-2.5 text-sm font-semibold text-accent hover:bg-accent hover:text-white"
                  >
                    <Phone size={15} aria-hidden="true" /> Request a callback
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setFallback(false)}
                  className="mt-2.5 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-primary"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* composer */}
          {!fallback && (
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
              <button
                type="button"
                onClick={() => setView('callback')}
                aria-label="Request a callback"
                title="Request a callback"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-accent hover:text-accent"
              >
                <Phone size={17} aria-hidden="true" />
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_MESSAGE_CHARS}
                placeholder="Ask about flavors, sizing, ordering…"
                aria-label="Your message"
                className="min-h-[44px] flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-40"
              >
                <Send size={17} aria-hidden="true" />
              </button>
            </form>
          )}
          </>
          )}

          <p className="px-4 pb-2.5 pt-0.5 text-center text-[11px] text-muted-foreground">
            AI can make mistakes — confirm details with Parul.
          </p>
        </div>
      )}
    </>
  )
}
