// ============================================================
// Kharan Crossing — hand-designed village map (128 x 128 m)
// All colliders match visual geometry exactly (same primitives).
// ============================================================
import * as THREE from 'three';
import { mulberry32, rand } from '../core/math.js';
import { makeGroundTexture } from './materials.js';
import { Colliders } from './colliders.js';

const H = 3.0;      // house wall height
const WT = 0.35;    // wall thickness

// ------------------------------------------------------------
// house builder: solid walls with door/window openings
// ------------------------------------------------------------
function buildHouse(group, coll, mats, spec) {
  const { x, z, w, d, rot = 0, name = 'house' } = spec;
  // local: X along width, Z along depth; then rotate 0/90/180/270
  const doors = spec.doors || [{ side: 's', t: 0, w: 1.1, y0: 0, y1: 2.1 }];
  const wins = spec.windows || [];
  const segs = []; // {side, t0, t1, y0, y1}

  function addSide(side, L, openings) {
    const sorted = openings.slice().sort((a, b) => a.t - b.t);
    let prev = -L / 2;
    for (const o of sorted) {
      const a = o.t - o.w / 2, b = o.t + o.w / 2;
      if (a > prev + 0.05) segs.push({ side, t0: prev, t1: a, y0: 0, y1: H });
      if (o.y0 > 0.02) segs.push({ side, t0: a, t1: b, y0: 0, y1: o.y0 });
      if (o.y1 < H - 0.02) segs.push({ side, t0: a, t1: b, y0: o.y1, y1: H });
      prev = b;
    }
    if (prev < L / 2 - 0.05) segs.push({ side, t0: prev, t1: L / 2, y0: 0, y1: H });
  }
  addSide('s', w, doors.filter((o) => o.side === 's').concat(wins.filter((o) => o.side === 's')));
  addSide('n', w, doors.filter((o) => o.side === 'n').concat(wins.filter((o) => o.side === 'n')));
  addSide('e', d, doors.filter((o) => o.side === 'e').concat(wins.filter((o) => o.side === 'e')));
  addSide('w', d, doors.filter((o) => o.side === 'w').concat(wins.filter((o) => o.side === 'w')));

  const cos = Math.cos(rot), sin = Math.sin(rot);
  const place = (lx, lz, sx, sz) => {
    const wx = x + lx * cos - lz * sin;
    const wz = z + lx * sin + lz * cos;
    return [wx, wz, sx, sz];
  };

  const wallMats = [mats.stucco, mats.stuccoDark];
  for (const s of segs) {
    const len = s.t1 - s.t0;
    if (len < 0.06) continue;
    const mid = (s.t0 + s.t1) / 2;
    const hgt = s.y1 - s.y0;
    const ymid = (s.y0 + s.y1) / 2;
    let wx, wz, sx, sz;
    if (s.side === 's' || s.side === 'n') {
      const lz = s.side === 's' ? d / 2 - WT / 2 : -d / 2 + WT / 2;
      [wx, wz, sx, sz] = place(mid, lz, len, WT);
    } else {
      const lx = s.side === 'e' ? w / 2 - WT / 2 : -w / 2 + WT / 2;
      [wx, wz, sx, sz] = place(lx, mid, WT, len);
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, hgt, sz), wallMats[(wx * 13 + wz * 7) % 2 < 1 ? 0 : 1]);
    m.position.set(wx, ymid, wz);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    coll.addCenter(wx, ymid, wz, sx, hgt, sz);
  }

  // roof slab
  {
    const rotated = rot === Math.PI / 2 || rot === -Math.PI / 2;
    const sw = rotated ? d + 0.55 : w + 0.55;
    const sd = rotated ? w + 0.55 : d + 0.55;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.24, sd), mats.roof);
    roof.position.set(x, H + 0.12, z);
    roof.castShadow = roof.receiveShadow = true;
    group.add(roof);
    coll.addCenter(x, H + 0.12, z, sw, 0.24, sd);
  }

  // interior furniture: crates + barrels
  const rng = mulberry32((x * 1000 + z) | 0);
  const nCrates = 1 + (rng() * 2 | 0);
  for (let i = 0; i < nCrates; i++) {
    const lx = (rng() - 0.5) * (w - 2.6);
    const lz = (rng() - 0.5) * (d - 2.6);
    const [wx, wz] = place(lx, lz, 1, 1);
    const s = 0.9 + rng() * 0.3;
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mats.wood);
    c.position.set(wx, s / 2, wz);
    c.rotation.y = rng() * 0.6;
    c.castShadow = c.receiveShadow = true;
    group.add(c);
    coll.addCenter(wx, s / 2, wz, s, s, s);
  }
  if (rng() < 0.6) {
    const lx = (rng() - 0.5) * (w - 2);
    const lz = (rng() - 0.5) * (d - 2);
    const [wx, wz] = place(lx, lz, 1, 1);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.95, 10), mats.barrel);
    b.position.set(wx, 0.48, wz);
    b.castShadow = true;
    group.add(b);
    coll.addCyl(wx, wz, 0.27, 0, 0.95);
  }
  return { x, z, w, d };
}

