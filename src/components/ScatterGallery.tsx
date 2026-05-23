import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { SHOWCASE } from '../data/showcase'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'

interface P { x: number; y: number; rot: number; scale: number }
type Phases = { scatter: P; line: P; circle: P; arc: P }

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// deterministic RNG so scatter positions are stable across renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KF: { p: number; key: keyof Phases }[] = [
  { p: 0.05, key: 'scatter' },
  { p: 0.36, key: 'line' },
  { p: 0.62, key: 'circle' },
  { p: 0.88, key: 'arc' },
]

function computeAll(w: number, h: number, n: number, cw: number, _ch: number): Phases[] {
  const cx = w / 2
  const cy = h / 2
  const rand = mulberry32(20260522)
  const out: Phases[] = []
  const circleR = Math.min(w, h) * 0.33
  const archCy = h * 1.44
  const archR = h * 1.02
  const angA = (-150 * Math.PI) / 180
  const angB = (-30 * Math.PI) / 180
  for (let i = 0; i < n; i++) {
    const fr = n === 1 ? 0.5 : i / (n - 1)
    // scatter
    const sx = lerp(cw * 0.9, w - cw * 0.9, rand())
    const sy = lerp(h * 0.16, h * 0.82, rand())
    const srot = (rand() - 0.5) * 56
    // line
    const lx = lerp(cw * 0.7, w - cw * 0.7, fr)
    // circle
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2
    // arc
    const aang = lerp(angA, angB, fr)
    out.push({
      scatter: { x: sx, y: sy, rot: srot, scale: 0.9 },
      line: { x: lx, y: cy, rot: 0, scale: 1 },
      circle: { x: cx + circleR * Math.cos(ang), y: cy + circleR * Math.sin(ang), rot: 0, scale: 1 },
      arc: {
        x: cx + archR * Math.cos(aang),
        y: archCy + archR * Math.sin(aang),
        rot: (aang * 180) / Math.PI + 90,
        scale: 1.06,
      },
    })
  }
  return out
}

