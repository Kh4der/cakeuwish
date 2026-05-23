import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CAKES, WHATSAPP_URL } from '../data/cakes'

const enquire = (title: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! I'd love a cake like "${title}".`)}`

export default function ExpandingCarousel() {
  const [active, setActive] = useState(0)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
  const activeRef = useRef(0)
  const lockRef = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const n = CAKES.length
  const setActiveBoth = (i: number) => { const c = Math.min(n - 1, Math.max(0, i)); activeRef.current = c; setActive(c) }
  const step = (d: number) => {
    if (lockRef.current) return
    const next = activeRef.current + d
    if (next < 0 || next >= n) return
    lockRef.current = true
    setActiveBoth(next)
    window.setTimeout(() => { lockRef.current = false }, 520)
  }

  useEffect(() => {
    const f = () => setIsDesktop(window.innerWidth >= 768)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  // wheel: step through items; release at the ends so the page can scroll on
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const amt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(amt) < 12) return
      const d = amt > 0 ? 1 : -1
      const next = activeRef.current + d
      if (next < 0 || next >= n) return // at an end → don't hijack page scroll
      e.preventDefault()
      step(d)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [n])

  const onPointerDown = (e: React.PointerEvent) => { dragRef.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = dragRef.current; dragRef.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    const horiz = Math.abs(dx) > Math.abs(dy)
    const delta = horiz ? dx : dy
    if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1)
  }

  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label="Featured cakes carousel"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
      }}
      className="flex w-full flex-col gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex-row"
      style={{ height: isDesktop ? 540 : '78svh', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
    >
      {CAKES.map((c, i) => {
        const isActive = i === active
        return (
          <button
            key={c.id}
            type="button"
            aria-label={isActive ? `${c.title} (focused)` : `Focus ${c.title}`}
            aria-current={isActive}
            onClick={() => setActiveBoth(i)}
            className="group relative overflow-hidden rounded-2xl"
            style={{
              flex: isActive ? '6 1 0%' : '0.6 1 0%',
              minWidth: 0,
              minHeight: 0,
              backgroundColor: c.bg,
              transition: 'flex 0.6s cubic-bezier(0.6,0,0.2,1)',
              cursor: isActive ? 'default' : 'pointer',
            }}
          >
            <img
              src={`/cakes/${c.id}/full.webp`}
              alt={c.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full transition-all duration-500"
              style={{ objectFit: isActive ? 'contain' : 'cover', objectPosition: 'center', padding: isActive ? '6% 6% 14%' : 0, filter: 'brightness(1.02) saturate(1.06)' }}
            />
            {/* readability scrim */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(to top, rgba(12,10,9,0.72), rgba(12,10,9,0))' }} />

            {/* inactive: vertical title */}
            {!isActive && (
              <span
                className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-white/90"
                style={{ writingMode: 'vertical-rl', transform: 'translateX(-50%) rotate(180deg)' }}
              >
                {c.title}
              </span>
            )}

            {/* active: full details + enquire link */}
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 p-5 text-left sm:p-7">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{c.category}</span>
                <h3 className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">{c.title}</h3>
                <p className="mt-1.5 hidden max-w-md text-sm text-white/85 sm:line-clamp-2 sm:block">{c.blurb}</p>
                <a
                  href={enquire(c.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#1C1917] transition-transform hover:scale-105"
                >
                  Enquire about this <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
