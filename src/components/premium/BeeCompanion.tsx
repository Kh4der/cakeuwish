import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildBee, type BeeParts } from './beeMesh'

// The CakeUWish baker bee — built procedurally (see beeMesh.ts) to match the
// reference render, with every part animatable. It chases the pointer with
// spring physics, banks into turns, and drifts over to the cake on stage when
// you rest. Its eyes follow the pointer, its wings flap from their roots, it
// munches in bursts beside the cakes, waves hello, and wears an "Ask me"
// speech bubble at its mouth that opens the chat.
//
// Import ONLY via React.lazy: three.js must stay out of every other chunk.

interface Target {
  x: number
  y: number
  chasing: boolean
}

function BeeModel({
  target,
  bubbleRef,
}: {
  target: React.MutableRefObject<Target>
  bubbleRef: React.RefObject<HTMLDivElement | null>
}) {
  const group = useRef<THREE.Group>(null)
  const { viewport, pointer, camera, size } = useThree()

  const vel = useRef(new THREE.Vector3())
  const bank = useRef(0)
  const chewAmp = useRef(0)
  const nextChew = useRef(3)
  const chewUntil = useRef(-1)
  const nextWave = useRef(6)
  const waveUntil = useRef(-1)
  const prevVelX = useRef(0)
  const accelSm = useRef(0)
  const mouthWorld = useRef(new THREE.Vector3())

  const rig = useMemo(() => {
    const parts: BeeParts = buildBee()
    const box = new THREE.Box3().setFromObject(parts.root)
    const sizeV = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    return {
      ...parts,
      scale: 0.85 / (sizeV.y || 1),
      centre,
      wingBase: parts.wings.map((w) => w.pivot.rotation.z),
      antBase: parts.antennae.map((a) => a.rotation.z),
    }
  }, [])

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime

    // ── flight: spring toward the target with a wandering figure-eight ──────
    const tx = (target.current.x / window.innerWidth - 0.5) * viewport.width
    const ty = -(target.current.y / window.innerHeight - 0.5) * viewport.height
    const wanderX = Math.sin(t * 0.9) * 0.42 + Math.sin(t * 2.3) * 0.12
    const wanderY = Math.cos(t * 1.3) * 0.3 + Math.cos(t * 3.1) * 0.08
    const desired = new THREE.Vector3(tx + wanderX, ty + wanderY, 0)
    const toTarget = desired.clone().sub(g.position)
    const chasing = target.current.chasing
    const stiffness = chasing ? 9 : 3.4
    const damping = chasing ? 3.4 : 2.6
    vel.current.addScaledVector(toTarget, stiffness * dt)
    vel.current.multiplyScalar(1 - Math.min(1, damping * dt))
    g.position.addScaledVector(vel.current, dt)

    const speed = vel.current.length()
    const lean = THREE.MathUtils.clamp(vel.current.x * 0.09, -0.22, 0.22)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, lean, 1 - Math.pow(0.001, dt))
    const targetBank = THREE.MathUtils.clamp(-vel.current.x * 0.14, -0.45, 0.45)
    bank.current = THREE.MathUtils.lerp(bank.current, targetBank, 1 - Math.pow(0.002, dt))
    g.rotation.z = bank.current
    g.rotation.x = THREE.MathUtils.clamp(vel.current.y * 0.08, -0.3, 0.3)
    g.position.z = Math.sin(t * 6) * 0.05

    // smoothed horizontal acceleration for trailing limbs/antennae
    const ax = (vel.current.x - prevVelX.current) / Math.max(dt, 1e-4)
    prevVelX.current = vel.current.x
    accelSm.current = THREE.MathUtils.lerp(accelSm.current, ax, 1 - Math.pow(0.001, dt))

    // breathing
    g.scale.setScalar(1 + Math.sin(t * 2.4) * 0.01)

    // ── wings: flap around their resting sweep, faster when hurrying ────────
    const beat = 30 + Math.min(16, speed * 4)
    rig.wings.forEach((w, i) => {
      const phase = w.lower ? -0.6 : 0
      w.pivot.rotation.z = rig.wingBase[i] + w.sign * Math.sin(t * beat + phase) * (w.lower ? 0.35 : 0.5)
    })

    // ── eyes follow the pointer ─────────────────────────────────────────────
    const gx = THREE.MathUtils.clamp(pointer.x, -1, 1)
    const gy = THREE.MathUtils.clamp(pointer.y, -1, 1)
    for (const eye of rig.eyes) {
      eye.iris.position.x = THREE.MathUtils.lerp(eye.iris.position.x, gx * eye.rx, 1 - Math.pow(0.0005, dt))
      eye.iris.position.y = THREE.MathUtils.lerp(eye.iris.position.y, gy * eye.ry, 1 - Math.pow(0.0005, dt))
    }

    // ── chew in bursts while settled (rest state is the open smile) ─────────
    chewAmp.current = THREE.MathUtils.lerp(chewAmp.current, chasing ? 0 : 1, 1 - Math.pow(chasing ? 0.005 : 0.05, dt))
    if (!chasing && t > nextChew.current) {
      chewUntil.current = t + 1.6
      nextChew.current = t + 7
    }
    const inBurst = t < chewUntil.current
    const burstEnv = inBurst ? Math.sin((1 - (chewUntil.current - t) / 1.6) * Math.PI) : 0
    const bite = Math.max(0, Math.sin(t * 11)) * burstEnv * chewAmp.current
    rig.mouth.scale.y = 1 - bite * 0.55 // munch = the open mouth closing
    rig.mouth.scale.x = 1 + bite * 0.15

    // ── wave hello while idling (offset from the chew schedule) ─────────────
    if (!chasing && t > nextWave.current) {
      waveUntil.current = t + 1.3
      nextWave.current = t + 9
    }
    const waving = t < waveUntil.current
    const waveEnv = waving ? Math.sin(((waveUntil.current - t) / 1.3) * Math.PI) : 0

    // ── arms: pendulum sway + acceleration trail; right arm waves ───────────
    const armSway = Math.sin(t * 1.6) * 0.05
    const armTrail = THREE.MathUtils.clamp(-accelSm.current * 0.04, -0.3, 0.3)
    rig.armL.rotation.z = armSway + armTrail
    rig.armR.rotation.z = waving ? -0.9 * waveEnv + Math.sin(t * 11) * 0.45 * waveEnv : -armSway + armTrail
    rig.armR.rotation.x = waving ? -0.3 * waveEnv : 0

    // ── feet dangle slowly, antennae spring against acceleration ────────────
    rig.feet.forEach((f, i) => {
      f.rotation.x = Math.sin(t * 1.9 + i * 0.9) * 0.12
    })
    const antWobble = THREE.MathUtils.clamp(accelSm.current * 0.02, -0.25, 0.25)
    rig.antennae.forEach((a, i) => {
      a.rotation.z = rig.antBase[i] + Math.sin(t * 3.1 + i * 1.4) * 0.07 - antWobble
    })
    // the toque gets a tiny lag of its own — pastry physics
    rig.hat.rotation.z = THREE.MathUtils.clamp(-accelSm.current * 0.008, -0.1, 0.1)

    // ── keep the "Ask me" bubble pinned to the mouth ────────────────────────
    const bubble = bubbleRef.current
    if (bubble) {
      rig.mouth.getWorldPosition(mouthWorld.current)
      const p = mouthWorld.current.clone().project(camera)
      const px = (p.x * 0.5 + 0.5) * size.width
      const py = (-p.y * 0.5 + 0.5) * size.height
      bubble.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`
    }
  })

  return (
    <group ref={group}>
      <group scale={rig.scale} position={rig.centre.clone().multiplyScalar(-rig.scale).toArray()}>
        <primitive object={rig.root} />
      </group>
    </group>
  )
}

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
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const holderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let idleTimer = 0

    const cakePoint = () => {
      const stage = document.querySelector('[data-bee-anchor]') as HTMLElement | null
      if (!stage) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 }
      const r = stage.getBoundingClientRect()
      return { x: r.left + r.width * 0.5 + 90, y: r.top + r.height * 0.22 }
    }

    const goIdle = () => {
      const p = cakePoint()
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

    // The bee (and its bubble) belong to the hero and below — not the intro.
    // Fade the whole overlay in once the hero stage reaches the viewport.
    const onScroll = () => {
      if (!target.current.chasing) goIdle()
      const holder = holderRef.current
      const stage = document.querySelector('[data-bee-anchor]') as HTMLElement | null
      if (holder && stage) {
        const top = stage.getBoundingClientRect().top
        const visible = top < window.innerHeight * 0.65
        holder.style.opacity = visible ? '1' : '0'
        holder.style.pointerEvents = 'none' // canvas layer never eats clicks
        if (bubbleRef.current) bubbleRef.current.style.opacity = visible ? '1' : '0'
      }
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
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 6]} intensity={1.3} />
          <BeeModel target={target} bubbleRef={bubbleRef} />
        </Canvas>
      </div>
      {/* "Ask me" — a speech bubble pinned to the bee's mouth. The only
          clickable part of the overlay; it opens the site's chat. */}
      <div
        ref={bubbleRef}
        className="fixed left-0 top-0 transition-opacity duration-500"
        style={{ zIndex: 46, willChange: 'transform' }}
      >
        <button
          type="button"
          onClick={openChat}
          className="pointer-events-auto relative -translate-y-full translate-x-3 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground shadow-soft transition-transform hover:scale-105"
          aria-label="Ask the CakeUWish assistant a question"
        >
          Ask me! 🍰
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 left-2 h-3 w-3 rotate-45 border-b border-r border-border bg-card"
          />
        </button>
      </div>
    </>
  )
}
