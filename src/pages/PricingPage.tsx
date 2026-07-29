import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/PageHero'
import TiltCard from '../components/premium/TiltCard'
import Magnetic from '../components/premium/Magnetic'
import ShaderSilk from '../components/premium/ShaderSilk'
import { ADDONS, FLAVORS, SIZING, STARTING_PRICES } from '../data/pricing'
import { usePageMeta } from '../lib/usePageMeta'
import type { LivePricing } from '../lib/pricingContent'

const BACKEND = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

const stagger = (i: number): CSSProperties => ({ '--reveal-delay': `${i * 80}ms` } as CSSProperties)

// Splits "From $95 / dozen" into eyebrow / foil dollar figure / suffix so the
// number itself carries the typography. Null still renders the quote link.
function Price({ value, size = 'md' }: { value: string | null; size?: 'md' | 'lg' }) {
  if (!value) {
    return (
      <Link
        to="/order#request"
        className="inline-flex min-h-[44px] items-center rounded-full border border-accent px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Request a quote
      </Link>
    )
  }
  // Swallow a trailing range segment so "$95–$150" foils as one figure.
  const m = value.match(/^(.*?)(\$\d[\d,]*(?:\.\d+)?(?:\s*[–-]\s*\$?\d[\d,]*(?:\.\d+)?)?)(.*)$/)
  if (!m) {
    // Free-text prices ("Market price", "Ask us") stay body-sized — display
    // foil at 5xl only suits short dollar figures.
    return <span className="font-display text-xl font-bold text-accent">{value}</span>
  }
  const [, pre = '', figure = '', post = ''] = m
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {pre.trim() && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{pre.trim()}</span>
      )}
      <span className={`text-foil font-display font-bold leading-none ${size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>
        {figure}
      </span>
      {post.trim() && <span className="text-sm text-muted-foreground">{post.trim()}</span>}
    </span>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
      <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
      {children}
    </p>
  )
}

// Proportional pure-CSS discs for the three round sizes (decorative — the
// table below is the accessible source of truth).
const DISC_SIZES = ['clamp(64px, 17vw, 120px)', 'clamp(84px, 22vw, 156px)', 'clamp(104px, 27vw, 192px)']

export default function PricingPage() {
  usePageMeta(
    'Pricing Guide',
    'How CakeUWish pricing works — starting prices by cake type, a cake sizing guide, flavor menu (all available eggless), and add-ons. Every cake is quoted individually.',
  )

  // Bundled prices render instantly; admin-edited rows override once fetched.
  const [live, setLive] = useState<LivePricing | null>(null)
  useEffect(() => {
    if (!BACKEND) return
    let active = true
    import('../lib/pricingContent')
      .then((m) => m.fetchPricing())
      .then((p) => {
        if (active && p) setLive(p)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const starting = live?.starting.length ? live.starting : STARTING_PRICES
  const addons = live?.addons.length ? live.addons : ADDONS

  return (
    <>
      <PageHero
        eyebrow="Pricing Guide"
        title="What custom cakes cost"
        intro="Every CakeUWish cake is designed from scratch, so every cake is quoted individually. Three things drive the price: how many people you're feeding, how intricate the design is, and special details like sculpted figures or sugar flowers."
      />

      {/* starting prices */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="starting-prices">
        <Eyebrow>The investment</Eyebrow>
        <h2 id="starting-prices" data-reveal className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Starting points
        </h2>
        <p data-reveal className="mt-4 max-w-2xl text-muted-foreground" style={{ lineHeight: 1.7 }}>
          These are starting prices — your quote is always personal to your design and guest count.
          Send your idea and get a real number, usually within a day or two. No payment is needed
          until you confirm.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {starting.map((p, i) => (
            <div key={p.item} data-reveal style={stagger(i)}>
              <TiltCard className="h-full rounded-3xl">
                <div className="glass flex h-full flex-col justify-between rounded-3xl p-7">
                  <div>
                    <h3 className="font-display text-xl font-bold">{p.item}</h3>
                    <div className="gold-rule mt-4 w-16" aria-hidden="true" />
                    <p className="mt-4 text-sm text-muted-foreground" style={{ lineHeight: 1.65 }}>
                      {p.detail}
                    </p>
                  </div>
                  <div className="mt-8">
                    <Price value={p.price} size="lg" />
                  </div>
                </div>
              </TiltCard>
            </div>
          ))}
        </div>
      </section>

      {/* sizing guide */}
      <section className="border-y border-border bg-muted/30" aria-labelledby="sizing">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <Eyebrow>Fit the party</Eyebrow>
          <h2 id="sizing" data-reveal className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Cake sizing guide
          </h2>
          <p data-reveal className="mt-4 max-w-2xl text-muted-foreground" style={{ lineHeight: 1.7 }}>
            Typical party-serving counts. Parul confirms exact numbers for your design, and a
            cutting chart comes with your order so you get every serving you paid for.
          </p>

          {/* visual proportion strip — decorative; the table is the accessible source */}
          <div aria-hidden="true" className="mt-12 flex items-end justify-center gap-6 sm:gap-14">
            {SIZING.slice(0, 3).map((row, i) => (
              <div key={row.size} data-reveal style={stagger(i)} className="flex flex-col items-center gap-3">
                <div
                  className="flex flex-col items-center justify-center rounded-full border border-accent/40"
                  style={{
                    width: DISC_SIZES[i],
                    height: DISC_SIZES[i],
                    background: 'radial-gradient(circle at 32% 28%, #FFFFFF 0%, #F5EFE6 55%, #EBDFC9 100%)',
                    boxShadow: 'inset 0 2px 10px rgba(161,98,7,0.12), 0 14px 28px -14px rgba(28,25,23,0.28)',
                  }}
                >
                  <span className="font-display text-base font-bold text-accent sm:text-xl">{row.servings}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
                    guests
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
                  {row.size}
                </p>
              </div>
            ))}
          </div>

          <div data-reveal className="glass mt-10 rounded-3xl">
            <div className="overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th scope="col" className="px-6 py-5 font-semibold">Size</th>
                    <th scope="col" className="px-6 py-5 font-semibold">Servings</th>
                    <th scope="col" className="px-6 py-5 font-semibold">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZING.map((row) => (
                    <tr key={row.size} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                      <th scope="row" className="px-6 py-5 font-display text-lg font-bold">
                        {row.size}
                      </th>
                      <td className="px-6 py-5 tabular-nums text-accent">{row.servings}</td>
                      <td className="px-6 py-5 text-muted-foreground">{row.bestFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* flavors */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24" aria-labelledby="flavors">
        <Eyebrow>The menu</Eyebrow>
        <h2 id="flavors" data-reveal className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Flavors
        </h2>

        <div data-reveal className="glass mt-8 max-w-2xl rounded-2xl p-6 sm:p-7">
          <p className="text-sm sm:text-base" style={{ lineHeight: 1.7 }}>
            Every flavor can be made <strong className="font-semibold text-accent">eggless</strong> — it's a
            CakeUWish specialty. Don't see your dream flavor? Ask; custom combinations happen all
            the time.
          </p>
        </div>

        <ul className="mt-10 grid gap-x-14 sm:grid-cols-2">
          {FLAVORS.map((f, i) => (
            <li key={f.name} data-reveal style={stagger(i % 2)} className="group border-b border-border py-6">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
                <h3 className="font-display text-xl font-bold tracking-normal transition-[letter-spacing] duration-500 ease-out group-hover:tracking-[0.06em] sm:text-2xl">
                  {f.name}
                </h3>
              </div>
              {f.note && (
                <p className="mt-1.5 pl-[18px] text-sm italic text-muted-foreground">{f.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* add-ons */}
      <section className="border-t border-border bg-muted/30" aria-labelledby="addons">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <Eyebrow>The extras</Eyebrow>
          <h2 id="addons" data-reveal className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Add-ons
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {addons.map((a, i) => (
              <div
                key={a.item}
                data-reveal
                style={stagger(i)}
                className="glass flex items-center justify-between gap-6 rounded-2xl p-6"
              >
                <div>
                  <h3 className="font-display text-lg font-bold">{a.item}</h3>
                  <p className="mt-1 text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                    {a.detail}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end text-right">
                  <Price value={a.price} />
                </div>
              </div>
            ))}
          </div>

          {/* CTA band */}
          <div data-reveal className="relative mt-16 overflow-hidden rounded-[2.5rem] border border-border shadow-soft">
            <ShaderSilk />
            <div className="relative px-6 py-14 text-center sm:px-12 sm:py-20">
              <p className="font-display text-lg italic text-accent">Ready when you are</p>
              <h2 className="mt-2 font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3.25rem)' }}>
                Get your <span className="text-foil">real number</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground" style={{ lineHeight: 1.7 }}>
                Two minutes to tell us about your celebration — then an actual quote, not a guess. A
                50% deposit locks your date; the rest is due at pickup.
              </p>
              <Magnetic className="mt-8">
                <Link
                  to="/order#request"
                  className="inline-flex min-h-[48px] items-center rounded-full bg-primary px-9 py-4 text-sm font-bold text-on-primary shadow-cake transition-colors hover:bg-primary-hover"
                >
                  Request a quote
                </Link>
              </Magnetic>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
