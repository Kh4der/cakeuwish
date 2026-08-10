import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { autoRig, type BeeRig } from './beeRig'

// The CakeUWish baker bee: the supplied GLB, auto-rigged at load (see beeRig.ts)
// so a fused, boneless model can still act. It chases the pointer with spring
// physics, drifts to the cake on stage when you rest, follows you with its eyes,
// flaps, chews in bursts, waves, and carries an "Ask me!" bubble at its mouth
// that opens the site's chat.
//
// Import ONLY via React.lazy: three.js must stay out of every other chunk.

const MODEL = '/models/bee.glb'

// Decided once, at module load. This drives everything that has to differ on a
// phone: the render budget, the size of the tap target, whether the speech
// cloud is always visible, and — most importantly — whether the bee chases a
// finger at all. On a touchscreen a scroll IS a stream of move events, so a
// pointer-chasing character would spend the whole gesture glued to your thumb.
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

interface Target {
  x: number
  y: number
  chasing: boolean
}

function BeeModel({
  target,
  hitRef,
  probeRef,
}: {
  target: React.MutableRefObject<Target>
  /** DOM hit-area + speech cloud, moved to the bee's screen position each frame */
  hitRef: React.RefObject<HTMLDivElement | null>
  /** the bee's only DOM reads, called a few times a second from inside the loop */
  probeRef: React.MutableRefObject<() => void>
}) {
  const group = useRef<THREE.Group>(null)
  const { viewport, pointer, camera, size, invalidate } = useThree()
  const { scene } = useGLTF(MODEL)

  const vel = useRef(new THREE.Vector3())
  const bank = useRef(0)
  const chewAmp = useRef(0)
  const nextChew = useRef(3)
  const chewUntil = useRef(-1)
  const nextWave = useRef(6)
  const waveUntil = useRef(-1)
  const prevVelX = useRef(0)
  const accelSm = useRef(0)
  const worldPos = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  const reseed = useRef(false)
  const nextProbe = useRef(0)
  const armed = useRef(false)

  const rig = useMemo<BeeRig & { scale: number }>(() => {
    const r = autoRig(scene)
    return { ...r, scale: 0.9 / (r.height || 1) }
  }, [scene])

  // On a phone the canvas runs on demand at ~30fps instead of R3F's default
  // uncapped rAF. Halving the draws (on top of dpr 1 and no MSAA) is what keeps
  // a full-screen transparent WebGL layer from stealing the scroll's frame
  // budget and heating the device into thermal throttling. Every behaviour
  // still plays: dt is clamped and all the easings are framerate-independent.
  useEffect(() => {
    if (!COARSE) return
    let raf = 0
    let last = 0
    const pump = (now: number) => {
      raf = requestAnimationFrame(pump)
      if (now - last < 33) return
      last = now
      invalidate()
    }
    raf = requestAnimationFrame(pump)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])

  // Scrolling back up to the intro puts the bee back to a clean slate: no
  // leftover momentum, and its chew/wave schedules start over so you don't
  // arrive mid-munch.
  useEffect(() => {
    const reset = () => {
      vel.current.set(0, 0, 0)
      bank.current = 0
      accelSm.current = 0
      prevVelX.current = 0
      chewAmp.current = 0
      chewUntil.current = -1
      waveUntil.current = -1
      // The chew/wave schedules live on the render clock, not wall time, so the
      // frame loop re-seeds them — seeding here would use the wrong time base.
      reseed.current = true
      const g = group.current
      if (g) {
        g.rotation.set(0, 0, 0)
        g.scale.setScalar(rig.scale)
      }
      const b = rig.bones
      b.head.rotation.set(0, 0, 0)
      b.eyeL.position.copy(rig.rest.eyeL)
      b.eyeR.position.copy(rig.rest.eyeR)
      b.mouth.position.copy(rig.rest.mouth)
      b.mouth.scale.set(1, 1, 1)
      invalidate()
    }
    window.addEventListener('cuw:intro-reset', reset)
    return () => window.removeEventListener('cuw:intro-reset', reset)
  }, [rig, invalidate])

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const b = rig.bones

    // a reset happened (scrolled back to the intro) — restart the schedules
    // against the render clock so the bee doesn't arrive mid-munch
    if (reseed.current) {
      reseed.current = false
      nextChew.current = t + 3
      nextWave.current = t + 6
      nextProbe.current = 0
    }

    // ── the bee's ONLY DOM reads, and they are throttled ────────────────────
    // These used to run inside a scroll listener, on every scroll event, on
    // every page: a document-wide querySelector plus getBoundingClientRect
    // plus innerWidth/innerHeight, landing right after the hero had dirtied
    // the layout — one forced synchronous reflow per scroll event. Here they
    // run ~7 times a second from inside the render loop instead.
    if (t > nextProbe.current) {
      nextProbe.current = t + 0.15
      probeRef.current()
    }

    // ── flight ──────────────────────────────────────────────────────────────
    const tx = (target.current.x / size.width - 0.5) * viewport.width
    const ty = -(target.current.y / size.height - 0.5) * viewport.height
    // Wander is in world units, so on a narrow screen (a small viewport.width)
    // an unscaled amplitude is a far bigger fraction of the screen — it read as
    // 17% of the width on a phone against 6% on desktop, which is what pushed
    // the bee off the edge. Scale it to the viewport.
    const roam = Math.min(1, viewport.width / 8)
    const wanderX = (Math.sin(t * 0.9) * 0.42 + Math.sin(t * 2.3) * 0.12) * roam
    const wanderY = (Math.cos(t * 1.3) * 0.3 + Math.cos(t * 3.1) * 0.08) * roam
    desired.current.set(tx + wanderX, ty + wanderY, 0).sub(g.position)
    const chasing = target.current.chasing
    vel.current.addScaledVector(desired.current, (chasing ? 9 : 3.4) * dt)
    vel.current.multiplyScalar(1 - Math.min(1, (chasing ? 3.4 : 2.6) * dt))
    g.position.addScaledVector(vel.current, dt)
    // never let it wander off-canvas
    const limX = viewport.width * 0.5 - 0.6
    const limY = viewport.height * 0.5 - 0.6
    g.position.x = THREE.MathUtils.clamp(g.position.x, -limX, limX)
    g.position.y = THREE.MathUtils.clamp(g.position.y, -limY, limY)

    const speed = vel.current.length()
    const lean = THREE.MathUtils.clamp(vel.current.x * 0.09, -0.22, 0.22)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, lean, 1 - Math.pow(0.001, dt))
    const targetBank = THREE.MathUtils.clamp(-vel.current.x * 0.14, -0.45, 0.45)
    bank.current = THREE.MathUtils.lerp(bank.current, targetBank, 1 - Math.pow(0.002, dt))
    g.rotation.z = bank.current
    g.rotation.x = THREE.MathUtils.clamp(vel.current.y * 0.08, -0.3, 0.3)
    g.position.z = Math.sin(t * 6) * 0.05
    g.scale.setScalar(rig.scale * (1 + Math.sin(t * 2.4) * 0.01)) // breathing

    const ax = (vel.current.x - prevVelX.current) / Math.max(dt, 1e-4)
    prevVelX.current = vel.current.x
    accelSm.current = THREE.MathUtils.lerp(accelSm.current, ax, 1 - Math.pow(0.001, dt))

    // ── wings flap from their roots ─────────────────────────────────────────
    // Wings sweep between level and RAISED, never below — verified in the
    // snapshot rig that a downstroke folds them behind the belly and they
    // disappear head-on. Sign matters: negative lifts the left wing.
    const beat = 24 + Math.min(12, speed * 4)
    const up = Math.sin(t * beat) * 0.5 + 0.5 // 0 = level, 1 = fully raised
    b.wingL.rotation.z = -up * 0.42
    b.wingR.rotation.z = up * 0.42

    // ── eyes follow the pointer (bones offset from their rest positions) ────
    const gx = THREE.MathUtils.clamp(pointer.x, -1, 1)
    const gy = THREE.MathUtils.clamp(pointer.y, -1, 1)
    // Gaze: a small, SYMMETRIC slide. Both eyes get the identical offset and
    // it is eased properly (the old factor was ~0.999 — a snap, not a lerp),
    // so a flick of the pointer can no longer shove one eye into the face.
    const ex = gx * rig.height * 0.012
    const ey = gy * rig.height * 0.009
    const gazeEase = 1 - Math.pow(0.004, dt)
    b.eyeL.position.x = THREE.MathUtils.lerp(b.eyeL.position.x, rig.rest.eyeL.x + ex, gazeEase)
    b.eyeL.position.y = THREE.MathUtils.lerp(b.eyeL.position.y, rig.rest.eyeL.y + ey, gazeEase)
    b.eyeR.position.x = THREE.MathUtils.lerp(b.eyeR.position.x, rig.rest.eyeR.x + ex, gazeEase)
    b.eyeR.position.y = THREE.MathUtils.lerp(b.eyeR.position.y, rig.rest.eyeR.y + ey, gazeEase)

    // ── chew in bursts while settled ────────────────────────────────────────
    chewAmp.current = THREE.MathUtils.lerp(
      chewAmp.current,
      chasing ? 0 : 1,
      1 - Math.pow(chasing ? 0.005 : 0.05, dt),
    )
    if (!chasing && t > nextChew.current) {
      chewUntil.current = t + 1.6
      nextChew.current = t + 7
    }
    const burst = t < chewUntil.current ? Math.sin((1 - (chewUntil.current - t) / 1.6) * Math.PI) : 0
    const bite = Math.max(0, Math.sin(t * 10)) * burst * chewAmp.current
    b.mouth.position.y = rig.rest.mouth.y - bite * rig.height * 0.02
    b.mouth.scale.set(1 + bite * 0.18, 1 - bite * 0.3, 1)

    // ── wave: the whole body tips and bobs a hello ──────────────────────────
    if (!chasing && t > nextWave.current) {
      waveUntil.current = t + 1.3
      nextWave.current = t + 9
    }
    const waving = t < waveUntil.current
    const waveEnv = waving ? Math.sin(((waveUntil.current - t) / 1.3) * Math.PI) : 0
    if (waving) g.rotation.z += Math.sin(t * 9) * 0.16 * waveEnv

    // ── head: ONE place, computed from scratch, then eased and clamped ──────
    // Everything that wants to move the head contributes to a target here.
    // The previous version mixed an assignment, a lerp and a `-=` across three
    // blocks, so the wobble compounded frame over frame and could crank the
    // head ~50° on a fast flick. Nothing accumulates now.
    //
    // Antennae and hat are NOT separately boned — they ride the head rigidly
    // (their own bones tore 1,445 hat vertices apart), so the head's tilt is
    // what gives them life. That also means the head must stay gentle.
    const HEAD_YAW = 0.1 // was 0.16
    const HEAD_PITCH = 0.07 // was 0.1
    const HEAD_ROLL = 0.09
    const targetYaw = THREE.MathUtils.clamp(gx * HEAD_YAW, -HEAD_YAW, HEAD_YAW)
    const targetPitch = THREE.MathUtils.clamp(-gy * HEAD_PITCH, -HEAD_PITCH, HEAD_PITCH)
    const targetRoll = THREE.MathUtils.clamp(
      Math.sin(t * 9) * 0.12 * waveEnv - accelSm.current * 0.004,
      -HEAD_ROLL,
      HEAD_ROLL,
    )
    const headEase = 1 - Math.pow(0.004, dt)
    b.head.rotation.y = THREE.MathUtils.lerp(b.head.rotation.y, targetYaw, headEase)
    b.head.rotation.x = THREE.MathUtils.lerp(b.head.rotation.x, targetPitch, headEase)
    b.head.rotation.z = THREE.MathUtils.lerp(b.head.rotation.z, targetRoll, headEase)

    // ── keep the hover target sitting exactly on the bee ────────────────────
    const hit = hitRef.current
    if (hit) {
      g.getWorldPosition(worldPos.current)
      const p = worldPos.current.project(camera)
      hit.style.transform = `translate(${Math.round((p.x * 0.5 + 0.5) * size.width)}px, ${Math.round(
        (-p.y * 0.5 + 0.5) * size.height,
      )}px)`
      // The tap target is LIVE ONLY WHEN THE BEE HAS SETTLED. In flight it is
      // an invisible 44px circle sweeping across the page, and on a phone it
      // used to be steered onto the exact spot your finger just left — so the
      // next tap opened the chat instead of hitting the link underneath.
      const settle = !chasing && vel.current.lengthSq() < 0.02
      if (settle !== armed.current) {
        armed.current = settle
        hit.style.pointerEvents = settle ? 'auto' : 'none'
      }
    }
  })

  return (
    <group ref={group}>
      <primitive object={rig.skinned} position={rig.centre.clone().multiplyScalar(-1).toArray()} />
    </group>
  )
}

