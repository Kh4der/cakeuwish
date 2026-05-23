import { useEffect, useRef } from 'react'

/**
 * Hover Bloom — a frosty watercolor-flower canvas for the start screen. As the
 * pointer moves (or taps), soft icy-white blooms (with a faint touch of blush /
 * rose) grow from short stems and slowly fade, leaving a gentle trail. Flowers
 * are pre-rendered to sprites once, so each frame is just drawImage — cheap. A
 * slight CSS blur gives the frosted-glass softness. Reduced-motion → disabled.
 */

// Soft watercolor "Mixed" palette (r,g,b) — original-style colourful blooms
const MIXED = [
  '236,148,178', // rose pink
  '244,176,168', // coral / peach
  '245,202,150', // warm apricot
  '202,170,224', // lavender
  '162,196,226', // powder blue
  '174,208,188', // soft sage
  '240,158,192', // pink
  '249,214,160', // soft gold
]

function makeFlowerSprite(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')!
  const cx = size / 2, cy = size / 2
  const petals = 5 + Math.floor(Math.random() * 3) // 5–7
  const base = MIXED[Math.floor(Math.random() * MIXED.length)]
  const accent = MIXED[Math.floor(Math.random() * MIXED.length)] // 2nd tone for watercolor variation
  const pr = size * 0.30  // petal radius
  const off = size * 0.16 // petal centre offset from middle
  const rot0 = Math.random() * Math.PI * 2
  for (let i = 0; i < petals; i++) {
    const a = rot0 + (i / petals) * Math.PI * 2
    const ex = cx + Math.cos(a) * off
    const ey = cy + Math.sin(a) * off
    const col = i % 2 === 0 ? base : accent
    const g = x.createRadialGradient(ex, ey, 0, ex, ey, pr)
    g.addColorStop(0, `rgba(${col},0.46)`)
    g.addColorStop(0.55, `rgba(${col},0.22)`)
    g.addColorStop(1, `rgba(${col},0)`)
    x.fillStyle = g
    x.beginPath()
    x.ellipse(ex, ey, pr, pr * 0.78, a, 0, Math.PI * 2)
    x.fill()
  }
  // soft watercolor centre
  const cg = x.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14)
  cg.addColorStop(0, `rgba(${accent},0.55)`)
  cg.addColorStop(1, `rgba(${accent},0)`)
  x.fillStyle = cg
  x.beginPath()
  x.arc(cx, cy, size * 0.14, 0, Math.PI * 2)
  x.fill()
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
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width || window.innerWidth
      h = r.height || window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.25 : 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      garden.width = canvas.width
      garden.height = canvas.height // (resizing clears the garden)
    }
    resize()

    // a small reusable pool of flower sprites (a big garden stays cheap)
    const POOL = Array.from({ length: 12 }, () => makeFlowerSprite(300)) // smaller sprites → much less canvas memory on mobile
    const active: Bloom[] = []   // blooms still growing; once grown they're stamped into the garden
    const SPAWN_DIST = 86
    let lastX = -999, lastY = -999
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
    }

    const local = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect()
      const inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
      return { x: clientX - r.left, y: clientY - r.top, inside }
    }
    const handle = (clientX: number, clientY: number, big: boolean) => {
      if (scrollFade < 0.15) return // stop growing flowers once scrolled away from the start screen
      const p = local(clientX, clientY)
      if (!p.inside) return
      if (!big && Math.hypot(p.x - lastX, p.y - lastY) < SPAWN_DIST) return
      lastX = p.x; lastY = p.y
      spawn(p.x, p.y, big)
      if (big) spawn(p.x + 20, p.y - 12, false)
    }
    const onMouseMove = (e: MouseEvent) => handle(e.clientX, e.clientY, false)
    const onMouseDown = (e: MouseEvent) => handle(e.clientX, e.clientY, true)
    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; if (t) handle(t.clientX, t.clientY, true) }
    const onScroll = () => {
      // fade the whole garden out as the start screen scrolls toward the hero
      scrollFade = Math.max(0, Math.min(1, 1 - window.scrollY / (window.innerHeight * 0.85)))
      canvas.style.opacity = String(0.9 * scrollFade)
    }
    onScroll()
    window.addEventListener('mousemove', onMouseMove, { passive: true })
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
      g.globalAlpha = 0.15
      g.strokeStyle = 'rgb(156,182,148)'
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
      g.globalAlpha = 0.45 + 0.5 * grow
      g.drawImage(b.sprite, b.x - sz / 2, b.y - sz / 2, sz, sz)
      g.globalAlpha = 1
    }

    let raf = 0
    const draw = () => {
      if (scrollFade <= 0.001) { raf = requestAnimationFrame(draw); return } // skip drawing once scrolled away from the start screen
      const now = performance.now()
      // stamp finished blooms permanently into the garden, then drop them from the active list
      for (let i = active.length - 1; i >= 0; i--) {
        if (now - active[i].born >= GROW_MS) {
          gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          paintBloom(gctx, active[i], 1, 1)
          active.splice(i, 1)
        }
      }
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
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
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
      style={{ filter: 'blur(1.4px)', opacity: 0.9, zIndex: 0 }}
    />
  )
}
