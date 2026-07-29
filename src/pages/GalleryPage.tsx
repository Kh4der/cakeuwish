import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Play, Search, X } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import PageHero from '../components/PageHero'
import Lightbox from '../components/Lightbox'
import TiltCard from '../components/premium/TiltCard'
import Magnetic from '../components/premium/Magnetic'
import { useContent } from '../content/ContentProvider'
import { CATEGORIES } from '../data/cakes'
import { usePageMeta } from '../lib/usePageMeta'
import type { CakeContent } from '../content/types'

gsap.registerPlugin(ScrollTrigger)

// Sits just below the fixed header (header = safe-area/12px pad + logo line + pad).
const STICKY_TOP = 'calc(max(0.75rem, env(safe-area-inset-top)) + 3.1rem)'

function matches(c: CakeContent, q: string): boolean {
  const hay = [c.title, c.blurb, c.category, c.flavor, ...c.tags].join(' ').toLowerCase()
  return q.split(/\s+/).every((w) => hay.includes(w))
}

const revealDelay = (i: number) => ({ '--reveal-delay': `${(i % 8) * 60}ms` }) as CSSProperties

function CakeCard({ cake, index }: { cake: CakeContent; index: number }) {
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
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">{cake.category}</p>
            <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-card-foreground sm:text-xl">
              {cake.title}
            </h3>
          </div>
        </Link>
      </TiltCard>
    </div>
  )
}

