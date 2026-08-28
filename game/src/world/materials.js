// procedural PBR materials + canvas textures (no external assets)
import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

export function hasCanvas() {
  return typeof document !== 'undefined' && !!document.createElement;
}

// minimal texture for headless (node test) environments
function blankTexture() {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

let _noiseTex = null;
function noiseCanvas(size, base, variance, rng) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * variance;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function makeNoiseTexture(size = 256) {
  if (_noiseTex) return _noiseTex;
  if (!hasCanvas()) return null;
  const rng = mulberry32(1234);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + rng() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _noiseTex = new THREE.CanvasTexture(c);
  _noiseTex.wrapS = _noiseTex.wrapT = THREE.RepeatWrapping;
  return _noiseTex;
}

function canvasTex(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

export function makeMaterials() {
  if (!hasCanvas()) {
    const M = (o) => new THREE.MeshStandardMaterial(o);
    const C = (c) => M({ color: c, roughness: 0.85 });
    return {
      stucco: C(0xb3a68c), stuccoDark: C(0x9a8d74), wood: C(0x6e4a2a),
      woodDark: C(0x55391f), roof: C(0x59606a), sandbag: C(0x8d7c58),
      stone: C(0x8b8781), rock: C(0x7d7872), metal: C(0x4a4e52),
      metalDark: C(0x2e3134), leaf: C(0x4a6a38), trunk: C(0x5a4630),
      barrel: C(0x5f6a52), dirt: C(0x8a7a5c),
      wMetal: M({ color: 0x767d84, metalness: 0.7, roughness: 0.42 }),
      wMetalDark: M({ color: 0x43484e, metalness: 0.85, roughness: 0.45 }),
      wWood: M({ color: 0xd9a86e, roughness: 0.55 }),
      wPolymer: M({ color: 0x3a3e44, roughness: 0.6 }),
      wSlide: M({ color: 0x5a6068, metalness: 0.85, roughness: 0.28 }),
      glove: C(0x5c6448), gloveTrim: C(0x3a4030), skin: C(0xd8a880), sleeve: C(0x666650),
      flash: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      tracer: new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }
  const rng = mulberry32(777);
  const noise = makeNoiseTexture();

  const stuccoC = noiseCanvas(256, '#b3a68c', 42, rng);
  const stucco = canvasTex(stuccoC, { repeat: [2, 2] });
  const woodC = noiseCanvas(256, '#9a6a38', 36, rng);
  // wood grain streaks
  {
    const g = woodC.getContext('2d');
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(40,24,12,${0.06 + rng() * 0.1})`;
      g.lineWidth = 1 + rng() * 2;
      const y = rng() * 256;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(64, y + (rng() - 0.5) * 10, 192, y + (rng() - 0.5) * 10, 256, y);
      g.stroke();
    }
  }
  const wood = canvasTex(woodC, { repeat: [1, 1] });
  const roofC = noiseCanvas(256, '#59606a', 30, rng);
  {
    const g = roofC.getContext('2d');
    g.strokeStyle = 'rgba(20,24,28,0.5)';
    for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  }
  const roofTex = canvasTex(roofC, { repeat: [3, 2] });
  const sandbagC = noiseCanvas(256, '#8d7c58', 52, rng);
  const sandbagTex = canvasTex(sandbagC, { repeat: [2, 1] });
  const stoneC = noiseCanvas(256, '#8b8781', 48, rng);
  const stoneTex = canvasTex(stoneC, { repeat: [2, 2] });
  const rockC = noiseCanvas(256, '#7d7872', 56, rng);
  const rockTex = canvasTex(rockC);
  const metalC = noiseCanvas(256, '#8a9098', 20, rng);
  const metalTex = canvasTex(metalC);
  const leafC = noiseCanvas(256, '#4a6a38', 44, rng);
  const leafTex = canvasTex(leafC);
  const trunkC = noiseCanvas(256, '#5a4630', 40, rng);
  const trunkTex = canvasTex(trunkC);
  const barrelC = noiseCanvas(256, '#5f6a52', 30, rng);
  const barrelTex = canvasTex(barrelC);
  const dirtC = noiseCanvas(256, '#8a7a5c', 40, rng);
  const dirtTex = canvasTex(dirtC, { repeat: [8, 8] });

  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mats = {
    stucco: M({ map: stucco, roughness: 0.92, bumpMap: noise, bumpScale: 0.6 }),
    stuccoDark: M({ map: stucco, color: 0x9a8d74, roughness: 0.94 }),
    wood: M({ map: wood, roughness: 0.8 }),
    woodDark: M({ map: wood, color: 0x8a6a48, roughness: 0.85 }),
    roof: M({ map: roofTex, roughness: 0.88, metalness: 0.05 }),
    sandbag: M({ map: sandbagTex, roughness: 0.95 }),
    stone: M({ map: stoneTex, roughness: 0.9 }),
    rock: M({ map: rockTex, roughness: 0.95, flatShading: true }),
    metal: M({ map: metalTex, metalness: 0.85, roughness: 0.5 }),
    metalDark: M({ color: 0x2e3134, metalness: 0.9, roughness: 0.42, map: metalTex }),
    leaf: M({ map: leafTex, roughness: 0.9, color: 0x9fb08a }),
    trunk: M({ map: trunkTex, roughness: 0.95 }),
    barrel: M({ map: barrelTex, roughness: 0.8, metalness: 0.2 }),
    dirt: M({ map: dirtTex, roughness: 1 }),
    // weapon
    wMetal: M({ color: 0x9aa0a8, metalness: 0.7, roughness: 0.4, map: metalTex }),
    wMetalDark: M({ color: 0x4a5058, metalness: 0.85, roughness: 0.45 }),
    wWood: M({ map: wood, roughness: 0.55, color: 0xffe3c2 }),
    wPolymer: M({ color: 0x3a3e44, metalness: 0.15, roughness: 0.6 }),
    wSlide: M({ color: 0x6a727c, metalness: 0.85, roughness: 0.28 }),
    glove: M({ color: 0x5c6448, roughness: 0.95 }),
    gloveTrim: M({ color: 0x3a4030, roughness: 0.9 }),
    skin: M({ color: 0xd8a880, roughness: 0.7 }),
    sleeve: M({ color: 0x666650, roughness: 0.92 }),
    // fx
    flash: new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    tracer: new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return mats;
}

// ground texture with baked-in roads (1024px for 128m => 8 px/m)
export function makeGroundTexture(roads) {
  if (!hasCanvas()) return null;
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rng = mulberry32(4242);
  // dirt base
  g.fillStyle = '#a3906c';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 46;
    d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  // mottled patches
  for (let i = 0; i < 420; i++) {
    const x = rng() * size, y = rng() * size, r = 4 + rng() * 26;
    g.fillStyle = `rgba(${60 + rng() * 60 | 0},${55 + rng() * 50 | 0},${40 + rng() * 36 | 0},${0.05 + rng() * 0.08})`;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // roads (world -64..64 -> 0..1024, 8px/m; y flipped: world z -64 -> 0? canvas y grows down; keep mapping: px=(x+64)*8, py=(z+64)*8)
  const P = (v) => (v + 64) * (size / 128);
  for (const r of roads) {
    g.fillStyle = r.type === 'asphalt' ? '#43464a' : '#6d6250';
    if (r.dir === 'h') {
      g.fillRect(0, P(r.a), size, P(r.b) - P(r.a));
    } else {
      g.fillRect(P(r.a), 0, P(r.b) - P(r.a), size);
    }
    // wear
    const img2 = g.getImageData(0, 0, size, size);
    const d2 = img2.data;
    for (let i = 0; i < d2.length; i += 8) {
      const n = (rng() - 0.5) * 26;
      d2[i] += n; d2[i + 1] += n; d2[i + 2] += n;
    }
    g.putImageData(img2, 0, 0);
  }
  // edge lines (faint)
  g.strokeStyle = 'rgba(220,210,180,0.14)';
  g.lineWidth = 2;
  for (const r of roads.filter((r) => r.type === 'asphalt')) {
    if (r.dir === 'h') {
      g.beginPath(); g.moveTo(0, P(r.a) + 4); g.lineTo(size, P(r.a) + 4); g.stroke();
      g.beginPath(); g.moveTo(0, P(r.b) - 4); g.lineTo(size, P(r.b) - 4); g.stroke();
    } else {
      g.beginPath(); g.moveTo(P(r.a) + 4, 0); g.lineTo(P(r.a) + 4, size); g.stroke();
      g.beginPath(); g.moveTo(P(r.b) - 4, 0); g.lineTo(P(r.b) - 4, size); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeSkyTexture() {
  if (!hasCanvas()) return new THREE.Color(0x9fb6c8);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#6f8fb4');
  gr.addColorStop(0.45, '#9db4c6');
  gr.addColorStop(0.72, '#d3c4a4');
  gr.addColorStop(1, '#c8b48e');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// radial sprite textures for particles
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  if (!hasCanvas()) return blankTexture();
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function makeFlashTexture() {
  if (!hasCanvas()) return blankTexture();
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rng = mulberry32(99);
  g.translate(64, 64);
  // star spikes
  g.fillStyle = 'rgba(255,220,150,0.95)';
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const len = 26 + rng() * 46;
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -3);
    g.lineTo(len, 0);
    g.lineTo(0, 3);
    g.closePath();
    g.fill();
    g.restore();
  }
  const gr = g.createRadialGradient(0, 0, 2, 0, 0, 34);
  gr.addColorStop(0, 'rgba(255,255,235,1)');
  gr.addColorStop(0.4, 'rgba(255,190,90,0.85)');
  gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
