import { useEffect, useRef } from 'react'

/**
 * Hover Bloom — a frosty watercolor-flower canvas for the start screen. As the
 * pointer moves (or taps), soft icy-white blooms (with a faint touch of blush /
 * rose) grow from short stems and slowly fade, leaving a gentle trail. Flowers
 * are pre-rendered to sprites once, so each frame is just drawImage — cheap. A
 * slight CSS blur gives the frosted-glass softness. Reduced-motion → disabled.
 */

// Straight off the logo and the bee cake: rose pink, gold, peach, sage, cream.
const PETALS = [
  '232,123,160', // logo rose pink
  '239,169,188', // blush
  '242,201,174', // peach
  '199,154,62',  // soft gold
  '245,183,45',  // bee yellow (the daisies on the cake)
  '190,58,102',  // deep pink
]
const CENTRES = ['58,42,30', '150,96,26', '190,58,102'] // cocoa, gold, deep pink
const STEM = '143,168,118' // sage

type Kind = 'daisy' | 'rose' | 'blossom'

/** One flower head, drawn with real petals rather than a watercolor smudge. */
function makeFlowerSprite(size: number, kind: Kind): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const base = PETALS[(Math.random() * PETALS.length) | 0]
  const centre = CENTRES[(Math.random() * CENTRES.length) | 0]
  const rot0 = Math.random() * Math.PI * 2

  if (kind === 'daisy') {
    // Many narrow petals around a dark eye — the sunflower-ish daisies piped
    // around the bee cake.
    const n = 11 + ((Math.random() * 4) | 0)
    for (let i = 0; i < n; i++) {
      const a = rot0 + (i / n) * Math.PI * 2
      const len = size * (0.30 + Math.random() * 0.05)
      x.save()
      x.translate(cx, cy)
      x.rotate(a)
      const g = x.createLinearGradient(0, 0, 0, -len)
      g.addColorStop(0, `rgba(${base},0.95)`)
      g.addColorStop(1, `rgba(${base},0.55)`)
      x.fillStyle = g
      x.beginPath()
      x.ellipse(0, -len * 0.58, size * 0.045, len * 0.5, 0, 0, Math.PI * 2)
      x.fill()
      x.restore()
    }
    x.fillStyle = `rgba(${centre},0.92)`
    x.beginPath()
    x.arc(cx, cy, size * 0.10, 0, Math.PI * 2)
    x.fill()
  } else if (kind === 'rose') {
    // Concentric spiralling arcs read as a rose from a distance.
    for (let r = size * 0.30; r > size * 0.03; r -= size * 0.035) {
      const t = r / (size * 0.30)
      x.strokeStyle = `rgba(${base},${0.30 + (1 - t) * 0.55})`
      x.lineWidth = size * 0.045
      x.lineCap = 'round'
      x.beginPath()
      x.arc(cx, cy, r, rot0 + t * 5.2, rot0 + t * 5.2 + Math.PI * 1.45)
      x.stroke()
    }
  } else {
    // Five rounded petals — a simple cherry-blossom shape.
    const n = 5
    for (let i = 0; i < n; i++) {
      const a = rot0 + (i / n) * Math.PI * 2
      const off = size * 0.17
      const ex = cx + Math.cos(a) * off
      const ey = cy + Math.sin(a) * off
      const g = x.createRadialGradient(ex, ey, 0, ex, ey, size * 0.22)
      g.addColorStop(0, `rgba(${base},0.95)`)
      g.addColorStop(1, `rgba(${base},0.42)`)
      x.fillStyle = g
      x.beginPath()
      x.ellipse(ex, ey, size * 0.20, size * 0.15, a, 0, Math.PI * 2)
      x.fill()
    }
    x.fillStyle = `rgba(${centre},0.85)`
    x.beginPath()
    x.arc(cx, cy, size * 0.075, 0, Math.PI * 2)
    x.fill()
  }
  return c
}

interface Bloom {
  x: number; y: number; size: number; born: number; lean: number
  sprite: HTMLCanvasElement
}

