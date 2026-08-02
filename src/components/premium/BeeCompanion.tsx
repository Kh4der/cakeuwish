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
    // A flattened, slightly tapered wing.
    const g = new THREE.SphereGeometry(0.5, 12, 8)
    g.scale(1, 0.12, 0.55)
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
    <group ref={group} position={[0, 0, 0]} scale={0.42}>
      {/* abdomen — striped */}
      <mesh position={[0, 0, 0.34]}>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshStandardMaterial color={YELLOW} roughness={0.55} />
      </mesh>
      {[0.16, 0.36, 0.56].map((z, i) => (
        <mesh key={i} position={[0, 0, z]} scale={[1, 1, 0.16]}>
          <sphereGeometry args={[0.425 - i * 0.02, 18, 12]} />
          <meshStandardMaterial color={DARK} roughness={0.7} />
        </mesh>
      ))}
      {/* thorax — fuzzy middle */}
      <mesh position={[0, 0.02, -0.08]}>
        <sphereGeometry args={[0.34, 18, 14]} />
        <meshStandardMaterial color={YELLOW} roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.02, -0.44]}>
        <sphereGeometry args={[0.26, 18, 14]} />
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </mesh>
      {/* eyes */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.07, -0.6]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.25} />
        </mesh>
      ))}
      {/* antennae */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.2, -0.56]} rotation={[0.5, 0, x > 0 ? -0.35 : 0.35]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 5]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
      ))}
      {/* wings */}
      <mesh ref={leftWing} geometry={wingGeo} position={[-0.3, 0.24, 0]} rotation={[-0.35, 0.35, 0.2]}>
        <meshStandardMaterial color={WING} transparent opacity={0.42} roughness={0.1} metalness={0} />
      </mesh>
      <mesh ref={rightWing} geometry={wingGeo} position={[0.3, 0.24, 0]} rotation={[-0.35, -0.35, -0.2]}>
        <meshStandardMaterial color={WING} transparent opacity={0.42} roughness={0.1} metalness={0} />
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

    const onMove = (e: PointerEvent) => {
      target.current = { x: e.clientX, y: e.clientY, chasing: true }
      window.clearTimeout(idleTimer)
      // Stop chasing shortly after the pointer settles, and drift to the cake.
      idleTimer = window.setTimeout(goIdle, 1600)
    }
    const onScroll = () => {
      // While scrolling the carousel the pointer usually isn't moving, so keep
      // re-aiming at whichever cake has slid onto the stage.
      if (!target.current.chasing) goIdle()
    }

    goIdle()
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(idleTimer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true" style={{ zIndex: 45 }}>
      <Canvas
        dpr={[1, 1.5]}
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
