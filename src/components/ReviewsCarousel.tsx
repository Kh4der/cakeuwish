import { useEffect, useMemo, useRef, useState } from 'react'
import { Star, Quote } from 'lucide-react'
import { REVIEWS } from '../data/reviews'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'

const N = REVIEWS.length
const STEP = 360 / N
const AUTO = 0.16 // deg per frame (~9.6°/s)
const SENS = 0.26 // deg per px dragged
const DECAY = 0.94

export default function ReviewsCarousel() {
  const reduced = usePrefersReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const rotation = useRef(0)
  const velocity = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)
  const lastX = useRef(0)
  const hover = useRef(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  const cardW = isMobile ? 256 : 320
  const cardH = isMobile ? 300 : 300
  const radius = useMemo(
    () => Math.round((cardW / 2) / Math.tan(Math.PI / N) * 1.15),
    [cardW],
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // animation loop
  useEffect(() => {
    let raf = 0
    const apply = () => {
      if (ringRef.current) {
        ringRef.current.style.transform = `translateZ(${-radius}px) rotateY(${rotation.current}deg)`
      }
    }
    const frame = () => {
      if (reduced) velocity.current = 0 // no inertial spin under reduced motion (WCAG 2.3.3)
      if (!dragging.current) {
        rotation.current += velocity.current
        velocity.current *= DECAY
        if (Math.abs(velocity.current) < 0.002) velocity.current = 0
        if (!reduced && !document.hidden) rotation.current += hover.current ? AUTO * 0.2 : AUTO
      }
      apply()
      raf = requestAnimationFrame(frame)
    }
    apply()
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [radius, reduced])

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    moved.current = false
    lastX.current = e.clientX
    velocity.current = 0
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastX.current
    lastX.current = e.clientX
    if (Math.abs(dx) > 3) moved.current = true
    const d = dx * SENS
    rotation.current += d
    velocity.current = d
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }
  const onWheel = (e: React.WheelEvent) => {
    // horizontal intent only — never hijack vertical page scroll
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      rotation.current += e.deltaX * 0.15
      velocity.current = e.deltaX * 0.04
    }
  }

  const fade = '#FAF9F7'

  return (
    <div
      ref={stageRef}
      className="relative mx-auto w-full select-none"
      style={{ height: isMobile ? 380 : 420, perspective: 1200, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      onMouseEnter={() => { hover.current = true }}
      onMouseLeave={() => { hover.current = false }}
    >
      <div
        ref={ringRef}
        className="absolute left-1/2 top-1/2"
        style={{ transformStyle: 'preserve-3d', width: 0, height: 0, cursor: 'grab' }}
      >
        {REVIEWS.map((r, i) => (
          <article
            key={r.name + i}
            className="absolute"
            style={{
              width: cardW,
              height: cardH,
              left: -cardW / 2,
              top: -cardH / 2,
              transform: `rotateY(${i * STEP}deg) translateZ(${radius}px)`,
              backfaceVisibility: 'hidden',
            }}
          >
            <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-cake">
              <Quote className="text-accent" size={26} aria-hidden="true" />
              <div className="mt-2 flex items-center gap-0.5 text-accent" aria-label={`${r.rating} out of 5 stars`}>
                {Array.from({ length: r.rating }).map((_, s) => (
                  <Star key={s} size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                ))}
              </div>
              <p className="mt-3 flex-1 overflow-hidden text-sm leading-relaxed text-card-foreground">
                {r.text}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="font-display font-bold text-primary">{r.name}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Google
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* edge fades */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 sm:w-40"
        style={{ background: `linear-gradient(to right, ${fade}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 sm:w-40"
        style={{ background: `linear-gradient(to left, ${fade}, transparent)` }}
      />
    </div>
  )
}
