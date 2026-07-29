import { useState, type CSSProperties } from 'react'
import { ArrowUpRight, CheckCircle2, Clock, Loader2, MapPin, MessageCircle, Phone } from 'lucide-react'
import Magnetic from '../components/premium/Magnetic'
import ShaderSilk from '../components/premium/ShaderSilk'
import { FACEBOOK_URL, WHATSAPP_DISPLAY, WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'
import { track } from '../lib/analytics'
import { usePageMeta } from '../lib/usePageMeta'

const BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

const field =
  'mt-1.5 w-full rounded-xl border border-border bg-white/75 px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent'

function ContactForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState('')
  const [waFallback, setWaFallback] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (website) return
    setError('')
    if (!name.trim() || !message.trim() || (!phone.trim() && !email.trim())) {
      setError('Please add your name, a message, and a phone number or email.')
      return
    }
    setState('submitting')
    const draft = {
      kind: 'contact' as const,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      eventDate: '',
      pickupDate: '',
      occasion: '',
      theme: '',
      servings: '',
      flavor: '',
      budget: '',
      dietary: '',
      message: message.trim(),
      cakeId: null,
      cakeTitle: '',
      photos: [],
    }
    try {
      const inquiries = await import('../lib/inquiries')
      if (!BACKEND) {
        if (!WHATSAPP_ENABLED) {
          setState('idle')
          setError(`We can't take messages online right now — please call or text ${WHATSAPP_DISPLAY}.`)
          return
        }
        const url = inquiries.waLink(draft)
        window.open(url, '_blank', 'noopener')
        setWaFallback(url)
        setState('done')
        track('contact_submitted', { channel: 'whatsapp-fallback' })
        return
      }
      await inquiries.submitInquiry(draft)
      setState('done')
      track('contact_submitted', { channel: 'form' })
    } catch {
      setState('idle')
      setError(`Something went wrong. You can also call or text ${WHATSAPP_DISPLAY}.`)
    }
  }

  if (state === 'done') {
    return (
      <div role="status" className="glass rounded-[2rem] p-8 text-center sm:p-10">
        <CheckCircle2 size={40} className="mx-auto text-accent" aria-hidden="true" />
        <h3 className="mt-3 font-display text-2xl font-bold">Message sent!</h3>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground" style={{ lineHeight: 1.7 }}>
          {waFallback
            ? 'Your message opened in WhatsApp — hit send there and Parul will get back to you.'
            : 'Parul will get back to you soon — usually within a day or two.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="glass rounded-[2rem] p-6 sm:p-8">
      <p className="font-display text-2xl font-bold">Send a note</p>
      <div className="gold-rule mb-6 mt-4" aria-hidden="true" />
      <div className="grid gap-4">
        <label className="block text-sm font-medium">
          Your name *
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Phone
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={field} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Message *
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required className={`${field} resize-y`} />
        </label>
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Add a phone number or an email so we can reply.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Magnetic className="mt-5">
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {state === 'submitting' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {state === 'submitting' ? 'Sending…' : 'Send message'}
        </button>
      </Magnetic>
    </form>
  )
}

const channelRow =
  'group flex min-h-[44px] items-center gap-4 border-b border-border/80 py-5 transition-colors duration-500 hover:border-accent/50 sm:gap-5'
const channelText =
  'flex-1 transition-transform duration-500 ease-out group-hover:translate-x-2 group-focus-visible:translate-x-2'
const channelArrow =
  'shrink-0 -translate-x-2 text-accent opacity-0 transition-all duration-500 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100'

export default function ContactPage() {
  usePageMeta(
    'Contact',
    'Get in touch with CakeUWish — call or text +1 (571) 762-5848, message us on Facebook, or send a note. Home-based bakery in Chantilly, VA serving the DMV.',
  )
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Cap the silk to the top of the page — full-height would keep its rAF
          loop "visible" (never pausing) for the entire visit. The component's
          own static fallback gradient covers the rest. */}
      <div className="absolute inset-x-0 top-0 h-[64rem] overflow-hidden">
        <ShaderSilk />
      </div>
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-32 sm:px-8 sm:pb-24 sm:pt-40">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* editorial left rail: display type + channels */}
          <div>
            <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
              <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
              Contact CakeUWish
            </p>
            <h1
              data-reveal
              className="mt-3 font-display font-bold leading-[0.95] tracking-tight"
              style={{ fontSize: 'clamp(3.4rem, 9vw, 6.75rem)' }}
            >
              Say <span className="text-foil">hello.</span>
            </h1>
            <p
              data-reveal
              className="mt-6 max-w-xl text-lg text-muted-foreground"
              style={{ lineHeight: 1.7, '--reveal-delay': '120ms' } as CSSProperties}
            >
              Call, text, or send a note below — every road leads to cake. Questions,
              ideas, and "is this even possible?" messages all welcome.
            </p>

            <div data-reveal className="mt-12 border-t border-border/80" style={{ '--reveal-delay': '180ms' } as CSSProperties}>
              {WHATSAPP_ENABLED && (
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-loc="contact-page" className={channelRow}>
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: '#1A8A4E' }}
                  >
                    <MessageCircle size={24} fill="white" strokeWidth={0} aria-hidden="true" />
                  </span>
                  <span className={channelText}>
                    <span className="block font-display text-lg font-bold">WhatsApp (preferred)</span>
                    <span className="block text-sm text-muted-foreground">{WHATSAPP_DISPLAY} — tap to start chatting</span>
                  </span>
                  <ArrowUpRight size={20} aria-hidden="true" className={channelArrow} />
                </a>
              )}
              <a href="tel:+15717625848" className={channelRow}>
                <span className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary">
                  <Phone size={22} aria-hidden="true" />
                </span>
                <span className={channelText}>
                  <span className="block font-display text-lg font-bold">Call or text</span>
                  <span className="block text-sm text-muted-foreground">{WHATSAPP_DISPLAY}</span>
                </span>
                <ArrowUpRight size={20} aria-hidden="true" className={channelArrow} />
              </a>
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={channelRow}>
                <span className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22 12a10 10 0 1 0-11.563 9.875v-6.988H7.898V12h2.539V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.887h-2.33v6.988A10.002 10.002 0 0 0 22 12Z" />
                  </svg>
                </span>
                <span className={channelText}>
                  <span className="block font-display text-lg font-bold">Facebook</span>
                  <span className="block text-sm text-muted-foreground">facebook.com/CakeUWishVA — DMs open</span>
                </span>
                <ArrowUpRight size={20} aria-hidden="true" className={channelArrow} />
              </a>
            </div>

            <div data-reveal className="mt-8 grid gap-4 sm:grid-cols-2" style={{ '--reveal-delay': '240ms' } as CSSProperties}>
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-accent" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">Where</span>
                </div>
                <p className="mt-2.5 text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                  Home-based bakery in Chantilly, VA — serving the DMV. Pickup address shared once
                  your order is confirmed.
                </p>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-accent" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">Hours</span>
                </div>
                <p className="mt-2.5 text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                  Orders by appointment. Messages answered daily — usually within a day or two.
                </p>
              </div>
            </div>
          </div>

          {/* glass form panel + map */}
          <div className="lg:pt-10">
            <div data-reveal style={{ '--reveal-delay': '160ms' } as CSSProperties}>
              <ContactForm />
            </div>
            <div
              data-reveal
              className="mt-6 overflow-hidden rounded-[2rem] border border-white/60 shadow-soft"
              style={{ '--reveal-delay': '260ms' } as CSSProperties}
            >
              <iframe
                title="Map of Chantilly, Virginia — CakeUWish's home base"
                src="https://www.google.com/maps?q=Chantilly,+VA&z=11&output=embed"
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
