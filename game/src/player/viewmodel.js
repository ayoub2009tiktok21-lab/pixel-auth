// ============================================================
// First-person viewmodel rig: weapon + hands parented to camera.
// Handles hip-fire/ADS transitions, walk bob, recoil kick,
// reload & switch poses.
// ============================================================
import * as THREE from 'three';
import { buildAK47 } from './ak47.js';
import { buildPistol } from './pistol.js';
import { buildHands, applyHandPose, handPose } from './hands.js';
import { clamp, damp, rand } from '../core/math.js';

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class ViewModel {
  constructor(camera, mats, weaponDefs) {
    this.camera = camera;
    this.mats = mats;
    this.defs = weaponDefs;
    this.time = 0;

    this.root = new THREE.Group();
    this.root.name = 'viewmodel';
    camera.add(this.root);

    // weapon roots (built once)
    this.weapons = {
      ak: buildAK47(mats),
      pistol: buildPistol(mats),
    };
    this.hands = buildHands(mats);
    this.root.add(this.weapons.ak, this.weapons.pistol, this.hands.R, this.hands.L);

    this.currentId = 'ak';
    this.visible = this.weapons.ak;
    this.visible.visible = true;
    this.weapons.pistol.visible = false;

    // recoil kick spring (viewmodel space)
    this.kick = { z: 0, y: 0, rx: 0 };
    this.kickVel = { z: 0, y: 0, rx: 0 };

    this.adsBlend = 0;      // 0 hip .. 1 ads
    this.switchT = 1;       // 1 = settled
    this.reloadT = 1;       // 0..1 reload progress (1 = idle)
    this.crouchBlend = 0;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.clench = 0;
    this.fovTarget = weaponDefs.ak.vm.hip;
    this.fov = weaponDefs.ak.vm.hip;
  }

  setWeapon(id, instant = false) {
    if (id === this.currentId) return;
    const was = this.currentId;
    this.currentId = id;
    if (instant) {
      this.weapons[was].visible = false;
      this.visible = this.weapons[id];
      this.visible.visible = true;
      this.switchT = 1;
    } else {
      this.switchT = 0;
      // keep both briefly visible during handoff
      this.weapons[was].visible = true;
      this.visible = this.weapons[id];
      this.visible.visible = true;
    }
    this._hideOldAfter = 0.32;
    this._oldId = was;
  }

  startReload(dur) {
    this.reloadT = 0;
    this.reloadDur = dur;
  }
  reloadProgress() {
    return this.reloadT;
  }

  onFire(def) {
    this.kickVel.z += def.kick.back * 6.5;
    this.kickVel.y += def.kick.up * 6.5;
    this.kickVel.rx += def.kick.rot * 7;
    this.clench = 1;
  }

  update(dt, state) {
    // state: {speed, ads, moving, crouching, airborne, fireHeld, reloadActive}
    this.time += dt;

    // --- ads blend ---
    const adsTarget = state.ads ? 1 : 0;
    this.adsBlend = damp(this.adsBlend, adsTarget, state.ads ? 14 : 10, dt);

    // --- switch ---
    if (this.switchT < 1) {
      this.switchT = clamp(this.switchT + dt / 0.32, 0, 1);
      if (this.switchT >= 1 && this._oldId) {
        this.weapons[this._oldId].visible = false;
        this._oldId = null;
      }
    }

    // --- reload timeline ---
    if (this.reloadT < 1) {
      this.reloadT = clamp(this.reloadT + dt / this.reloadDur, 0, 1);
    }

    // --- walk bob ---
    const spd = clamp(state.speed / 4, 0, 1.6);
    const targetBob = state.moving && !state.airborne ? (state.ads ? 0.35 : 1) * spd : 0;
    this.bobAmt = damp(this.bobAmt, targetBob, 8, dt);
    const freq = 2.6 * (0.8 + spd * 0.45);
    this.bobPhase += dt * freq * Math.PI * 2 * clamp(spd, 0.3, 1.4);
    this.crouchBlend = damp(this.crouchBlend, state.crouching ? 1 : 0, 10, dt);

    // --- recoil spring ---
    const k = 90, c = 14;
    this.kickVel.z += (-k * this.kick.z + -c * this.kickVel.z) * dt;
    this.kickVel.y += (-k * this.kick.y + -c * this.kickVel.y) * dt;
    this.kickVel.rx += (-k * this.kick.rx + -c * this.kickVel.rx) * dt;
    this.kick.z = clamp(this.kick.z + this.kickVel.z * dt, -0.2, 0.3);
    this.kick.y = clamp(this.kick.y + this.kickVel.y * dt, -0.2, 0.3);
    this.kick.rx = clamp(this.kick.rx + this.kickVel.rx * dt, -0.4, 0.4);
    this.clench = damp(this.clench, 0, 6, dt);

    // --- compose weapon transform ---
    const def = this.defs[this.currentId];
    const hip = def.vm.hip, ads = def.vm.ads;
    const b = this.adsBlend;
    const px = lerp3(hip.pos[0], ads.pos[0], b) + this.kick.z;
    const py = lerp3(hip.pos[1], ads.pos[1], b) + this.kick.y;
    const pz = lerp3(hip.pos[2], ads.pos[2], b) + this.kick.z * 0.4;
    let rx = lerp3(hip.rot[0], ads.rot[0], b) + this.kick.rx;
    let ry = lerp3(hip.rot[1], ads.rot[1], b);
    let rz = lerp3(hip.rot[2], ads.rot[2], b);

    // walk bob offset (applied in camera space)
    const bx = Math.cos(this.bobPhase * 0.5) * 0.006 * this.bobAmt;
    const by = -Math.abs(Math.sin(this.bobPhase)) * 0.008 * this.bobAmt;
    // crouch tuck
    const ckY = -0.02 * this.crouchBlend;

    // switch dip
    const sw = Math.sin(this.switchT * Math.PI) * 0.14;

    // reload tilt (weapon rolls down-left, left hand pulls mag)
    const rl = this.reloadT < 1 ? Math.sin(this.reloadT * Math.PI) : 0;
    rx += rl * 0.16;
    rz += -rl * 0.22;
    const rlX = -rl * 0.06;

    this.visible.position.set(px + bx + rlX, py + by + ckY - sw, pz);
    this.visible.rotation.set(rx, ry, rz);

    // hands follow the current weapon pose (in weapon space → world)
    const wQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    for (const side of ['R', 'L']) {
      const pose = handPose(this.currentId, side);
      const hand = this.hands[side];
      // local offset in weapon space
      const lp = V3(pose.pos).applyQuaternion(wQuat).add(this.visible.position);
      let lr = new THREE.Euler(pose.rot[0] + rx * 0.6, pose.rot[1] + ry * 0.6, pose.rot[2] + rz * 0.6);
      // left hand extra motion during reload (mag pull)
      if (side === 'L' && this.currentId === 'ak' && rl > 0.05) {
        const pull = Math.sin(clamp((this.reloadT - 0.25) / 0.5, 0, 1) * Math.PI);
        lp.y -= pull * 0.085;
        lp.z += pull * 0.02;
      }
      if (side === 'L' && this.currentId === 'pistol' && rl > 0.05) {
        // left hand pulls mag from base
        const pull = Math.sin(clamp((this.reloadT - 0.2) / 0.5, 0, 1) * Math.PI);
        lp.y -= pull * 0.06;
      }
      hand.position.copy(lp);
      hand.rotation.copy(lr);
      applyHandPose(hand, { pos: [0, 0, 0], rot: [0, 0, 0], curl: pose.curl }, this.time, this.clench);
      // reapply position/rotation (applyHandPose resets them)
      hand.position.copy(lp);
      hand.rotation.copy(lr);
    }
  }

  getMuzzleWorld(out = new THREE.Vector3()) {
    const def = this.defs[this.currentId];
    this.visible.localToWorld(out.set(def.vm.muzzle[0], def.vm.muzzle[1], def.vm.muzzle[2]));
    return out;
  }
}

function lerp3(a, b, t) { return a + (b - a) * t; }
