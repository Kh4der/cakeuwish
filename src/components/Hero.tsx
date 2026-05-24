import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { CAKES, WHATSAPP_URL, START_INDEX } from '../data/cakes'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
// Viewport fraction of scroll spent gliding from one cake to the next.
const STEP = 0.45

// --- per-cake colour helpers: derive a light + a deeper tone from each cake bg --
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
/** amt > 0 → lighter (toward white); amt < 0 → darker (toward black). */
function shade(hex: string, amt: number): string {
  let [r, g, b] = hexToRgb(hex)
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt }
  else { const k = 1 + amt; r *= k; g *= k; b *= k }
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
function rgba(hex: string, a: number): string { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})` }

/**
 * Hero — a scroll-driven cake carousel. The pinned stage holds while you scroll;
 * progress slides every (whole) cake sideways so the current one glides out and
 * the next glides into the centre, cycling through all cakes. No exploding into
 * layers and no prev/next arrows — the scroll itself moves the cakes. Each cake's
 * background, title and category cross-fade in as it reaches centre.
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion()
  // Display order rotated so the hero opens on START_INDEX ("Simply, Always").
  const order = useMemo(
    () => Array.from({ length: CAKES.length }, (_, k) => (START_INDEX + k) % CAKES.length),
    [],
  )
  const [active, setActive] = useState(0) // index INTO `order` of the centred cake
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const cake = CAKES[order[active]]

  const stageRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const ghostRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const activeRef = useRef(0)
  const isMobileRef = useRef(isMobile)
  const renderRef = useRef<() => void>(() => {})

  const textMain = cake.dark ? '#FAF9F7' : '#1C1917'
  const textSub = cake.dark ? 'rgba(250,249,247,0.82)' : 'rgba(28,25,23,0.72)'
  // Two-tone backdrop matching the cake: a lighter spotlight glow over a deeper base.
  const bgDark = shade(cake.bg, cake.dark ? -0.35 : -0.16)
  const bgLight = shade(cake.bg, cake.dark ? 0.32 : 0.22)
  // Ghost wordmark tint derived from the cake (so it shifts colour per cake).
  const ghostColor = cake.dark ? rgba(shade(cake.bg, 0.75), 0.1) : rgba(shade(cake.bg, -0.5), 0.11)

  // Preload the starting cake eagerly; the rest during idle time.
  useEffect(() => {
    CAKES[START_INDEX].layers.forEach((l) => { const img = new Image(); img.src = l.file })
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 300))
    ric(() => { CAKES.forEach((c, i) => { if (i !== START_INDEX) c.layers.forEach((l) => { const img = new Image(); img.src = l.file }) }) })
  }, [])

  // Place every cake from scroll progress: a continuous coverflow where the cake
  // at `pos` is centred (sharp, full size) and its neighbours slide to the sides
  // (smaller, blurred, fading). Styles are set imperatively so React re-renders
  // (bg / title swaps) never clobber the transforms mid-scroll.
  const render = useCallback(() => {
    const n = order.length
    const pos = clamp01(progressRef.current) * (n - 1) // 0 → first centred … n-1 → last centred
    const m = isMobileRef.current
    const vw = window.innerWidth || 1
    const spacing = vw * (m ? 0.82 : 0.5) // how far each cake slides per step
    const cards = cardsRef.current
    for (let slot = 0; slot < cards.length; slot++) {
      const el = cards[slot]
      if (!el) continue
      const rel = slot - pos // 0 = centred, ± = to the sides
      const a = Math.abs(rel)
      const tx = rel * spacing
      const scale = Math.max(0.5, 1 - a * 0.32)
      const ty = a * (m ? 10 : 24) // side cakes settle a touch lower
      const opacity = clamp01(1 - Math.max(0, a - 0.6) / 1.1)
      el.style.transform = `translate3d(calc(-50% + ${tx}px), ${ty}px, 0) scale(${scale})`
      el.style.opacity = String(opacity)
      // Animated blur/drop-shadow per scroll frame is the biggest jank source on
      // phones — skip filters on mobile (scale + opacity already convey depth).
      el.style.filter = m ? 'none' : (a < 0.06 ? 'drop-shadow(0 28px 38px rgba(28,25,23,0.22))' : `blur(${Math.min(a, 1.4) * 2.5}px)`)
      el.style.zIndex = String(100 - Math.round(a * 10))
      el.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible'
    }
    if (ghostRef.current) ghostRef.current.style.transform = `translateX(${-pos * vw * 0.02}px)` // gentle parallax, scaled to viewport so it stays readable on phones
    if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - clamp01(progressRef.current) * 12))

    const act = Math.max(0, Math.min(n - 1, Math.round(pos)))
    if (act !== activeRef.current) { activeRef.current = act; setActive(act) }
  }, [order])

  useEffect(() => { renderRef.current = render }, [render])
  // Paint the correct layout BEFORE first paint (no all-cakes-stacked flash).
  useLayoutEffect(() => { render() }, [render])

  // Track viewport size (lazy-safe) and re-place cakes.
  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 640
      isMobileRef.current = m
      setIsMobile(m)
      renderRef.current()
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Scroll-driven slide via NATIVE CSS sticky (no GSAP pin — its JS pinning
  // jitters during momentum scroll on phones; sticky stays buttery). Progress is
  // driven by Lenis's scroll emit (the same reliable signal GSAP ScrollTrigger
  // used), with a window-scroll bootstrap until Lenis is ready.
  useEffect(() => {
    if (reduced) return
    let visible = true
    const onScroll = () => {
      if (!visible) return // skip re-placing the 7 cakes while the hero is off-screen
      const s = stageRef.current
      if (!s) return
      const total = s.offsetHeight - window.innerHeight
      progressRef.current = total > 0 ? clamp01(-s.getBoundingClientRect().top / total) : 0
      renderRef.current()
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    type LenisLike = { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void }
    let lenis: LenisLike | undefined
    const id = window.setTimeout(() => {
      lenis = (window as unknown as { __lenis?: LenisLike }).__lenis
      if (lenis) { lenis.on('scroll', onScroll); window.removeEventListener('scroll', onScroll) }
    }, 0)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll() }, { threshold: 0 })
    if (stageRef.current) io.observe(stageRef.current)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('scroll', onScroll)
      lenis?.off('scroll', onScroll)
      io.disconnect()
    }
  }, [reduced])

  const heightVh = Math.round((1 + (order.length - 1) * STEP) * 100)

  return (
    <section
      ref={stageRef}
      id="top"
      style={{
        height: reduced ? '100svh' : `${heightVh}vh`,
        backgroundColor: bgDark,
        transition: 'background-color 650ms cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      <div
        ref={pinRef}
        className="sticky top-0 w-full overflow-hidden"
        style={{ height: '100svh', backgroundColor: bgDark, transition: 'background-color 650ms cubic-bezier(0.25,0.46,0.45,0.94)' }}
      >
        {/* two-tone wash: a lighter spotlight of the cake colour over the deep base */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: bgLight,
            transition: 'background-color 650ms cubic-bezier(0.25,0.46,0.45,0.94)',
            WebkitMaskImage: 'radial-gradient(118% 88% at 50% 40%, #000 0%, rgba(0,0,0,0.34) 56%, transparent 84%)',
            maskImage: 'radial-gradient(118% 88% at 50% 40%, #000 0%, rgba(0,0,0,0.34) 56%, transparent 84%)',
            zIndex: 1,
          }}
        />

        {/* grain */}
        <div className="grain pointer-events-none absolute inset-0" style={{ zIndex: 50 }} />

        {/* ghost word */}
        <div
          ref={ghostRef}
          className="font-display pointer-events-none absolute inset-x-0 flex select-none items-center justify-center"
          style={{ top: '14%', zIndex: 2 }}
        >
          <span
            style={{
              fontSize: 'clamp(34px, 14vw, 220px)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: ghostColor,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Cake U Wish
          </span>
        </div>

        {/* brand label */}
        <div className="absolute left-4 top-6 sm:left-8" style={{ zIndex: 60 }}>
          <h2 className="sr-only">Featured cakes</h2>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: textMain, letterSpacing: '0.2em' }}>
            CakeUWish
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cake.accent }} />
          </span>
        </div>

        {/* index counter */}
        <div className="absolute right-4 top-6 sm:right-8" style={{ zIndex: 60 }}>
          <span aria-hidden="true" className="font-display text-sm" style={{ color: textMain, opacity: 0.85 }}>
            {String(active + 1).padStart(2, '0')} <span style={{ opacity: 0.5 }}>/ {String(order.length).padStart(2, '0')}</span>
          </span>
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{cake.title}, cake {active + 1} of {order.length}</div>

        {/* carousel: every cake stays whole; scroll slides them across the stage */}
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {order.map((ci, slot) => {
            const c = CAKES[ci]
            return (
              <div
                key={c.id}
                ref={(el) => { cardsRef.current[slot] = el }}
                aria-hidden={slot !== active}
                className="absolute"
                style={{
                  left: '50%',
                  bottom: isMobile ? '12%' : '5%',
                  height: isMobile ? '56%' : '80%',
                  aspectRatio: '1024 / 1536',
                  transformOrigin: 'bottom center',
                  willChange: 'transform, opacity, filter',
                  pointerEvents: 'none',
                }}
              >
                {c.layers.map((l) => (
                  <picture key={l.file} className="absolute inset-0 h-full w-full">
                    <source srcSet={l.file} type="image/webp" />
                    <img
                      src={l.filePng}
                      alt=""
                      width={1024}
                      height={1536}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full"
                      style={{ objectFit: 'contain', objectPosition: 'bottom center' }}
                    />
                  </picture>
                ))}
              </div>
            )
          })}
        </div>

        {/* scroll hint (desktop only — mobile bottom row holds title + CTA) */}
        {!reduced && !isMobile && (
          <div ref={hintRef} className="absolute inset-x-0 flex justify-center" style={{ bottom: '1.5rem', zIndex: 40 }}>
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: textSub }}>Scroll to explore ↓</span>
          </div>
        )}

        {/* bottom-left: title */}
        <div className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] left-4 sm:bottom-16 sm:left-16" style={{ zIndex: 60, maxWidth: 340 }}>
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase"
            style={{ backgroundColor: cake.dark ? 'rgba(255,255,255,0.10)' : 'rgba(28,25,23,0.05)', color: cake.dark ? '#E8B98A' : '#854D0E', letterSpacing: '0.12em', border: `1px solid ${cake.accent}33` }}
          >
            {cake.category}
          </span>
          <h2 className="font-display" style={{ color: textMain, fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.02, fontWeight: 800 }}>
            {cake.title}
          </h2>
          <p className="mt-2 hidden text-sm sm:block" style={{ color: textSub, lineHeight: 1.6 }}>{cake.blurb}</p>
        </div>

        {/* bottom-right: order CTA */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Order on WhatsApp"
          data-magnetic
          data-cursor-label="Order"
          className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] right-4 flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 transition-transform duration-300 sm:bottom-16 sm:right-12"
          style={{ zIndex: 60, color: cake.dark ? '#1C1917' : '#FAF9F7', backgroundColor: cake.dark ? '#FAF9F7' : '#1C1917' }}
        >
          <MessageCircle size={isMobile ? 18 : 22} strokeWidth={2.25} aria-hidden="true" />
          <span className="font-display uppercase" style={{ fontSize: 'clamp(15px, 2vw, 22px)', fontWeight: 700, letterSpacing: '0.01em' }}>Order Now</span>
        </a>
      </div>
    </section>
  )
}
