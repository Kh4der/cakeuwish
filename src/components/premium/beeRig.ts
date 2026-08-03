import * as THREE from 'three'

// AUTO-RIG for the baker-bee GLB.
//
// The model arrives as ONE fused mesh — no bones, no separate parts, nothing
// to animate. Rather than settle for a statue, we build a skeleton ourselves:
// vertices are assigned to bones purely by WHERE THEY ARE, with the weight
// feathered toward each region's edge so the surface stretches instead of
// tearing. Verified visually (wings fold, eyes slide, face stays intact).
//
// Regions, all derived from the model's own bounding box so this survives a
// re-export at a different scale:
//   wingL / wingR  outer flanks, behind the belly
//   eyeL  / eyeR   two spheres on the face (gaze)
//   mouth          small patch below and between the eyes (chewing)
//   head           everything above the shoulders (nods, tilts)
//   antL  / antR   the two stalks above the head
//   body           everything else (root)

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
    antL: THREE.Bone
    antR: THREE.Bone
  }
  /** rest positions, so animation can offset rather than overwrite */
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
  let src: THREE.Mesh | null = null
  source.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !src) src = o as THREE.Mesh
  })
  if (!src) throw new Error('bee model has no mesh')
  const mesh = src as THREE.Mesh

  mesh.updateWorldMatrix(true, true)
  const geo = mesh.geometry.clone()
  geo.applyMatrix4(mesh.matrixWorld)

  const box = new THREE.Box3().setFromBufferAttribute(
    geo.attributes.position as THREE.BufferAttribute,
  )
  const size = box.getSize(new THREE.Vector3())
  const mid = box.getCenter(new THREE.Vector3())

  // ── landmark the face by scanning the front surface ─────────────────────
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
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
  if (rn) rc.divideScalar(rn)
  // fall back to symmetric guesses if the scan found nothing
  if (!ln) lc.set(-size.x * 0.1, box.min.y + size.y * 0.72, mid.z + size.z * 0.28)
  if (!rn) rc.set(size.x * 0.1, box.min.y + size.y * 0.72, mid.z + size.z * 0.28)

  const mouthC = new THREE.Vector3(mid.x, lc.y - size.y * 0.1, Math.max(lc.z, rc.z))

  // ── bones ───────────────────────────────────────────────────────────────
  const body = bone(new THREE.Vector3(mid.x, mid.y, mid.z))
  const head = bone(new THREE.Vector3(mid.x, box.min.y + size.y * 0.62, mid.z))
  const wingL = bone(new THREE.Vector3(-size.x * 0.16, mid.y + size.y * 0.06, mid.z - size.z * 0.2))
  const wingR = bone(new THREE.Vector3(size.x * 0.16, mid.y + size.y * 0.06, mid.z - size.z * 0.2))
  const eyeL = bone(lc)
  const eyeR = bone(rc)
  const mouth = bone(mouthC)
  const antL = bone(new THREE.Vector3(-size.x * 0.12, box.max.y - size.y * 0.06, mid.z))
  const antR = bone(new THREE.Vector3(size.x * 0.12, box.max.y - size.y * 0.06, mid.z))
  body.add(wingL, wingR, head)
  head.add(eyeL, eyeR, mouth, antL, antR)

  const list = [body, head, wingL, wingR, eyeL, eyeR, mouth, antL, antR]
  const IDX = { body: 0, head: 1, wingL: 2, wingR: 3, eyeL: 4, eyeR: 5, mouth: 6, antL: 7, antR: 8 }
  const skeleton = new THREE.Skeleton(list)

  // ── weight painting ─────────────────────────────────────────────────────
  const si: number[] = []
  const sw: number[] = []
  const wingX = size.x * 0.26
  const wingFeather = size.x * 0.16
  const eyeR0 = Math.min(size.x, size.y) * 0.07
  const mouthR = Math.min(size.x, size.y) * 0.06
  const antY = box.max.y - size.y * 0.2
  const headY = box.min.y + size.y * 0.6
  const headFeather = size.y * 0.12

  const push = (b: number, w: number) => {
    si.push(b, IDX.body, 0, 0)
    sw.push(w, 1 - w, 0, 0)
  }

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)

    // antennae first — they sit highest and are thin
    if (v.y > antY && Math.abs(v.x) > size.x * 0.05) {
      push(v.x < 0 ? IDX.antL : IDX.antR, 1)
      continue
    }
    // wings
    const ax = Math.abs(v.x)
    if (ax > wingX && v.z < mid.z + size.z * 0.15) {
      push(v.x < 0 ? IDX.wingL : IDX.wingR, THREE.MathUtils.clamp((ax - wingX) / wingFeather, 0, 1))
      continue
    }
    // eyes (only on the front surface)
    if (v.z > mid.z + size.z * 0.08) {
      const dl = v.distanceTo(lc)
      const dr = v.distanceTo(rc)
      const d = Math.min(dl, dr)
      if (d < eyeR0) {
        push(dl < dr ? IDX.eyeL : IDX.eyeR, THREE.MathUtils.clamp(1 - d / eyeR0, 0, 1))
        continue
      }
      const dm = v.distanceTo(mouthC)
      if (dm < mouthR) {
        push(IDX.mouth, THREE.MathUtils.clamp(1 - dm / mouthR, 0, 1))
        continue
      }
    }
    // head — everything above the shoulders, feathered into the body
    if (v.y > headY) {
      push(IDX.head, THREE.MathUtils.clamp((v.y - headY) / headFeather, 0, 1))
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
    bones: { body, head, wingL, wingR, eyeL, eyeR, mouth, antL, antR },
    rest: { eyeL: lc.clone(), eyeR: rc.clone(), mouth: mouthC.clone() },
    height: size.y,
    centre: mid,
  }
}