export default function ScatterGallery() {
  const reduced = usePrefersReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const introRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const posRef = useRef<Phases[]>([])
  const progressRef = useRef(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const dimsRef = useRef({ cw: 124, ch: 168 })
  const renderRef = useRef<() => void>(() => {})
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef(0)

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [selected, setSelected] = useState<number | null>(null)
  const n = SHOWCASE.length
  const close = useCallback(() => { setSelected(null); const c = cardsRef.current[openerRef.current]; requestAnimationFrame(() => c?.focus?.()) }, [])

  const render = useCallback(() => {
    const pos = posRef.current
    if (!pos.length) return
    const p = clamp01(progressRef.current)
    const { cw, ch } = dimsRef.current
    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    for (let i = 0; i < n; i++) {
      const el = cardsRef.current[i]
      if (!el) continue
      const kf = pos[i]
      let cur: P
      if (p <= KF[0].p) cur = kf.scatter
      else if (p >= KF[KF.length - 1].p) cur = kf.arc
      else {
        let a = KF[0], b = KF[1]
        for (let k = 0; k < KF.length - 1; k++) {
          if (p >= KF[k].p && p <= KF[k + 1].p) { a = KF[k]; b = KF[k + 1]; break }
        }
        const t = easeInOut(seg(p, a.p, b.p))
        const pa = kf[a.key], pb = kf[b.key]
        cur = {
          x: lerp(pa.x, pb.x, t),
          y: lerp(pa.y, pb.y, t),
          rot: lerp(pa.rot, pb.rot, t),
          scale: lerp(pa.scale, pb.scale, t),
        }
      }
      // subtle mouse parallax, depth varies per card
      const depth = 0.4 + (i % 5) * 0.16
      const px = mx * 26 * depth
      const py = my * 14 * depth
      el.style.transform =
        `translate3d(${cur.x - cw / 2 + px}px, ${cur.y - ch / 2 + py}px, 0) rotate(${cur.rot}deg) scale(${cur.scale})`
    }
    if (introRef.current) {
      const o = 1 - seg(p, 0.5, 0.66)
      introRef.current.style.opacity = String(o)
      introRef.current.style.pointerEvents = o < 0.05 ? 'none' : 'auto'
      introRef.current.setAttribute('aria-hidden', o < 0.5 ? 'true' : 'false')
    }
    if (contentRef.current) {
      const o = seg(p, 0.82, 0.92)
      contentRef.current.style.opacity = String(o)
      contentRef.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
      contentRef.current.setAttribute('aria-hidden', o < 0.5 ? 'true' : 'false')
    }
  }, [n])

  useEffect(() => { renderRef.current = render }, [render])

  // measure + recompute positions
  useEffect(() => {
    const measure = () => {
      const el = pinRef.current
      if (!el) return
      const w = el.clientWidth
      const h = el.clientHeight
      const mobile = w < 768
      setIsMobile(mobile)
      const cw = mobile ? 86 : 124
      const ch = mobile ? 116 : 168
      dimsRef.current = { cw, ch }
      posRef.current = computeAll(w, h, n, cw, ch)
      if (reduced) progressRef.current = 1
      renderRef.current()
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (pinRef.current) ro.observe(pinRef.current)
    return () => ro.disconnect()
  }, [n, reduced])

  // scroll-driven phases via CSS-sticky pin + manual progress
  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      const stage = stageRef.current
      if (!stage) return
      const total = stage.offsetHeight - window.innerHeight
      progressRef.current = total > 0 ? clamp01(-stage.getBoundingClientRect().top / total) : 0
      renderRef.current()
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  // mouse parallax
  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    const el = pinRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      mouseRef.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
      renderRef.current()
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [reduced])

  // lightbox: lock scroll + keyboard nav while open
  useEffect(() => {
    if (selected === null) return
    const lenis = (window as Window & { __lenis?: { stop?: () => void; start?: () => void } }).__lenis
    lenis?.stop?.()
    requestAnimationFrame(() => closeBtnRef.current?.focus()) // move focus into the dialog
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setSelected((s) => (s === null ? s : (s + 1) % n))
      else if (e.key === 'ArrowLeft') setSelected((s) => (s === null ? s : (s - 1 + n) % n))
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); lenis?.start?.() }
    // `close` is a stable useCallback — intentionally omitted to keep the deps array size constant
  }, [selected, n])

  return (
    <section
      ref={stageRef}
      id="showcase"
      aria-label="Cake showcase gallery"
      style={{ height: reduced ? '100svh' : '320vh', backgroundColor: '#1C1917' }}
    >
      <div ref={pinRef} className="sticky top-0 w-full overflow-hidden" style={{ height: '100svh' }}>
        {/* intro text */}
        <div
          ref={introRef}
          className="pointer-events-none absolute inset-x-0 top-[14%] z-[5] flex flex-col items-center px-6 text-center"
        >
          <h2 className="font-display font-bold text-cream" style={{ fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.05 }}>
            Every flavor of joy.
          </h2>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: '#CA8A04' }}>
            Scroll to explore
          </p>
        </div>

        {/* content text (revealed when the arc forms) */}
        <div
          ref={contentRef}
          className="pointer-events-none absolute inset-x-0 top-[7%] z-[5] mx-auto flex max-w-2xl flex-col items-center px-6 text-center"
          style={{ opacity: 0 }}
        >
          <h2 className="font-display font-bold text-cream" style={{ fontSize: 'clamp(30px, 5vw, 64px)', lineHeight: 1.08 }}>
            From cartoons to couture.
          </h2>
          <p className="mt-4 text-base sm:text-lg" style={{ color: 'rgba(245,239,230,0.85)', lineHeight: 1.6 }}>
            Frozen castles, Paw Patrol, glowing geodes, Indian weddings — over 200 celebrations,
            and not one cake the same. Yours is next.
          </p>
        </div>

        {/* card field */}
        <div ref={fieldRef} className="absolute inset-0 z-[3]">
          {SHOWCASE.map((im, i) => (
            <div
              key={im.src}
              ref={(el) => { cardsRef.current[i] = el }}
              role="button"
              tabIndex={0}
              aria-label={`Enlarge ${im.alt}`}
              onClick={() => { openerRef.current = i; setSelected(i) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openerRef.current = i; setSelected(i) } }}
              className="sg-card absolute left-0 top-0"
              style={{ width: isMobile ? 86 : 124, height: isMobile ? 116 : 168, willChange: 'transform' }}
            >
              <div className="sg-inner">
                <div className="sg-face">
                  <img src={im.src} alt={im.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
                <div
                  className="sg-face sg-back flex flex-col items-center justify-center px-2 text-center"
                  aria-hidden="true"
                  style={{ background: 'linear-gradient(150deg, #A16207, #1C1917)' }}
                >
                  <span className="font-display text-sm font-bold text-cream">CakeUWish</span>
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#CA8A04' }}>
                    Custom Cake
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected !== null && (
        <div
          className="lb-backdrop fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(12,10,9,0.92)', perspective: '1600px' }}
          role="dialog"
          aria-modal="true"
          aria-label={SHOWCASE[selected].alt}
          onClick={close}
        >
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-cream transition-transform hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.14)' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); setSelected((s) => (s === null ? s : (s - 1 + n) % n)) }}
            className="absolute left-3 flex h-12 w-12 items-center justify-center rounded-full text-cream transition-transform hover:scale-110 sm:left-8"
            style={{ background: 'rgba(255,255,255,0.14)' }}
          >
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
          <figure key={selected} className="lb-panel m-0 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={SHOWCASE[selected].src}
              alt={SHOWCASE[selected].alt}
              className="rounded-2xl object-contain shadow-2xl"
              style={{ maxHeight: '74vh', maxWidth: 'min(92vw, 620px)', background: '#1C1917' }}
            />
            <figcaption className="mt-4 text-center text-sm" style={{ color: 'rgba(245,239,230,0.9)' }}>
              {SHOWCASE[selected].alt}
            </figcaption>
          </figure>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); setSelected((s) => (s === null ? s : (s + 1) % n)) }}
            className="absolute right-3 flex h-12 w-12 items-center justify-center rounded-full text-cream transition-transform hover:scale-110 sm:right-8"
            style={{ background: 'rgba(255,255,255,0.14)' }}
          >
            <ChevronRight size={26} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
