import * as THREE from 'three'

// The CakeUWish baker bee, built procedurally to match the reference render
// (chubby yellow egg body, two black stripes, chef's hat, big amber eyes with
// brows, rosy cheeks, open smile, blue glass wings). Every part that animates
// is its own named group with a sensible pivot, which is the entire reason we
// build it from primitives instead of shipping the fused-mesh original.
//
// Built Y-up, FACING +Z. All sizes relative to a body radius of ~1.

const YELLOW = '#F7BE23'
const STRIPE = '#2A2320'
const HAT = '#F6F1E7'
const WING = '#BFE0F5'
const CHEEK = '#EE8F8F'
const IRIS = '#7A431F'
const PUPIL = '#191008'
const BROW = '#241B12'
const MOUTH = '#6B2F1F'

const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...opts })

const sphere = (
  r: number,
  color: string | THREE.MeshStandardMaterial,
  sx = 1,
  sy = 1,
  sz = 1,
  segs = 24,
) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, segs, segs),
    typeof color === 'string' ? mat(color) : color,
  )
  m.scale.set(sx, sy, sz)
  return m
}

export interface BeeParts {
  root: THREE.Group
  height: number
  wings: { pivot: THREE.Group; sign: number; lower: boolean }[]
  eyes: { iris: THREE.Group; rx: number; ry: number }[]
  mouth: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  feet: THREE.Group[]
  antennae: THREE.Group[]
  hat: THREE.Group
}

