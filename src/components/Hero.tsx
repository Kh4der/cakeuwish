import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAKES, CANVAS_H, WHATSAPP_URL, START_INDEX } from '../data/cakes'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

type Role = 'center' | 'left' | 'right' | 'back' | 'hidden'

function roleOf(i: number, active: number, n: number): Role {
  if (i === active) return 'center'
  if (i === (active + 1) % n) return 'right'
  if (i === (active - 1 + n) % n) return 'left'
  if (i === (active + 2) % n) return 'back'
  return 'hidden'
}

interface RoleStyle {
  left: string
  bottom: string
  height: string
  scale: number
  blur: string
  opacity: number
  z: number
}

function roleStyle(role: Role, m: boolean): RoleStyle {
  switch (role) {
    case 'center':
      return { left: '50%', bottom: m ? '13%' : '4%', height: m ? '54%' : '76%', scale: m ? 1.08 : 1.14, blur: '0px', opacity: 1, z: 30 }
    case 'left':
      return { left: m ? '17%' : '25%', bottom: m ? '33%' : '15%', height: m ? '17%' : '30%', scale: 1, blur: '2px', opacity: 0.92, z: 20 }
    case 'right':
      return { left: m ? '83%' : '75%', bottom: m ? '33%' : '15%', height: m ? '17%' : '30%', scale: 1, blur: '2px', opacity: 0.92, z: 20 }
    case 'back':
      return { left: '50%', bottom: m ? '35%' : '18%', height: m ? '13%' : '23%', scale: 1, blur: '4px', opacity: 0.8, z: 10 }
    default:
      return { left: '50%', bottom: '18%', height: '20%', scale: 0.5, blur: '6px', opacity: 0, z: 1 }
  }
}

