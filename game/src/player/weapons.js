// ============================================================
// Weapon system: ammo, fire cadence, recoil camera model,
// ADS, spread, hitscan with world + entity intersection.
// ============================================================
import * as THREE from 'three';
import { clamp, damp, rand } from '../core/math.js';
import { raycast } from '../world/colliders.js';

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    const W = game.CFG.weapons;
    this.defs = W;
    this.current = 'ak';
    this.ammo = {
      ak: { mag: W.ak.magSize, reserve: W.ak.reserve },
      pistol: { mag: W.pistol.magSize, reserve: W.pistol.reserve },
    };
    this.fireCd = 0;
    this.shotIndex = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.switching = false;
    this.switchT = 0;
    this.fireHeld = false;
    this.semiArmed = false;
    // camera recoil spring state (applied ON TOP of view angles)
    this.rec = { p: 0, y: 0, vp: 0, vy: 0 };
    this.ads = false;
    this.adsBlend = 0;
    this.fov = game.CFG.player.fovHip;
  }

  reset() {
    const W = this.defs;
    this.current = 'ak';
    this.ammo.ak = { mag: W.ak.magSize, reserve: W.ak.reserve };
    this.ammo.pistol = { mag: W.pistol.magSize, reserve: W.pistol.reserve };
    this.fireCd = 0; this.shotIndex = 0;
    this.reloading = false; this.reloadT = 0;
    this.switching = false; this.switchT = 1;
    this.rec = { p: 0, y: 0, vp: 0, vy: 0 };
    this.fov = this.game.CFG.player.fovHip;
  }

  get def() { return this.defs[this.current]; }
  get ammoState() { return this.ammo[this.current]; }

  swap() {
    if (this.switching || this.reloading) return;
    const next = this.current === 'ak' ? 'pistol' : 'ak';
    this.current = next;
    this.switching = true;
    this.switchT = 0;
    this.shotIndex = 0;
    this.semiArmed = false;
    this.game.viewmodel.setWeapon(next);
    this.game.events.emit('switch', { weapon: next });
  }

  startReload() {
    const a = this.ammoState;
    if (this.reloading || this.switching) return;
    if (a.mag >= this.def.magSize || a.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    this.game.viewmodel.startReload(this.def.reloadTime);
    this.game.events.emit('reloadstart', { weapon: this.current });
  }

  update(dt, input) {
    const P = this.game.player;
    const def = this.def;

    // switch
    if (this.switching) {
      this.switchT = clamp(this.switchT + dt / def.switchTime, 0, 1);
      if (this.switchT >= 1) this.switching = false;
    }

    // reload
    if (this.reloading) {
      this.reloadT += dt / def.reloadTime;
      if (this.reloadT >= 1) {
        this.reloading = false;
        const a = this.ammoState;
        const need = def.magSize - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
        this.game.events.emit('reloadend', { weapon: this.current });
      }
    }

    // fire
    this.fireCd -= dt;
    const canFire = this.fireCd <= 0 && !this.reloading && !this.switching && this.game.playerAlive && this.game.matchActive;
    const wantFire = input.fire && canFire && this.ammoState.mag > 0;
    if (wantFire) {
      if (def.auto || !this.semiArmed) {
        this.fire(input);
        this.semiArmed = true;
      }
    } else if (!input.fire) {
      this.semiArmed = false;
    }
    if (this.ammoState.mag === 0 && !this.reloading) {
      this.startReload();
      this.game.events.emit('dryfire', { weapon: this.current });
    }

    // ads blend + fov
    this.ads = !!input.ads;
    this.adsBlend = damp(this.adsBlend, this.ads ? 1 : 0, this.ads ? 16 : 11, dt);
    const hipFov = this.game.settings.fov || this.game.CFG.player.fovHip;
    const adsFov = def.adsFov;
    this.fov = damp(this.fov, hipFov + (adsFov - hipFov) * this.adsBlend, 12, dt);

    // recoil spring (camera)
    const R = def.recoil;
    const k = R.spring * 26, c = R.damp * 2.6;
    this.rec.vp += (-k * this.rec.p + -c * this.rec.vp) * dt;
    this.rec.vy += (-k * this.rec.y + -c * this.rec.vy) * dt;
    this.rec.p += this.rec.vp * dt;
    this.rec.y += this.rec.vy * dt;
  }

  currentSpread() {
    const P = this.game.player;
    const def = this.def;
    let s = this.ads ? def.adsSpread : def.hipSpread;
    const ms = def.moveSpread;
    if (this.game.player.sliding) s += ms.slide;
    else if (P.airborne) s += ms.air;
    else if (P.speed > 5.4) s += ms.sprint;
    else if (P.speed > 1.2) s += ms.walk;
    if (P.crouching && !P.sliding) s += ms.crouch;
    // sustained fire heat
    s += (this.shotIndex % 14) * (def.auto ? 0.0011 : 0.0007);
    return s;
  }

  fire(input) {
    const def = this.def;
    const P = this.game.player;
    const a = this.ammoState;
    a.mag--;
    this.fireCd = 60 / def.rpm;
    this.shotIndex++;

    // ---- aim direction: camera forward + spread cone ----
    const eye = P.eye(new THREE.Vector3());
    const dir = new THREE.Vector3(
      -Math.sin(P.yaw + this.rec.y * 0.5) * Math.cos(P.pitch + this.rec.p * 0.5),
      Math.sin(P.pitch + this.rec.p * 0.5),
      -Math.cos(P.yaw + this.rec.y * 0.5) * Math.cos(P.pitch + this.rec.p * 0.5)
    ).normalize();
    // spread: offset in local right/up
    const s = this.currentSpread();
    const f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const up = new THREE.Vector3().crossVectors(right, f);
    const g1 = (rand() + rand() + rand() - 1.5) * 0.816;
    const g2 = (rand() + rand() + rand() - 1.5) * 0.816;
    dir.addScaledVector(right, g1 * s).addScaledVector(up, g2 * s).normalize();

    // ---- world hit ----
    const worldHit = raycast(this.game.coll, eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 300);
    let worldDist = worldHit ? worldHit.t : 300;
    let worldPoint = worldHit ? worldHit.point : null;
    let worldNormal = worldHit ? worldHit.normal : null;

    // ---- entity hits (enemies only for the player) ----
    const ents = this.game.match ? this.game.match.entities() : [];
    let bestT = worldDist;
    let hitEnt = null, hitZone = null;
    const playerEnt = this.game.match ? this.game.match.playerEnt : null;
    for (const e of ents) {
      if (!e.alive || e.team === this.game.playerTeam || e === playerEnt) continue;
      const r = rayEntity(e, eye, dir);
      if (r && r.t < bestT) { bestT = r.t; hitEnt = e; hitZone = r.zone; }
    }

    const endX = eye.x + dir.x * bestT, endY = eye.y + dir.y * bestT, endZ = eye.z + dir.z * bestT;
    if (hitEnt) {
      const mul = hitZone === 'head' ? def.dmg.head : hitZone === 'limb' ? def.dmg.limb : def.dmg.body;
      this.game.match.damage(hitEnt, mul, playerEnt, this.current, { x: endX, y: endY, z: endZ, zone: hitZone });
    }

    // ---- visual/audio effects from muzzle ----
    const muzzle = this.game.viewmodel.getMuzzleWorld(new THREE.Vector3());
    this.game.fx.shot(muzzle, endX, endY, endZ, endX ? worldPoint || [endX, endY, endZ] : [endX, endY, endZ], worldNormal, this.current, 'self');
    this.game.audio.play(this.current === 'ak' ? 'ak' : 'pistol', muzzle, 0);
    this.game.viewmodel.onFire(def);
    this.applyRecoil(def);
    this.game.haptics(8);
    this.game.events.emit('playerShot', { pos: [eye.x, eye.y, eye.z], weapon: this.current });
  }

  applyRecoil(def) {
    const R = def.recoil;
    const pat = R.pattern[this.shotIndex % R.pattern.length];
    let pitch = (pat[0] + (rand() * 2 - 1) * R.jitter) * (Math.PI / 180);
    let yaw = (pat[1] + (rand() * 2 - 1) * R.jitter * 0.8) * (Math.PI / 180);
    // modifiers
    if (this.adsBlend > 0.4) { pitch *= R.adsMul; yaw *= R.adsMul; }
    if (this.game.player.crouching && !this.game.player.sliding) { pitch *= R.crouchMul; yaw *= R.crouchMul; }
    if (this.game.player.airborne) { pitch *= 1.12; yaw *= 1.2; }
    this.rec.vp += pitch * 6.2;
    this.rec.vy += yaw * 6.2;
  }

  addAmmo(amount) {
    const a = this.ammoState;
    const d = Math.min(amount, def_cap(this.def.reserveMax) - a.reserve);
    a.reserve += Math.max(0, d);
  }

  serialize() {
    return { current: this.current, ammo: JSON.parse(JSON.stringify(this.ammo)) };
  }
}

function def_cap(m) { return m; }

// ray vs entity (3-zone sphere approximation in world space)
export function rayEntity(e, eye, dir) {
  const p = e.pos; // {x, y, z} feet position
  const crouch = e.crouching ? 0.6 : 1;
  const zones = [
    { name: 'head', cx: p.x, cy: p.y + 1.62 * crouch, cz: p.z, r: 0.16 },
    { name: 'body', cx: p.x, cy: p.y + 1.05 * crouch, cz: p.z, r: 0.3 },
    { name: 'limb', cx: p.x, cy: p.y + 0.45 * crouch, cz: p.z, r: 0.26 },
  ];
  let best = null;
  for (const z of zones) {
    const t = raySphere(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, z.cx, z.cy, z.cz, z.r);
    if (t > 0 && t < 120 && (!best || t < best.t)) best = { t, zone: z.name };
  }
  return best;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const fx = ox - cx, fy = oy - cy, fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0.05 ? t : -1;
}
