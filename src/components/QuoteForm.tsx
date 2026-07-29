import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ImagePlus, Loader2, MessageCircle, X } from 'lucide-react'
import Magnetic from './premium/Magnetic'
import { useContent } from '../content/ContentProvider'
import { FLAVORS, OCCASIONS, SERVING_OPTIONS } from '../data/pricing'
import { WHATSAPP_DISPLAY, WHATSAPP_ENABLED } from '../data/cakes'
import { track } from '../lib/analytics'
import { localIsoDay } from '../lib/dates'
import type { Availability } from '../lib/availability'
import type { InquiryDraft } from '../lib/inquiries'

// Compile-time check — avoids pulling supabase-js into this chunk just to ask.
const BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

const MAX_PHOTOS = 4

const field =
  'mt-1 w-full rounded-lg border border-border bg-card/85 px-3 py-2.5 text-sm outline-none transition-[box-shadow,border-color] duration-300 hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent'
const label = 'block text-sm font-medium'

// Small-caps editorial divider between field groups.
function GroupHead({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <span
        className="shrink-0 font-semibold tracking-[0.2em] text-accent"
        style={{ fontVariantCaps: 'all-small-caps', fontSize: '0.95rem' }}
      >
        {children}
      </span>
      <span className="gold-rule flex-1" aria-hidden="true" />
    </div>
  )
}

interface PhotoDraft {
  file: File
  preview: string
}

