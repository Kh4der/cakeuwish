import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import PageHero from '../components/PageHero'
import Magnetic from '../components/premium/Magnetic'
import { ADDONS, OCCASIONS, SERVING_OPTIONS } from '../data/pricing'
import { WHATSAPP_DISPLAY } from '../data/cakes'
import { track } from '../lib/analytics'
import { localIsoDay } from '../lib/dates'
import { usePageMeta } from '../lib/usePageMeta'
import type { Availability } from '../lib/availability'

const BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

const MAX_PROMPT = 400
const TIER_OPTIONS = ['1', '2', '3', '4', '5'] as const
const SHAPE_OPTIONS = ['Round', 'Square'] as const
const STYLE_OPTIONS = [
  'Smooth buttercream',
  'Textured buttercream',
  'Fondant',
  'Semi-naked',
  'Drip cake',
  'Floral cascade',
]
const SWATCHES = [
  { name: 'Blush pink', hex: '#F0CBD6' },
  { name: 'Ivory', hex: '#F3EDE1' },
  { name: 'Gold', hex: '#CA8A04' },
  { name: 'Sage', hex: '#B7C4A8' },
  { name: 'Dusty blue', hex: '#CBD6E6' },
  { name: 'Burgundy', hex: '#7C2D3E' },
  { name: 'Lavender', hex: '#D6CDEA' },
  { name: 'Chocolate', hex: '#5C4033' },
]

// Ballpark bands anchored to the published starting prices; add-ons stack
// their own published from-prices on top. Estimates only — Parul quotes.
// 1–3 mirror the published starting prices; 4–5 extrapolate the same curve
// (tall tiers need internal doweling and much more labour). All estimates.
const TIER_BASE: Record<string, [number, number]> = {
  '1': [95, 150],
  '2': [185, 280],
  '3': [325, 480],
  '4': [480, 700],
  '5': [650, 950],
}
// Square tiers take more work than round: sharp corners have to be built and
// iced true, so the ballpark nudges up.
const SHAPE_FACTOR: Record<string, number> = { Round: 1, Square: 1.1 }
const STYLE_FACTOR: Record<string, number> = {
  Fondant: 1.2,
  'Floral cascade': 1.2,
  'Drip cake': 1.1,
  'Textured buttercream': 1.08,
}
const ADDON_BUMP: Record<string, [number, number]> = {
  'Custom cake toppers': [15, 30],
  'Hand-sculpted figures': [30, 60],
  'Matching cupcakes': [35, 55],
  'Delivery & setup': [35, 50],
}

const label = 'block text-sm font-medium'
const field =
  'mt-1 w-full rounded-lg border border-border bg-card/85 px-3 py-2.5 text-sm outline-none transition-[box-shadow,border-color] duration-300 hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent'

