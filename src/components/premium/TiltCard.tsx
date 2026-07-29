import { useRef, type CSSProperties, type ReactNode } from 'react'

// Pointer-tracked 3D tilt with a moving sheen — the "pick the card up" feel.
// Pure CSS transforms driven by rAF-lerped pointer state; inert on touch
// devices and under prefers-reduced-motion.

const MAX_TILT = 7 // degrees
const LERP = 0.12

export default function TiltCard({
  children,
  className = '',
  style,
  sheen = true,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  sheen?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef({ rx: 0, ry: 0, tx: 0, ty: 0, sx: 50, sy: 50, raf: 0, hover: false })

  const apply = () => {
    const el = ref.current
    const s = state.current
    if (!el) return
    s.rx += (s.tx - s.rx) * LERP
    s.ry += (s.ty - s.ry) * LERP
    el.style.transform = `perspective(900px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg)`
    el.style.setProperty('--sheen-x', `${s.sx}%`)
    el.style.setProperty('--sheen-y', `${s.sy}%`)
    if (Math.abs(s.tx - s.rx) > 0.02 || Math.abs(s.ty - s.ry) > 0.02 || s.hover) {
      s.raf = requestAnimationFrame(apply)
    } else {
      s.raf = 0
    }
  }

  const kick = () => {
    if (!state.current.raf) state.current.raf = requestAnimationFrame(apply)
  }

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const s = state.current
    s.hover = true
    s.tx = (0.5 - py) * MAX_TILT * 2
    s.ty = (px - 0.5) * MAX_TILT * 2
    s.sx = px * 100
    s.sy = py * 100
    kick()
  }

  const onLeave = () => {
    const s = state.current
    s.hover = false
    s.tx = 0
    s.ty = 0
    kick()
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`relative will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d', ...style }}
    >
      {children}
      {sheen && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [div:hover>&]:opacity-100"
          style={{
            background:
              'radial-gradient(320px circle at var(--sheen-x,50%) var(--sheen-y,50%), rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)',
            mixBlendMode: 'soft-light',
          }}
        />
      )}
    </div>
  )
}
