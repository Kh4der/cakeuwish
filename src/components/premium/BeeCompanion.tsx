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

interface Target {
  x: number
  y: number
  chasing: boolean
}

function BeeModel({
  target,
  hitRef,
}: {
  target: React.MutableRefObject<Target>
  /** DOM hit-area + speech cloud, moved to the bee's screen position each frame */
  hitRef: React.RefObject<HTMLDivElement | null>
}) {
  const group = useRef<THREE.Group>(null)
  const { viewport, pointer, camera, size } = useThree()
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
  const reseed = useRef(false)

  const rig = useMemo<BeeRig & { scale: number }>(() => {
    const r = autoRig(scene)
    return { ...r, scale: 0.9 / (r.height || 1) }
  }, [scene])

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
    }
    window.addEventListener('cuw:intro-reset', reset)
    return () => window.removeEventListener('cuw:intro-reset', reset)
  }, [rig])

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
    }

    // ── flight ──────────────────────────────────────────────────────────────
    const tx = (target.current.x / window.innerWidth - 0.5) * viewport.width
    const ty = -(target.current.y / window.innerHeight - 0.5) * viewport.height
    const wanderX = Math.sin(t * 0.9) * 0.42 + Math.sin(t * 2.3) * 0.12
    const wanderY = Math.cos(t * 1.3) * 0.3 + Math.cos(t * 3.1) * 0.08
    const desired = new THREE.Vector3(tx + wanderX, ty + wanderY, 0)
    const toTarget = desired.clone().sub(g.position)
    const chasing = target.current.chasing
    vel.current.addScaledVector(toTarget, (chasing ? 9 : 3.4) * dt)
    vel.current.multiplyScalar(1 - Math.min(1, (chasing ? 3.4 : 2.6) * dt))
    g.position.addScaledVector(vel.current, dt)

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
  const holderRef = useRef<HTMLDivElement | null>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let idleTimer = 0

    // Where the bee loiters when you leave it alone. On the home hero that's
    // beside whichever cake is on stage; anywhere else (intro, subpages) it
    // just hovers in a pleasant upper-right spot out of the reading column.
    const restPoint = () => {
      const stage = document.querySelector('[data-bee-anchor]') as HTMLElement | null
      const r = stage?.getBoundingClientRect()
      const onStage = r && r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.2
      if (onStage) return { x: r.left + r.width * 0.5 + 90, y: r.top + r.height * 0.22 }
      return { x: window.innerWidth * 0.82, y: window.innerHeight * 0.3 }
    }
    const goIdle = () => {
      const p = restPoint()
      target.current = { x: p.x, y: p.y, chasing: false }
    }
    const chase = (x: number, y: number, holdMs: number) => {
      target.current = { x, y, chasing: true }
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(goIdle, holdMs)
    }
    const onMove = (e: PointerEvent) => chase(e.clientX, e.clientY, 1600)
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0]
      if (t) chase(t.clientX, t.clientY, 2600)
    }
    // The bee is always present now — intro, hero and every subpage. Scrolling
    // back up to the intro fires a reset so the start screen feels untouched
    // (see the 'cuw:intro-reset' listener below).
    let wasPastIntro = window.scrollY > window.innerHeight * 0.5
    const onScroll = () => {
      if (!target.current.chasing) goIdle()
      const pastIntro = window.scrollY > window.innerHeight * 0.5
      if (wasPastIntro && !pastIntro) {
        window.dispatchEvent(new CustomEvent('cuw:intro-reset'))
      }
      wasPastIntro = pastIntro
    }

    goIdle()
    onScroll()
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(idleTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <>
      <div
        ref={holderRef}
        className="pointer-events-none fixed inset-0 transition-opacity duration-500"
        aria-hidden="true"
        style={{ zIndex: 45 }}
      >
        <Canvas
          dpr={[1, 1.25]}
          camera={{ position: [0, 0, 6], fov: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={1.25} />
          <directionalLight position={[3, 5, 6]} intensity={1.25} />
          <Suspense fallback={null}>
            <BeeModel target={target} hitRef={hitRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Hover target that rides along with the bee. The canvas itself never
          takes clicks; this small circle does. Hovering it puffs out the
          speech cloud, clicking opens the chat. */}
      <div
        ref={hitRef}
        className="fixed left-0 top-0 transition-opacity duration-500"
        style={{ zIndex: 46, willChange: 'transform' }}
      >
        <button
          type="button"
          onClick={openChat}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          aria-label="Ask the CakeUWish assistant a question"
          className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
        >
          <span className="sr-only">Ask me a question</span>
        </button>

        {/* the cloud — only while hovering */}
        <div
          aria-hidden={!hovered}
          className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap transition-all duration-200 ${
            hovered ? 'opacity-100' : 'translate-y-1 opacity-0'
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
