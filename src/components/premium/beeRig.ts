import * as THREE from 'three'

// AUTO-RIG for the baker-bee GLB.
//
// The model arrives as ONE fused mesh — no bones, no separate parts. Rather
// than settle for a statue, we build a skeleton at load time by claiming
// vertices purely by WHERE THEY ARE.
//
// DESIGN RULE learned the hard way: be conservative. An earlier version gave
// the antennae their own bones using a simple "top of the model" test — which
// is exactly where the CHEF'S HAT lives, so 1,445 hat vertices got torn between
// bones and the hat visibly distorted. Now only four things deform, each with a
// tight, verified region:
//
//   wingL / wingR  outer flanks, behind the belly        (flap)
//   eyeL  / eyeR   two small spheres on the face          (gaze)
//   mouth          a small patch below the eyes           (chew)
//   head           EVERYTHING above the shoulders, rigid  (turn/tilt)
//
// The head deliberately includes the hat and antennae and moves them as one
// solid piece, feathering only in a narrow band at the neck — far below the
// hat — so nothing shears.

export interface BeeRig {
  skinned: THREE.SkinnedMesh
  bones: {
    body: THREE.Bone
    head: THREE.Bone
    wingL: THREE.Bone
    wingR: THREE.Bone
    eyeL: THREE.Bone
    eyeR: THREE.Bone
    mouth: THREE.Bone
  }
  rest: { eyeL: THREE.Vector3; eyeR: THREE.Vector3; mouth: THREE.Vector3 }
  height: number
  centre: THREE.Vector3
}

const bone = (p: THREE.Vector3) => {
  const b = new THREE.Bone()
  b.position.copy(p)
  return b
}

export function autoRig(source: THREE.Object3D): BeeRig {
  let found: THREE.Mesh | null = null
  source.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !found) found = o as THREE.Mesh
  })
  if (!found) throw new Error('bee model has no mesh')
  const mesh = found as THREE.Mesh

  mesh.updateWorldMatrix(true, true)
  const geo = mesh.geometry.clone()
  geo.applyMatrix4(mesh.matrixWorld)

  const pos = geo.attributes.position as THREE.BufferAttribute
  const box = new THREE.Box3().setFromBufferAttribute(pos)
  const size = box.getSize(new THREE.Vector3())
  const mid = box.getCenter(new THREE.Vector3())
  const v = new THREE.Vector3()

  // ── locate the eyes by scanning the front of the face ───────────────────
  const eyeY0 = box.min.y + size.y * 0.62
  const eyeY1 = box.min.y + size.y * 0.82
  const zFront = mid.z + size.z * 0.18
  const lc = new THREE.Vector3()
  const rc = new THREE.Vector3()
  let ln = 0
  let rn = 0
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    if (v.y > eyeY0 && v.y < eyeY1 && v.z > zFront) {
      if (v.x < -size.x * 0.04 && v.x > -size.x * 0.22) {
        lc.add(v)
        ln++
      } else if (v.x > size.x * 0.04 && v.x < size.x * 0.22) {
        rc.add(v)
        rn++
      }
    }
  }
  if (ln) lc.divideScalar(ln)
  else lc.set(-size.x * 0.1, box.min.y + size.y * 0.72, mid.z + size.z * 0.28)
  if (rn) rc.divideScalar(rn)
  else rc.set(size.x * 0.1, box.min.y + size.y * 0.72, mid.z + size.z * 0.28)

  const mouthC = new THREE.Vector3(mid.x, lc.y - size.y * 0.11, Math.max(lc.z, rc.z))

  // ── bones ───────────────────────────────────────────────────────────────
  // The head pivots at the NECK, not at its centre, so turning it swings the
  // face rather than sliding the whole skull sideways.
  const neckY = box.min.y + size.y * 0.52
  const body = bone(mid.clone())
  const head = bone(new THREE.Vector3(mid.x, neckY, mid.z))
  const wingL = bone(new THREE.Vector3(-size.x * 0.16, mid.y + size.y * 0.06, mid.z - size.z * 0.2))
  const wingR = bone(new THREE.Vector3(size.x * 0.16, mid.y + size.y * 0.06, mid.z - size.z * 0.2))
  const eyeL = bone(lc)
  const eyeR = bone(rc)
  const mouth = bone(mouthC)
  body.add(wingL, wingR, head)
  head.add(eyeL, eyeR, mouth)

  const IDX = { body: 0, head: 1, wingL: 2, wingR: 3, eyeL: 4, eyeR: 5, mouth: 6 }
  const skeleton = new THREE.Skeleton([body, head, wingL, wingR, eyeL, eyeR, mouth])

  // ── weight painting ─────────────────────────────────────────────────────
  const si: number[] = []
  const sw: number[] = []
  const wingX = size.x * 0.27
  const wingFeather = size.x * 0.14
  const eyeRad = Math.min(size.x, size.y) * 0.065
  const mouthRad = Math.min(size.x, size.y) * 0.055
  // narrow neck band: the ONLY place the head blends into the body
  const neckLo = neckY - size.y * 0.05
  const neckHi = neckY + size.y * 0.05

  const push = (b: number, w: number, fallback = IDX.body) => {
    si.push(b, fallback, 0, 0)
    sw.push(w, 1 - w, 0, 0)
  }

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)

    // wings — outer flanks, behind the belly
    const ax = Math.abs(v.x)
    if (ax > wingX && v.z < mid.z + size.z * 0.15) {
      push(v.x < 0 ? IDX.wingL : IDX.wingR, THREE.MathUtils.clamp((ax - wingX) / wingFeather, 0, 1))
      continue
    }

    // face features — only on the front surface, and only above the neck
    if (v.z > mid.z + size.z * 0.08 && v.y > neckY) {
      const dl = v.distanceTo(lc)
      const dr = v.distanceTo(rc)
      const d = Math.min(dl, dr)
      if (d < eyeRad) {
        // blend against the HEAD (not the body) so gaze survives a head turn
        push(dl < dr ? IDX.eyeL : IDX.eyeR, THREE.MathUtils.clamp(1 - d / eyeRad, 0, 1), IDX.head)
        continue
      }
      const dm = v.distanceTo(mouthC)
      if (dm < mouthRad) {
        push(IDX.mouth, THREE.MathUtils.clamp(1 - dm / mouthRad, 0, 1), IDX.head)
        continue
      }
    }

    // head — rigid above the neck band (hat and antennae ride along untouched)
    if (v.y >= neckHi) {
      push(IDX.head, 1)
      continue
    }
    if (v.y > neckLo) {
      push(IDX.head, THREE.MathUtils.clamp((v.y - neckLo) / (neckHi - neckLo), 0, 1))
      continue
    }
    push(IDX.body, 1)
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))

  const skinned = new THREE.SkinnedMesh(geo, mesh.material as THREE.Material)
  skinned.add(body)
  skinned.bind(skeleton)
  skinned.frustumCulled = false

  return {
    skinned,
    bones: { body, head, wingL, wingR, eyeL, eyeR, mouth },
    rest: { eyeL: lc.clone(), eyeR: rc.clone(), mouth: mouthC.clone() },
    height: size.y,
    centre: mid,
  }
}