export default function Hero() {
  const [index, setIndex] = useState(START_INDEX)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const [assembled, setAssembled] = useState(false)
  const [navigated, setNavigated] = useState(false)
  const cake = CAKES[index]

  const stageRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const centerImgsRef = useRef<HTMLImageElement[]>([])
  const ghostRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const sepRef = useRef(360)
  const animatingRef = useRef(false)
  const assembledRef = useRef(false)
  const renderRef = useRef<() => void>(() => {})

  const reduced = usePrefersReducedMotion()

  const textMain = cake.dark ? '#FAF9F7' : '#1C1917'
  const textSub = cake.dark ? 'rgba(250,249,247,0.82)' : 'rgba(28,25,23,0.72)'
  const ghostColor = cake.dark ? 'rgba(250,249,247,0.09)' : 'rgba(161,98,7,0.07)'

  // Preload the starting cake's layers eagerly; the rest during idle time.
  useEffect(() => {
    CAKES[START_INDEX].layers.forEach((l) => { const img = new Image(); img.src = l.file })
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 300))
    ric(() => { CAKES.forEach((c, i) => { if (i !== START_INDEX) c.layers.forEach((l) => { const img = new Image(); img.src = l.file }) }) })
  }, [])

  // Apply the exploded-view transforms (center cake only) from scroll progress.
  const render = useCallback(() => {
    const p = Math.min(Math.max(progressRef.current, 0), 1)
    // arrives EXPLODED, ASSEMBLES as you scroll (smoothstep over the first ~55%)
    const a = Math.min(p / 0.55, 1)
    const factor = 1 - a * a * (3 - 2 * a)
    const sep = sepRef.current
    centerImgsRef.current.forEach((el, i) => {
      const yNorm = Number(el.dataset.yc) / CANVAS_H // 0 (top) .. 1 (bottom)
      const ty = -(1 - yNorm) * sep * factor // tiers lift upward; board (~1) stays anchored
      const tx = (i % 2 === 0 ? -1 : 1) * 14 * factor
      const rot = (i % 2 === 0 ? -1 : 1) * 2.2 * factor
      const scale = 1 + 0.03 * factor
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(${scale})`
      el.style.filter = `drop-shadow(0 ${8 + 22 * factor}px ${14 + 26 * factor}px rgba(28,25,23,${0.12 + 0.18 * factor}))`
    })
    if (ghostRef.current) ghostRef.current.style.transform = `translateY(${-64 * factor}px) scale(${1 + 0.06 * factor})`
    if (hintRef.current) hintRef.current.style.opacity = String(Math.max(0, 1 - p * 8))
  }, [])

  useEffect(() => { renderRef.current = render }, [render])

  // After each role change / resize: cache the new center's layer imgs, clear
  // stale transforms from the previous center, recompute separation, re-render.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const root = pinRef.current
      if (!root) return
      root.querySelectorAll<HTMLElement>('img[data-yc]').forEach((im) => { im.style.transform = ''; im.style.filter = '' })
      const center = root.querySelector<HTMLElement>('[data-role="center"]')
      centerImgsRef.current = center ? Array.from(center.querySelectorAll<HTMLImageElement>('img[data-yc]')) : []
      const h = center?.getBoundingClientRect().height ?? window.innerHeight * 0.7
      sepRef.current = h * 0.42
      renderRef.current()
    })
    return () => cancelAnimationFrame(raf)
  }, [index, isMobile])

  // Track viewport size.
  useEffect(() => {
    const onResize = () => { setIsMobile(window.innerWidth < 640); ScrollTrigger.refresh() }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Scroll-driven pin + explode (skipped for reduced motion).
  useEffect(() => {
    if (reduced || !stageRef.current || !pinRef.current) return
    const st = ScrollTrigger.create({
      trigger: stageRef.current,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinRef.current,
      pinSpacing: true,
      scrub: true,
      onUpdate: (self) => {
        progressRef.current = self.progress
        renderRef.current()
        const done = self.progress > 0.6
        if (done !== assembledRef.current) { assembledRef.current = done; setAssembled(done) }
      },
      onRefresh: () => renderRef.current(),
    })
    return () => { st.kill() }
  }, [reduced])

  const navigate = useCallback((dir: 1 | -1) => {
    if (animatingRef.current) return
    animatingRef.current = true
    setNavigated(true)
    setIndex((prev) => (prev + dir + CAKES.length) % CAKES.length)
    window.setTimeout(() => { animatingRef.current = false }, 650)
  }, [])

  return (
    <section
      ref={stageRef}
      id="top"
      style={{
        height: reduced ? '100svh' : '240vh',
        backgroundColor: cake.bg,
        transition: 'background-color 650ms cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
    >
      <div
        ref={pinRef}
        className="relative w-full overflow-hidden"
        style={{ height: '100svh', backgroundColor: cake.bg, transition: 'background-color 650ms cubic-bezier(0.25,0.46,0.45,0.94)' }}
      >
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
              fontSize: 'clamp(86px, 27vw, 380px)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: ghostColor,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Wish
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
            {String(index + 1).padStart(2, '0')} <span style={{ opacity: 0.5 }}>/ {String(CAKES.length).padStart(2, '0')}</span>
          </span>
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{cake.title}, cake {index + 1} of {CAKES.length}</div>

        {/* carousel: every cake placed by role; only the center cake explodes on scroll */}
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {CAKES.map((c, i) => {
            const role = roleOf(i, index, CAKES.length)
            const rs = roleStyle(role, isMobile)
            const isCenter = role === 'center'
            return (
              <div
                key={c.id}
                data-role={role}
                aria-hidden={!isCenter}
                className="absolute"
                style={{
                  left: rs.left,
                  bottom: rs.bottom,
                  height: rs.height,
                  aspectRatio: '1024 / 1536',
                  transform: `translateX(-50%) scale(${rs.scale})`,
                  transformOrigin: 'bottom center',
                  filter: rs.blur === '0px' ? 'none' : `blur(${rs.blur})`,
                  opacity: rs.opacity,
                  zIndex: rs.z,
                  pointerEvents: 'none',
                  transition: 'left 650ms cubic-bezier(0.25,0.46,0.45,0.94), bottom 650ms cubic-bezier(0.25,0.46,0.45,0.94), height 650ms cubic-bezier(0.25,0.46,0.45,0.94), transform 650ms cubic-bezier(0.25,0.46,0.45,0.94), filter 650ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 650ms cubic-bezier(0.25,0.46,0.45,0.94)',
                  willChange: 'transform, opacity, filter',
                }}
              >
                {c.layers.map((l) => (
                  <picture key={l.file} className="absolute inset-0 h-full w-full">
                    <source srcSet={l.file} type="image/webp" />
                    <img
                      data-yc={l.yCenter}
                      src={l.filePng}
                      alt=""
                      width={1024}
                      height={1536}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full"
                      style={{ objectFit: 'contain', objectPosition: 'bottom center', willChange: isCenter ? 'transform, filter' : undefined }}
                    />
                  </picture>
                ))}
              </div>
            )
          })}
        </div>

        {/* scroll hint */}
        {!reduced && !isMobile && (
          <div ref={hintRef} className="absolute inset-x-0 flex justify-center" style={{ bottom: '1.5rem', zIndex: 40 }}>
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: textSub }}>Scroll to assemble ↓</span>
          </div>
        )}

        {/* bottom-left: title + nav */}
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

        {/* large side nav arrows */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Previous cake"
          className={`absolute left-4 top-1/2 z-[60] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm transition-[transform,background-color] duration-200 hover:scale-110 sm:left-6 sm:h-[76px] sm:w-[76px] ${assembled && !navigated ? 'nav-highlight' : ''}`}
          style={{ border: `2px solid ${textMain}`, color: textMain, backgroundColor: cake.dark ? 'rgba(255,255,255,0.12)' : 'rgba(28,25,23,0.05)' }}
        >
          <ArrowLeft size={isMobile ? 24 : 32} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Next cake"
          className={`absolute right-4 top-1/2 z-[60] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm transition-[transform,background-color] duration-200 hover:scale-110 sm:right-6 sm:h-[76px] sm:w-[76px] ${assembled && !navigated ? 'nav-highlight' : ''}`}
          style={{ border: `2px solid ${textMain}`, color: textMain, backgroundColor: cake.dark ? 'rgba(255,255,255,0.12)' : 'rgba(28,25,23,0.05)' }}
        >
          <ArrowRight size={isMobile ? 24 : 32} strokeWidth={2} aria-hidden="true" />
        </button>

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
