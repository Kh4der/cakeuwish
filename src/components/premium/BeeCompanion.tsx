import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A little 3D bee that lives over the hero, straight off the CakeUWish bee cake.
//
// Behaviour, in one sentence: it chases the pointer with spring physics, banks
// into its turns, and — when you stop moving — drifts over to hover above the
// cake on stage, so scrolling through the carousel looks like the bee is
// visiting each cake in turn.
//
// Import ONLY via React.lazy: three.js must stay out of every other chunk.
// The parent decides when it is worth showing (desktop, motion allowed).

const YELLOW = '#F2B705' // bee body, matching the fondant bees on the cake
const DARK = '#241A12' // stripes / head — warm near-black, not pure black
const WING = '#FFFFFF'

/** Where the bee wants to be, in screen pixels. */
interface Target {
  x: number
  y: number
  /** true while the pointer is driving; false when idling over the cake */
  chasing: boolean
}

function Bee({ target }: { target: React.MutableRefObject<Target> }) {
  const group = useRef<THREE.Group>(null)
  const leftWing = useRef<THREE.Mesh>(null)
  const rightWing = useRef<THREE.Mesh>(null)
  const { viewport } = useThree()

  // Velocity is integrated, not set, so the bee overshoots and settles like a
  // real insect rather than snapping to the cursor.
  const vel = useRef(new THREE.Vector3())
  const bank = useRef(0)

  const wingGeo = useMemo(() => {
    // Long, thin and nearly flat — a real bee's wing is about as long as its
    // body, not a stubby paddle.
    const g = new THREE.SphereGeometry(0.5, 14, 8)
    g.scale(1.5, 0.06, 0.42)
    return g
  }, [])

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05) // clamp so a stalled tab doesn't fling it
    const t = clock.elapsedTime

    // Screen pixels → world units on the bee's z-plane.
    const tx = (target.current.x / window.innerWidth - 0.5) * viewport.width
    const ty = -(target.current.y / window.innerHeight - 0.5) * viewport.height

    // Bees never fly straight: add a wandering figure-eight so even a still
    // pointer keeps it alive.
    const wanderX = Math.sin(t * 0.9) * 0.42 + Math.sin(t * 2.3) * 0.12
    const wanderY = Math.cos(t * 1.3) * 0.3 + Math.cos(t * 3.1) * 0.08

    const desired = new THREE.Vector3(tx + wanderX, ty + wanderY, 0)
    const toTarget = desired.clone().sub(g.position)

    // Spring toward the target; softer when idling so it loiters over the cake.
    const stiffness = target.current.chasing ? 9 : 3.4
    const damping = target.current.chasing ? 3.4 : 2.6
    vel.current.addScaledVector(toTarget, stiffness * dt)
    vel.current.multiplyScalar(1 - Math.min(1, damping * dt))
    g.position.addScaledVector(vel.current, dt)

    // Face the direction of travel and bank into the turn.
    const speed = vel.current.length()
    if (speed > 0.05) {
      const heading = Math.atan2(vel.current.x, Math.abs(vel.current.z) + 0.001)
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, heading * 0.6, 1 - Math.pow(0.001, dt))
    }
    const targetBank = THREE.MathUtils.clamp(-vel.current.x * 0.16, -0.5, 0.5)
    bank.current = THREE.MathUtils.lerp(bank.current, targetBank, 1 - Math.pow(0.002, dt))
    g.rotation.z = bank.current
    // Nose down when climbing, up when diving — reads as effort.
    g.rotation.x = THREE.MathUtils.clamp(vel.current.y * 0.10, -0.35, 0.35)

    // Body bob, faster when hurrying.
    g.position.z = Math.sin(t * 6) * 0.05
    const scale = 1 + Math.sin(t * 5.5) * 0.015
    g.scale.setScalar(scale)

    // Wings: a blur-fast flutter. Real bees beat ~200Hz; we fake the look at a
    // frame-rate-safe speed and let motion blur do the rest.
    const flap = Math.sin(t * 42) * 0.7
    if (leftWing.current) leftWing.current.rotation.x = -0.35 + flap
    if (rightWing.current) rightWing.current.rotation.x = -0.35 - flap
  })

  return (
    // Small — a bee on screen should read as an insect, not a mascot.
    <group ref={group} position={[0, 0, 0]} scale={0.17}>
      {/* abdomen — long, tapering to a point at the back */}
      <mesh position={[0, 0, 0.46]} scale={[0.82, 0.78, 1.35]}>
        <sphereGeometry args={[0.4, 20, 16]} />
        <meshStandardMaterial color={YELLOW} roughness={0.6} />
      </mesh>
      {/* four narrow bands, thinning toward the tip */}
      {[0.18, 0.42, 0.66, 0.86].map((z, i) => (
        <mesh key={i} position={[0, 0, z]} scale={[0.83 - i * 0.06, 0.79 - i * 0.06, 0.075]}>
          <sphereGeometry args={[0.405, 18, 12]} />
          <meshStandardMaterial color={DARK} roughness={0.75} />
        </mesh>
      ))}
      {/* thorax — compact and fuzzy */}
      <mesh position={[0, 0.01, -0.12]} scale={[0.92, 0.88, 0.85]}>
        <sphereGeometry args={[0.33, 18, 14]} />
        <meshStandardMaterial color="#C8901F" roughness={0.95} />
      </mesh>
      {/* head — small */}
      <mesh position={[0, 0, -0.42]} scale={[0.9, 0.85, 0.8]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={DARK} roughness={0.65} />
      </mesh>
      {/* compound eyes, wrapping the sides of the head */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.02, -0.47]} scale={[0.55, 1, 0.8]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color="#15100C" roughness={0.2} />
        </mesh>
      ))}
      {/* antennae — elbowed, angled forward */}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.14, -0.52]} rotation={[0.7, 0, x > 0 ? -0.4 : 0.4]}>
          <cylinderGeometry args={[0.009, 0.009, 0.26, 5]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      ))}
      {/* six legs, tucked up in flight */}
      {[-1, 1].map((side) =>
        [-0.18, 0.0, 0.18].map((z, i) => (
          <mesh
            key={`${side}-${i}`}
            position={[side * 0.2, -0.2, z]}
            rotation={[0.6, 0, side * 0.9]}
          >
            <cylinderGeometry args={[0.014, 0.008, 0.24, 5]} />
            <meshStandardMaterial color={DARK} roughness={0.8} />
          </mesh>
        )),
      )}
      {/* wings — long, held high and swept back */}
      <mesh ref={leftWing} geometry={wingGeo} position={[-0.42, 0.2, -0.02]} rotation={[-0.3, 0.42, 0.16]}>
        <meshStandardMaterial color={WING} transparent opacity={0.3} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={rightWing} geometry={wingGeo} position={[0.42, 0.2, -0.02]} rotation={[-0.3, -0.42, -0.16]}>
        <meshStandardMaterial color={WING} transparent opacity={0.3} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export default function BeeCompanion() {
  // Screen-space target, written by DOM listeners and read inside useFrame.
  const target = useRef<Target>({
    x: typeof window === 'undefined' ? 0 : window.innerWidth * 0.5,
    y: typeof window === 'undefined' ? 0 : window.innerHeight * 0.42,
    chasing: false,
  })

  useEffect(() => {
    let idleTimer = 0

    /** Hover point over the cake currently on stage — the bee's resting post. */
    const cakePoint = () => {
      const stage = document.querySelector('[data-bee-anchor]') as HTMLElement | null
      if (!stage) return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 }
      const r = stage.getBoundingClientRect()
      // Just above the cake, slightly off-centre so it doesn't hide the design.
      return { x: r.left + r.width * 0.5 + 90, y: r.top + r.height * 0.22 }
    }

    const goIdle = () => {
      const p = cakePoint()
      target.current = { x: p.x, y: p.y, chasing: false }
    }

    const chase = (x: number, y: number, holdMs: number) => {
      target.current = { x, y, chasing: true }
      window.clearTimeout(idleTimer)
      // Stop chasing shortly after the pointer settles, and drift to the cake.
      idleTimer = window.setTimeout(goIdle, holdMs)
    }
    const onMove = (e: PointerEvent) => chase(e.clientX, e.clientY, 1600)
    // Touch: a tap sends the bee over, then it lingers a beat longer before
    // heading back to the cake (there is no hover to keep it company).
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0]
      if (t) chase(t.clientX, t.clientY, 2600)
    }
    const onScroll = () => {
      // While scrolling the carousel the pointer usually isn't moving, so keep
      // re-aiming at whichever cake has slid onto the stage.
      if (!target.current.chasing) goIdle()
    }

    goIdle()
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
    <div className="pointer-events-none fixed inset-0" aria-hidden="true" style={{ zIndex: 45 }}>
      <Canvas
        // One small mesh — capping DPR at 1.25 keeps phones cool for free.
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 6]} intensity={1.1} />
        <Bee target={target} />
      </Canvas>
    </div>
  )
}
