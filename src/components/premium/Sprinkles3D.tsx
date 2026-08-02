import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Drifting 3D "sprinkles" — instanced capsules in the brand's pastel palette
// floating through the hero with gentle mouse parallax. Import this ONLY via
// React.lazy (three.js stays out of every other chunk); the parent decides
// when it's worth showing (desktop, motion allowed).

const COUNT = 90
// Straight off the logo and its photography: rose pink, gold, peach, sage, cream.
const PALETTE = ['#E87BA0', '#96601A', '#F2C9AE', '#EFA9BC', '#8FA876', '#C79A3E']

function Field() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 14,
        y: (Math.random() - 0.5) * 8,
        z: -2 - Math.random() * 6,
        rx: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        spin: 0.1 + Math.random() * 0.35,
        drift: 0.08 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        scale: 0.5 + Math.random() * 0.8,
      })),
    [],
  )

  const colors = useMemo(() => {
    const arr = new Float32Array(COUNT * 3)
    const c = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      c.set(PALETTE[i % PALETTE.length])
      c.toArray(arr, i * 3)
    }
    return arr
  }, [])

  useFrame(({ clock, pointer }) => {
    const m = mesh.current
    if (!m) return
    const t = clock.elapsedTime
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      dummy.position.set(
        s.x + Math.sin(t * s.drift + s.phase) * 0.7 + pointer.x * (0.4 + s.z * -0.06),
        s.y + Math.cos(t * s.drift * 0.8 + s.phase) * 0.5 + pointer.y * (0.3 + s.z * -0.05),
        s.z,
      )
      dummy.rotation.set(s.rx + t * s.spin, t * s.spin * 0.6, s.rz + t * s.spin * 0.4)
      dummy.scale.setScalar(s.scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <capsuleGeometry args={[0.045, 0.22, 3, 8]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </capsuleGeometry>
      <meshLambertMaterial vertexColors transparent opacity={0.85} />
    </instancedMesh>
  )
}

export default function Sprinkles3D() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 6, 8]} intensity={0.9} />
        <Field />
      </Canvas>
    </div>
  )
}
