import { useCallback, useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../lib/useReducedMotion'
import HoverBloom from './HoverBloom'

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

interface Particle { x: number; y: number; hx: number; hy: number; vx: number; vy: number; c: string; ph: number; sz: number }

/**
 * Interactive particle wordmark "CAKE U WISH" (newmix-style fluid field): the
 * letters are built from particles that the cursor REPELS + SWIRLS (curl/vortex)
 * and DRAGS along its motion (velocity wake / contrail), then they drift slowly
 * home under a weak spring + light damping while shimmering with idle motion.
 * Fast particles render as short streaks (smoke look); at rest they're crisp dots.
 * On scroll the particles fly out from the gold "U" and the canvas zooms in + fades.
 */
export default function Intro() {
  const reduced = usePrefersReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const uRef = useRef({ x: 0, y: 0 })

  const build = useCallback(() => {
    const canvas = canvasRef.current, stage = stageRef.current
    if (!canvas || !stage) return
    const w = stage.clientWidth || window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.25 : 2) // lower DPR on phones to cut per-frame fill cost
    sizeRef.current = { w, h, dpr }
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    const off = document.createElement('canvas')
    off.width = w; off.height = h
    const o = off.getContext('2d')
    if (!o) return
    o.clearRect(0, 0, w, h)
    o.textBaseline = 'middle'
    o.textAlign = 'left'
    const family = '"Playfair Display", Georgia, serif'
    const y = h * 0.5
    // Start from a target size, then SHRINK-TO-FIT so the whole "CAKE U WISH"
    // (with the 1.3× gold "U") always fits inside the canvas — this is what fixes
    // the leading "C" and trailing "H" getting clipped on narrow phones.
    let fs = Math.min(w * (w < 768 ? 0.2 : 0.12), 150)
    let fsU = fs * 1.3
    o.font = `900 ${fs}px ${family}`
    let wCake = o.measureText('CAKE ').width
    let wWish = o.measureText(' WISH').width
    o.font = `900 ${fsU}px ${family}`
    let wU = o.measureText('U').width
    let total = wCake + wU + wWish
    const maxW = w * 0.9 // keep a safe margin on both sides so nothing touches the edge
    if (total > maxW) {
      const k = maxW / total // measureText scales linearly with font px, so this is exact
      fs *= k; fsU *= k; wCake *= k; wWish *= k; wU *= k; total = maxW
    }
    const cakeFont = `900 ${fs}px ${family}`
    const uFont = `900 ${fsU}px ${family}`
    let x = w / 2 - total / 2
    o.font = cakeFont; o.fillStyle = '#1C1917'; o.fillText('CAKE ', x, y); x += wCake
    o.font = uFont; o.fillStyle = '#A16207'; o.fillText('U', x, y); uRef.current = { x: x + wU / 2, y }; x += wU
    o.font = cakeFont; o.fillStyle = '#1C1917'; o.fillText(' WISH', x, y)

    const img = o.getImageData(0, 0, w, h).data
    const mobile = w < 768
    const step = mobile ? 4 : 6 // denser sampling on phones so the wordmark actually reads
    const baseSz = mobile ? 2.7 : 2.1 // + slightly bigger dots on phones → solid, legible letters
    const parts: Particle[] = []
    for (let py = 0; py < h; py += step) {
      for (let px = 0; px < w; px += step) {
        const idx = (py * w + px) * 4
        if (img[idx + 3] > 130) {
          parts.push({ x: px, y: py, hx: px, hy: py, vx: 0, vy: 0, c: `rgb(${img[idx]},${img[idx + 1]},${img[idx + 2]})`, ph: Math.random() * Math.PI * 2, sz: baseSz + Math.random() * 0.9 })
        }
      }
    }
    particlesRef.current = parts
  }, [])

  // animation + interaction
  useEffect(() => {
    build()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build)

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const drawStatic = () => {
      const { w, h, dpr } = sizeRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const p of particlesRef.current) { ctx.fillStyle = p.c; ctx.fillRect(p.hx, p.hy, p.sz, p.sz) }
    }

    if (reduced) {
      drawStatic()
      const onR = () => { build(); drawStatic() }
      window.addEventListener('resize', onR)
      return () => window.removeEventListener('resize', onR)
    }

    // --- newmix-style tunables ---------------------------------------------
    const R = 150          // repel + curl radius
    const WAKE = 235       // velocity-wake radius (larger, softer)
    const REPEL = 4.6      // radial push strength
    const CURL = 3.1       // tangential swirl strength (the vortex)
    const DRAG = 0.5       // how much cursor velocity is imparted (wake)
    const MAXV = 20        // clamp on cursor speed feeding the wake (tames fast flicks)
    const SPRING = 0.04    // weak pull home -> slow, fluid recovery
    const FRICTION = 0.89  // light damping -> particles drift/orbit before settling
    const SHIMMER = 0.5    // idle motion amplitude (px)
    const STREAK = 1.6     // motion-streak length factor
    const MAXSTREAK = 16   // cap streak length (px)
    // -----------------------------------------------------------------------
    const R2 = R * R, WAKE2 = WAKE * WAKE
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    if (stageRef.current) io.observe(stageRef.current)
    let raf = 0
    const tStart = performance.now()
    const pm = { x: -9999, y: -9999 } // previous cursor position
    let mvx = 0, mvy = 0              // smoothed cursor velocity (drives the wake)

    const frame = (now: number) => {
      if (!visible) { raf = requestAnimationFrame(frame); return } // pause the field when the intro is off-screen
      const { w, h, dpr } = sizeRef.current
      const t = (now - tStart) * 0.001
      const p = clamp01(progressRef.current)
      const disperse = ease(clamp01((p - 0.55) / 0.45)) // CAKE & WISH drift gently outward from the U
      const zoom = 1 + 1.6 * ease(clamp01((p - 0.55) / 0.45)) // GENTLE zoom into the U (stays on-screen, no sparse overflow)
      const fade = 1 - clamp01((p - 0.72) / 0.28) // fades out cohesively, finishing right as the hero arrives
      const interact = 1 - clamp01(p / 0.5) // wordmark stays readable + interactive for most of the scroll
      const u = uRef.current
      const m = mouseRef.current

      // smoothed cursor velocity (0 when off-canvas or freshly entered)
      let dvx = 0, dvy = 0
      if (m.x > -9000 && pm.x > -9000) { dvx = m.x - pm.x; dvy = m.y - pm.y }
      mvx += (dvx - mvx) * 0.35; mvy += (dvy - mvy) * 0.35
      pm.x = m.x; pm.y = m.y
      // clamp cursor speed so a fast flick can't fling particles off-screen
      const msp = Math.hypot(mvx, mvy)
      if (msp > MAXV) { const s = MAXV / msp; mvx *= s; mvy *= s }
      const live = interact > 0 && m.x > -9000

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.translate(u.x, u.y); ctx.scale(zoom, zoom); ctx.translate(-u.x, -u.y)
      ctx.globalAlpha = fade
      ctx.lineCap = 'round'
      const parts = particlesRef.current
      for (let i = 0; i < parts.length; i++) {
        const pt = parts[i]
        // idle shimmer: gently drifting home target keeps the field alive at rest
        const sx = pt.hx + (Math.sin(t * 1.1 + pt.ph) + Math.sin(t * 0.53 + pt.ph * 1.7)) * SHIMMER
        const sy = pt.hy + (Math.cos(t * 0.9 + pt.ph * 1.3) + Math.sin(t * 0.61 + pt.ph)) * SHIMMER
        // scroll fly-away: home pushed radially outward from the U
        const hx = sx + (pt.hx - u.x) * disperse * 1.3
        const hy = sy + (pt.hy - u.y) * disperse * 1.3

        if (live) {
          const dx = pt.x - m.x, dy = pt.y - m.y
          const d2 = dx * dx + dy * dy
          if (d2 < WAKE2) {
            const d = Math.sqrt(d2) || 1
            const nx = dx / d, ny = dy / d
            // velocity wake: drag particles along the cursor's motion (contrail)
            const wf = (1 - d / WAKE) * DRAG * interact
            pt.vx += mvx * wf; pt.vy += mvy * wf
            if (d2 < R2) {
              const prox = (R - d) / R
              const rf = prox * REPEL * interact // radial repel (carves the void)
              const cf = prox * CURL * interact  // tangential curl (swirls the rim)
              pt.vx += nx * rf - ny * cf
              pt.vy += ny * rf + nx * cf
            }
          }
        }

        // weak spring home + light damping = slow fluid drift back
        pt.vx += (hx - pt.x) * SPRING
        pt.vy += (hy - pt.y) * SPRING
        pt.vx *= FRICTION; pt.vy *= FRICTION
        pt.x += pt.vx; pt.y += pt.vy

        // render: streak when moving fast, crisp dot at rest.
        // Streaks (per-particle stroke) are costlier than fillRect — desktop only;
        // phones always draw dots so interaction stays smooth.
        const sp2 = pt.vx * pt.vx + pt.vy * pt.vy
        if (sp2 > 1.1 && w >= 768) {
          let tx = pt.vx * STREAK, ty = pt.vy * STREAK
          const tl = Math.hypot(tx, ty)
          if (tl > MAXSTREAK) { const s = MAXSTREAK / tl; tx *= s; ty *= s }
          ctx.strokeStyle = pt.c
          ctx.lineWidth = pt.sz
          ctx.beginPath()
          ctx.moveTo(pt.x, pt.y)
          ctx.lineTo(pt.x - tx, pt.y - ty)
          ctx.stroke()
        } else {
          ctx.fillStyle = pt.c
          ctx.fillRect(pt.x, pt.y, pt.sz, pt.sz)
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // pointermove covers mouse + touch + pen, so the wordmark reacts on phones too
    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    window.addEventListener('pointermove', toLocal, { passive: true })
    // Tap / click impulse: a quick touch can't build a velocity wake, so give the
    // field an outward BURST at the tap point. This makes the wordmark react to a
    // single tap on phones (where any drag just scrolls the page away instead).
    const onDown = (e: PointerEvent) => {
      if (clamp01(progressRef.current) > 0.3) return // ignore once scrolling toward the hero
      const r = canvas.getBoundingClientRect()
      const lx = e.clientX - r.left, ly = e.clientY - r.top
      const BR = 180, BR2 = BR * BR, POW = 11
      const parts = particlesRef.current
      for (let i = 0; i < parts.length; i++) {
        const pt = parts[i]
        const dx = pt.x - lx, dy = pt.y - ly
        const d2 = dx * dx + dy * dy
        if (d2 < BR2) {
          const d = Math.sqrt(d2) || 1
          const f = (1 - d / BR) * POW
          pt.vx += (dx / d) * f; pt.vy += (dy / d) * f
        }
      }
      mouseRef.current = { x: lx, y: ly }
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    // Release the field when the touch lifts / the pointer leaves: move the cursor
    // off-canvas so the repel+curl stop and the particles drift home and SETTLE.
    // Phones have no hover/leave, so without this the void swirls forever after a tap.
    const release = () => { mouseRef.current = { x: -9999, y: -9999 } }
    window.addEventListener('pointerup', release, { passive: true })
    window.addEventListener('pointercancel', release, { passive: true })
    window.addEventListener('pointerleave', release, { passive: true })
    let rT = 0
    const onResize = () => { window.clearTimeout(rT); rT = window.setTimeout(build, 150) } // debounce (iOS toolbar fires resize repeatedly)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', toLocal)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('pointerleave', release)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(rT)
    }
  }, [build, reduced])

  // scroll progress (sticky pin)
  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      const s = stageRef.current
      if (!s) return
      const total = s.offsetHeight - window.innerHeight
      progressRef.current = total > 0 ? clamp01(-s.getBoundingClientRect().top / total) : 0
      if (hintRef.current) hintRef.current.style.opacity = String(1 - clamp01(progressRef.current / 0.05))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  return (
    <section ref={stageRef} id="intro" style={{ height: reduced ? '100svh' : '170vh', backgroundColor: '#F3EDE1' }}>
      <h1 className="sr-only">CakeUWish — Custom Celebration Cakes in Chantilly, VA</h1>
      <div className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden">
        <HoverBloom />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <div ref={hintRef} className="pointer-events-none absolute bottom-10 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'rgba(28,25,23,0.68)' }}>
          Scroll to enter ↓
        </div>
      </div>
    </section>
  )
}
