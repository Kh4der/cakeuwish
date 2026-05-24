import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ExpandingCarousel from './ExpandingCarousel'
import { CAKES, WHATSAPP_URL } from '../data/cakes'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'

const HEADING = "A taste of what's possible."
const STEP = 0.4 // viewport-fraction of scroll spent opening each cake
const enquire = (title: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! I'd love a cake like "${title}".`)}`

/**
 * "A taste of what's possible." — a scroll-driven gallery: the section pins and,
 * as you scroll, each cake opens up in turn (Gallery maps scroll progress → the
 * active index, ExpandingCarousel expands that one). Once the last opens, the pin
 * releases and the page continues. Reduced motion → a static, accessible grid.
 */
export default function Gallery() {
  const reduced = usePrefersReducedMotion()
  const n = CAKES.length
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const activeRef = useRef(0)

  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      const s = sectionRef.current
      if (!s) return
      const total = s.offsetHeight - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -s.getBoundingClientRect().top / total)) : 0
      const a = Math.round(p * (n - 1))
      if (a !== activeRef.current) { activeRef.current = a; setActive(a) }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced, n])

  const Heading = (
    <>
      <p data-reveal className="font-display text-lg italic text-accent">The Work</p>
      <h2 className="mt-2 font-display text-3xl font-bold sm:text-5xl">
        {HEADING.split(' ').map((w, i) => (
          <span key={i} className="reveal-mask">
            <span data-reveal style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}>{w}&nbsp;</span>
          </span>
        ))}
      </h2>
    </>
  )

  // Reduced motion: no pin / no scroll-drive — a plain accessible grid of all cakes.
  if (reduced) {
    return (
      <section id="work" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        {Heading}
        <p data-reveal className="mt-3 max-w-xl text-muted-foreground">A few of our favourite creations.</p>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CAKES.map((c) => (
            <a
              key={c.id}
              href={enquire(c.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-[4/5] overflow-hidden rounded-2xl"
              style={{ backgroundColor: c.bg }}
            >
              <img src={`/cakes/${c.id}/full.webp`} alt={c.title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full" style={{ objectFit: 'cover' }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(to top, rgba(12,10,9,0.72), rgba(12,10,9,0))' }} />
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">{c.category}</span>
                <h3 className="font-display text-base font-bold leading-tight text-white">{c.title}</h3>
              </div>
            </a>
          ))}
        </div>
      </section>
    )
  }

  const heightVh = Math.round((1 + (n - 1) * STEP) * 100)
  return (
    <section ref={sectionRef} id="work" style={{ height: `${heightVh}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-7xl shrink-0 px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8">
          {Heading}
          <p data-reveal className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Keep scrolling — each creation opens up in turn.</p>
        </div>
        <div className="mx-auto mt-5 w-full min-h-0 max-w-7xl flex-1 px-5 sm:px-8">
          <ExpandingCarousel active={active} fillHeight />
        </div>
        {/* progress indicator */}
        <div className="mx-auto flex w-full max-w-7xl shrink-0 items-center gap-1.5 px-5 py-4 sm:px-8" aria-hidden="true">
          {CAKES.map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: i === active ? 22 : 8, backgroundColor: i === active ? 'var(--color-accent)' : 'rgba(28,25,23,0.18)' }}
            />
          ))}
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{CAKES[active].title}, {active + 1} of {n}</div>
      </div>
    </section>
  )
}