// ------------------------------------------------------------
// trees / rocks
// ------------------------------------------------------------
function buildTree(group, coll, mats, x, z, variant, rng) {
  const s = 0.85 + rng() * 0.45;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const rotY = rng() * Math.PI * 2;
  g.rotation.y = rotY;
  if (variant === 0) {
    // pine
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.18 * s, 2.3 * s, 7), mats.trunk);
    trunk.position.y = 1.1 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const coneM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x33502e).offsetHSL(0, 0, (rng() - 0.5) * 0.08), roughness: 0.95, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const r = (1.5 - i * 0.38) * s, h = 1.7 * s;
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), coneM);
      c.position.y = (2.1 + i * 0.95) * s;
      c.castShadow = true;
      g.add(c);
    }
  } else if (variant === 1) {
    // oak
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 2.4 * s, 8), mats.trunk);
    trunk.position.y = 1.2 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const leafM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x4c6b39).offsetHSL(0, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1), roughness: 0.95, flatShading: true });
    for (let i = 0; i < 3; i++) {
      const r = (1.15 + rng() * 0.5) * s;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafM);
      const a = rng() * Math.PI * 2;
      blob.position.set(Math.cos(a) * 0.8 * s, (2.9 + rng() * 0.7) * s, Math.sin(a) * 0.8 * s);
      blob.castShadow = true;
      g.add(blob);
    }
    // canopy also blocks sight/shots (dense foliage)
    coll.addCyl(x, z, 1.5 * s, 2.3 * s, 4.3 * s);
  } else {
    // poplar
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 3.2 * s, 7), mats.trunk);
    trunk.position.y = 1.6 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const leafM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x5c7a42).offsetHSL(0, 0, (rng() - 0.5) * 0.1), roughness: 0.95, flatShading: true });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.95 * s, 7, 6), leafM);
    top.scale.set(1, 1.9, 1);
    top.position.y = 4.1 * s;
    top.castShadow = true;
    g.add(top);
    coll.addCyl(x, z, 0.9 * s, 3.1 * s, 5.1 * s);
  }
  g.scale.setScalar(variant === 0 ? 1 : s / 0.85 * 0.9 + 0.1);
  group.add(g);
  coll.addCyl(x, z, 0.3 * s, 0, 2.6 * s);
}

function buildRock(group, coll, mats, x, z, r, rng) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const j = 1 + (rng() - 0.5) * 0.35;
    pos.setXYZ(i, pos.getX(i) * j, pos.getY(i) * j * 0.72, pos.getZ(i) * j);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats.rock);
  m.position.set(x, r * 0.42, z);
  m.rotation.y = rng() * Math.PI * 2;
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  coll.addCyl(x, z, r * 0.82, 0, r * 1.05);
}