export default function GalleryPage() {
  usePageMeta(
    'Cake Gallery',
    'Browse custom cake designs by CakeUWish — weddings, birthdays, milestones, kids themes and more. Filter by occasion or search for an idea.',
  )
  const { cakes, showcase } = useContent()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') ?? 'All'
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const [lightbox, setLightbox] = useState(-1)

  // Chips: canonical categories first (only those with cakes), then any extras
  // an admin has typed in, then All.
  const chips = useMemo(() => {
    const present = new Set(cakes.map((c) => c.category).filter(Boolean))
    const ordered = [
      ...CATEGORIES.filter((c) => present.has(c)),
      ...[...present].filter((c) => !CATEGORIES.includes(c)).sort(),
    ]
    return ['All', ...ordered]
  }, [cakes])

  const setParam = (key: 'cat' | 'q', value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'All') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const filteredCakes = useMemo(
    () =>
      cakes.filter(
        (c) => c.visible && (cat === 'All' || c.category === cat) && (!q || matches(c, q)),
      ),
    [cakes, cat, q],
  )

  // Showcase photos carry no category — they join the wall only for "All",
  // matched against their alt text when searching.
  const filteredShowcase = useMemo(
    () =>
      cat !== 'All'
        ? []
        : showcase.filter((s) => s.visible && (!q || q.split(/\s+/).every((w) => s.alt.toLowerCase().includes(w)))),
    [showcase, cat, q],
  )

  const empty = filteredCakes.length === 0 && filteredShowcase.length === 0

  // The global reveal system only re-scans on navigation; cards mounted by a
  // filter change (or async content load) need their own observer.
  const resultsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = resultsRef.current
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
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [filteredCakes, filteredShowcase])

  // Masonry wall: alternate columns drift at different scrub speeds (desktop,
  // motion-friendly only — gsap.matchMedia reverts transforms otherwise).
  const wallRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wall = wallRef.current
    if (!wall || filteredShowcase.length === 0) return
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      const tiles = Array.from(wall.querySelectorAll<HTMLElement>('button'))
      if (tiles.length === 0) return
      // CSS columns give no structural grouping — bucket tiles by x offset.
      const cols = new Map<number, HTMLElement[]>()
      tiles.forEach((el) => {
        const key = Math.round(el.offsetLeft / 24)
        cols.set(key, [...(cols.get(key) ?? []), el])
      })
      const drifts = [-46, 24, -72, -8]
      const tweens = [...cols.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, els], i) =>
          gsap.to(els, {
            y: drifts[i % drifts.length],
            ease: 'none',
            scrollTrigger: { trigger: wall, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
          }),
        )
      return () => {
        tweens.forEach((t) => {
          t.scrollTrigger?.kill()
          t.kill()
        })
        gsap.set(tiles, { clearProps: 'transform' })
      }
    })
    return () => mm.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on item identity, not array identity: rebuilding all ScrollTriggers on every search keystroke snaps tile transforms mid-view
  }, [filteredShowcase.map((s) => s.id).join('|')])

  return (
    <>
      <PageHero
        eyebrow="The Collection"
        title="Cake Gallery"
        intro="Every cake here was baked for a real celebration — and every one of them started as an idea just like yours. Filter by occasion, or search for a theme."
      />

      <div className="relative">
        {/* sticky glass control bar */}
        <div className="sticky z-40 px-3 pt-4 sm:px-6" style={{ top: STICKY_TOP }}>
          <div className="glass mx-auto max-w-7xl rounded-[1.75rem] p-3 sm:px-4 lg:flex lg:items-center lg:gap-5">
            <label className="relative block lg:w-80 lg:shrink-0">
              <span className="sr-only">Search designs</span>
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={params.get('q') ?? ''}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search — “unicorn”, “wedding”, “geode”…"
                className="min-h-11 w-full rounded-full border border-border/70 bg-card/80 py-2.5 pl-11 pr-10 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setParam('q', '')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <div
              role="group"
              aria-label="Filter by category"
              className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5 lg:mt-0 lg:flex-1 lg:flex-wrap lg:overflow-x-visible lg:pb-0"
            >
              {chips.map((c) => {
                const active = cat === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setParam('cat', c)}
                    aria-pressed={active}
                    className={`relative flex min-h-11 shrink-0 items-center overflow-hidden rounded-full border px-4 text-sm font-medium transition-colors duration-300 ${
                      active
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border/80 bg-card/70 text-foreground/80 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {c}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-3 bottom-[7px] h-px bg-gradient-to-r from-transparent via-gold-soft to-transparent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        active ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <section ref={resultsRef} className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-14">
          {empty ? (
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 text-center sm:py-20">
              <span
                aria-hidden="true"
                className="ghost-numeral pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 select-none text-[9rem] leading-none sm:text-[12rem]"
              >
                0
              </span>
              <div className="relative">
                <p className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3rem)' }}>
                  Nothing matches that <span className="text-foil italic">yet</span>.
                </p>
                <p className="mx-auto mt-4 max-w-md text-muted-foreground" style={{ lineHeight: 1.7 }}>
                  Parul has baked far more designs than we've photographed — if you don't see your idea,
                  she can almost certainly make it.
                </p>
                <Magnetic className="mt-8">
                  <Link
                    to="/order#request"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
                  >
                    Ask for exactly what you want <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </Magnetic>
              </div>
            </div>
          ) : (
            <>
              {filteredCakes.length > 0 && (
                <>
                  <div className="mb-8 flex items-center gap-4">
                    <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {filteredCakes.length} design{filteredCakes.length === 1 ? '' : 's'}
                      {cat !== 'All' ? ` · ${cat}` : ''}
                    </p>
                    <div className="gold-rule flex-1" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                    {filteredCakes.map((c, i) => (
                      <CakeCard key={c.id} cake={c} index={i} />
                    ))}
                  </div>
                </>
              )}

              {filteredShowcase.length > 0 && (
                <div className={filteredCakes.length > 0 ? 'mt-20 sm:mt-28' : ''}>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="ghost-numeral pointer-events-none absolute -top-8 right-0 select-none text-[6rem] leading-none sm:text-[9rem]"
                    >
                      {String(filteredShowcase.length).padStart(2, '0')}
                    </span>
                    <p data-reveal className="flex items-center gap-3 font-display text-lg italic text-accent">
                      <span className="inline-block h-px w-10 bg-accent/60" aria-hidden="true" />
                      The candid wall
                    </p>
                    <h2
                      data-reveal
                      className="mt-2 font-display font-bold tracking-tight"
                      style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
                    >
                      More from recent celebrations
                    </h2>
                    <p data-reveal className="mt-3 max-w-xl text-muted-foreground">
                      Straight from the kitchen — tap any photo for a closer look.
                    </p>
                  </div>
                  <div ref={wallRef} className="mt-10 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>button]:mb-4 [&>button]:break-inside-avoid">
                    {filteredShowcase.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setLightbox(i)}
                        aria-label={s.mediaType === 'video' ? `Play video: ${s.alt}` : s.alt}
                        className="zoom-frame relative block w-full overflow-hidden rounded-2xl border border-border shadow-soft"
                      >
                        {s.mediaType === 'video' ? (
                          <>
                            <video src={s.src} muted playsInline preload="metadata" className="w-full object-cover" />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <span className="glass-dark flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg">
                                <Play size={20} fill="white" strokeWidth={0} aria-hidden="true" />
                              </span>
                            </span>
                          </>
                        ) : (
                          <img
                            src={s.src}
                            alt={s.alt}
                            loading="lazy"
                            decoding="async"
                            className="w-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* bottom CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-primary px-6 py-16 text-center text-cream sm:px-12 sm:py-24">
          <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <p className="font-display text-lg italic text-gold-soft">Every cake begins as a wish</p>
            <h2
              className="mx-auto mt-3 max-w-3xl font-display font-bold leading-[1.05] tracking-tight"
              style={{ fontSize: 'clamp(2rem, 5.5vw, 4rem)' }}
            >
              Saw something you <span className="text-foil italic">love</span>?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-cream/85" style={{ lineHeight: 1.7 }}>
              Every design can be re-imagined for your occasion, guest count, and flavors. Tell us
              what caught your eye and we'll take it from there.
            </p>
            <Magnetic className="mt-9">
              <Link
                to="/order#request"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream px-8 py-4 text-sm font-bold text-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.04]"
              >
                Request a quote <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>

      {lightbox >= 0 && (
        <Lightbox
          photos={filteredShowcase.map((s) => ({ src: s.src, alt: s.alt, mediaType: s.mediaType }))}
          index={lightbox}
          onClose={() => setLightbox(-1)}
          onIndex={setLightbox}
        />
      )}
    </>
  )
}
