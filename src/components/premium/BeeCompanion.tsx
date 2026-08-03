import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// The CakeUWish bee — a cartoon GLB (public/models/bee.glb) that lives over the
// hero. It chases the pointer with spring physics, banks into its turns, and
// when you stop moving drifts over to hover above the cake on stage. Its wings
// flap from their roots and its eyes (iris/pupil/sparkle are separate meshes)
// slide inside the eye whites to LOOK at the pointer.
//
// Model facts that shape this code (verified by parsing the GLB):
// - every part is a flat root node at the ORIGIN — no pivots. Wings must be
//   re-pivoted to their inner edge before rotating, or they'd orbit the belly.
// - eyes come as white/iris/pupil/sparkle pairs, so gaze = translating the
//   inner three within the white's radius. No bones, no baked animations.
//
// Import ONLY via React.lazy: three.js must stay out of every other chunk.

const MODEL = '/models/bee.glb'

interface Target {
  x: number
  y: number
  chasing: boolean
}

/** Re-pivot a mesh so it rotates around `pivot` instead of the scene origin. */
function repivot(mesh: THREE.Mesh, pivot: THREE.Vector3) {
  mesh.geometry = mesh.geometry.clone()
  mesh.geometry.translate(-pivot.x, -pivot.y, -pivot.z)
  mesh.position.copy(pivot)
}

