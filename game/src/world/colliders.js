// collision system: AABBs + vertical cylinders, shared by visual geometry,
// player/bot movement, line-of-sight and bullet raycasts (single source of truth).

export class Colliders {
  constructor() {
    this.boxes = [];   // {min:[x,y,z], max:[x,y,z], platform?:bool, noBullet?:bool}
    this.cyls = [];    // {x, z, r, y0, y1}
    this.bbox = null;  // overall bounds for nav grid
  }

  addBox(min, max, opts = {}) {
    const b = { min: min.slice(), max: max.slice(), ...opts };
    this.boxes.push(b);
    return b;
  }
  addCenter(cx, cy, cz, sx, sy, sz, opts = {}) {
    return this.addBox([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], opts);
  }
  addCyl(x, z, r, y0, y1) {
    const c = { x, z, r, y0, y1 };
    this.cyls.push(c);
    return c;
  }
  clear() { this.boxes.length = 0; this.cyls.length = 0; }
}

// ---------------- ray queries ----------------

function rayAABB(ox, oy, oz, dx, dy, dz, min, max, tmax) {
  let tmin = 0, tmaxL = tmax;
  for (let i = 0; i < 3; i++) {
    const o = [ox, oy, oz][i], d = [dx, dy, dz][i];
    const mn = min[i], mx = max[i];
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return -1;
    } else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmaxL) tmaxL = t2;
      if (tmin > tmaxL) return -1;
    }
  }
  return tmin > 0.0001 ? tmin : -1;
}

function rayCyl(ox, oy, oz, dx, dy, dz, c, tmax) {
  // 2D ray vs circle in xz
  const fx = ox - c.x, fz = oz - c.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return -1;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - c.r * c.r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0.0001) t = (-b + sq) / (2 * a);
  if (t < 0.0001 || t > tmax) return -1;
  // y range check at hit
  const y = oy + dy * t;
  if (y < c.y0 || y > c.y1) return -1;
  return t;
}

/**
 * raycast against all colliders.
 * returns { t, point:[x,y,z], normal:[x,y,z], collider } or null
 */
export function raycast(coll, ox, oy, oz, dx, dy, dz, tmax = 200) {
  let best = tmax, hit = null;
  for (const b of coll.boxes) {
    const t = rayAABB(ox, oy, oz, dx, dy, dz, b.min, b.max, best);
    if (t > 0 && t < best) {
      best = t;
      hit = { t, collider: b, kind: 'box' };
    }
  }
  for (const c of coll.cyls) {
    const t = rayCyl(ox, oy, oz, dx, dy, dz, c, best);
    if (t > 0 && t < best) {
      best = t;
      hit = { t, collider: c, kind: 'cyl' };
    }
  }
  if (!hit) return null;
  const px = ox + dx * best, py = oy + dy * best, pz = oz + dz * best;
  let nx = 0, ny = 0, nz = 0;
  if (hit.kind === 'box') {
    const b = hit.collider;
    // approximate normal: find axis of smallest penetration
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const ex = (b.max[0] - b.min[0]) / 2, ey = (b.max[1] - b.min[1]) / 2, ez = (b.max[2] - b.min[2]) / 2;
    const vx = (px - cx) / ex, vy = (py - cy) / ey, vz = (pz - cz) / ez;
    const ax = Math.abs(1 - Math.abs(vx)), ay = Math.abs(1 - Math.abs(vy)), az = Math.abs(1 - Math.abs(vz));
    if (ax <= ay && ax <= az) nx = vx > 0 ? 1 : -1;
    else if (ay <= az) ny = vy > 0 ? 1 : -1;
    else nz = vz > 0 ? 1 : -1;
  } else {
    const c = hit.collider;
    const l = Math.hypot(px - c.x, pz - c.z) || 1;
    nx = (px - c.x) / l; nz = (pz - c.z) / l;
  }
  return { t: best, point: [px, py, pz], normal: [nx, ny, nz] };
}

/** line-of-sight: true if segment a->b (both eye height) is unobstructed */
export function lineOfSight(coll, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (t < 0.01) return true;
  return !raycast(coll, ax, ay, az, dx / t, dy / t, dz / t, t);
}

// ---------------- movement queries ----------------

/**
 * move a circle of radius r by (dx, dz) on the XZ plane, resolving against
 * colliders. Returns {x, z, hit} — hit if blocked by a vertical face.
 */
export function moveCircle(coll, x, z, dx, dz, r, y = 1.0, yTop = 1.8) {
  let hit = false;
  const resolve = (px, pz) => {
    for (const b of coll.boxes) {
      if (px + r < b.min[0] || px - r > b.max[0] || pz + r < b.min[2] || pz - r > b.max[2]) continue;
      // box vertically spans the body?
      if (b.max[1] <= y - 0.05 || b.min[1] >= yTop + 0.05) continue;
      // push out along the axis of least penetration
      const penL = px + r - b.min[0];
      const penR = b.max[0] - (px - r);
      const penT = pz + r - b.min[2];
      const penB = b.max[2] - (pz - r);
      const m = Math.min(penL, penR, penT, penB);
      if (m < 0) continue;
      hit = true;
      if (m === penL) return [b.min[0] - r, pz];
      if (m === penR) return [b.max[0] + r, pz];
      if (m === penT) return [px, b.min[2] - r];
      return [px, b.max[2] + r];
    }
    for (const c of coll.cyls) {
      if (c.y1 <= y - 0.05 || c.y0 >= yTop + 0.05) continue;
      const dx2 = px - c.x, dz2 = pz - c.z;
      const d = Math.hypot(dx2, dz2);
      const minD = c.r + r;
      if (d < minD && d > 1e-6) {
        hit = true;
        return [c.x + (dx2 / d) * minD, c.z + (dz2 / d) * minD];
      } else if (d <= 1e-6) {
        hit = true;
        return [c.x + minD, c.z];
      }
    }
    return [px, pz];
  };

  // axis-separated for stable sliding
  let nx = x + dx;
  const r1 = resolve(nx, z);
  nx = r1[0];
  if (r1[1] !== z) { z = r1[1]; }
  const r2 = resolve(nx, z + dz);
  z = r2[1];
  nx = r2[0];
  if (r2[1] !== z + dz) { /* blocked on z axis */ }
  // second pass for corner stability
  const r3 = resolve(nx, z);
  return { x: r3[0], z: r3[1], hit };
}

/**
 * highest platform top under (x,z) that is at most `step` above feetY, else 0.
 */
export function groundHeight(coll, x, z, feetY, step = 0.55) {
  let g = 0;
  for (const b of coll.boxes) {
    if (x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2]) continue;
    const top = b.max[1];
    if (top <= feetY + step && top > g) g = top;
  }
  return g;
}

/** is point (x,y,z) inside any solid? (spawn validation) */
export function pointInSolid(coll, x, y, z, pad = 0.1) {
  for (const b of coll.boxes) {
    if (x > b.min[0] - pad && x < b.max[0] + pad && y > b.min[1] - pad && y < b.max[1] + pad && z > b.min[2] - pad && z < b.max[2] + pad) return true;
  }
  for (const c of coll.cyls) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + pad && y > c.y0 && y < c.y1) return true;
  }
  return false;
}