export default function QuoteForm() {
  const [params] = useSearchParams()
  const { cakes } = useContent()
  const refCake = useMemo(() => cakes.find((c) => c.id === params.get('cake')) ?? null, [cakes, params])
  const [cakeRef, setCakeRef] = useState(true)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [occasion, setOccasion] = useState('')
  const [theme, setTheme] = useState('')
  const [servings, setServings] = useState('')
  const [flavor, setFlavor] = useState('')
  const [budget, setBudget] = useState('')
  const [eggless, setEggless] = useState(false)
  const [nutFree, setNutFree] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot — bots fill it, humans never see it
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState('')
  const [waFallback, setWaFallback] = useState('')

  const [availability, setAvailability] = useState<Availability | null>(null)
  const [pickupSlot, setPickupSlot] = useState('')

  const today = localIsoDay()

  // Booking constraints are progressive enhancement: null (no backend / any
  // failure) leaves the form behaving exactly as before.
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

  const minDate = useMemo(() => {
    if (!availability || availability.minLeadDays <= 0) return today
    return localIsoDay(availability.minLeadDays)
  }, [availability, today])

  const dateIssue = (iso: string): string => {
    if (!iso || !availability) return ''
    if (availability.blocked.includes(iso)) return 'Parul is fully booked / away that day — pick another date.'
    if (availability.full.includes(iso)) return 'That day has hit its order limit — pick another date.'
    if (iso < minDate) return `Custom cakes need at least ${availability.minLeadDays} days' notice.`
    return ''
  }
  const eventDateError = dateIssue(eventDate)
  const pickupDateError = dateIssue(pickupDate)

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const next = [...photos]
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) break
      if (!f.type.startsWith('image/')) continue
      next.push({ file: f, preview: URL.createObjectURL(f) })
    }
    setPhotos(next)
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photos[i].preview)
    setPhotos(photos.filter((_, idx) => idx !== i))
  }

  const buildDraft = (photoUrls: string[]): InquiryDraft => ({
    kind: 'quote',
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    eventDate,
    pickupDate,
    occasion,
    theme: theme.trim(),
    servings,
    flavor,
    budget: budget.trim(),
    dietary: [eggless && 'Eggless', nutFree && 'Nut-free', allergies.trim()].filter(Boolean).join(', '),
    message: message.trim(),
    cakeId: cakeRef && refCake ? refCake.id : null,
    cakeTitle: cakeRef && refCake ? refCake.title : '',
    photos: photoUrls,
    pickupSlot,
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (website) return // honeypot tripped — silently drop
    setError('')
    if (!name.trim() || !phone.trim()) {
      setError('Please add your name and a phone number so Parul can reach you.')
      return
    }
    if (eventDateError || pickupDateError) {
      setError('Please pick an available date before sending your request.')
      return
    }
    setState('submitting')
    try {
      const inquiries = await import('../lib/inquiries')
      if (!BACKEND) {
        if (!WHATSAPP_ENABLED) {
          setState('idle')
          setError(`We can't take requests online right now — please call or text ${WHATSAPP_DISPLAY}.`)
          return
        }
        // No backend configured — hand the request over via WhatsApp instead.
        const url = inquiries.waLink(buildDraft([]))
        window.open(url, '_blank', 'noopener')
        setWaFallback(url)
        setState('done')
        track('quote_submitted', { occasion, servings, channel: 'whatsapp-fallback' })
        return
      }
      const urls: string[] = []
      for (const p of photos) {
        urls.push(await inquiries.uploadInspirationPhoto(p.file))
      }
      await inquiries.submitInquiry(buildDraft(urls))
      setState('done')
      track('quote_submitted', { occasion, servings, channel: 'form' })
    } catch (err) {
      setState('idle')
      setError(
        err instanceof Error && err.message !== 'not-configured'
          ? `Something went wrong (${err.message}). You can also call or text ${WHATSAPP_DISPLAY}.`
          : `Something went wrong. You can also call or text ${WHATSAPP_DISPLAY}.`,
      )
    }
  }

  if (state === 'done') {
    return (
      <div className="glass rounded-3xl p-8 text-center sm:p-12">
        <CheckCircle2 size={44} className="mx-auto text-accent" aria-hidden="true" />
        <h3 className="mt-4 font-display text-2xl font-bold sm:text-3xl">Request received!</h3>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground" style={{ lineHeight: 1.7 }}>
          {waFallback
            ? 'Your request opened in WhatsApp — hit send there and Parul will reply with a quote.'
            : 'Parul will review your request and reply with a quote — usually within a day or two.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {waFallback && WHATSAPP_ENABLED && (
            <a
              href={waFallback}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: '#1A8A4E' }}
            >
              <MessageCircle size={17} fill="white" strokeWidth={0} /> Re-open WhatsApp
            </a>
          )}
          {!waFallback && WHATSAPP_ENABLED && (
            <a
              href="https://wa.me/15717625848"
              target="_blank"
              rel="noopener noreferrer"
              data-loc="quote-success"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: '#1A8A4E' }}
            >
              <MessageCircle size={17} fill="white" strokeWidth={0} /> Chat on WhatsApp
            </a>
          )}
          <Link
            to="/gallery"
            className="inline-flex items-center rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary"
          >
            Keep browsing cakes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="glass rounded-3xl p-6 sm:p-9">
      {availability && availability.vacationNote && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" style={{ lineHeight: 1.6 }}>
          {availability.vacationNote}
        </p>
      )}
      {refCake && cakeRef && (
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl border border-border p-3"
          style={{ backgroundColor: `${refCake.bg}55` }}
        >
          <img src={refCake.image} alt="" className="h-14 w-12 rounded-lg object-contain" style={{ backgroundColor: refCake.bg }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Inspired by</p>
            <p className="truncate font-display font-bold">{refCake.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setCakeRef(false)}
            aria-label="Remove cake reference"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="space-y-9">
        <div>
          <GroupHead>You</GroupHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Your name *
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={field} />
            </label>
            <label className={label}>
              Phone *
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                className={field}
              />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Email <span className="font-normal text-muted-foreground">(optional)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
            </label>
          </div>
        </div>

        <div>
          <GroupHead>The occasion</GroupHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Event date
              <input
                type="date"
                min={minDate}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                aria-invalid={eventDateError ? true : undefined}
                aria-describedby={eventDateError ? 'event-date-error' : undefined}
                className={field}
              />
              {eventDateError && <span id="event-date-error" className="mt-1 block text-xs font-normal text-red-700">{eventDateError}</span>}
            </label>
            <label className={label}>
              Preferred pickup date <span className="font-normal text-muted-foreground">(if different)</span>
              <input
                type="date"
                min={minDate}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                aria-invalid={pickupDateError ? true : undefined}
                aria-describedby={pickupDateError ? 'pickup-date-error' : undefined}
                className={field}
              />
              {pickupDateError && <span id="pickup-date-error" className="mt-1 block text-xs font-normal text-red-700">{pickupDateError}</span>}
            </label>
            {availability && availability.pickupSlots.length > 0 && (
              <label className={label}>
                Preferred pickup time <span className="font-normal text-muted-foreground">(optional)</span>
                <select value={pickupSlot} onChange={(e) => setPickupSlot(e.target.value)} className={field}>
                  <option value="">No preference</option>
                  {availability.pickupSlots.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
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
        </div>

        <div>
          <GroupHead>The cake</GroupHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Theme or idea
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. gold & burgundy florals, dinosaurs…"
                className={field}
              />
            </label>
            <label className={label}>
              Number of servings
              <select value={servings} onChange={(e) => setServings(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {SERVING_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Flavor
              <select value={flavor} onChange={(e) => setFlavor(e.target.value)} className={field}>
                <option value="">Choose…</option>
                {FLAVORS.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
                <option>Not sure — recommend something!</option>
              </select>
            </label>
            <label className={label}>
              Budget <span className="font-normal text-muted-foreground">(optional — helps us tailor the design)</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. around $150" className={field} />
            </label>

            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Dietary preferences</legend>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={eggless}
                    onChange={(e) => setEggless(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  Eggless
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={nutFree}
                    onChange={(e) => setNutFree(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  Nut-free
                </label>
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Other allergies or restrictions"
                  aria-label="Other allergies or restrictions"
                  className="min-w-52 flex-1 rounded-lg border border-border bg-card/85 px-3 py-2 text-sm outline-none transition-[box-shadow,border-color] duration-300 hover:border-accent/50 focus:border-accent focus:ring-2 focus:ring-accent"
                />
              </div>
            </fieldset>
          </div>
        </div>

        <div>
          <GroupHead>Inspiration</GroupHead>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="text-sm font-medium">
                Inspiration photos <span className="font-normal text-muted-foreground">(up to {MAX_PHOTOS})</span>
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {photos.map((p, i) => (
                  <div key={p.preview} className="relative">
                    <div className="zoom-frame rounded-xl border border-border">
                      <img src={p.preview} alt={`Inspiration ${i + 1}`} className="h-20 w-20 object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow before:absolute before:-inset-2.5 before:content-['']"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    <ImagePlus size={20} aria-hidden="true" />
                    <span className="text-[11px] font-medium">Add</span>
                  </button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
              {!BACKEND && photos.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Heads up: photos can't be attached while we're offline — mention them in your note and Parul will ask for them.
                </p>
              )}
            </div>

            <label className={`${label} sm:col-span-2`}>
              Anything else we should know?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Names and ages for the cake, colors to match, what the guest of honour loves…"
                className={`${field} resize-y`}
              />
            </label>
          </div>
        </div>

        {/* honeypot */}
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Magnetic>
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="group relative inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {/* gold sheen sweep */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(224,178,90,0.45)] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            {state === 'submitting' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {state === 'submitting' ? 'Sending…' : 'Send my request'}
          </button>
        </Magnetic>
        <p className="text-xs text-muted-foreground">
          No payment now — you'll get a quote first. See our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-primary">
            ordering policies
          </Link>
          .
        </p>
      </div>
    </form>
  )
}
