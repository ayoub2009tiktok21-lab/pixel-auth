// ============================================================
// Particle & effect system: pooled tracers, muzzle flashes,
// impact sparks, dust, decals. All cheap, budget-scaled.
// ============================================================
import * as THREE from 'three';
import { rand } from '../core/math.js';
import { makeFlashTexture, makeGlowTexture } from '../world/materials.js';

class Pool {
  constructor(n, make) {
    this.items = [];
    this.n = n;
    for (let i = 0; i < n; i++) {
      const it = make(i);
      it.active = false;
      it.t = 0;
      this.items.push(it);
    }
  }
  take() {
    for (const it of this.items) if (!it.active) return it;
    return null;
  }
  updateAll(dt) {
    for (const it of this.items) if (it.active && it.update) it.update(dt);
  }
}

export class FX {
  constructor(scene, mats, qualityMul = 1) {
    this.scene = scene;
    this.q = qualityMul;
    this.flashTex = makeFlashTexture();
    this.sparkTex = makeGlowTexture('rgba(255,230,180,1)', 'rgba(255,160,60,0)');
    this.dustTex = makeGlowTexture('rgba(150,135,110,0.55)', 'rgba(150,135,110,0)');

    // --- tracers ---
    this.tracers = new Pool(26, () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 4), mats.tracer.clone());
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      return { mesh: m, life: 0.07, max: 0.07,
        update(dt) {
          this.life -= dt;
          if (this.life <= 0) { this.mesh.visible = false; this.active = false; return; }
          this.mesh.material.opacity = 0.85 * (this.life / this.max);
        } };
    });

    // --- muzzle flash sprites (2 crossed planes) ---
    this.flashes = new Pool(10, () => {
      const grp = new THREE.Group();
      const g1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mats.flash.clone());
      const g2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mats.flash.clone());
      g2.rotation.z = Math.PI / 4;
      grp.add(g1, g2);
      grp.visible = false;
      scene.add(grp);
      return { grp, g1, g2, life: 0.05, max: 0.05,
        update(dt) {
          this.life -= dt;
          if (this.life <= 0) { this.grp.visible = false; this.active = false; return; }
          const k = this.life / this.max;
          this.g1.material.opacity = 0.95 * k;
          this.g2.material.opacity = 0.95 * k;
          const s = 0.7 + (1 - k) * 0.7;
          this.grp.scale.setScalar(s);
        } };
    });
    this.flashLight = new THREE.PointLight(0xffc070, 0, 7, 2);
    scene.add(this.flashLight);
    this.flashLightT = 0;

    // --- sparks ---
    this.sparks = new Pool(90, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), new THREE.MeshBasicMaterial({
        map: this.sparkTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      return { mesh: m, vel: new THREE.Vector3(), life: 0, max: 0.26,
        update(dt) {
          this.life -= dt;
          if (this.life <= 0) { this.mesh.visible = false; this.active = false; return; }
          this.vel.y -= 9 * dt;
          this.mesh.position.addScaledVector(this.vel, dt);
          const k = this.life / this.max;
          this.mesh.material.opacity = k;
          this.mesh.scale.setScalar(0.5 + k);
        } };
    });

    // --- dust puffs ---
    this.dust = new Pool(40, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({
        map: this.dustTex, transparent: true, depthWrite: false, opacity: 0.4 }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      return { mesh: m, life: 0, max: 0.55,
        update(dt) {
          this.life -= dt;
          if (this.life <= 0) { this.mesh.visible = false; this.active = false; return; }
          const k = 1 - this.life / this.max;
          this.mesh.scale.setScalar(0.4 + k * 1.5);
          this.mesh.material.opacity = 0.4 * (1 - k);
          this.mesh.position.y += dt * 0.4;
        } };
    });

    // --- bullet decals ---
    this.decals = new Pool(28, () => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.028, 8), new THREE.MeshBasicMaterial({
        color: 0x1a1712, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.visible = false;
      scene.add(m);
      return { mesh: m, life: 0, max: 50,
        update(dt) {
          this.life -= dt;
          if (this.life <= 0) { this.mesh.visible = false; this.active = false; return; }
          if (this.life < 8) this.mesh.material.opacity = 0.85 * (this.life / 8);
        } };
    });
    this.decalIdx = 0;
  }

  setQuality(mul) { this.q = mul; }

  shot(muzzle, endX, endY, endZ, impactPoint, impactNormal, weaponId, who) {
    // muzzle flash
    if (who === 'self' || true) {
      const f = this.flashes.take();
      if (f) {
        f.active = true;
        f.life = f.max = weaponId === 'ak' ? 0.055 : 0.045;
        f.grp.visible = true;
        f.grp.position.copy(muzzle);
        f.grp.rotation.set(rand(-0.4, 0.4), rand(0, Math.PI), rand(0, Math.PI));
      }
    }
    if (who === 'self') {
      this.flashLight.position.copy(muzzle);
      this.flashLight.intensity = weaponId === 'ak' ? 2.4 : 1.5;
      this.flashLightT = 0.05;
    }
    // tracer
    const t = this.tracers.take();
    if (t) {
      t.active = true;
      t.life = t.max = 0.075;
      const a = muzzle, b = new THREE.Vector3(endX, endY, endZ);
      const len = a.distanceTo(b);
      if (len > 0.8) {
        t.mesh.visible = true;
        t.mesh.position.copy(a).add(b).multiplyScalar(0.5);
        t.mesh.scale.set(1, len, 1);
        t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      } else {
        t.mesh.visible = true;
        t.mesh.scale.setScalar(0.001);
      }
    }
    // impact
    if (impactPoint) this.impact(impactPoint, impactNormal || [0, 1, 0], weaponId);
  }

  impact(p, n, weaponId) {
    const px = p[0], py = p[1], pz = p[2];
    const budget = Math.round(5 * this.q);
    for (let i = 0; i < budget; i++) {
      const s = this.sparks.take();
      if (!s) break;
      s.active = true;
      s.life = s.max = 0.16 + rand(0.12);
      s.mesh.visible = true;
      s.mesh.position.set(px, py, pz);
      s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]).normalize());
      const sp = 1.2 + rand(2.2);
      s.vel.set(
        n[0] * sp + rand(-1.6, 1.6),
        n[1] * sp + rand(-0.4, 2.0),
        n[2] * sp + rand(-1.6, 1.6)
      );
    }
    const d = this.dust.take();
    if (d) {
      d.active = true;
      d.life = d.max = 0.5;
      d.mesh.visible = true;
      d.mesh.position.set(px + n[0] * 0.03, py + n[1] * 0.03, pz + n[2] * 0.03);
      d.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]).normalize());
    }
    // decal (only on surfaces, not in the air)
    const dec = this.decals.items[this.decalIdx];
    this.decalIdx = (this.decalIdx + 1) % this.decals.items.length;
    if (dec) {
      dec.active = true;
      dec.life = dec.max = 40 + rand(20);
      dec.mesh.visible = true;
      dec.mesh.position.set(px + n[0] * 0.006, py + n[1] * 0.006, pz + n[2] * 0.006);
      dec.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]).normalize());
    }
  }

  update(dt) {
    this.tracers.updateAll(dt);
    this.flashes.updateAll(dt);
    this.sparks.updateAll(dt);
    this.dust.updateAll(dt);
    this.decals.updateAll(dt);
    if (this.flashLightT > 0) {
      this.flashLightT -= dt;
      if (this.flashLightT <= 0) this.flashLight.intensity = 0;
    }
  }

  dispose() {
    const kill = (pool) => {
      for (const it of pool.items) {
        if (it.mesh) { this.scene.remove(it.mesh); it.mesh.geometry.dispose(); if (it.mesh.material.dispose) it.mesh.material.dispose(); }
        if (it.grp) { this.scene.remove(it.grp); }
      }
      pool.items.length = 0;
    };
    kill(this.tracers); kill(this.flashes); kill(this.sparks); kill(this.dust); kill(this.decals);
    this.scene.remove(this.flashLight);
  }
}
