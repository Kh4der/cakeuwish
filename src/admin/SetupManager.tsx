import { useEffect, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  MessagesSquare,
  PhoneCall,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { accessToken, currentEmail, getConfig, saveConfig, type SiteConfig } from './lib/configDb'

// Installation panel — the agency's cockpit for configuring a client
// deployment without touching code. Secret API keys deliberately live in
// Vercel env (never in this database); this page shows their live status and
// the exact command to set each one.

interface KeyStatus {
  supabase: boolean
  anthropic: boolean
  openai: boolean
  resend: boolean
  notifySecret: boolean
  posthogCapture: boolean
  posthogDashboard: boolean
  twitter: boolean
  facebook: boolean
  instagram: boolean
  chatwootBot: boolean
  llm: boolean
  vapi: boolean
}

const input =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent'
const label = 'block text-sm font-medium'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusRow({ ok, name, getAt, cmd }: { ok: boolean; name: string; getAt?: string; cmd?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
      {ok ? (
        <CheckCircle2 size={16} className="shrink-0 text-green-700" aria-hidden="true" />
      ) : (
        <Circle size={16} className="shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <span className="min-w-32 font-medium">{name}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ok ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>
        {ok ? 'Configured' : 'Missing'}
      </span>
      {!ok && getAt && (
        <a href={getAt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Get key <ExternalLink size={11} aria-hidden="true" />
        </a>
      )}
      {!ok && cmd && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(cmd).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted"
          title={cmd}
        >
          <Copy size={11} aria-hidden="true" /> {copied ? 'copied!' : cmd}
        </button>
      )}
    </li>
  )
}

export default function SetupManager() {
  const [config, setConfig] = useState<SiteConfig | null>(null)
  const [me, setMe] = useState('')
  const [keys, setKeys] = useState<KeyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    Promise.all([getConfig(), currentEmail()])
      .then(async ([c, email]) => {
        setConfig(c)
        setMe(email)
        // Key status needs the deployed API — fails silently under plain vite dev.
        try {
          const token = await accessToken()
          const res = await fetch('/api/status', { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) setKeys((await res.json()) as KeyStatus)
        } catch {
          /* local dev — status board shows unknown */
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const patch = (p: Partial<SiteConfig>) => {
    setConfig((c) => (c ? { ...c, ...p } : c))
    setSaveState('idle')
  }

  const save = async () => {
    if (!config) return
    setSaveState('saving')
    setError(null)
    try {
      await saveConfig(config)
      setSaveState('saved')
    } catch (e) {
      setError(
        e instanceof Error && /policy|permission|denied/i.test(e.message)
          ? `Saving is restricted to the super admin (${config.superAdminEmail}). You are signed in as ${me}.`
          : e instanceof Error
            ? e.message
            : 'Save failed',
      )
      setSaveState('error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading setup…
      </div>
    )
  }
  if (!config) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? 'Run migration 0010 first (supabase/setup.sql).'}</p>
  }

  const isSuper = me !== '' && me === config.superAdminEmail

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <ShieldCheck size={22} className="text-accent" /> Installation setup
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The agency cockpit: client details, channels, and integration status — no code required.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saveState === 'saving' || !isSuper}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          {saveState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save all changes'}
        </button>
      </div>

      {!isSuper && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Lock size={14} /> Read-only: only the super admin ({config.superAdminEmail}) can save changes here.
        </p>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title="Business identity" hint="Rendered across the website.">
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Business name
              <input value={config.businessName} onChange={(e) => patch({ businessName: e.target.value })} className={input} />
            </label>
            <label className={label}>
              Legal name
              <input value={config.legalName} onChange={(e) => patch({ legalName: e.target.value })} className={input} />
            </label>
            <label className={label}>
              Owner / baker name
              <input value={config.ownerName} onChange={(e) => patch({ ownerName: e.target.value })} className={input} />
            </label>
            <label className={label}>
              City
              <input value={config.city} onChange={(e) => patch({ city: e.target.value })} className={input} />
            </label>
            <label className={label}>
              State / region
              <input value={config.region} onChange={(e) => patch({ region: e.target.value })} className={input} />
            </label>
          </div>
        </Section>

        <Section title="Contact & channels">
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Phone (E.164)
              <input value={config.phoneE164} onChange={(e) => patch({ phoneE164: e.target.value })} placeholder="+15717625848" className={input} />
            </label>
            <label className={label}>
              Phone (display)
              <input value={config.phoneDisplay} onChange={(e) => patch({ phoneDisplay: e.target.value })} className={input} />
            </label>
            <label className={`${label} col-span-2`}>
              Facebook URL
              <input value={config.facebookUrl} onChange={(e) => patch({ facebookUrl: e.target.value })} className={input} />
            </label>
            <label className={`${label} col-span-2`}>
              Instagram URL
              <input value={config.instagramUrl} onChange={(e) => patch({ instagramUrl: e.target.value })} className={input} />
            </label>
            <label className={`${label} col-span-2`}>
              X / Twitter handle <span className="font-normal text-muted-foreground">(without @)</span>
              <input value={config.twitterHandle} onChange={(e) => patch({ twitterHandle: e.target.value.replace(/^@/, '') })} placeholder="cakeuwish" className={input} />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={config.whatsappEnabled}
              onChange={(e) => patch({ whatsappEnabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            WhatsApp buttons on the website
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Note: the live site currently reads this switch from code (src/config/site.ts) — keep both in sync until the
            runtime-config rollout.
          </p>
        </Section>

        <Section title="Reviews">
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Rating
              <input value={config.reviewRating} onChange={(e) => patch({ reviewRating: e.target.value })} className={input} />
            </label>
            <label className={label}>
              Review count
              <input
                type="number"
                value={config.reviewCount}
                onChange={(e) => patch({ reviewCount: Math.max(0, Math.round(e.target.valueAsNumber || 0)) })}
                className={input}
              />
            </label>
            <label className={label}>
              SociableKit embed ID
              <input value={config.sociablekitId} onChange={(e) => patch({ sociablekitId: e.target.value })} className={input} />
            </label>
            <label className={label}>
              Google Place ID
              <input value={config.googlePlaceId} onChange={(e) => patch({ googlePlaceId: e.target.value })} className={input} />
            </label>
          </div>
        </Section>

        <Section title="Notifications" hint="Where new-inquiry emails go (used live by the email pipeline).">
          <label className={label}>
            Owner notification email
            <input
              type="email"
              value={config.notifyEmail}
              onChange={(e) => patch({ notifyEmail: e.target.value })}
              placeholder="owner@bakery.com"
              className={input}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Emails send once the RESEND_API_KEY is configured (status below). This address takes effect immediately —
            no redeploy.
          </p>
        </Section>

        <Section
          title="Omnichannel chat (Chatwoot)"
          hint="One inbox for website + Facebook + Instagram + WhatsApp. Create the account, paste two values, done."
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Create a free account at{' '}
              <a href="https://app.chatwoot.com" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                app.chatwoot.com <ExternalLink size={11} className="inline" aria-hidden="true" />
              </a>{' '}
              and add a <strong>Website</strong> inbox.
            </li>
            <li>Paste its Website Token + your Chatwoot URL below and save — the site's chat bubble switches to Chatwoot.</li>
            <li>Connect Facebook, Instagram, and WhatsApp inside Chatwoot's own Inboxes screen (their guided flows).</li>
          </ol>
          <div className="mt-3 grid gap-3">
            <label className={label}>
              <span className="inline-flex items-center gap-1.5"><MessagesSquare size={14} className="text-accent" /> Chatwoot base URL</span>
              <input
                value={config.chatwootBaseUrl}
                onChange={(e) => patch({ chatwootBaseUrl: e.target.value })}
                placeholder="https://app.chatwoot.com"
                className={input}
              />
            </label>
            <label className={label}>
              Website inbox token
              <input value={config.chatwootToken} onChange={(e) => patch({ chatwootToken: e.target.value })} className={input} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {config.chatwootBaseUrl && config.chatwootToken
              ? '✓ Active — the public site now loads the Chatwoot bubble instead of the built-in AI chat.'
              : 'Empty = the built-in AI chat widget stays active.'}
          </p>

          <h3 className="mt-5 font-display text-sm font-bold">Put the AI inside Chatwoot (agent bot)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The same AI that powers the website widget can answer every Chatwoot inbox — website, Messenger,
            Instagram, WhatsApp — and hand off to a human on request. One brain, all channels.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              In Chatwoot: <strong>Settings → Bots → Add Bot</strong>. Webhook URL:
              <code className="mx-1 break-all rounded bg-muted px-1.5 py-0.5 text-[11px]">
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/chatwoot-bot?secret=<CHATWOOT_WEBHOOK_SECRET>`}
              </code>
              (invent a long random secret — it becomes the env value below).
            </li>
            <li>Copy the bot's <strong>Access Token</strong> shown after creation.</li>
            <li>
              Add the env values on Vercel, then redeploy: <code>CHATWOOT_BOT_TOKEN</code>,{' '}
              <code>CHATWOOT_ACCOUNT_ID</code> (the number in your Chatwoot URL after /accounts/),{' '}
              <code>CHATWOOT_WEBHOOK_SECRET</code> (the same secret as in the webhook URL).
            </li>
            <li>
              Back in Chatwoot: open each inbox → <strong>Bot Configuration</strong> → select the bot → save. New
              conversations start with the AI; it hands off to your team when asked (or on any error).
            </li>
          </ol>
        </Section>

        <Section
          title="Cross-posting (Facebook + Instagram)"
          hint="One upload in “Share a post” goes to every connected network. These two need a Meta app the CLIENT owns."
        >
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              At{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                developers.facebook.com/apps <ExternalLink size={11} className="inline" aria-hidden="true" />
              </a>{' '}
              create an app owned by the bakery's own business portfolio, and add the{' '}
              <strong>“Manage everything on your Page”</strong> use case.
            </li>
            <li>
              Inside that use case, explicitly add <code>pages_manage_posts</code> and <code>pages_read_engagement</code>{' '}
              — they are <strong>not</strong> included by default, and login fails without them.
            </li>
            <li>
              Give the owner's personal Facebook account a <strong>Tester or Developer</strong> role on the app, and make
              sure that account is a full <strong>Admin</strong> of the Page (not Moderator or Analyst).
            </li>
            <li>
              For Instagram: the account must be a <strong>Professional</strong> (Business or Creator) account, and the
              owner must <strong>accept the Tester invite on their phone</strong> under Settings → Apps and websites →
              Tester invites. Nothing works until they tap Accept.
            </li>
            <li>
              Mint the token in this order — short-lived user token → <strong>long-lived</strong> user token →{' '}
              <code>/me/accounts</code>. Doing it the other way round yields a Page token that dies in an hour.
            </li>
            <li>Add the values on Vercel (see the status board below) and redeploy.</li>
          </ol>
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Because only people with a role on the app use it, Meta's own docs say App Review is not required. Their
            docs contradict themselves on whether that still holds once the app is switched to Live mode, so{' '}
            <strong>test with one throwaway post before promising a launch date</strong>. Instagram's long-lived token
            also expires every <strong>60 days</strong> and needs re-minting — if Instagram silently stops working in
            about two months, that is why.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Facebook Page name <span className="font-normal text-muted-foreground">(display only)</span>
              <input value={config.facebookPageName} onChange={(e) => patch({ facebookPageName: e.target.value })} placeholder="CakeUWishVA" className={input} />
            </label>
            <label className={label}>
              Instagram handle <span className="font-normal text-muted-foreground">(without @)</span>
              <input value={config.instagramHandle} onChange={(e) => patch({ instagramHandle: e.target.value.replace(/^@/, '') })} placeholder="cakeuwish" className={input} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              WhatsApp Channel URL
              <input value={config.whatsappChannelUrl} onChange={(e) => patch({ whatsappChannelUrl: e.target.value })} placeholder="https://whatsapp.com/channel/…" className={input} />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                WhatsApp has no posting API at any price — Status and Channels are app-only. This link just opens the
                channel from the “post this by hand” card so the owner can paste it in.
              </span>
            </label>
          </div>
        </Section>

        <Section title="AI voice (Vapi)" hint="Phone AI answering — needs a Vapi account, number, and billing.">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Create an account at{' '}
              <a href="https://vapi.ai" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                vapi.ai <ExternalLink size={11} className="inline" aria-hidden="true" />
              </a>{' '}
              and buy/port a number.
            </li>
            <li>Build the assistant there (reuse the AI Facts knowledge), then record its ID here for reference.</li>
            <li>
              To get every call summarized into the <strong>Inbox + owner email</strong>: in the assistant's settings set{' '}
              <strong>Server URL</strong> to
              <code className="mx-1 break-all rounded bg-muted px-1.5 py-0.5 text-[11px]">
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/vapi`}
              </code>
              with a secret of your choosing, and add that same value on Vercel as <code>VAPI_WEBHOOK_SECRET</code>{' '}
              (status below). Calls then file themselves as callback requests — same pipeline as the website forms.
            </li>
          </ol>
          <label className={`${label} mt-3`}>
            <span className="inline-flex items-center gap-1.5"><PhoneCall size={14} className="text-accent" /> Vapi assistant ID</span>
            <input value={config.vapiAssistantId} onChange={(e) => patch({ vapiAssistantId: e.target.value })} className={input} />
          </label>
        </Section>
      </div>

      <Section
        title="API keys — live status"
        hint="Secrets live in Vercel env, never in this database. Each row shows the exact command; run it from the project folder, then redeploy."
      >
        {keys ? (
          <ul className="divide-y divide-border">
            <StatusRow ok={keys.supabase} name="Supabase (backbone)" />
            <StatusRow ok={keys.anthropic} name="Anthropic — AI chat + bill reading" getAt="https://console.anthropic.com" cmd="vercel env add ANTHROPIC_API_KEY production" />
            <StatusRow ok={keys.openai} name="OpenAI — cake builder images" getAt="https://platform.openai.com" cmd="vercel env add OPENAI_API_KEY production" />
            <StatusRow ok={keys.resend} name="Resend — inquiry emails" getAt="https://resend.com" cmd="vercel env add RESEND_API_KEY production" />
            <StatusRow ok={keys.notifySecret} name="Notify webhook secret" cmd="vercel env add NOTIFY_WEBHOOK_SECRET production" />
            <StatusRow ok={keys.posthogCapture} name="PostHog — visitor capture" getAt="https://posthog.com" cmd="vercel env add VITE_POSTHOG_KEY production" />
            <StatusRow ok={keys.posthogDashboard} name="PostHog — dashboard numbers" getAt="https://posthog.com" cmd="vercel env add POSTHOG_API_KEY production" />
            <StatusRow ok={keys.twitter} name="X / Twitter — post & reply (4 keys)" getAt="https://developer.x.com" cmd="vercel env add TWITTER_CONSUMER_KEY production" />
            <StatusRow ok={keys.facebook} name="Facebook Page — publish photos & video" getAt="https://developers.facebook.com/apps" cmd="vercel env add FB_PAGE_ACCESS_TOKEN production" />
            <StatusRow ok={keys.instagram} name="Instagram — publish photos & reels" getAt="https://developers.facebook.com/apps" cmd="vercel env add IG_ACCESS_TOKEN production" />
            <StatusRow ok={keys.llm} name="Free AI (chat) — OpenAI-compatible key" getAt="https://console.groq.com" cmd="vercel env add LLM_API_KEY production" />
            <StatusRow ok={keys.chatwootBot} name="Chatwoot agent bot — AI in every inbox" getAt="https://app.chatwoot.com" cmd="vercel env add CHATWOOT_BOT_TOKEN production" />
            <StatusRow ok={keys.vapi} name="Vapi — phone calls into the Inbox" getAt="https://vapi.ai" cmd="vercel env add VAPI_WEBHOOK_SECRET production" />
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Status loads on the deployed site (the /api routes don't run under plain local vite dev).
          </p>
        )}
      </Section>

      <p className="mt-4 text-xs text-muted-foreground">
        Super admin: <strong>{config.superAdminEmail}</strong> — change it in the Supabase SQL editor
        (<code>update site_config set super_admin_email = '…'</code>) when handing a deployment to a client.
      </p>
    </div>
  )
}
