// ============================================================
// Player controller: movement state machine (idle/walk/sprint/
// crouch/slide/jump/air), world collision, step-up, eye height.
// ============================================================
import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';
import { moveCircle, groundHeight } from '../world/colliders.js';

export class PlayerController {
  constructor(game, spawn) {
    this.game = game;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw;
    this.pitch = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.crouching = false;
    this.sliding = false;
    this.slideT = 0;
    this.slideDir = new THREE.Vector2(0, -1);
    this.airborne = false;
    this.speed = 0;
    this.moving = false;
    this.footTimer = 0;
    this.eyeH = 1.6;
    this.eyeTarget = 1.6;
    this.lastFallV = 0;
    this.stuck = 0;
  }

  get C() { return this.game.CFG.player; }

  reset(spawn) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.y = 0;
    this.vel.set(0, 0, 0);
    this.yaw = spawn.yaw;
    this.pitch = 0;
    this.crouching = false;
    this.sliding = false;
    this.grounded = true;
    this.vy = 0;
  }

  eye(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.y + this.eyeH, this.pos.z);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  // smart low-button: edge-triggered
  onLowButton() {
    if (this.airborne) return;
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (spd > 4.6) {
      // start slide
      this.sliding = true;
      this.slideT = 0;
      this.crouching = false;
      const f = this.forward(new THREE.Vector3());
      this.slideDir.set(f.x, f.z).normalize();
      this.vel.x = this.slideDir.x * this.C.slideSpeed;
      this.vel.z = this.slideDir.y * this.C.slideSpeed;
      this.game.events.emit('slide', { x: this.pos.x, z: this.pos.z });
    } else {
      this.crouching = !this.crouching;
      if (this.crouching) this.game.events.emit('crouch', { x: this.pos.x, z: this.pos.z });
    }
  }

  onJump() {
    if (this.grounded && !this.sliding) {
      this.vy = this.C.jump;
      this.grounded = false;
      this.airborne = true;
      this.sliding = false;
      this.game.events.emit('jump', { x: this.pos.x, z: this.pos.z });
    }
  }

  update(dt, input, coll) {
    const C = this.C;
    const ads = input.ads;
    const mx = input.mx, mz = input.mz;
    const mlen = Math.hypot(mx, mz);

    // --- slide ---
    if (this.sliding) {
      this.slideT += dt;
      const f = Math.max(0, 1 - this.slideT / C.slideTime);
      const sp = C.slideSpeed * f;
      this.vel.x = this.slideDir.x * sp;
      this.vel.z = this.slideDir.y * sp;
      this.eyeTarget = C.eyeSlide;
      if (this.slideT >= C.slideTime || sp < 1.2) {
        this.sliding = false;
        this.crouching = true; // slide ends in crouch
      }
    } else if (this.airborne) {
      // air control
      if (mlen > 0.1) {
        const f = this.forward(new THREE.Vector3());
        const r = new THREE.Vector3(-f.z, 0, f.x);
        const dx = f.x * mz + r.x * mx, dz = f.z * mz + r.z * mx;
        const d = Math.hypot(dx, dz) || 1;
        this.vel.x += (dx / d) * C.accel * C.airControl * dt * mlen;
        this.vel.z += (dz / d) * C.accel * C.airControl * dt * mlen;
        const sp = Math.hypot(this.vel.x, this.vel.z);
        const maxAir = C.sprint;
        if (sp > maxAir) { this.vel.x *= maxAir / sp; this.vel.z *= maxAir / sp; }
      }
      this.eyeTarget = C.eyeStanding;
    } else {
      // ground locomotion
      const sprinting = mlen > 0.86 && !ads && !this.crouching;
      const cap = this.crouching ? C.crouch : ads ? C.ads : sprinting ? C.sprint : C.walk;
      let tx = 0, tz = 0;
      if (mlen > 0.08) {
        const f = this.forward(new THREE.Vector3());
        const r = new THREE.Vector3(-f.z, 0, f.x);
        tx = (f.x * mz + r.x * mx) * cap;
        tz = (f.z * mz + r.z * mx) * cap;
      }
      const lam = tx || tz ? C.accel : C.decel;
      this.vel.x = damp(this.vel.x, tx, lam / 4, dt);
      this.vel.z = damp(this.vel.z, tz, lam / 4, dt);
      this.eyeTarget = this.crouching ? C.eyeCrouch : C.eyeStanding;
      this.moving = mlen > 0.12;
    }

    // --- integrate vertical ---
    if (!this.grounded) {
      this.vy -= C.gravity * dt;
      this.y += this.vy * dt;
    }
    const g = groundHeight(coll, this.pos.x, this.pos.z, this.y);
    if (this.y <= g + 0.002 && this.vy <= 0.01) {
      if (!this.grounded && this.lastFallV < -6.5) {
        this.game.events.emit('land', { x: this.pos.x, z: this.pos.z, v: -this.lastFallV });
      }
      this.y = g;
      this.vy = 0;
      this.grounded = true;
      this.airborne = false;
    } else if (this.y > g + 0.05) {
      this.grounded = false;
      this.airborne = true;
    }
    this.lastFallV = this.vy;

    // --- integrate horizontal with collision ---
    const bodyH = this.crouching || this.sliding ? 0.95 : 1.75;
    const prevX = this.pos.x, prevZ = this.pos.z;
    const res = moveCircle(coll, this.pos.x, this.pos.z, this.vel.x * dt, this.vel.z * dt, C.radius, this.y + 0.2, this.y + bodyH);
    this.pos.x = res.x;
    this.pos.z = res.z;
    // map bounds
    this.pos.x = clamp(this.pos.x, -62, 62);
    this.pos.z = clamp(this.pos.z, -62, 62);

    const travelled = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.6 && travelled < this.speed * dt * 0.25) this.stuck += dt;
    else this.stuck = 0;

    // --- eye height (smooth) ---
    this.eyeH = damp(this.eyeH, this.eyeTarget, 14, dt);

    // --- footsteps ---
    if (this.grounded && this.moving && !this.sliding) {
      this.footTimer -= dt;
      if (this.footTimer <= 0) {
        const stepRate = clamp(this.speed / 3.2, 0.8, 2.4);
        this.footTimer = 1 / (stepRate * 1.7);
        this.game.events.emit('footstep', { x: this.pos.x, z: this.pos.z, vol: clamp(this.speed / 7, 0.3, 1) });
      }
    }
  }

  // apply look delta (radians) with sensitivity already applied
  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.52, 1.52);
  }
}