// ------------------------------------------------------------
// map
// ------------------------------------------------------------
export function buildMap(scene, mats) {
  const group = new THREE.Group();
  const coll = new Colliders();
  const rng = mulberry32(20260827);

  // ---- ground + roads ----
  const roads = [
    { dir: 'h', a: -7, b: 7, type: 'asphalt' },
    { dir: 'v', a: -7, b: 7, type: 'asphalt' },
    { dir: 'h', a: 30, b: 36, type: 'dirt' },
    { dir: 'v', a: -40, b: -35, type: 'dirt' },
  ];
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(128, 128),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(roads), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- perimeter walls ----
  for (const [min, max, sx, sz] of [
    [[-64, 0, 62.4], [64, 2.4, 63.2], 128.8, 0.8],
    [[-64, 0, -63.2], [64, 2.4, -62.4], 128.8, 0.8],
    [[62.4, 0, -64], [63.2, 2.4, 64], 0.8, 128.8],
    [[-63.2, 0, -64], [-62.4, 2.4, 64], 0.8, 128.8],
  ]) {
    const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 2.4, sz), mats.stone);
    m.position.set(cx, 1.2, cz);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    coll.addBox(min, max);
  }

  // ---- houses ----
  const houses = [
    { x: -30, z: -14, w: 10, d: 7, rot: 0, doors: [{ side: 's', t: 1.5, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 's', t: -2.5, w: 1.2, y0: 1.0, y1: 2.0 }, { side: 'e', t: 0, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: -40, z: 6, w: 8, d: 6, rot: 0, doors: [{ side: 's', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 'w', t: 0, w: 1.1, y0: 1.0, y1: 2.0 }] },
    { x: -22, z: 26, w: 12, d: 7, rot: 0, doors: [{ side: 's', t: 0, w: 1.2, y0: 0, y1: 2.1 }, { side: 'n', t: 3, w: 1.0, y0: 0, y1: 2.0 }], windows: [{ side: 's', t: -3.5, w: 1.2, y0: 1.0, y1: 2.0 }, { side: 's', t: 3.5, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: 28, z: -20, w: 10, d: 7, rot: 0, doors: [{ side: 's', t: -1.5, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 's', t: 2.5, w: 1.2, y0: 1.0, y1: 2.0 }, { side: 'w', t: 0, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: 40, z: 8, w: 8, d: 6, rot: 0, doors: [{ side: 'w', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 'e', t: 0, w: 1.1, y0: 1.0, y1: 2.0 }] },
    { x: 26, z: 26, w: 12, d: 7, rot: 0, doors: [{ side: 's', t: -2, w: 1.2, y0: 0, y1: 2.1 }], windows: [{ side: 's', t: 3, w: 1.2, y0: 1.0, y1: 2.0 }, { side: 'e', t: 0, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: -10, z: 44, w: 8, d: 6, rot: 0, doors: [{ side: 'n', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 's', t: 0, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: 13, z: 46, w: 8, d: 6, rot: Math.PI / 2, doors: [{ side: 'n', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 'e', t: 0, w: 1.1, y0: 1.0, y1: 2.0 }] },
    { x: -32, z: -44, w: 10, d: 7, rot: 0, doors: [{ side: 's', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 'w', t: 0, w: 1.2, y0: 1.0, y1: 2.0 }] },
    { x: 22, z: -46, w: 8, d: 6, rot: 0, doors: [{ side: 's', t: 0, w: 1.1, y0: 0, y1: 2.1 }], windows: [{ side: 'e', t: 0, w: 1.1, y0: 1.0, y1: 2.0 }] },
    { x: 46, z: -42, w: 12, d: 10, rot: 0, doors: [{ side: 'w', t: 0, w: 1.4, y0: 0, y1: 2.3 }], windows: [{ side: 'n', t: -3, w: 1.4, y0: 1.0, y1: 2.0 }, { side: 'n', t: 3, w: 1.4, y0: 1.0, y1: 2.0 }] },
  ];
  for (const h of houses) buildHouse(group, coll, mats, h);

  // ---- market stalls (open front) ----
  for (const [sx, sz, rot] of [[-14, 2, 0], [-14, 10, 0], [6, 32, Math.PI]]) {
    const g = new THREE.Group();
    g.position.set(sx, 0, sz);
    g.rotation.y = rot;
    const post = (px, pz) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.16), mats.woodDark);
      p.position.set(px, 1.25, pz);
      p.castShadow = true;
      g.add(p);
      coll.addCenter(sx + px, 1.25, sz + pz, 0.16, 2.5, 0.16);
    };
    post(-2.2, -1.2); post(2.2, -1.2); post(-2.2, 1.2); post(2.2, 1.2);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.8), mats.wood);
    counter.position.set(0, 0.45, 0.2);
    counter.castShadow = counter.receiveShadow = true;
    g.add(counter);
    // world-space counter collider (rotated)
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const cxw = sx + (0 * cosR - 0.2 * sinR), czw = sz + (0 * sinR + 0.2 * cosR);
    coll.addCenter(cxw, 0.45, czw, rot === 0 ? 3.4 : 0.8, 0.9, rot === 0 ? 0.8 : 3.4);
    const roofS = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 3.0), mats.roof);
    roofS.position.set(0, 2.56, 0);
    roofS.castShadow = true;
    g.add(roofS);
    coll.addCenter(sx, 2.56, sz, rot === 0 ? 4.6 : 3.0, 0.12, rot === 0 ? 3.0 : 4.6);
    group.add(g);
  }

  // ---- watchtower (climbable, 2.6 m platform) ----
  {
    const tx = 4, tz = -26, hw = 2.1;
    const platY = 2.4;
    for (const [px, pz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, platY + 0.4, 0.26), mats.woodDark);
      post.position.set(tx + px, (platY + 0.4) / 2, tz + pz);
      post.castShadow = true;
      group.add(post);
      coll.addCenter(tx + px, (platY + 0.4) / 2, tz + pz, 0.26, platY + 0.4, 0.26);
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.4, 0.18, hw * 2 + 0.4), mats.wood);
    floor.position.set(tx, platY + 0.09, tz);
    floor.castShadow = floor.receiveShadow = true;
    group.add(floor);
    coll.addCenter(tx, platY + 0.09, tz, hw * 2 + 0.4, 0.18, hw * 2 + 0.4, { platform: true });
    // railings (non-colliding, thin)
    const railH = 0.9;
    for (const [rx, rz, sx, sz] of [[0, -hw, hw * 2, 0.08], [0, hw, hw * 2, 0.08], [-hw, 0, 0.08, hw * 2], [hw, 0, 0.08, hw * 2]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(sx, railH, sz), mats.woodDark);
      r.position.set(tx + rx, platY + 0.18 + railH / 2, tz + rz);
      group.add(r);
    }
    // stairs (5 steps) on the +z side
    for (let i = 0; i < 5; i++) {
      const stepH = (platY + 0.18) / 5;
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.4, stepH * (i + 1), 0.55), mats.wood);
      st.position.set(tx, stepH * (i + 1) / 2, tz + hw + 0.28 + (4 - i) * 0.55);
      st.castShadow = st.receiveShadow = true;
      group.add(st);
      coll.addCenter(tx, stepH * (i + 1) / 2, tz + hw + 0.28 + (4 - i) * 0.55, 1.4, stepH * (i + 1), 0.55, { platform: true });
    }
  }

  // ---- water tower (north-west) ----
  {
    const wx = -46, wz = -28;
    for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.6, 8), mats.metal);
      leg.position.set(wx + lx, 2.3, wz + lz);
      leg.castShadow = true;
      group.add(leg);
      coll.addCyl(wx + lx, wz + lz, 0.16, 0, 4.6);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.5, 14), mats.barrel);
    tank.position.set(wx, 5.35, wz);
    tank.castShadow = true;
    group.add(tank);
    coll.addCyl(wx, wz, 1.7, 4.6, 6.1);
    // small vantage platform at 2.2
    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.2), mats.metal);
    plat.position.set(wx + 2.2, 2.2, wz);
    plat.castShadow = true;
    group.add(plat);
    coll.addCenter(wx + 2.2, 2.2, wz, 1.2, 0.14, 1.2, { platform: true });
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55 * (i + 1), 0.5), mats.metal);
      st.position.set(wx + 2.2, 0.55 * (i + 1) / 2, wz + 1.1 + (3 - i) * 0.5);
      group.add(st);
      coll.addCenter(wx + 2.2, 0.55 * (i + 1) / 2, wz + 1.1 + (3 - i) * 0.5, 0.8, 0.55 * (i + 1), 0.5, { platform: true });
    }
  }

  // ---- sandbag lines (central cover) ----
  const sandbags = [
    { x: 12, z: 14, len: 4.4, rot: 0 },
    { x: -16, z: -10, len: 4.0, rot: Math.PI / 2 },
    { x: 20, z: -4, len: 3.6, rot: Math.PI / 2 },
    { x: -4, z: 20, len: 4.2, rot: Math.PI / 2 },
    { x: 34, z: 34, len: 4.0, rot: 0 },
    { x: -34, z: -2, len: 4.0, rot: Math.PI / 2 },
  ];
  for (const s of sandbags) {
    const sx = s.rot === 0 ? s.len : 0.7, sz = s.rot === 0 ? 0.7 : s.len;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.95, sz), mats.sandbag);
    m.position.set(s.x, 0.48, s.z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    coll.addCenter(s.x, 0.48, s.z, sx, 0.95, sz);
  }

  // ---- rocks ----
  const rockSpots = [
    [-8, -24, 1.6], [8, 38, 1.3], [-46, 22, 1.9], [44, -12, 1.5], [-18, -38, 1.4],
    [38, 16, 1.2], [-52, -48, 2.0], [52, 44, 1.7], [-28, 12, 1.1], [48, -50, 1.4],
    [2, 14, 0.9], [-44, 44, 1.5],
  ];
  for (const [x, z, r] of rockSpots) buildRock(group, coll, mats, x, z, r * (0.85 + rng() * 0.3), rng);

  // ---- trees ----
  const treeSpots = [
    [-56, -10, 0], [-58, 14, 1], [-52, 36, 2], [-56, 52, 0], [-36, 56, 1],
    [-12, 56, 2], [16, 56, 0], [36, 54, 1], [54, 48, 0], [58, 26, 1],
    [56, 4, 0], [58, -20, 2], [54, -38, 0], [40, -54, 1], [8, -56, 0],
    [-16, -54, 1], [-34, -56, 2], [56, -52, 0], [-8, 34, 0], [16, -34, 1],
  ];
  for (const [x, z, v] of treeSpots) buildTree(group, coll, mats, x, z, v, rng);

  // ---- scattered crates & barrels near roads ----
  for (const [x, z] of [[-24, -6], [26, 6], [-6, -30], [10, 42], [-40, -20], [44, 20], [-10, 8], [30, -34]]) {
    const n = 1 + (rng() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const px = x + (rng() - 0.5) * 2.4, pz = z + (rng() - 0.5) * 2.4;
      if (rng() < 0.6) {
        const s = 0.7 + rng() * 0.4;
        const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mats.wood);
        c.position.set(px, s / 2, pz);
        c.rotation.y = rng() * 0.8;
        c.castShadow = c.receiveShadow = true;
        group.add(c);
        coll.addCenter(px, s / 2, pz, s, s, s);
      } else {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.95, 10), mats.barrel);
        b.position.set(px, 0.48, pz);
        b.castShadow = true;
        group.add(b);
        coll.addCyl(px, pz, 0.27, 0, 0.95);
      }
    }
  }

  scene.add(group);

  // ---- spawns (facing the map center) ----
  // forward(yaw) = (-sin yaw, -cos yaw): yaw 0 → -z ; yaw π → +z
  const spawns = {
    a: [
      { x: -18, z: 56, yaw: 0 },
      { x: -6, z: 58, yaw: 0 },
      { x: 6, z: 58, yaw: 0 },
      { x: 18, z: 56, yaw: 0 },
    ],
    b: [
      { x: -18, z: -56, yaw: Math.PI },
      { x: -6, z: -58, yaw: Math.PI },
      { x: 6, z: -58, yaw: Math.PI },
      { x: 18, z: -56, yaw: Math.PI },
    ],
  };

  // ---- cover points (for AI) ----
  const coverPoints = [];
  const addCover = (x, z, nx, nz) => {
    const px = x + nx * 1.15, pz = z + nz * 1.15;
    if (Math.abs(px) > 61 || Math.abs(pz) > 61) return;
    coverPoints.push({ x: px, z: pz });
  };
  for (const b of coll.boxes) {
    if (b.max[1] - b.min[1] < 1.1) continue;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const ex = (b.max[0] - b.min[0]) / 2, ez = (b.max[2] - b.min[2]) / 2;
    if (ex > ez) {
      for (const f of [-1, 1]) {
        for (const t of [-ex * 0.6, ex * 0.6]) {
          addCover(cx + t, cz + f * (ez + 0.02), 0, f);
        }
      }
    } else {
      for (const f of [-1, 1]) {
        for (const t of [-ez * 0.6, ez * 0.6]) {
          addCover(cx + f * (ex + 0.02), cz + t, f, 0);
        }
      }
    }
  }
  for (const c of coll.cyls) {
    if (c.r < 0.6) continue;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      addCover(c.x + Math.cos(a) * c.r * 0.4, c.z + Math.sin(a) * c.r * 0.4, Math.cos(a), Math.sin(a));
    }
  }
  // dedupe + cap
  const seen = new Set();
  const covers = coverPoints.filter((p) => {
    const k = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 420);

  // ---- nav grid ----
  const nav = buildNavGrid(coll, 128, 1.3);

  // ---- grass spots (instanced by world) ----
  const grassSpots = [];
  for (let i = 0; i < 1500; i++) {
    const x = (rng() - 0.5) * 124;
    const z = (rng() - 0.5) * 124;
    const s = 0.5 + rng() * 0.8;
    const tint = rng();
    grassSpots.push({ x, z, s, tint, r: rng() * Math.PI });
  }

  return { coll, spawns, coverPoints: covers, nav, grassSpots, group };
}