export default function HoverBloom() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, dpr = 1
    // persistent "garden" buffer — grown flowers are stamped here and never cleared
    const garden = document.createElement('canvas')
    const gctx = garden.getContext('2d')!
    // Tracked here rather than read back off the canvas: `garden` is a fresh
    // element per effect run, so comparing against canvas.width would skip
    // sizing the garden whenever the visible canvas already happened to be the
    // right size (StrictMode's double-mount does exactly that) and every
    // stamped flower would land in an unsized 300x150 buffer.
    let lastW = -1
    let lastH = -1
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width || window.innerWidth
      h = r.height || window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1 : 1.5)
      const cw = Math.round(w * dpr)
      const ch = Math.round(h * dpr)
      // Bail BEFORE touching the bitmaps: assigning canvas.width clears it even
      // when the value is unchanged. On a phone every URL-bar slide fires
      // `resize`, so without this the garden was wiped constantly and the
      // flowers you had just grown vanished mid-scroll.
      if (cw === lastW && ch === lastH) return
      lastW = cw
      lastH = ch
      canvas.width = cw
      canvas.height = ch
      garden.width = cw
      garden.height = ch // (a real resize clears the garden)
    }
    resize()

    // A reusable pool covering all three flower types, so repeated taps scatter
    // a mixed bed rather than one repeated shape. Building all 15 up front was
    // ~140 gradient-filled paths in one synchronous task at mount — on a phone
    // that landed in the same frame as the intro's particle build. Seed two,
    // then grow the pool one sprite per idle callback.
    const KINDS: Kind[] = ['daisy', 'daisy', 'rose', 'blossom', 'blossom']
    const SPRITE = w < 768 ? 200 : 300
    const POOL: HTMLCanvasElement[] = [makeFlowerSprite(SPRITE, 'daisy'), makeFlowerSprite(SPRITE, 'blossom')]
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => window.setTimeout(cb, 120))
    const grow = () => {
      if (POOL.length >= 15) return
      POOL.push(makeFlowerSprite(SPRITE, KINDS[POOL.length % KINDS.length]))
      idle(grow)
    }
    idle(grow)
    const active: Bloom[] = []   // blooms still growing; once grown they're stamped into the garden
    let needsRedraw = false      // when false + no active blooms, the canvas is static → skip the per-frame redraw
    let scrollFade = 1 // 1 on the start screen, fades to 0 as you scroll down to the hero

    const spawn = (cx: number, cy: number, big: boolean) => {
      const size = (big ? 430 : 270) + Math.random() * 150 // very big flowers
      const sign = Math.random() < 0.5 ? -1 : 1
      active.push({
        x: cx, y: cy, size,
        born: performance.now(),
        lean: sign * (0.14 + Math.random() * 0.13), // guaranteed bend -> curved stem (never a straight line)
        sprite: POOL[(Math.random() * POOL.length) | 0],
      })
      needsRedraw = true
    }

    const local = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      const inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
      return { x: clientX - r.left, y: clientY - r.top, inside }
    }
    // Flowers grow ONLY where you click or tap. Spawning on hover carpeted the
    // start screen and buried the logo within seconds.
    const handle = (clientX: number, clientY: number) => {
      if (scrollFade < 0.15) return // stop growing flowers once scrolled away from the start screen
      const p = local(clientX, clientY)
      if (!p.inside) return
      spawn(p.x, p.y, true)
      // one small companion bloom so a click reads as a little cluster
      spawn(p.x + 26, p.y - 14, false)
    }
    const onMouseDown = (e: MouseEvent) => handle(e.clientX, e.clientY)
    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t) handle(t.clientX, t.clientY) }
    const onScroll = () => {
      // fade the whole garden out as the start screen scrolls toward the hero
      scrollFade = Math.max(0, Math.min(1, 1 - window.scrollY / (window.innerHeight * 0.85)))
      canvas.style.opacity = String(0.62 * scrollFade)
    }
    // Scrolling back up to the intro wipes the flower bed, so the start screen
    // is as clean as it was on arrival rather than showing an old session's
    // garden. Fired by the scroll watcher in BeeCompanion.
    const onReset = () => {
      gctx.setTransform(1, 0, 0, 1, 0, 0)
      gctx.clearRect(0, 0, garden.width, garden.height)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      active.length = 0
      needsRedraw = true
    }
    window.addEventListener('cuw:intro-reset', onReset)
    onScroll()
    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', onScroll, { passive: true })

    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const GROW_MS = 1320 // once fully grown a flower is stamped into the garden for good

    // draw a stem (organic S-curve) + flower head into any context
    const paintBloom = (g: CanvasRenderingContext2D, b: Bloom, stemGrow: number, grow: number) => {
      const sz = b.size * (0.5 + 0.5 * grow)
      const stemLen = b.size * 1.5 * stemGrow
      g.globalAlpha = 0.18
      g.strokeStyle = `rgb(${STEM})`
      g.lineWidth = Math.max(2, b.size * 0.011)
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(b.x, b.y)
      g.bezierCurveTo(
        b.x + b.lean * stemLen * 0.9, b.y + stemLen * 0.30,
        b.x - b.lean * stemLen * 0.5, b.y + stemLen * 0.72,
        b.x + b.lean * stemLen * 0.15, b.y + stemLen,
      )
      g.stroke()
      // Kept well under 1: these sit BEHIND the wordmark and must never
      // compete with it for attention.
      g.globalAlpha = (0.2 + 0.28 * grow) * 0.9
      g.drawImage(b.sprite, b.x - sz / 2, b.y - sz / 2, sz, sz)
      g.globalAlpha = 1
    }

    let raf = 0
    const draw = () => {
      if (scrollFade <= 0.001) { raf = requestAnimationFrame(draw); return } // skip drawing once scrolled away from the start screen
      const now = performance.now()
      // stamp finished blooms permanently into the garden, then drop them from the active list
      let stamped = false
      for (let i = active.length - 1; i >= 0; i--) {
        if (now - active[i].born >= GROW_MS) {
          gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          paintBloom(gctx, active[i], 1, 1)
          active.splice(i, 1)
          stamped = true
        }
      }
      // idle (no flowers growing, nothing pending): the canvas already shows the
      // garden — skip the full-screen redraw so the start page costs ~nothing at rest
      if (active.length === 0 && !needsRedraw && !stamped) { raf = requestAnimationFrame(draw); return }
      // render: the persistent garden, then the actively growing blooms on top
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
      ctx.drawImage(garden, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (let i = 0; i < active.length; i++) {
        const b = active[i]
        const el = now - b.born
        const stemGrow = ease(Math.min(1, el / 700))                    // stem grows first (~0.7s)
        const grow = ease(Math.min(1, Math.max(0, (el - 320) / 900)))   // then the flower blooms
        paintBloom(ctx, b, stemGrow, grow)
      }
      if (active.length === 0) needsRedraw = false // drew the final state → go idle until the next bloom
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('cuw:intro-reset', onReset)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ filter: 'blur(0.6px)', opacity: 0.62, zIndex: 0 }}
    />
  )
}