useGLTF.preload(MODEL)

/** Open whichever chat this deployment runs: Chatwoot bubble or built-in widget. */
function openChat() {
  const cw = (window as unknown as { $chatwoot?: { toggle: (s?: string) => void } }).$chatwoot
  if (cw) {
    cw.toggle('open')
    return
  }
  window.dispatchEvent(new CustomEvent('cuw:open-chat'))
}

export default function BeeCompanion() {
  const target = useRef<Target>({
    x: typeof window === 'undefined' ? 0 : window.innerWidth * 0.5,
    y: typeof window === 'undefined' ? 0 : window.innerHeight * 0.42,
    chasing: false,
  })
  const hitRef = useRef<HTMLDivElement | null>(null)
  const probeRef = useRef<() => void>(() => {})
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let idleTimer = 0
    // Cached so the render loop never reads layout for them. innerWidth /
    // innerHeight are layout reads, and on Chrome Android they change every
    // time the URL bar slides.
    let vw = window.innerWidth
    let vh = window.innerHeight
    let anchor: HTMLElement | null = null
    let wasPastIntro = window.scrollY > vh * 0.5

    // Where the bee loiters when you leave it alone. On the home hero that's
    // beside whichever cake is on stage; anywhere else (intro, subpages) it
    // just hovers in a pleasant upper-right spot out of the reading column.
    const restPoint = () => {
      if (!anchor || !anchor.isConnected) {
        anchor = document.querySelector('[data-bee-anchor]')
      }
      const r = anchor?.getBoundingClientRect()
      const onStage = r && r.top < vh * 0.8 && r.bottom > vh * 0.2
      // A phone has no room for the desktop's +90px shoulder beside the cake,
      // and the upper-right corner is where the ghost wordmark lives — so the
      // bee tucks in closer and lower.
      const narrow = vw < 640
      if (onStage) {
        return {
          x: r.left + r.width * (narrow ? 0.76 : 0.5) + (narrow ? 0 : 90),
          y: r.top + r.height * (narrow ? 0.34 : 0.22),
        }
      }
      return { x: vw * (narrow ? 0.84 : 0.82), y: vh * (narrow ? 0.24 : 0.3) }
    }

    // Called from inside the render loop, throttled — see BeeModel. Re-homes
    // the idle bee (so it follows the cake on stage as you scroll) and watches
    // for the upward crossing back into the intro.
    probeRef.current = () => {
      if (!target.current.chasing) {
        const p = restPoint()
        target.current.x = p.x
        target.current.y = p.y
      }
      const pastIntro = window.scrollY > vh * 0.5
      if (wasPastIntro && !pastIntro) {
        window.dispatchEvent(new CustomEvent('cuw:intro-reset'))
      }
      wasPastIntro = pastIntro
    }

    // Releasing just clears the chase flag; the probe re-homes the bee on its
    // next tick. Nothing here reads layout.
    const release = () => {
      target.current.chasing = false
    }
    const chase = (x: number, y: number, holdMs: number) => {
      target.current = { x, y, chasing: true }
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(release, holdMs)
    }

    // On a touchscreen, pointermove fires for the finger too — and a scroll is
    // one long stream of them. Mouse only.
    const onMove = (e: PointerEvent) => {
      if (COARSE && e.pointerType !== 'mouse') return
      chase(e.clientX, e.clientY, 1600)
    }

    // Touch: a deliberate TAP calls the bee over, a swipe does not. The old
    // code chased every touchmove, so the bee spent every scroll pinned under
    // the thumb. The bee is aimed above the tap so it never lands on the thing
    // you were reaching for.
    let sx = 0
    let sy = 0
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) {
        sx = t.clientX
        sy = t.clientY
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) return // that was a scroll
      chase(t.clientX, Math.max(vh * 0.12, t.clientY - 120), 1800)
    }

    const onResize = () => {
      vw = window.innerWidth
      vh = window.innerHeight
    }

    probeRef.current()
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointercancel', release, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
    return () => {
      window.clearTimeout(idleTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{ zIndex: 45 }}
      >
        <Canvas
          frameloop={COARSE ? 'demand' : 'always'}
          dpr={COARSE ? 1 : [1, 1.25]}
          camera={{ position: [0, 0, 6], fov: 50 }}
          // MSAA buys nothing on a bee this small and costs a full-screen
          // resolve every frame; the debounce stops Chrome Android from
          // reallocating the drawing buffer while the URL bar slides.
          gl={{ antialias: !COARSE, alpha: true, powerPreference: 'low-power', stencil: false }}
          resize={{ scroll: false, debounce: { scroll: 200, resize: 200 } }}
          // pointerEvents MUST be set here, not just on the holder: R3F puts
          // `pointer-events: auto` on its own container div, which overrides the
          // holder's `none` — so this full-screen canvas was quietly eating
          // every click on the page underneath it.
          style={{ background: 'transparent', pointerEvents: 'none' }}
        >
          <ambientLight intensity={1.25} />
          <directionalLight position={[3, 5, 6]} intensity={1.25} />
          <Suspense fallback={null}>
            <BeeModel target={target} hitRef={hitRef} probeRef={probeRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Hover target that rides along with the bee. The canvas itself never
          takes clicks; this small circle does. Hovering it puffs out the
          speech cloud, clicking opens the chat. It starts parked off-screen
          and inert — the render loop arms it once the bee settles. */}
      <div
        ref={hitRef}
        className="fixed left-0 top-0"
        style={{
          zIndex: 46,
          willChange: 'transform',
          pointerEvents: 'none',
          transform: 'translate(-300px, -300px)',
        }}
      >
        <button
          type="button"
          onClick={openChat}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          aria-label="Ask the CakeUWish assistant a question"
          className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full sm:h-24 sm:w-24"
        >
          <span className="sr-only">Ask me a question</span>
        </button>

        {/* The cloud. On a phone there is no hover to reveal it, so it stays
            up permanently — otherwise the bee carries an invisible tap target
            and no way to know it is tappable. */}
        <div
          aria-hidden={!hovered && !COARSE}
          className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap transition-all duration-200 ${
            hovered || COARSE ? 'opacity-100' : 'translate-y-1 opacity-0'
          }`}
          style={{ bottom: 'calc(50% + 46px)' }}
        >
          <span className="relative inline-block rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-soft">
            Ask me! 🍰
            {/* two little puffs make the tag read as a speech cloud */}
            <span
              aria-hidden="true"
              className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-4 rounded-full border border-border bg-card"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-3.5 left-1/2 h-1.5 w-1.5 -translate-x-1 rounded-full border border-border bg-card"
            />
          </span>
        </div>
      </div>
    </>
  )
}
