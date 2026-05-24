import { useEffect, useRef, useState } from 'react'

const WORD = 'CakeUWish'.split('')
const sizeFor = (ch: string) => (ch === 'U' ? 30 : ch === 'W' ? 26 : 21)

/**
 * Cursor follower: the letters of "CakeUWish" trail BEHIND the pointer in a
 * living DNA double-helix — laid along the direction of travel and spiralling
 * around that axis (sin = sideways, cos = depth → scale + opacity). They follow
 * the pointer as it moves instead of colliding on it. Click anywhere → every
 * letter falls to the floor (gravity + bounce), then SLOWLY rises back up and
 * resumes the helix. Native pointer is kept; magnetic pull on [data-magnetic].
 */
export default function CustomCursor() {
  const elsRef = useRef<(HTMLSpanElement | null)[]>([])
  const magRef = useRef<HTMLElement | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    setOn(true)

    const n = WORD.length
    const SPACING = 25    // gap between letters along the trail
    const AMP = 26        // helix radius
    const SPEED = 0.0042  // phase advance per ms
    const PHASE = 0.85    // phase offset between adjacent letters (helix tightness)

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const prev = { x: mouse.x, y: mouse.y }
    const head = { x: 1, y: 0 } // smoothed heading (unit vector of travel)
    const L = WORD.map(() => ({ x: mouse.x, y: mouse.y, vx: 0, vy: 0, sc: 1, op: 1, rot: 0, rotTarget: 0 }))
    let mode: 'follow' | 'fall' | 'rise' = 'follow'
    const t0 = performance.now()
    let fallTO = 0, riseTO = 0
    let dir = 1            // horizontal travel sign; reversing it re-orders the letters
    let lastMX = mouse.x

    // Keep the brand readable left→right whichever way you move: when moving RIGHT
    // the trail extends to the left, so the letter nearest the cursor must be the
    // LAST letter ("h"); moving LEFT it must be the first ("C"). On a reversal each
    // letter swaps content behind a 360° flip so the word re-arranges, never mirrors.
    const applyLetters = (d: number) => {
      for (let i = 0; i < n; i++) {
        const ch = WORD[d > 0 ? n - 1 - i : i]
        const el = elsRef.current[i]
        if (el && el.textContent !== ch) { el.textContent = ch; el.style.fontSize = sizeFor(ch) + 'px' }
      }
    }
    applyLetters(dir)

    const onMove = (e: MouseEvent) => {
      const ddx = e.clientX - lastMX; lastMX = e.clientX
      if (Math.abs(ddx) > 3) {
        const nd = ddx > 0 ? 1 : -1
        if (nd !== dir) { dir = nd; applyLetters(dir); for (const l of L) l.rotTarget += 360 }
      }
      mouse.x = e.clientX; mouse.y = e.clientY
      const tgt = e.target as Element | null
      const m = tgt && typeof tgt.closest === 'function' ? (tgt.closest('[data-magnetic]') as HTMLElement | null) : null
      if (magRef.current && magRef.current !== m) { magRef.current.style.transform = ''; magRef.current = null }
      if (m) {
        const r = m.getBoundingClientRect()
        m.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * 0.25}px, ${(e.clientY - (r.top + r.height / 2)) * 0.25}px)`
        magRef.current = m
      }
    }
    const onDown = () => {
      mode = 'fall'
      for (const l of L) { l.vx = (Math.random() - 0.5) * 11; l.vy = -Math.random() * 6 - 2 }
      window.clearTimeout(fallTO); window.clearTimeout(riseTO)
      fallTO = window.setTimeout(() => { mode = 'rise' }, 3000)  // rest on the floor ~3s, then
      riseTO = window.setTimeout(() => { mode = 'follow' }, 6500) // VERY slow rise back to the helix
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('pointerdown', onDown)

    let raf = 0
    const tick = (now: number) => {
      const t = now - t0
      const floor = window.innerHeight - 30
      const W = window.innerWidth

      // smoothed heading from pointer motion (frozen when still)
      const dx = mouse.x - prev.x, dy = mouse.y - prev.y
      const sp = Math.hypot(dx, dy)
      if (sp > 0.6) {
        head.x += (dx / sp - head.x) * 0.18
        head.y += (dy / sp - head.y) * 0.18
        const hl = Math.hypot(head.x, head.y) || 1; head.x /= hl; head.y /= hl
      }
      prev.x += dx * 0.5; prev.y += dy * 0.5
      const perpX = -head.y, perpY = head.x

      for (let i = 0; i < n; i++) {
        const l = L[i]
        if (mode === 'fall') {
          l.vy += 0.8; l.vx *= 0.99
          l.x += l.vx; l.y += l.vy
          if (l.y > floor) { l.y = floor; l.vy *= -0.5; l.vx *= 0.7; if (Math.abs(l.vy) < 1.4) l.vy = 0 }
          if (l.x < 12) { l.x = 12; l.vx *= -0.5 }
          if (l.x > W - 12) { l.x = W - 12; l.vx *= -0.5 }
          l.sc += (1 - l.sc) * 0.1; l.op += (1 - l.op) * 0.1
        } else {
          const dist = (i + 1) * SPACING
          const baseX = mouse.x - head.x * dist
          const baseY = mouse.y - head.y * dist
          const phase = t * SPEED + i * PHASE
          const s = Math.sin(phase), c = Math.cos(phase)
          const tx = baseX + perpX * s * AMP
          const ty = baseY + perpY * s * AMP
          const lerp = mode === 'rise' ? 0.028 : 0.2 // very slow rise vs responsive follow
          l.x += (tx - l.x) * lerp
          l.y += (ty - l.y) * lerp
          const tsc = 1 + c * 0.28              // front of helix larger
          const top = 0.55 + (c * 0.5 + 0.5) * 0.45 // front of helix brighter
          l.sc += (tsc - l.sc) * 0.2
          l.op += (top - l.op) * 0.2
        }
        l.rot += (l.rotTarget - l.rot) * 0.18 // ease the 360° flip on direction change
        const el = elsRef.current[i]
        if (el) {
          el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, -50%) rotateY(${l.rot}deg) scale(${l.sc})`
          el.style.opacity = String(l.op)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.clearTimeout(fallTO); window.clearTimeout(riseTO)
      if (magRef.current) magRef.current.style.transform = ''
    }
  }, [])

  // The pointer letters only appear AFTER the hero section — the intro + hero
  // stay clean (just the particle wordmark + watercolor blooms).
  useEffect(() => {
    if (!on) return
    const update = () => {
      const hero = document.getElementById('top')
      const past = hero
        ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.5
        : window.scrollY > window.innerHeight * 3
      if (wrapRef.current) wrapRef.current.style.opacity = past ? '1' : '0'
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [on])

  if (!on) return null
  return (
    <div ref={wrapRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, mixBlendMode: 'difference', perspective: '600px', opacity: 0, transition: 'opacity 0.45s ease' }}>
      {WORD.map((ch, i) => (
        <span
          key={i}
          ref={(el) => { elsRef.current[i] = el }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            willChange: 'transform, opacity',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: sizeFor(ch) + 'px',
            color: '#fff',
            lineHeight: 1,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}
