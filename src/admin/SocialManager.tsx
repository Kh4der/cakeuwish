import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, ExternalLink, Loader2, Lock, MessageSquareReply, Send } from 'lucide-react'
import { accessToken } from './lib/configDb'

// X / Twitter from inside the admin: compose tweets, see mentions, reply —
// all through /api/twitter (admin-token gated, keys in Vercel env).

interface XUser {
  id: string
  username: string
  name: string
}
interface Mention {
  id: string
  text: string
  createdAt: string
  author: XUser | null
}

const MAX = 280

export default function SocialManager() {
  const [state, setState] = useState<'loading' | 'unconfigured' | 'authFailed' | 'noCredits' | 'ready'>('loading')
  const [user, setUser] = useState<XUser | null>(null)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [tierBlocked, setTierBlocked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<Mention | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const token = await accessToken()
        const res = await fetch('/api/twitter?action=mentions', { headers: { Authorization: `Bearer ${token}` } })
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean
          authFailed?: boolean
          creditsExhausted?: boolean
          user?: XUser | null
          mentions?: Mention[]
          tierBlocked?: boolean
        }
        if (data.authFailed) {
          setState('authFailed')
          return
        }
        if (data.creditsExhausted) {
          setState('noCredits')
          return
        }
        // Only an explicit configured:true counts — under plain vite dev the
        // /api route doesn't exist and the fetch returns the SPA's HTML.
        if (!res.ok || data.configured !== true) {
          setState('unconfigured')
          return
        }
        setUser(data.user ?? null)
        setMentions(data.mentions ?? [])
        setTierBlocked(Boolean(data.tierBlocked))
        setState('ready')
      } catch {
        setState('unconfigured')
      }
    })()
  }, [])

  const post = async (body: { text: string; replyToId?: string }) => {
    const token = await accessToken()
    const res = await fetch('/api/twitter', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { posted?: boolean; error?: string }
    if (!res.ok || !data.posted) throw new Error(data.error ?? 'Posting failed.')
  }

  const sendTweet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setPosting(true)
    setError('')
    setNotice('')
    try {
      await post({ text: text.trim() })
      setText('')
      setNotice('Tweet posted! 🎉')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Posting failed.')
    } finally {
      setPosting(false)
    }
  }

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyTo || !replyText.trim()) return
    setReplying(true)
    setError('')
    setNotice('')
    try {
      await post({ text: replyText.trim(), replyToId: replyTo.id })
      setNotice(`Reply sent to @${replyTo.author?.username ?? 'them'}!`)
      setReplyTo(null)
      setReplyText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed.')
    } finally {
      setReplying(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Connecting to X…
      </div>
    )
  }

  if (state === 'noCredits') {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <AtSign size={22} className="text-accent" /> X / Twitter
        </h1>
        <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Lock size={15} className="text-amber-600" /> X is out of API credits.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            X retired its free tier in February 2026 and now charges per request. Top up the balance at{' '}
            <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
              developer.x.com <ExternalLink size={11} className="inline" aria-hidden="true" />
            </a>{' '}
            and this page comes straight back. Roughly $0.015 per post — a caption containing a link costs more.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'unconfigured' || state === 'authFailed') {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <AtSign size={22} className="text-accent" /> X / Twitter
        </h1>
        <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Lock size={15} className="text-amber-600" />
            {state === 'authFailed' ? 'X rejected the configured keys.' : 'Not connected yet.'}
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Create a (free) developer app at{' '}
              <a href="https://developer.x.com" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                developer.x.com <ExternalLink size={11} className="inline" aria-hidden="true" />
              </a>{' '}
              while signed in as the bakery's X account.
            </li>
            <li>In the app's settings, set up User authentication with <strong>Read and Write</strong> permissions.</li>
            <li>Generate all four values: API Key + Secret, Access Token + Secret{state === 'authFailed' ? ' (regenerate AFTER changing permissions)' : ''}.</li>
            <li>
              Add them on Vercel, then redeploy:
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{`vercel env add TWITTER_CONSUMER_KEY production
vercel env add TWITTER_CONSUMER_SECRET production
vercel env add TWITTER_ACCESS_TOKEN production
vercel env add TWITTER_ACCESS_SECRET production`}</pre>
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            X charges per request since February 2026 (no free tier) — posting is a few cents. Reading mentions here
            additionally needs one of their paid plans. Make sure the app sits in a <strong>Project</strong> on a{' '}
            <strong>Production</strong> environment, or photo and video uploads fail even while text posts work.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <AtSign size={22} className="text-accent" /> X / Twitter
        </h1>
        {user && (
          <a
            href={`https://x.com/${user.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
          >
            <AtSign size={14} className="text-accent" /> {user.username} <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>

      {notice && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* compose */}
        <form onSubmit={sendTweet} className="h-fit rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Compose</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder="Fresh out of the oven today…"
            className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs tabular-nums ${text.length > MAX - 20 ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>
              {text.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {posting ? 'Posting…' : 'Post tweet'}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This box is for quick text-only updates. To post a photo or video — and send it to Facebook and Instagram at
            the same time — use{' '}
            <Link to="/compose" className="font-semibold text-accent hover:underline">
              Share a post
            </Link>
            .
          </p>
        </form>

        {/* mentions + replies */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Mentions & replies</h2>
          {tierBlocked ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Reading mentions needs X's paid Basic API tier.</p>
              <p className="mt-1">
                Posting works on the free tier (compose on the left). To pull mentions and reply from this
                screen, upgrade the developer app at{' '}
                <a href="https://developer.x.com/en/portal/products" target="_blank" rel="noreferrer" className="font-semibold underline">
                  developer.x.com
                </a>{' '}
                — until then, reply from the X app itself.
              </p>
            </div>
          ) : mentions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No mentions yet — when someone tags the bakery, it shows up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {mentions.map((m) => (
                <li key={m.id} className="py-3">
                  <p className="text-sm">
                    <a
                      href={`https://x.com/${m.author?.username ?? ''}/status/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-accent hover:underline"
                    >
                      @{m.author?.username ?? 'someone'}
                    </a>{' '}
                    <span className="text-xs text-muted-foreground">{m.createdAt.slice(0, 10)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm" style={{ lineHeight: 1.55 }}>
                    {m.text}
                  </p>
                  {replyTo?.id === m.id ? (
                    <form onSubmit={sendReply} className="mt-2 flex items-start gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        maxLength={MAX}
                        rows={2}
                        autoFocus
                        placeholder={`Reply to @${m.author?.username ?? ''}…`}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                      />
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="submit"
                          disabled={replying || !replyText.trim()}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
                        >
                          {replying ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTo(null)}
                          className="rounded-full px-4 py-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(m)
                        setReplyText('')
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:border-accent hover:text-accent"
                    >
                      <MessageSquareReply size={13} /> Reply
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