function chipCls(active: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
    active ? 'border-primary bg-primary text-on-primary' : 'border-border bg-card text-foreground/80 hover:border-accent hover:text-accent'
  }`
}

/** Playful CSS cake mock that mirrors the choices before AI renders the real preview. */
function CakeMock({ tiers, shape, colors }: { tiers: string; shape: string; colors: string[] }) {
  const n = Math.max(1, Math.min(5, Number(tiers) || 1))
  const palette = colors.length > 0 ? colors : ['#F3EDE1']
  const square = shape === 'Square'
  // Tiers are drawn top-first, so index 0 is the SMALLEST. Widths taper evenly
  // from the base up, and heights shrink as the stack grows so five tiers still
  // fit the square preview box.
  const HEIGHTS: Record<number, number> = { 1: 120, 2: 88, 3: 68, 4: 55, 5: 46 }
  const tierHeight = HEIGHTS[n]
  const widthFor = (fromTop: number) => {
    const fromBottom = n - 1 - fromTop
    if (n === 1) return 78
    return 86 - (fromBottom * (86 - 38)) / (n - 1)
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-10" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="border border-black/5 shadow-soft transition-all duration-500"
          style={{
            width: `${widthFor(i)}%`,
            height: `${tierHeight}px`,
            backgroundColor: palette[i % palette.length],
            // Square cakes read by their crisp corners; round ones stay soft,
            // with the top tier domed a little more.
            borderRadius: square ? '2px' : i === 0 ? '14px 14px 6px 6px' : '8px',
          }}
        />
      ))}
      <div className={`h-2.5 w-[94%] bg-primary/85 ${square ? 'rounded-sm' : 'rounded-full'}`} />
      <div className="mx-auto h-8 w-14 rounded-b-2xl bg-primary/70" />
    </div>
  )
}

export default function CakeBuilderPage() {
  usePageMeta(
    'Cake Builder',
    'Describe your dream cake in your own words, pick add-ons, preview it with AI, and send it straight to Parul for a real quote.',
  )

  const [prompt, setPrompt] = useState('')
  const [tiers, setTiers] = useState<(typeof TIER_OPTIONS)[number]>('2')
  const [shape, setShape] = useState<(typeof SHAPE_OPTIONS)[number]>('Round')
  const [style, setStyle] = useState(STYLE_OPTIONS[0])
  const [colors, setColors] = useState<string[]>(['Blush pink', 'Gold'])
  const [occasion, setOccasion] = useState('')
  const [addons, setAddons] = useState<string[]>([])

  const [genState, setGenState] = useState<'idle' | 'generating' | 'ready' | 'unconfigured'>('idle')
  const [genError, setGenError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageHosted, setImageHosted] = useState(false)

  // request step
  const [requesting, setRequesting] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [servings, setServings] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [submitError, setSubmitError] = useState('')
  const [availability, setAvailability] = useState<Availability | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const today = localIsoDay()
  useEffect(() => {
    if (!BACKEND) return
    let active = true
    import('../lib/availability')
      .then((m) => m.fetchAvailability())
      .then((a) => {
        if (active && a) setAvailability(a)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const minDate = availability && availability.minLeadDays > 0 ? localIsoDay(availability.minLeadDays) : today
  const dateError = !eventDate || !availability
    ? ''
    : availability.blocked.includes(eventDate)
      ? 'Parul is fully booked / away that day — pick another date.'
      : availability.full.includes(eventDate)
        ? 'That day has hit its order limit — pick another date.'
        : eventDate < minDate
          ? `Custom cakes need at least ${availability.minLeadDays} days' notice.`
          : ''

  const estimate = useMemo(() => {
    const base = TIER_BASE[tiers] ?? TIER_BASE['1']
    let [lo, hi] = base
    const f =
      (STYLE_FACTOR[style] ?? 1) *
      (SHAPE_FACTOR[shape] ?? 1) *
      (prompt.trim().length > 40 ? 1.1 : 1)
    lo = lo * (f > 1 ? (1 + f) / 2 : 1)
    hi = hi * f
    for (const a of addons) {
      const [alo, ahi] = ADDON_BUMP[a] ?? [0, 0]
      lo += alo
      hi += ahi
    }
    const round5 = (n: number) => Math.round(n / 5) * 5
    const level = hi >= base[1] * 1.25 ? 'Showstopper' : hi > base[1] * 1.05 ? 'Detailed' : 'Classic'
    return { lo: round5(lo), hi: round5(hi), level }
  }, [tiers, shape, style, prompt, addons])

  const toggleColor = (name: string) =>
    setColors((cs) => (cs.includes(name) ? cs.filter((c) => c !== name) : cs.length >= 3 ? cs : [...cs, name]))
  const toggleAddon = (name: string) =>
    setAddons((as) => (as.includes(name) ? as.filter((a) => a !== name) : [...as, name]))

  const specLines = () => [
    prompt.trim() && `“${prompt.trim().slice(0, 120)}${prompt.trim().length > 120 ? '…' : ''}”`,
    `Tiers: ${tiers} · Shape: ${shape} · Style: ${style}`,
    colors.length > 0 && `Colors: ${colors.join(', ')}`,
    addons.length > 0 && `Add-ons: ${addons.join(', ')}`,
    `Ballpark shown: $${estimate.lo}–$${estimate.hi} (${estimate.level})`,
  ]

  const generate = async () => {
    if (!prompt.trim()) {
      setGenError('Describe your cake first — even a few magic words help.')
      return
    }
    setGenError('')
    setGenState('generating')
    track('builder_generate', { tiers, shape, style, addons: addons.length })
    try {
      const res = await fetch('/api/generate-cake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          tiers,
          shape: shape.toLowerCase(),
          style: style.toLowerCase(),
          colors: colors.join(', '),
          occasion,
          addons,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        configured?: boolean
        url?: string | null
        dataUrl?: string
        error?: string
      }
      if (res.status === 429 || res.status === 400) {
        setGenState(imageUrl ? 'ready' : 'idle')
        setGenError(data.error ?? 'Try again in a moment.')
        return
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.configured === false) {
        setGenState('unconfigured')
        return
      }
      const src = data.url || data.dataUrl
      if (!src) throw new Error('No image returned')
      setImageUrl(src)
      setImageHosted(Boolean(data.url))
      setGenState('ready')
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch {
      setGenState(imageUrl ? 'ready' : 'idle')
      setGenError('The oven hiccuped — give it another go.')
    }
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    if (!name.trim() || !phone.trim()) {
      setSubmitError('Your name and number, so Parul can send your quote.')
      return
    }
    if (dateError) {
      setSubmitError('Please pick an available date first.')
      return
    }
    if (!BACKEND) {
      setSubmitError(`We can't take requests online right now — please call or text ${WHATSAPP_DISPLAY}.`)
      return
    }
    setSubmitState('submitting')
    const draft = {
      kind: 'quote' as const,
      name: name.trim(),
      phone: phone.trim(),
      email: '',
      eventDate,
      pickupDate: '',
      occasion,
      theme: prompt.trim().slice(0, 120),
      servings,
      flavor: '',
      budget: `$${estimate.lo}–$${estimate.hi} ballpark shown`,
      dietary: '',
      message: ['Cake Builder design:', ...specLines().filter(Boolean)].join('\n'),
      cakeId: null,
      cakeTitle: '',
      photos: imageHosted && imageUrl ? [imageUrl] : [],
    }
    try {
      const inquiries = await import('../lib/inquiries')
      await inquiries.submitInquiry(draft)
      setSubmitState('done')
      track('builder_quote_submitted', { channel: 'form', tiers, style })
    } catch {
      setSubmitState('idle')
      setSubmitError(`That didn’t go through — try again, or call/text ${WHATSAPP_DISPLAY}.`)
    }
  }

  if (submitState === 'done') {
    return (
      <section className="mx-auto max-w-2xl px-5 pb-24 pt-36 sm:px-8">
        <div role="status" className="glass rounded-3xl p-8 text-center sm:p-12">
          <CheckCircle2 size={44} className="mx-auto text-accent" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold">Your design is with Parul!</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground" style={{ lineHeight: 1.7 }}>
            She’ll review your design, confirm the date, and reply with a real quote — usually
            within a day or two.
          </p>
          {imageUrl && (
            <img src={imageUrl} alt="Your AI cake design" className="mx-auto mt-6 w-56 rounded-2xl border border-border shadow-cake" />
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/gallery" className="inline-flex min-h-[44px] items-center rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary">
              Browse real cakes meanwhile
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Design Studio"
        title="Build your dream cake"
        intro="Tell us the dream in your own words, tune the details, add the extras — our AI sketches it, and Parul bakes the real thing. Every design goes to her for a personal quote."
      />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* controls */}
          <div className="space-y-8">
            {/* THE main prompt */}
            <div data-reveal>
              <label htmlFor="cake-prompt" className="font-semibold tracking-[0.2em] text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>
                Your cake, in your words
              </label>
              <textarea
                id="cake-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={MAX_PROMPT}
                rows={4}
                placeholder="e.g. An enchanted-garden cake for my daughter's 5th — pastel flowers, a few butterflies, her name in gold, something that makes people gasp…"
                className={`${field} mt-3 resize-y font-display text-base`}
                style={{ lineHeight: 1.6 }}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{prompt.length}/{MAX_PROMPT}</p>
            </div>

            {/* structure refinements */}
            <div data-reveal>
              <p className="font-semibold tracking-[0.2em] text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>
                The structure
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Number of tiers">
                {TIER_OPTIONS.map((t) => (
                  <button key={t} type="button" onClick={() => setTiers(t)} aria-pressed={tiers === t} className={chipCls(tiers === t)}>
                    {t} tier{t === '1' ? '' : 's'}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Cake shape">
                {SHAPE_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setShape(s)} aria-pressed={shape === s} className={chipCls(shape === s)}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`h-3.5 w-3.5 border-2 border-current ${s === 'Round' ? 'rounded-full' : 'rounded-[2px]'}`}
                        aria-hidden="true"
                      />
                      {s}
                    </span>
                  </button>
                ))}
              </div>
              {Number(tiers) >= 4 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Four and five tiers are showstopper territory — they need internal support and extra lead time.
                  Parul will confirm what's possible for your date.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Finish style">
                {STYLE_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setStyle(s)} aria-pressed={style === s} className={chipCls(style === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div data-reveal>
              <p className="font-semibold tracking-[0.2em] text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>
                The palette <span className="normal-case text-muted-foreground">(up to 3)</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {SWATCHES.map((s) => {
                  const active = colors.includes(s.name)
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => toggleColor(s.name)}
                      aria-pressed={active}
                      title={s.name}
                      className={`flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                        active ? 'border-primary ring-2 ring-accent/60' : 'border-border hover:border-accent'
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: s.hex }} aria-hidden="true" />
                      {s.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* add-ons — the published extras, selectable right here */}
            <div data-reveal>
              <p className="font-semibold tracking-[0.2em] text-accent" style={{ fontVariantCaps: 'all-small-caps' }}>
                Add-ons
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {ADDONS.map((a) => {
                  const active = addons.includes(a.item)
                  return (
                    <button
                      key={a.item}
                      type="button"
                      onClick={() => toggleAddon(a.item)}
                      aria-pressed={active}
                      className={`flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                        active ? 'border-primary bg-primary/[0.04] ring-2 ring-accent/50' : 'border-border bg-card hover:border-accent'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{a.item}</span>
                        <span className="block text-xs text-muted-foreground">{a.detail}</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-accent">{a.price ?? 'Quote'}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div data-reveal className="max-w-xs">
              <label className={label}>
                Occasion
                <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className={field}>
                  <option value="">Choose…</option>
                  {OCCASIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* complexity + estimate */}
            <div data-reveal className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Complexity</p>
                <p className="mt-1 font-display text-xl font-bold">{estimate.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ballpark</p>
                <p className="mt-1 font-display text-xl font-bold">
                  <span className="text-foil">${estimate.lo}–${estimate.hi}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">estimate only — Parul quotes for real</p>
              </div>
            </div>

            <div data-reveal className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <button
                  type="button"
                  onClick={generate}
                  disabled={genState === 'generating'}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
                >
                  {genState === 'generating' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Wand2 size={17} aria-hidden="true" />}
                  {genState === 'generating' ? 'Baking your preview…' : imageUrl ? 'Generate another look' : 'Generate AI preview'}
                </button>
              </Magnetic>
              {imageUrl && genState === 'ready' && (
                <button type="button" onClick={generate} aria-label="Regenerate" className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground/70 hover:border-accent hover:text-accent">
                  <RefreshCw size={17} />
                </button>
              )}
              {genError && <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{genError}</p>}
            </div>
          </div>

          {/* preview + request */}
          <div ref={previewRef} className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-border bg-cream shadow-cake">
              <div className="relative aspect-square">
                {genState === 'generating' && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-cream/85 backdrop-blur-sm" role="status">
                    <Sparkles size={26} className="animate-pulse text-accent" aria-hidden="true" />
                    <p className="font-display text-lg italic text-foreground/80">Piping the pixels…</p>
                  </div>
                )}
                {imageUrl ? (
                  <img src={imageUrl} alt="AI preview of your cake design" className="h-full w-full object-cover" />
                ) : (
                  <CakeMock tiers={tiers} shape={shape} colors={colors.map((n) => SWATCHES.find((s) => s.name === n)?.hex ?? '#F3EDE1')} />
                )}
              </div>
              <div className="border-t border-border p-5">
                {genState === 'unconfigured' && (
                  <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    The AI preview oven is still warming up — your design spec below goes to Parul either way.
                  </p>
                )}
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Your spec</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                  {specLines()
                    .filter(Boolean)
                    .map((l) => (
                      <li key={l as string}>{l}</li>
                    ))}
                </ul>

                {!requesting ? (
                  <Magnetic className="mt-5 block">
                    <button
                      type="button"
                      onClick={() => setRequesting(true)}
                      className="min-h-[48px] w-full rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
                    >
                      Request this cake
                    </button>
                  </Magnetic>
                ) : (
                  <form onSubmit={submitRequest} className="mt-5 space-y-3">
                    <label className={label}>
                      Your name *
                      <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={field} />
                    </label>
                    <label className={label}>
                      Phone *
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required className={field} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={label}>
                        Event date
                        <input type="date" min={minDate} value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={field} />
                      </label>
                      <label className={label}>
                        Servings
                        <select value={servings} onChange={(e) => setServings(e.target.value)} className={field}>
                          <option value="">Choose…</option>
                          {SERVING_OPTIONS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {dateError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{dateError}</p>}
                    {availability?.vacationNote && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{availability.vacationNote}</p>
                    )}
                    {submitError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
                    <button
                      type="submit"
                      disabled={submitState === 'submitting'}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60"
                    >
                      {submitState === 'submitting' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                      {submitState === 'submitting' ? 'Sending your design…' : 'Send to Parul for a quote'}
                    </button>
                    <p className="text-center text-[11px] text-muted-foreground">
                      No payment now — Parul confirms the date and price personally.
                    </p>
                  </form>
                )}

                <Link
                  to="/contact"
                  className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-accent hover:text-accent"
                >
                  <MessageCircle size={15} aria-hidden="true" /> Rather talk it through? Contact us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
