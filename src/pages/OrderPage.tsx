import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck2, FileText, MessageSquareQuote, Search, ShoppingBag } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import PageHero from '../components/PageHero'
import QuoteForm from '../components/QuoteForm'
import ShaderSilk from '../components/premium/ShaderSilk'
import { usePageMeta } from '../lib/usePageMeta'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  {
    icon: Search,
    title: 'Browse for inspiration',
    text: 'Wander the gallery, save screenshots, collect ideas — Pinterest boards welcome. Rough ideas are more than enough to start.',
  },
  {
    icon: FileText,
    title: 'Send your request',
    text: 'Fill in the form below with your date, occasion, servings, and any inspiration photos — or design your cake in the Cake Builder.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Get your quote',
    text: 'Parul reviews every request personally and replies with a price and design suggestions — usually within a day or two.',
  },
  {
    icon: CalendarCheck2,
    title: 'Confirm your date',
    text: 'A 50% deposit locks in your date (cash, Zelle, or PayPal). Design tweaks are welcome up to 7 days before the event.',
  },
  {
    icon: ShoppingBag,
    title: 'Pick up & celebrate',
    text: 'Collect your cake in Chantilly, VA — or ask about delivery & setup for tiered and wedding cakes.',
  },
]

export default function OrderPage() {
  usePageMeta(
    'How to Order',
    'Ordering a custom cake from CakeUWish is easy: browse designs, send a request, get a quote, confirm with a deposit, and pick up in Chantilly, VA.',
  )

  const journeyRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  // Gold rail draws in as you scroll the journey (desktop only — the line
  // renders fully drawn by default, so mobile/reduced-motion get a static rail).
  useEffect(() => {
    const wrap = journeyRef.current
    const line = lineRef.current
    if (!wrap || !line) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    const tween = gsap.fromTo(
      line,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 75%', end: 'bottom 60%', scrub: 0.6 },
      },
    )
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [])

  return (
    <>
      <PageHero
        eyebrow="Ordering"
        title="How it works"
        intro="From first idea to final candle, here's the whole journey. Custom cakes typically need 2–4 weeks' notice — the earlier you reach out, the more magic we can fit in."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-28">
        <div ref={journeyRef} className="relative">
          {/* rail: faint base + gold progress line */}
          <div
            aria-hidden="true"
            className="absolute bottom-8 left-[9px] top-3 w-px bg-accent/15 lg:left-1/2 lg:-translate-x-1/2"
          >
            <div
              ref={lineRef}
              className="absolute inset-0 origin-top bg-gradient-to-b from-accent via-accent/70 to-accent/30"
            />
          </div>

          <ol className="relative flex flex-col gap-20 lg:grid lg:grid-cols-2 lg:gap-x-0 lg:gap-y-24">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const leftCol = i % 2 === 0
              return (
                <li
                  key={s.title}
                  data-reveal
                  className={`relative pl-12 lg:pl-0 ${leftCol ? 'lg:pr-20 lg:text-right' : 'lg:pl-20'}`}
                  style={{ gridColumn: leftCol ? '1' : '2', gridRow: i + 1 }}
                >
                  {/* rail node */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-[3px] top-4 h-3.5 w-3.5 rounded-full border-2 border-accent bg-background ${
                      leftCol ? 'lg:left-auto lg:right-[-7px]' : 'lg:left-[-7px]'
                    }`}
                  />
                  {/* ghost numeral behind the step */}
                  <span
                    aria-hidden="true"
                    className={`ghost-numeral pointer-events-none absolute -top-8 right-0 select-none leading-none ${
                      leftCol ? 'lg:right-auto lg:left-4' : 'lg:right-4'
                    }`}
                    style={{ fontSize: 'clamp(5.5rem, 11vw, 8rem)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div
                    className={`glass relative flex h-12 w-12 items-center justify-center rounded-2xl text-accent ${
                      leftCol ? 'lg:ml-auto' : ''
                    }`}
                  >
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <h2 className="relative mt-5 font-display text-xl font-bold tracking-tight sm:text-2xl">
                    {s.title}
                  </h2>
                  <p
                    className={`relative mt-2 max-w-md text-sm text-muted-foreground ${leftCol ? 'lg:ml-auto' : ''}`}
                    style={{ lineHeight: 1.7 }}
                  >
                    {s.text}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>

        <p data-reveal className="mt-14 text-center text-sm text-muted-foreground">
          Full details — deposits, changes, cancellations, allergens — live in our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-primary">
            terms & policies
          </Link>
          .
        </p>
      </section>

      <section id="request" className="relative overflow-hidden border-t border-border">
        <ShaderSilk />
        <div className="relative mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
            <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
            Step 2, made easy
          </p>
          <h2
            data-reveal
            className="mt-2 font-display font-bold tracking-tight"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}
          >
            Request a quote
          </h2>
          <p data-reveal className="mt-4 max-w-xl text-muted-foreground" style={{ lineHeight: 1.7 }}>
            Tell us about your celebration. Don't worry about having every answer — "birthday, ~30
            guests, she loves pandas" is a perfectly good start.
          </p>
          <div data-reveal className="mt-10">
            <QuoteForm />
          </div>
        </div>
      </section>
    </>
  )
}