export function buildBee(): BeeParts {
  const root = new THREE.Group()

  // ── body: one chubby egg, slightly wider low ─────────────────────────────
  const body = sphere(1, mat(YELLOW, { roughness: 0.55 }), 0.98, 1.18, 0.9)
  root.add(body)

  // two BROAD stripes hugging the egg (x/z sized to the body's cross-section
  // at each height so they sit flush instead of reading as belts)
  for (const [y, h] of [
    [-0.3, 0.44],
    [-0.76, 0.38],
  ] as const) {
    const lat = Math.sqrt(Math.max(0.1, 1 - (y / 1.18) ** 2))
    const band = sphere(1, STRIPE, 0.98 * lat + 0.03, h, 0.9 * lat + 0.03)
    band.position.y = y
    root.add(band)
  }

  // ── chef's hat, sitting back on the crown ────────────────────────────────
  const hat = new THREE.Group()
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.28, 24), mat(HAT, { roughness: 0.8 }))
  hat.add(brim)
  const puffs = [
    [0, 0.28, 0, 0.34],
    [-0.24, 0.22, 0.06, 0.24],
    [0.24, 0.22, 0.06, 0.24],
    [-0.12, 0.24, -0.2, 0.22],
    [0.12, 0.24, -0.2, 0.22],
    [0, 0.42, -0.06, 0.26],
  ] as const
  for (const [x, y, z, r] of puffs) {
    const p = sphere(r, mat(HAT, { roughness: 0.8 }))
    p.position.set(x, y, z)
    hat.add(p)
  }
  hat.position.set(0, 1.16, -0.12)
  hat.rotation.x = -0.18
  hat.scale.set(1.1, 1.35, 1.1) // a proper toque is taller than it is wide
  root.add(hat)

  // ── face ─────────────────────────────────────────────────────────────────
  const faceZ = (y: number, x: number) => {
    // point on the body surface for a given height/side, pushed slightly out
    const ry = y / 1.18
    const rx = x / 0.98
    return 0.9 * Math.sqrt(Math.max(0.05, 1 - ry * ry - rx * rx))
  }

  // eyes: amber iris + pupil + sparkle inside a socket group (gaze slides the
  // inner group; the socket stays put)
  const eyes: BeeParts['eyes'] = []
  for (const side of [-1, 1]) {
    const x = 0.29 * side
    const y = 0.5
    const socket = new THREE.Group()
    socket.position.set(x, y, faceZ(y, x) - 0.02)
    const iris = new THREE.Group()
    const irisBall = sphere(0.19, mat(IRIS, { roughness: 0.3 }), 1, 1.12, 0.5)
    iris.add(irisBall)
    const pupil = sphere(0.09, mat(PUPIL, { roughness: 0.15 }), 1, 1.15, 0.5)
    pupil.position.z = 0.06
    iris.add(pupil)
    const glint = sphere(0.055, new THREE.MeshBasicMaterial({ color: '#FFFFFF' }) as unknown as THREE.MeshStandardMaterial)
    glint.position.set(0.055, 0.07, 0.1)
    iris.add(glint)
    socket.add(iris)
    root.add(socket)
    eyes.push({ iris, rx: 0.06, ry: 0.05 })

    // eyebrow: a thin, gentle arch floating above the eye
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 16, 0.9), mat(BROW, { roughness: 0.6 }))
    brow.position.set(x, y + 0.22, faceZ(y + 0.22, x) - 0.04)
    // torus arcs start on +x going CCW; centre the arc at the top, tiny tilt
    brow.rotation.z = Math.PI / 2 - 0.9 / 2 + 0.05 * side
    root.add(brow)

    // cheek
    const cheek = sphere(0.12, mat(CHEEK, { roughness: 0.9 }), 1.25, 0.9, 0.4)
    cheek.position.set(0.47 * side, 0.2, faceZ(0.2, 0.47) - 0.02)
    root.add(cheek)
  }

  // open happy mouth (rest state is a small smiling "o")
  const mouth = new THREE.Group()
  const lips = sphere(0.15, mat(MOUTH, { roughness: 0.5 }), 1.2, 1, 0.35)
  mouth.add(lips)
  const tongue = sphere(0.08, mat('#C96A5A', { roughness: 0.7 }), 1.2, 0.6, 0.4)
  tongue.position.set(0, -0.06, 0.04)
  mouth.add(tongue)
  mouth.position.set(0, 0.18, faceZ(0.18, 0) + 0.01)
  root.add(mouth)

  // ── antennae: stalk + ball, pivoted at the head ──────────────────────────
  const antennae: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const a = new THREE.Group()
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 8), mat(STRIPE))
    stalk.position.y = 0.31
    stalk.rotation.x = 0.3
    a.add(stalk)
    const tip = sphere(0.08, STRIPE)
    tip.position.set(0, 0.6, 0.18)
    a.add(tip)
    // rooted forward of the hat brim so they stay visible, splayed outward
    a.position.set(0.24 * side, 0.98, 0.34)
    a.rotation.z = -0.35 * side
    root.add(a)
    antennae.push(a)
  }

  // ── arms: stubby black curves held against the belly front, clearly in
  // front of the stripes (pivot at the shoulder) ───────────────────────────
  const makeArm = (side: number) => {
    const arm = new THREE.Group()
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 12), mat(STRIPE, { roughness: 0.7 }))
    limb.position.set(-0.16 * side, -0.22, 0.24)
    limb.rotation.x = 0.9
    limb.rotation.z = -0.7 * side
    arm.add(limb)
    const hand = sphere(0.125, STRIPE)
    hand.position.set(-0.34 * side, -0.34, 0.42)
    arm.add(hand)
    arm.position.set(0.66 * side, 0.02, 0.5)
    root.add(arm)
    return arm
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)

  // ── feet: little black stubs below (pivot where they meet the body) ──────
  const feet: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const f = new THREE.Group()
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 6, 12), mat(STRIPE, { roughness: 0.7 }))
    foot.position.y = -0.14
    f.add(foot)
    f.position.set(0.2 * side, -1.12, 0.05)
    root.add(f)
    feet.push(f)
  }

  // ── wings: blue glass, two per side, pivoted at the roots on the back ────
  const wingMat = new THREE.MeshStandardMaterial({
    color: WING,
    roughness: 0.12,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  })
  const wings: BeeParts['wings'] = []
  const wingGeo = new THREE.SphereGeometry(0.5, 18, 12)
  wingGeo.scale(1.7, 1.05, 0.1)
  wingGeo.translate(0.8, 0.12, 0) // root at origin so the pivot IS the root
  for (const side of [-1, 1]) {
    for (const lower of [false, true]) {
      const pivot = new THREE.Group()
      const w = new THREE.Mesh(wingGeo, wingMat)
      if (side < 0) w.scale.x = -1
      pivot.add(w)
      pivot.position.set(0.3 * side, lower ? 0.14 : 0.5, -0.55)
      pivot.rotation.y = 0.35 * side
      // uppers sweep upward like the reference; lowers sit near level
      pivot.rotation.z = (lower ? 0.08 : 0.38) * side
      root.add(pivot)
      wings.push({ pivot, sign: side, lower })
    }
  }

  return { root, height: 2.75, wings, eyes, mouth, armL, armR, feet, antennae, hat }
}
