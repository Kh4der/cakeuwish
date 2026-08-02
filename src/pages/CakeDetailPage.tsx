import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CakeSlice, Loader2, MessageCircle, Users } from 'lucide-react'
import ShaderSilk from '../components/premium/ShaderSilk'
import TiltCard from '../components/premium/TiltCard'
import Magnetic from '../components/premium/Magnetic'
import { useContent } from '../content/ContentProvider'
import { WHATSAPP_ENABLED, WHATSAPP_URL } from '../data/cakes'
import { usePageMeta } from '../lib/usePageMeta'
import type { CakeContent } from '../content/types'

const revealDelay = (i: number) => ({ '--reveal-delay': `${i * 70}ms` }) as CSSProperties

function RelatedCard({ cake, index }: { cake: CakeContent; index: number }) {
  return (
    <div data-reveal style={revealDelay(index)} className="h-full">
      <TiltCard className="h-full rounded-3xl">
        <Link
          to={`/cakes/${cake.id}`}
          className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-shadow duration-500 hover:shadow-cake"
        >
          <div className="zoom-frame relative aspect-[4/5]" style={{ backgroundColor: cake.bg }}>
            <img
              src={cake.image}
              alt={cake.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain p-4 sm:p-5"
            />
            <span
              aria-hidden="true"
              className="glass-dark pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-[150%] items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cream opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
            >
              View cake <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">{cake.category}</p>
            <h3 className="mt-1.5 font-display text-lg font-bold leading-snug">{cake.title}</h3>
          </div>
        </Link>
      </TiltCard>
    </div>
  )
}

export default function CakeDetailPage() {
  const { id } = useParams()
  const { cakes, loading } = useContent()
  const cake = cakes.find((c) => c.id === id)
  usePageMeta(cake ? cake.title : 'Cake', cake ? `${cake.title} — ${cake.blurb}` : undefined)

  const images = useMemo(() => (cake ? [cake.image, ...cake.extraImages] : []), [cake])
  const [imgIndex, setImgIndex] = useState(0)
  // Router reuses this component across /cakes/a → /cakes/b (related-card
  // clicks); without a reset the new cake opens on a stale thumbnail index.
  useEffect(() => setImgIndex(0), [id])

  const related = useMemo(() => {
    if (!cake) return []
    const others = cakes.filter((c) => c.id !== cake.id && c.visible)
    const sameCat = others.filter((c) => c.category === cake.category)
    const sharedTag = others.filter(
      (c) => c.category !== cake.category && c.tags.some((t) => cake.tags.includes(t)),
    )
    return [...sameCat, ...sharedTag, ...others.filter((c) => !sameCat.includes(c) && !sharedTag.includes(c))].slice(0, 3)
  }, [cakes, cake])

  // Content arrives async — the global reveal scan may have already run, so
  // reveal the page's [data-reveal] nodes with a local observer.
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not(.revealed)'))
    if (els.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('revealed'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [cake, related])

  if (!cake) {
    return (
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-32 sm:px-8">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={18} /> Loading cake…
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center">
            <span
              aria-hidden="true"
              className="ghost-numeral pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 select-none text-[9rem] leading-none"
            >
              ?
            </span>
            <div className="relative">
              <p className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
                We couldn't find that cake.
              </p>
              <p className="mt-3 text-muted-foreground">It may have been removed — but there's plenty more to see.</p>
              <Link
                to="/gallery"
                className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover"
              >
                <ArrowLeft size={16} /> Back to the gallery
              </Link>
            </div>
          </div>
        )}
      </section>
    )
  }

  const current = Math.min(imgIndex, images.length - 1)
  const enquireUrl = `${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! I'd love a cake like "${cake.title}".`)}`

  return (
    <div ref={pageRef}>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-36">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/gallery" className="inline-flex items-center gap-1.5 transition-colors hover:text-primary">
            <ArrowLeft size={15} aria-hidden="true" /> Gallery
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <Link to={`/gallery?cat=${encodeURIComponent(cake.category)}`} className="transition-colors hover:text-primary">
            {cake.category}
          </Link>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* viewer — pins while the details scroll on desktop */}
          <div data-reveal className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4">
              <div
                className="zoom-frame relative aspect-[4/5] flex-1 overflow-hidden rounded-[2rem] border border-border shadow-cake"
                style={{ backgroundColor: cake.bg }}
              >
                <img
                  src={images[current]}
                  alt={cake.title}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-contain p-6 sm:p-8"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[2rem]"
                  style={{ boxShadow: 'inset 0 0 64px rgba(58, 42, 30, 0.08)' }}
                />
              </div>
              {images.length > 1 && (
                <div
                  role="group"
                  aria-label="More photos"
                  className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[34rem] lg:w-20 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible"
                >
                  {images.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setImgIndex(i)}
                      aria-label={`Photo ${i + 1}`}
                      aria-pressed={i === current}
                      className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300 lg:h-24 lg:w-20 ${
                        i === current ? 'border-accent shadow-gold' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: cake.bg }}
                    >
                      <img src={src} alt="" className="h-full w-full object-contain p-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* details */}
          <div className="flex flex-col justify-center">
            <p
              data-reveal
              className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent"
            >
              <span className="inline-block h-px w-8 bg-accent/60" aria-hidden="true" />
              {cake.category}
            </p>
            <h1
              data-reveal
              style={{ ...revealDelay(1), fontSize: 'clamp(2.3rem, 4.5vw, 3.9rem)' }}
              className="mt-3 font-display font-bold leading-[1.04] tracking-tight"
            >
              {cake.title}
            </h1>
            <p
              data-reveal
              style={{ ...revealDelay(2), lineHeight: 1.7 }}
              className="mt-5 max-w-lg text-muted-foreground"
            >
              {cake.blurb}
            </p>

            <div data-reveal style={revealDelay(3)} className="glass mt-9 rounded-3xl p-6 sm:p-7">
              <dl>
                <div className="flex items-start gap-4">
                  <CakeSlice size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">Flavor</dt>
                    <dd className="mt-1 text-sm text-muted-foreground" style={{ lineHeight: 1.65 }}>
                      {cake.flavor || 'Your choice — any flavor from our menu (eggless available for every cake)'}
                    </dd>
                  </div>
                </div>
                <div className="gold-rule my-5" aria-hidden="true" />
                <div className="flex items-start gap-4">
                  <Users size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">Servings</dt>
                    <dd className="mt-1 text-sm text-muted-foreground" style={{ lineHeight: 1.65 }}>
                      {cake.servings || 'Sized to your guest count — see the sizing guide on the pricing page'}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            {cake.tags.length > 0 && (
              <ul data-reveal style={revealDelay(4)} className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
                {cake.tags.map((t) => (
                  <li key={t}>
                    <Link
                      to={`/gallery?q=${encodeURIComponent(t)}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-border bg-card/70 px-4 text-xs font-medium text-foreground/80 transition-colors hover:border-primary hover:bg-primary hover:text-on-primary"
                    >
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div data-reveal style={revealDelay(5)} className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link
                  to={`/order?cake=${cake.id}#request`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
                >
                  Request this design <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </Magnetic>
              {WHATSAPP_ENABLED && (
                <a
                  href={enquireUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cake={cake.title}
                  data-loc="cake-detail"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-105"
                  style={{ backgroundColor: '#1A8A4E' }}
                >
                  <MessageCircle size={18} fill="white" strokeWidth={0} aria-hidden="true" />
                  Ask on WhatsApp
                </a>
              )}
            </div>
            <p data-reveal style={revealDelay(6)} className="mt-4 text-xs text-muted-foreground">
              Every cake is made to order — this design can be adapted to your colors, theme, size, and flavor.
            </p>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
              <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
              Keep browsing
            </p>
            <h2
              data-reveal
              className="mt-2 font-display font-bold tracking-tight"
              style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
            >
              You might also love
            </h2>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
              {related.map((c, i) => (
                <RelatedCard key={c.id} cake={c} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* full-bleed quote band */}
      <section className="relative overflow-hidden border-t border-border">
        <ShaderSilk />
        <div className="relative mx-auto max-w-7xl px-5 py-24 text-center sm:px-8 sm:py-36">
          <p data-reveal className="font-display text-lg italic text-accent">Make it yours</p>
          <h2
            data-reveal
            style={{ ...revealDelay(1), fontSize: 'clamp(2.2rem, 6vw, 4.8rem)' }}
            className="mx-auto mt-3 max-w-4xl font-display font-bold leading-[1.02] tracking-tight"
          >
            This design, <span className="text-foil italic">your</span> celebration
          </h2>
          <p data-reveal style={revealDelay(2)} className="mx-auto mt-6 max-w-xl text-muted-foreground">
            Colors, tiers, toppers, flavors — tell us the occasion and we'll shape “{cake.title}” around it.
          </p>
          <div data-reveal style={revealDelay(3)} className="mt-10">
            <Magnetic>
              <Link
                to={`/order?cake=${cake.id}#request`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
              >
                Start your quote <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>
    </div>
  )
}