// ------------------------------------------------------------
// nav grid + A*
// ------------------------------------------------------------
function buildNavGrid(coll, size, cell) {
  const n = Math.floor(size / cell);
  const half = size / 2 - cell / 2;
  const grid = new Uint8Array(n * n); // 1 = free
  const x0 = -size / 2 + cell / 2;
  for (let gz = 0; gz < n; gz++) {
    for (let gx = 0; gx < n; gx++) {
      const wx = x0 + gx * cell;
      const wz = x0 + gz * cell;
      let blocked = false;
      for (const b of coll.boxes) {
        if (wx > b.min[0] - 0.32 && wx < b.max[0] + 0.32 && wz > b.min[2] - 0.32 && wz < b.max[2] + 0.32 && b.max[1] > 0.6) { blocked = true; break; }
      }
      if (!blocked) for (const c of coll.cyls) {
        const d = Math.hypot(wx - c.x, wz - c.z);
        if (d < c.r + 0.32 && c.y1 > 0.6) { blocked = true; break; }
      }
      grid[gz * n + gx] = blocked ? 0 : 1;
    }
  }
  return { n, cell, x0, grid };
}

function navFind(nav, sx, sz, tx, tz) {
  const { n, cell, x0, grid } = nav;
  const toCell = (wx, wz) => {
    let gx = Math.floor((wx - x0) / cell), gz = Math.floor((wz - x0) / cell);
    gx = Math.max(0, Math.min(n - 1, gx));
    gz = Math.max(0, Math.min(n - 1, gz));
    return [gx, gz];
  };
  let [sgx, sgz] = toCell(sx, sz);
  let [tgx, tgz] = toCell(tx, tz);
  if (!grid[sgz * n + sgx]) { // find nearest free
    outer: for (let r = 1; r < 6; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const gx = sgx + dx, gz = sgz + dz;
        if (gx >= 0 && gz >= 0 && gx < n && gz < n && grid[gz * n + gx]) { sgx = gx; sgz = gz; break outer; }
      }
    }
  }
  if (!grid[tgz * n + tgx]) {
    outer: for (let r = 1; r < 8; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const gx = tgx + dx, gz = tgz + dz;
        if (gx >= 0 && gz >= 0 && gx < n && gz < n && grid[gz * n + gx]) { tgx = gx; tgz = gz; break outer; }
      }
    }
  }
  if (grid[sgz * n + sgx] === 0 || grid[tgz * n + tgx] === 0) return null;
  if (sgx === tgx && sgz === tgz) return null;

  const start = sgz * n + sgx, target = tgz * n + tgx;
  const g = new Float32Array(n * n).fill(Infinity);
  const from = new Int32Array(n * n).fill(-1);
  g[start] = 0;
  const open = [start];
  const inOpen = new Uint8Array(n * n);
  inOpen[start] = 1;
  const h = (i) => {
    const gx = i % n, gz = (i / n) | 0;
    return Math.hypot(gx - tgx, gz - tgz);
  };
  let iter = 0;
  while (open.length && iter++ < 9000) {
    // pop min f (linear scan — grid is small enough at these budgets)
    let bi = 0, bf = Infinity;
    for (let i = 0; i < open.length; i++) {
      const f = g[open[i]] + h(open[i]);
      if (f < bf) { bf = f; bi = i; }
    }
    const cur = open[bi];
    open.splice(bi, 1);
    inOpen[cur] = 0;
    if (cur === target) break;
    const cgx = cur % n, cgz = (cur / n) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx2 = cgx + dx, nz2 = cgz + dz;
      if (nx2 < 0 || nz2 < 0 || nx2 >= n || nz2 >= n) continue;
      const ni = nz2 * n + nx2;
      if (!grid[ni]) continue;
      if (dx && dz && (!grid[cgz * n + nx2] || !grid[nz2 * n + cgx])) continue; // no corner cutting
      const cost = g[cur] + (dx && dz ? 1.414 : 1);
      if (cost < g[ni]) {
        g[ni] = cost;
        from[ni] = cur;
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }
  if (from[target] === -1 && target !== start) return null;
  const path = [];
  let cur = target;
  while (cur !== start && cur !== -1) {
    const gx = cur % n, gz = (cur / n) | 0;
    path.push({ x: x0 + (gx + 0.5) * cell, z: x0 + (gz + 0.5) * cell });
    cur = from[cur];
    if (path.length > 400) return null;
  }
  path.reverse();
  return path;
}

export { navFind, buildNavGrid };