function BeeModel({ target }: { target: React.MutableRefObject<Target> }) {
  const group = useRef<THREE.Group>(null)
  const { viewport, pointer } = useThree()
  const { scene } = useGLTF(MODEL)

  const vel = useRef(new THREE.Vector3())
  const bank = useRef(0)

  // One-time surgery on the loaded scene: normalise scale/orientation, re-pivot
  // the wings, and collect the animatable parts.
  const rig = useMemo(() => {
    const root = scene
    const bbox = new THREE.Box3().setFromObject(root)
    const size = bbox.getSize(new THREE.Vector3())
    const centre = bbox.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    // GLTFLoader sanitises node names: spaces become underscores (verified by
    // loading this exact file) — so "Eye white -1" arrives as "Eye_white_-1".
    const byName = (n: string) => root.getObjectByName(n.replace(/ /g, '_')) as THREE.Mesh | null

    // Which way does the face point? The eyes sit forward of the body centre;
    // the sign of that offset on z tells us the facing direction.
    const eyeWhites = [byName('Eye white -1'), byName('Eye white 1')].filter(Boolean) as THREE.Mesh[]
    let faceSign = 1
    if (eyeWhites.length) {
      const eb = new THREE.Box3()
      eyeWhites.forEach((m) => eb.expandByObject(m))
      faceSign = eb.getCenter(new THREE.Vector3()).z >= centre.z ? 1 : -1
    }

    // Wings: pivot each at its inner edge (the side nearest the body's x=0).
    const wings = (
      [
        ['Wing left upper', 1],
        ['Wing right upper', -1],
        ['Wing left lower', 1],
        ['Wing right lower', -1],
      ] as const
    )
      .map(([name, sign]) => {
        const mesh = byName(name)
        if (!mesh) return null
        const wb = new THREE.Box3().setFromObject(mesh)
        const wc = wb.getCenter(new THREE.Vector3())
        const inner = wc.x >= centre.x ? wb.min.x : wb.max.x
        repivot(mesh, new THREE.Vector3(inner, wc.y, wc.z))
        return { mesh, sign: wc.x >= centre.x ? -1 : 1, lower: name.includes('lower'), fallbackSign: sign }
      })
      .filter(Boolean) as { mesh: THREE.Mesh; sign: number; lower: boolean }[]

    // Eyes: the iris/pupil/sparkle trios slide inside the whites to form gaze.
    const gaze = (['-1', '1'] as const).map((side) => {
      const white = byName(`Eye white ${side}`)
      const parts = [byName(`Iris ${side}`), byName(`Pupil ${side}`), byName(`Eye sparkle ${side}`)].filter(
        Boolean,
      ) as THREE.Mesh[]
      // The whites are wide ovals (≈0.68 × 0.26 in this model), so the gaze
      // travels further sideways than up-down — like real cartoon eyes.
      let rx = 0.05
      let ry = 0.03
      if (white) {
        const wb = new THREE.Box3().setFromObject(white)
        const ws = wb.getSize(new THREE.Vector3())
        rx = ws.x * 0.18
        ry = ws.y * 0.16
      }
      return { parts, rx, ry }
    })

    // Limbs bob gently by translation (origin pivots make rotation unusable).
    const limbs = ['Arm -1', 'Arm 1', 'Hand -1', 'Hand 1', 'Leg -1', 'Leg 1', 'Foot -1', 'Foot 1']
      .map((n) => byName(n))
      .filter(Boolean) as THREE.Mesh[]

    return { root, scale: 0.5 / maxDim, centre, faceSign, wings, gaze, limbs }
  }, [scene])

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime

    const tx = (target.current.x / window.innerWidth - 0.5) * viewport.width
    const ty = -(target.current.y / window.innerHeight - 0.5) * viewport.height
    const wanderX = Math.sin(t * 0.9) * 0.42 + Math.sin(t * 2.3) * 0.12
    const wanderY = Math.cos(t * 1.3) * 0.3 + Math.cos(t * 3.1) * 0.08

    const desired = new THREE.Vector3(tx + wanderX, ty + wanderY, 0)
    const toTarget = desired.clone().sub(g.position)
    const stiffness = target.current.chasing ? 9 : 3.4
    const damping = target.current.chasing ? 3.4 : 2.6
    vel.current.addScaledVector(toTarget, stiffness * dt)
    vel.current.multiplyScalar(1 - Math.min(1, damping * dt))
    g.position.addScaledVector(vel.current, dt)

    // 3/4 base facing (so the face shows), leaning into the direction of travel.
    const speed = vel.current.length()
    const baseYaw = rig.faceSign > 0 ? -0.55 : Math.PI - 0.55
    const lean = THREE.MathUtils.clamp(vel.current.x * 0.22, -0.6, 0.6)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, baseYaw + lean * rig.faceSign, 1 - Math.pow(0.001, dt))
    const targetBank = THREE.MathUtils.clamp(-vel.current.x * 0.14, -0.45, 0.45)
    bank.current = THREE.MathUtils.lerp(bank.current, targetBank, 1 - Math.pow(0.002, dt))
    g.rotation.z = bank.current
    g.rotation.x = THREE.MathUtils.clamp(vel.current.y * 0.08, -0.3, 0.3)

    // hover bob
    g.position.z = Math.sin(t * 6) * 0.05

    // Wings flap from their roots — uppers lead, lowers trail a beat behind,
    // beating a touch faster when the bee hurries.
    const beat = 34 + Math.min(14, speed * 4)
    for (const w of rig.wings) {
      const phase = w.lower ? -0.6 : 0
      w.mesh.rotation.z = w.sign * Math.sin(t * beat + phase) * (w.lower ? 0.5 : 0.72)
    }

    // Eyes look where the pointer is: slide iris/pupil/sparkle within the white.
    // pointer is already in NDC (-1..1); invert x when the model faces -z.
    const gx = THREE.MathUtils.clamp(pointer.x, -1, 1) * rig.faceSign
    const gy = THREE.MathUtils.clamp(pointer.y, -1, 1)
    for (const eye of rig.gaze) {
      for (const p of eye.parts) {
        p.position.x = THREE.MathUtils.lerp(p.position.x, gx * eye.rx, 1 - Math.pow(0.0005, dt))
        p.position.y = THREE.MathUtils.lerp(p.position.y, gy * eye.ry, 1 - Math.pow(0.0005, dt))
      }
    }

    // limbs sway softly, out of phase
    rig.limbs.forEach((m, i) => {
      m.position.y = Math.sin(t * 5 + i * 1.3) * 0.012
    })
  })

  return (
    <group ref={group}>
      <group scale={rig.scale} position={rig.centre.clone().multiplyScalar(-rig.scale).toArray()}>
        <primitive object={rig.root} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL)

export default function BeeCompanion() {
  const target = useRef<Target>({
    x: typeof window === 'undefined' ? 0 : window.innerWidth * 0.5,
    y: typeof window === 'undefined' ? 0 : window.innerHeight * 0.42,
    chasing: false,
  })

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
    const onScroll = () => {
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
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[3, 5, 6]} intensity={1.0} />
        <Suspense fallback={null}>
          <BeeModel target={target} />
        </Suspense>
      </Canvas>
    </div>
  )
}
