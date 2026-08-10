import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { WHATSAPP_ENABLED, WHATSAPP_URL, START_ID } from '../data/cakes'
import { useContent } from '../content/ContentProvider'
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
  const { cakes } = useContent()
  // The hero opens on START_ID ("Simply, Always"); falls back to the first cake.
  const startIndex = useMemo(() => Math.max(0, cakes.findIndex((c) => c.id === START_ID)), [cakes])
  // Display order rotated so the hero opens on the start cake, then cycles.
  const order = useMemo(
    () => Array.from({ length: cakes.length }, (_, k) => (startIndex + k) % cakes.length),
    [cakes.length, startIndex],
  )
  const [active, setActive] = useState(0) // index INTO `order` of the centred cake
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const cake = cakes[order[Math.min(active, order.length - 1)]] ?? cakes[0]

  const stageRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const ghostRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const activeRef = useRef(0)
  const isMobileRef = useRef(isMobile)
  const renderRef = useRef<() => void>(() => {})
  // The scrollable travel of the stage, measured ONCE per layout change rather
  // than derived from window.innerHeight on every scroll event. On a phone
  // innerHeight changes as the URL bar slides, so deriving it live made the
  // cakes drift sideways with no scroll at all, and left the drag's snap points
  // sitting between cakes. See `measure`.
  const totalRef = useRef(0)
  const vwRef = useRef(typeof window === 'undefined' ? 0 : window.innerWidth)

  const textMain = cake.dark ? '#FDF8F2' : '#3A2A1E'
  const textSub = cake.dark ? 'rgba(253,248,242,0.82)' : 'rgba(58,42,30,0.72)'
  // Two-tone backdrop matching the cake: a lighter spotlight glow over a deeper base.
  const bgDark = shade(cake.bg, cake.dark ? -0.35 : -0.16)
  const bgLight = shade(cake.bg, cake.dark ? 0.32 : 0.22)
  // Ghost wordmark tint derived from the cake (so it shifts colour per cake).
  const ghostColor = cake.dark ? rgba(shade(cake.bg, 0.75), 0.1) : rgba(shade(cake.bg, -0.5), 0.11)

  // Preload the starting cake eagerly; the rest during idle time.
  useEffect(() => {
    const pre = (src: string) => { const img = new Image(); img.src = src }
    if (cakes[startIndex]) pre(cakes[startIndex].image)
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 300))
    ric(() => { cakes.forEach((c, i) => { if (i !== startIndex) pre(c.image) }) })
  }, [cakes, startIndex])

  // Place every cake from scroll progress: a continuous coverflow where the cake
  // at `pos` is centred (sharp, full size) and its neighbours slide to the sides
  // (smaller, blurred, fading). Styles are set imperatively so React re-renders
  // (bg / title swaps) never clobber the transforms mid-scroll.
  // Stage travel = how far the sticky pin can slide inside the tall section.
  // Both are read from the elements themselves, so they share one unit basis
  // (100svh) instead of mixing CSS `vh` with a live `window.innerHeight`.
  const measure = useCallback(() => {
    const s = stageRef.current
    const p = pinRef.current
    if (!s || !p) return
    totalRef.current = Math.max(1, s.offsetHeight - p.offsetHeight)
    vwRef.current = window.innerWidth
  }, [])

  const render = useCallback(() => {
    const n = order.length
    const pos = clamp01(progressRef.current) * (n - 1) // 0 → first centred … n-1 → last centred
    const m = isMobileRef.current
    const vw = vwRef.current || window.innerWidth || 1
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
      el.style.filter = m ? 'none' : (a < 0.06 ? 'drop-shadow(0 28px 38px rgba(58,42,30,0.22))' : `blur(${Math.min(a, 1.4) * 2.5}px)`)
      el.style.zIndex = String(100 - Math.round(a * 10))
      el.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible'
    }
    // Gentle parallax, scaled to the viewport. On a phone the wordmark already
    // fills the width, so 2% of it would drag the word off the screen edge.
    if (ghostRef.current) ghostRef.current.style.transform = `translateX(${-pos * vw * (m ? 0.004 : 0.02)}px)`
    if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - clamp01(progressRef.current) * 12))

    const act = Math.max(0, Math.min(n - 1, Math.round(pos)))
    if (act !== activeRef.current) { activeRef.current = act; setActive(act) }
  }, [order])

  useEffect(() => { renderRef.current = render }, [render])
  // Paint the correct layout BEFORE first paint (no all-cakes-stacked flash).
  useLayoutEffect(() => { measure(); render() }, [measure, render])

  // Track viewport size (lazy-safe) and re-place cakes. Gated on the WIDTH
  // actually changing: on Chrome Android every URL-bar slide fires `resize`,
  // and re-placing seven cakes plus a setState mid-scroll is exactly the stutter
  // you feel. Height changes can't affect the layout any more — the stage is
  // measured in svh, which the URL bar doesn't move.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth === vwRef.current) return
      const m = window.innerWidth < 640
      isMobileRef.current = m
      setIsMobile(m)
      measure()
      renderRef.current()
    }
    vwRef.current = -1 // force the first pass through
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [measure])

  // Scroll-driven slide via NATIVE CSS sticky (no GSAP pin — its JS pinning
  // jitters during momentum scroll on phones; sticky stays buttery). Progress is
  // driven by Lenis's scroll emit (the same reliable signal GSAP ScrollTrigger
  // used), with a window-scroll bootstrap until Lenis is ready.
  useEffect(() => {
    if (reduced) return
    let visible = true
    // Placing the cakes is deferred to one rAF per frame instead of running
    // inside the scroll dispatch. Scroll events fire before rAF in the same
    // frame so nothing is delayed, but the other scroll readers on this page
    // (the chat widget, the header, the bee) no longer measure against a tree
    // this handler just dirtied — which was a forced reflow each, every event.
    let queued = 0
    const place = () => {
      queued = 0
      const s = stageRef.current
      if (!s) return
      const total = totalRef.current
      progressRef.current = total > 0 ? clamp01(-s.getBoundingClientRect().top / total) : 0
      renderRef.current()
    }
    const onScroll = () => {
      if (!visible) return // skip re-placing the 7 cakes while the hero is off-screen
      if (!queued) queued = requestAnimationFrame(place)
    }
    place()
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
      if (queued) cancelAnimationFrame(queued)
      window.removeEventListener('scroll', onScroll)
      lenis?.off('scroll', onScroll)
      io.disconnect()
    }
  }, [reduced])

  // Drag-to-slide: the carousel is driven by scroll position, so a horizontal
  // drag simply scrubs that same scroll — one cake per ~55% of the viewport
  // width — and on release snaps to the nearest cake. Vertical swipes are left
  // to native scrolling (touch-action: pan-y), and drags that start on the CTA
  // or title links are ignored so they stay clickable.
  useEffect(() => {
    if (reduced) return
    const pin = pinRef.current
    const stage = stageRef.current
    if (!pin || !stage) return
    type LenisLike = { scrollTo: (y: number, o?: { immediate?: boolean }) => void }
    const lenis = () => (window as unknown as { __lenis?: LenisLike }).__lenis
    // One step is exactly one seventh of the measured travel, so a snap always
    // lands a cake dead centre. Deriving it from window.innerHeight put the
    // snap points off by the height of the URL bar.
    const stepPx = () => totalRef.current / Math.max(1, order.length - 1)
    const setScroll = (y: number, immediate: boolean) => {
      const l = lenis()
      if (l) l.scrollTo(y, { immediate })
      else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
    }

    // 'none' = still deciding, 'x' = ours (scrub the carousel), 'y' = the
    // browser's (a page scroll; we never touch it again for this gesture).
    let axis: 'none' | 'x' | 'y' = 'none'
    let pid = -1
    let startX = 0
    let startY = 0
    let startScroll = 0
    let stageTopPx = 0
    let pendingDx = 0
    let raf = 0

    // Scrubbing is applied once per frame. lenis.scrollTo(immediate) emits its
    // scroll event synchronously, so calling it straight from pointermove ran
    // the whole carousel re-place inside the input handler.
    const applyDrag = () => {
      raf = 0
      const total = (order.length - 1) * stepPx()
      const raw = startScroll - (pendingDx * stepPx()) / (vwRef.current * 0.55)
      setScroll(Math.max(stageTopPx, Math.min(stageTopPx + total, raw)), true)
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (!e.isPrimary || pid !== -1) return
      if ((e.target as HTMLElement).closest('a,button')) return
      pid = e.pointerId
      axis = 'none'
      startX = e.clientX
      startY = e.clientY
      startScroll = window.scrollY
      // Read the stage offset ONCE per gesture instead of twice per move.
      stageTopPx = stage.getBoundingClientRect().top + window.scrollY
      pin.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid || axis === 'y') return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (axis === 'none') {
        // Deciding who owns the gesture. The old test latched at 8px on a bare
        // dx > dy — inside the browser's own touch slop — so a thumb arc that
        // was fractionally more horizontal at the start got claimed by the
        // carousel, and because touch-action is pan-y the page then refused to
        // scroll at all. Horizontal now needs real intent, and vertical can
        // win and hand the gesture back for good.
        const ax = Math.abs(dx)
        const ay = Math.abs(dy)
        if (ax >= 14 && ax >= ay * 1.5) {
          axis = 'x'
          pin.style.cursor = 'grabbing'
          pin.style.userSelect = 'none'
        } else if (ay >= 10) {
          axis = 'y'
          pid = -1
          return
        } else {
          return
        }
      }
      // Inert for touch (touch-action governs that) but still what stops a
      // mouse drag from selecting the title text underneath.
      if (e.pointerType === 'mouse') e.preventDefault()
      pendingDx = dx
      if (!raf) raf = requestAnimationFrame(applyDrag)
    }
    const finish = (snap: boolean) => {
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      pin.style.cursor = 'grab'
      pin.style.userSelect = ''
      const wasDrag = axis === 'x'
      axis = 'none'
      pid = -1
      if (!snap || !wasDrag) return
      const idx = Math.max(0, Math.min(order.length - 1, Math.round((window.scrollY - stageTopPx) / stepPx())))
      setScroll(stageTopPx + idx * stepPx(), false)
    }
    const up = (e: PointerEvent) => { if (e.pointerId === pid || pid === -1) finish(true) }
    // A cancel means the browser (or iOS momentum) took the gesture. Snapping
    // into that with a 1.1s animated scrollTo is what yanked the page back.
    const cancel = (e: PointerEvent) => { if (e.pointerId === pid) finish(false) }

    pin.style.cursor = 'grab'
    pin.style.touchAction = 'pan-y'
    pin.addEventListener('pointerdown', down)
    // Pointer capture retargets move/up to the pin, so these no longer sit on
    // window firing for every gesture anywhere on the page.
    pin.addEventListener('pointermove', move, { passive: false })
    pin.addEventListener('pointerup', up)
    pin.addEventListener('pointercancel', cancel)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      pin.style.cursor = ''
      pin.style.touchAction = ''
      pin.style.userSelect = ''
      pin.removeEventListener('pointerdown', down)
      pin.removeEventListener('pointermove', move)
      pin.removeEventListener('pointerup', up)
      pin.removeEventListener('pointercancel', cancel)
    }
  }, [reduced, order.length])

  const heightVh = Math.round((1 + (order.length - 1) * STEP) * 100)

  return (
    <section
      ref={stageRef}
      id="top"
      style={{
        // svh, not vh: the sticky pin below is 100svh, so mixing units meant
        // the track and the pin disagreed by the height of the phone's URL bar.
        height: reduced ? '100svh' : `${heightVh}svh`,
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

        {/* carousel: every cake stays whole; scroll slides them across the stage.
            data-bee-anchor tells BeeCompanion where the cake on stage is, so the
            bee drifts over to visit it whenever the pointer goes still. */}
        <div className="absolute inset-0" data-bee-anchor style={{ zIndex: 3 }}>
          {order.map((ci, slot) => {
            const c = cakes[ci]
            if (!c) return null
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
                <img
                  src={c.image}
                  alt=""
                  width={1024}
                  height={1536}
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full"
                  style={{ objectFit: 'contain', objectPosition: 'bottom center' }}
                />
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
        {/* The CTA sits on this same line, bottom-right. On a phone a 340px
            title box ran straight under it — measured 15px of overlap at 375px
            wide, more on the longer titles — so the box is capped to whatever
            is left beside the pill. */}
        <div className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] left-4 sm:bottom-16 sm:left-16" style={{ zIndex: 60, maxWidth: isMobile ? 'calc(100vw - 11rem)' : 340 }}>
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase"
            style={{ backgroundColor: cake.dark ? 'rgba(255,255,255,0.10)' : 'rgba(58,42,30,0.05)', color: cake.dark ? '#E8B98A' : '#7C4A12', letterSpacing: '0.12em', border: `1px solid ${cake.accent}33` }}
          >
            {cake.category}
          </span>
          <h2 className="font-display" style={{ color: textMain, fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.02, fontWeight: 800, overflowWrap: 'anywhere' }}>
            {cake.title}
          </h2>
          <p className="mt-2 hidden text-sm sm:block" style={{ color: textSub, lineHeight: 1.6 }}>{cake.blurb}</p>
        </div>

        {/* bottom-right: order CTA */}
        {!WHATSAPP_ENABLED ? (
          <Link
            to={`/order?cake=${cake.id}#request`}
            aria-label={`Request a quote for ${cake.title}`}
            data-magnetic
            className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] right-4 flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 transition-transform duration-300 sm:bottom-16 sm:right-12"
            style={{ zIndex: 60, color: cake.dark ? '#3A2A1E' : '#FDF8F2', backgroundColor: cake.dark ? '#FDF8F2' : '#3A2A1E' }}
          >
            <span className="font-display uppercase" style={{ fontSize: 'clamp(15px, 2vw, 22px)', fontWeight: 700, letterSpacing: '0.01em' }}>Order Now</span>
          </Link>
        ) : (
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Order on WhatsApp"
          data-magnetic
          data-cursor-label="Order"
          data-loc="hero"
          className="absolute bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] right-4 flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 transition-transform duration-300 sm:bottom-16 sm:right-12"
          style={{ zIndex: 60, color: cake.dark ? '#3A2A1E' : '#FDF8F2', backgroundColor: cake.dark ? '#FDF8F2' : '#3A2A1E' }}
        >
          <MessageCircle size={isMobile ? 18 : 22} strokeWidth={2.25} aria-hidden="true" />
          <span className="font-display uppercase" style={{ fontSize: 'clamp(15px, 2vw, 22px)', fontWeight: 700, letterSpacing: '0.01em' }}>Order Now</span>
        </a>
        )}
      </div>
    </section>
  )
}
