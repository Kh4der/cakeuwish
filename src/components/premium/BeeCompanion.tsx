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
  // liveliness state: chew eases in/out, waves are scheduled, accel is smoothed
  const chewAmp = useRef(0)
  const nextWave = useRef(4)
  const waveUntil = useRef(-1)
  const prevVelX = useRef(0)
  const accelSm = useRef(0)

  // One-time surgery on the loaded scene. MEASURED FACTS about this model:
  // it is built LYING ON ITS BACK — body along z (head +z, feet -z), face
  // (eyes/mouth/cheeks all at +y) pointing at the sky. Rendered as-is it reads
  // as a sleeping bee. Standing it "normal, facing us" = rotate -90° about X
  // (head up, feet down), then 180° about Y (face was left pointing away).
  const rig = useMemo(() => {
    const root = scene

    // GLTFLoader sanitises node names: spaces become underscores (verified by
    // loading this exact file) — so "Eye white -1" arrives as "Eye_white_-1".
    const byName = (n: string) => root.getObjectByName(n.replace(/ /g, '_')) as THREE.Mesh | null

    const rawBox = new THREE.Box3().setFromObject(root)
    const rawCentre = rawBox.getCenter(new THREE.Vector3())

    // Wings: pivot each at its inner edge (the side nearest the body's x=0).
    const wings = (['Wing left upper', 'Wing right upper', 'Wing left lower', 'Wing right lower'] as const)
      .map((name) => {
        const mesh = byName(name)
        if (!mesh) return null
        const wb = new THREE.Box3().setFromObject(mesh)
        const wc = wb.getCenter(new THREE.Vector3())
        const inner = wc.x >= rawCentre.x ? wb.min.x : wb.max.x
        repivot(mesh, new THREE.Vector3(inner, wc.y, wc.z))
        return { mesh, sign: wc.x >= rawCentre.x ? -1 : 1, lower: name.includes('lower') }
      })
      .filter(Boolean) as { mesh: THREE.Mesh; sign: number; lower: boolean }[]

    // Eyes: iris/pupil/sparkle slide inside the whites to form the gaze. In
    // MODEL space the eye plane is x (width) by z (height-once-standing); the
    // whites measure ≈0.68 × 0.86, so travel is generous both ways.
    const gaze = (['-1', '1'] as const).map((side) => {
      const white = byName(`Eye white ${side}`)
      const parts = [byName(`Iris ${side}`), byName(`Pupil ${side}`), byName(`Eye sparkle ${side}`)].filter(
        Boolean,
      ) as THREE.Mesh[]
      let rx = 0.1
      let rz = 0.1
      if (white) {
        const wb = new THREE.Box3().setFromObject(white)
        const ws = wb.getSize(new THREE.Vector3())
        rx = ws.x * 0.22
        rz = ws.z * 0.18
      }
      return { parts, rx, rz }
    })

    // Joints. Every part is an origin-pivoted mesh, so real articulation means
    // building joint groups: a group is placed at the anatomical pivot (still
    // in model space, root untransformed) and the meshes are attach()ed so they
    // keep their world placement. Rotating the group then bends the joint.
    const joint = (names: string[], pivotOf: (b: THREE.Box3) => THREE.Vector3) => {
      const meshes = names.map((n) => byName(n)).filter(Boolean) as THREE.Mesh[]
      if (!meshes.length) return null
      const b = new THREE.Box3()
      meshes.forEach((m) => b.expandByObject(m))
      const grp = new THREE.Group()
      grp.position.copy(pivotOf(b))
      root.add(grp)
      meshes.forEach((m) => grp.attach(m))
      return grp
    }
    const mid = (b: THREE.Box3) => b.getCenter(new THREE.Vector3())
    // Shoulder: the arm's inner edge (toward x=0), at its top.
    const shoulder = (b: THREE.Box3) => {
      const c = mid(b)
      return new THREE.Vector3(Math.abs(b.min.x) < Math.abs(b.max.x) ? b.min.x : b.max.x, c.y, b.max.z)
    }
    // Hip: top of the leg (max z in model space = nearest the body).
    const hip = (b: THREE.Box3) => {
      const c = mid(b)
      return new THREE.Vector3(c.x, c.y, b.max.z)
    }
    // Antenna base: bottom of the stem (min z), on the head.
    const antennaBase = (b: THREE.Box3) => {
      const c = mid(b)
      return new THREE.Vector3(c.x, c.y, b.min.z)
    }
    const armL = joint(['Arm -1', 'Hand -1'], shoulder)
    const armR = joint(['Arm 1', 'Hand 1'], shoulder)
    const legL = joint(['Leg -1', 'Foot -1'], hip)
    const legR = joint(['Leg 1', 'Foot 1'], hip)
    // Jaw: mouth + tongue squash from the mouth's own centre for the chew.
    const mouth = joint(['Happy mouth', 'Tongue'], mid)
    const antL = joint(['Antenna stem -1', 'Antenna tip -1'], antennaBase)
    const antR = joint(['Antenna stem 1', 'Antenna tip 1'], antennaBase)

    // Stand the model up: inner group lifts the head from +z to +y; outer turns
    // the face (which lands on -z) around to the camera. Nested groups keep the
    // rotation order unambiguous.
    const stand = new THREE.Group()
    stand.rotation.x = -Math.PI / 2
    stand.add(root)
    const holder = new THREE.Group()
    holder.rotation.y = Math.PI
    holder.add(stand)

    // Normalise on the STANDING height and centre the whole character.
    const box = new THREE.Box3().setFromObject(holder)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const scale = 0.85 / (size.y || 1)

    return {
      holder,
      scale,
      centre,
      wings,
      gaze,
      joints: { armL, armR, legL, legR, mouth, antL, antR },
      mouthBase: mouth ? mouth.position.clone() : null,
    }
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

    // Face the viewer straight on — the eyes are the whole show. Only a whisper
    // of lean into the direction of travel so flight still reads as alive.
    const speed = vel.current.length()
    const lean = THREE.MathUtils.clamp(vel.current.x * 0.09, -0.22, 0.22)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, lean, 1 - Math.pow(0.001, dt))
    const targetBank = THREE.MathUtils.clamp(-vel.current.x * 0.14, -0.45, 0.45)
    bank.current = THREE.MathUtils.lerp(bank.current, targetBank, 1 - Math.pow(0.002, dt))
    g.rotation.z = bank.current
    g.rotation.x = THREE.MathUtils.clamp(vel.current.y * 0.08, -0.3, 0.3)

    // hover bob
    g.position.z = Math.sin(t * 6) * 0.05

    // Wings flap from their roots — uppers lead, lowers trail a beat behind,
    // beating faster when the bee hurries. With the character standing, model-y
    // is the screen normal, so rotating about local y sweeps the wing tips
    // up-and-down in the screen plane where the flutter is actually visible.
    const beat = 34 + Math.min(14, speed * 4)
    for (const w of rig.wings) {
      const phase = w.lower ? -0.6 : 0
      w.mesh.rotation.y = w.sign * Math.sin(t * beat + phase) * (w.lower ? 0.5 : 0.72)
    }

    // Eyes look where the pointer is: slide iris/pupil/sparkle within the white.
    // Axis map after standing the model up (Y-turn then X-stand): screen-right
    // is model -x, screen-up is model +z.
    const gx = THREE.MathUtils.clamp(pointer.x, -1, 1)
    const gy = THREE.MathUtils.clamp(pointer.y, -1, 1)
    for (const eye of rig.gaze) {
      for (const p of eye.parts) {
        p.position.x = THREE.MathUtils.lerp(p.position.x, -gx * eye.rx, 1 - Math.pow(0.0005, dt))
        p.position.z = THREE.MathUtils.lerp(p.position.z, gy * eye.rz, 1 - Math.pow(0.0005, dt))
      }
    }

    // ── whole-body liveliness ───────────────────────────────────────────────
    // Axis map once standing: joint rotation about local y swings in the screen
    // plane; local x nods toward/away from the camera; mouth scale.z is a
    // vertical squash on screen.
    const { armL, armR, legL, legR, mouth, antL, antR } = rig.joints
    const chasing = target.current.chasing
    const zip = Math.min(1, speed * 0.45) // 0 hovering → 1 hurrying

    // smoothed horizontal acceleration — antennae and arms lag behind it
    const ax = (vel.current.x - prevVelX.current) / Math.max(dt, 1e-4)
    prevVelX.current = vel.current.x
    accelSm.current = THREE.MathUtils.lerp(accelSm.current, ax, 1 - Math.pow(0.001, dt))

    // breathing — the softest cue that something is alive
    g.scale.setScalar(1 + Math.sin(t * 2.4) * 0.01)

    // CHEW when it settles by the cakes (a bakery bee cannot help itself):
    // eases in while idle, eases out the moment the chase resumes.
    chewAmp.current = THREE.MathUtils.lerp(chewAmp.current, chasing ? 0 : 1, 1 - Math.pow(chasing ? 0.005 : 0.05, dt))
    if (mouth && rig.mouthBase) {
      // The mouth mesh is a thin smile arc — squashing it was invisible at
      // 137px. Chewing must OPEN it: stretch the arc tall into an "O", narrow
      // it a touch, and drop the jaw, at a munching pace slow enough to read.
      const bite = Math.max(0, Math.sin(t * 5.2)) * chewAmp.current
      mouth.scale.z = 1 + bite * 1.6 // opens tall
      mouth.scale.x = 1 - bite * 0.18
      mouth.position.z = rig.mouthBase.z - bite * 0.07 // jaw drops
    }

    // WAVE hello every few seconds while idling — one arm, three friendly swings
    if (!chasing && t > nextWave.current) {
      waveUntil.current = t + 1.3
      nextWave.current = t + 5.5
    }
    const waving = t < waveUntil.current
    const waveEnv = waving ? Math.sin(((waveUntil.current - t) / 1.3) * Math.PI) : 0

    // ARMS: trail the flight like streamers when chasing; sway gently when
    // idle; the wave overrides the right arm with big hello swings.
    const armSwing = Math.sin(t * (6 + zip * 6)) * (0.06 + zip * 0.22)
    const armTrail = THREE.MathUtils.clamp(-accelSm.current * 0.03, -0.3, 0.3)
    if (armL) armL.rotation.y = armSwing + armTrail
    if (armR) armR.rotation.y = waving ? Math.sin(t * 11) * 0.7 * waveEnv : -armSwing + armTrail
    if (armR && waving) armR.rotation.x = -0.25 * waveEnv // raise the waving arm toward you

    // LEGS: happy alternating scissor-kicks, faster and wider when it hurries.
    const kick = 0.08 + zip * 0.3
    if (legL) legL.rotation.y = Math.sin(t * (7 + zip * 5)) * kick
    if (legR) legR.rotation.y = -Math.sin(t * (7 + zip * 5) + 0.4) * kick

    // ANTENNAE: spring against acceleration and keep a soft idle wobble.
    const antWobble = THREE.MathUtils.clamp(accelSm.current * 0.02, -0.25, 0.25)
    if (antL) antL.rotation.y = Math.sin(t * 3.1) * 0.09 - antWobble
    if (antR) antR.rotation.y = Math.sin(t * 3.1 + 1.4) * 0.09 - antWobble
  })

  return (
    <group ref={group}>
      <group scale={rig.scale} position={rig.centre.clone().multiplyScalar(-rig.scale).toArray()}>
        <primitive object={rig.holder} />
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
