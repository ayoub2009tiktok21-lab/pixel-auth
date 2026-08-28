// ============================================================
// Bot AI: perception (vision/hearing only — no radar),
// last-known-position search, cover usage, human-like firing,
// full bot-vs-bot combat.
// ============================================================
import * as THREE from 'three';
import { clamp, damp, rand, pick } from '../core/math.js';
import { lineOfSight, raycast } from '../world/colliders.js';
import { navFind } from '../world/map.js';
import { rayEntity } from '../player/weapons.js';

export class Bot {
  constructor(game, id, team, isAlly) {
    this.game = game;
    this.id = id;
    this.team = team;
    this.isAlly = isAlly;
    this.name = isAlly ? `IRON-${id}` : `ASH-${id}`;
    this.pos = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.hp = game.CFG.ai.botHp;
    this.alive = true;
    this.crouching = false;
    this.speed = 0;
    this.vel = { x: 0, z: 0 };

    const W = game.CFG.weapons;
    this.weapon = 'ak';
    this.mag = W.ak.magSize;
    this.reserve = W.ak.reserve;
    this.reloading = false;
    this.reloadT = 0;
    this.fireCd = 0;

    // perception state
    this.target = null;
    this.lastSeenT = -99;
    this.lastSeenPos = null;
    this.lkp = null;            // {x, z, t}
    this.reactionT = 0;         // countdown to first shot at a new target
    this.sawKillPos = null;

    // behavior
    this.state = 'patrol';
    this.stateT = 0;
    this.path = [];
    this.pathT = 0;
    this.objPos = null;
    this.strafeDir = 1;
    this.strafeT = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.stuckT = 0;
    this.lastMove = null;
    this.coverPt = null;
    this.searchPhase = 0;
    this.scanT = 0;
    this.idleT = 0;
    this.senseT = Math.random() / game.CFG.ai.senseRate;
    this.thinkT = Math.random() / game.CFG.ai.thinkRate;
    this.diff = game.difficulty();
    this.dmgTakenT = -99;

    // mesh
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const mats = this.game.mats;
    const vestCol = this.team === 'a' ? 0x8a6a2c : 0x6e3a32;
    const vest = new THREE.MeshStandardMaterial({ color: vestCol, roughness: 0.9 });
    const dark = mats.sleeve;
    const M = (sx, sy, sz, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    // legs
    this.legL = M(0.14, 0.85, 0.16, -0.11, 0.43, 0, dark);
    this.legR = M(0.14, 0.85, 0.16, 0.11, 0.43, 0, dark);
    // torso
    M(0.44, 0.62, 0.26, 0, 1.18, 0, dark);
    M(0.46, 0.5, 0.28, 0, 1.22, 0, vest);
    // arms
    this.armL = M(0.11, 0.5, 0.13, -0.29, 1.28, 0.02, dark);
    this.armR = M(0.11, 0.5, 0.13, 0.29, 1.28, 0.02, dark);
    // head + helmet
    M(0.21, 0.22, 0.22, 0, 1.68, 0, mats.skin ? mats.gloveTrim : dark);
    const helmet = M(0.24, 0.14, 0.25, 0, 1.78, 0, vest);
    // weapon (crude third-person: receiver + barrel + stock)
    const wp = new THREE.Group();
    const wb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.5), mats.wMetal);
    wb.position.z = -0.25;
    const wbar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), mats.wMetalDark);
    wbar.rotation.x = Math.PI / 2;
    wbar.position.set(0, 0.02, -0.62);
    wp.add(wb, wbar);
    wp.position.set(0.16, 1.32, -0.1);
    g.add(wp);
    this.weaponMesh = wp;

    this.mesh = g;
    g.userData.isBot = true;
    this.game.scene.add(g);
  }

  get eyeH() { return this.crouching ? 1.0 : 1.62; }
  eye() { return { x: this.pos.x, y: this.pos.y + this.eyeH, z: this.pos.z }; }
  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }

  reset(spawn) {
    this.pos.x = spawn.x; this.pos.z = spawn.z; this.pos.y = 0;
    this.yaw = spawn.yaw;
    this.hp = this.game.CFG.ai.botHp;
    this.alive = true;
    this.crouching = false;
    this.target = null; this.lkp = null; this.lastSeenT = -99;
    this.state = 'patrol'; this.path = []; this.objPos = null;
    this.mag = this.game.CFG.weapons.ak.magSize;
    this.reserve = this.game.CFG.weapons.ak.reserve;
    this.reloading = false;
    this.mesh.visible = true;
    this.mesh.rotation.set(0, 0, 0);
    this.deathT = 0;
  }

  takeDamage(amount, from, weapon, hitInfo) {
    if (!this.alive) return;
    this.hp -= amount;
    this.dmgTakenT = this.game.time;
    // react to being shot: last known = attacker
    if (from) {
      this.lkp = { x: from.pos.x, z: from.pos.z, t: this.game.time, sure: true };
      if (this.game.time - this.lastSeenT > 0.4) {
        this.lastSeenPos = { x: from.pos.x, z: from.pos.z };
        this.lastSeenT = this.game.time - 0.4; // forces re-acquire
        if (this.target !== from) {
          this.target = from;
          this.reactionT = rand(...this.diff.react) * 0.8;
        }
      }
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.deathT = 0;
      this.target = null;
      this.game.events.emit('botDied', { bot: this, from, weapon, hitInfo });
    }
  }

  die() {
    // fall over
    const f = this.forward();
    this.deathFall = { rx: rand(-0.2, 0.2), ry: this.yaw + Math.PI + rand(-0.4, 0.4) };
  }

  // ================= perception =================
  sense(dt) {
    this.senseT -= dt;
    if (this.senseT > 0) return;
    this.senseT = 1 / this.game.CFG.ai.senseRate;
    if (!this.alive) return;
    const me = this.eye();
    const f = this.forward();
    const V = this.game.CFG.ai.vision;
    const ents = this.game.match ? this.game.match.entities() : [];
    for (const e of ents) {
      if (!e.alive || e.team === this.team) continue;
      const eEye = e.eye ? e.eye() : { x: e.pos.x, y: e.pos.y + 1.5, z: e.pos.z };
      const dx = eEye.x - me.x, dy = eEye.y - me.y, dz = eEye.z - me.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > V.range) continue;
      // angle to facing
      const dot = (dx * f.x + dz * f.z) / (Math.sqrt(dx * dx + dz * dz) || 1);
      const ang = Math.acos(clamp(dot, -1, 1));
      const eSpeed = e.speed || 0;
      const eCrouch = e.crouching ? 1 : 0;
      let p = 0;
      if (ang < 1.0) {           // core vision ~57deg each side
        p = 0.8;
      } else if (ang < 1.35 && (eSpeed > 1.5 || this.game.time - (e.lastShotT || -99) < 0.3)) {
        p = 0.22;                // peripheral: motion / gunsmoke only
      } else continue;
      p *= clamp(1 - (dist - 30) / 40, 0.4, 1);
      if (eSpeed > 4) p *= 0.8;
      if (eCrouch) p *= 0.85;
      if (Math.random() > p) continue;
      // LOS gate — never see through walls
      if (!lineOfSight(this.game.coll, me.x, me.y, me.z, eEye.x, eEye.y, eEye.z)) continue;
      this.spot(e, dist);
    }
  }

  spot(e, dist) {
    const wasTarget = this.target === e;
    this.target = e;
    this.lastSeenT = this.game.time;
    this.lastSeenPos = { x: e.pos.x, z: e.pos.z };
    this.lkp = { x: e.pos.x, z: e.pos.z, t: this.game.time, sure: true };
    if (!wasTarget) {
      this.reactionT = rand(...this.diff.react) * (dist > 30 ? 1.25 : 1);
      this.state = 'engage';
      this.stateT = 0;
    }
    // team knowledge (in-game info sharing)
    this.game.match?.teamKnow(this.team, e, e.pos);
  }

  hearShot(pos, shooter) {
    if (!this.alive) return;
    const d = Math.hypot(pos[0] - this.pos.x, pos[2] - this.pos.z);
    if (d > this.game.CFG.ai.hearShot) return;
    if (shooter && shooter.team !== this.team && shooter.alive) {
      // pin down approximately (human-like: not exact)
      const err = rand(1.5, 5) * (d / 40);
      this.lkp = {
        x: pos[0] + rand(-err, err), z: pos[2] + rand(-err, err),
        t: this.game.time, sure: false,
      };
      if (!this.target) {
        this.state = 'search';
        this.stateT = 0;
        this.searchPhase = 0;
      }
    }
  }

  // ================= decision =================
  think(dt) {
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 1 / this.game.CFG.ai.thinkRate;
    if (!this.alive) return;
    const now = this.game.time;

    // reload logic
    if (this.mag <= 0 && !this.reloading) {
      this.reloading = true;
      this.reloadT = 0;
      this.game.audio.reloadSeq('ak');
    }

    // target lost?
    if (this.target && now - this.lastSeenT > 1.35) {
      this.target = null;
      if (this.state === 'engage') { this.state = 'search'; this.stateT = 0; this.searchPhase = 0; }
    }

    // --- state machine ---
    if (this.state === 'engage' && this.target) {
      this.decideEngage();
    } else if (this.lkp && now - this.lkp.t < 16) {
      if (this.state !== 'search') { this.state = 'search'; this.stateT = 0; this.searchPhase = 0; }
      this.decideSearch();
    } else if (this.state !== 'retreat') {
      this.state = 'patrol';
      this.stateT = 0;
      this.decidePatrol();
    }
  }

  decideEngage() {
    const t = this.target;
    const dist = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    const now = this.game.time;

    // retreat if badly wounded
    if (this.hp < 28 && now - this.dmgTakenT < 3 && Math.random() < this.diff.cover * 0.3) {
      this.state = 'retreat';
      this.stateT = 0;
      const away = threatDir(this.pos, t.pos);
      const cp = this.nearestCover(away);
      if (cp) { this.objPos = cp; this.goTo(cp.x, cp.z); }
      return;
    }
    // reload (prefer cover if exposed)
    if (this.mag <= 0 && !this.reloading) return; // reload started in think()
    if (this.reloading) return;

    // movement: hold mid range
    if (dist > 26) {
      const p = pointAtDist(this.pos.x, this.pos.z, t.pos.x, t.pos.z, 24);
      this.goTo(p.x, p.z);
    } else if (dist < 9) {
      const p = pointAtDist(t.pos.x, t.pos.z, this.pos.x, this.pos.z, 12);
      this.goTo(p.x, p.z);
    } else {
      // strafe
      this.strafeT -= 1 / this.game.CFG.ai.thinkRate;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rand(0.7, 1.7); }
      const f = facing(t.pos.x, t.pos.z, this.pos.x, this.pos.z);
      this.goTo(this.pos.x + (-f.z) * this.strafeDir * 2.2 + f.x * 0.6, this.pos.z + f.x * this.strafeDir * 2.2 + f.z * 0.6);
    }
    // take cover if hit and exposed
    if (now - this.dmgTakenT < 0.8 && Math.random() < this.diff.cover) {
      const cp = this.nearestCover(threatDir(this.pos, t.pos));
      if (cp && Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z) < 7) {
        this.goTo(cp.x, cp.z);
        this.coverPt = cp;
        this.crouching = true;
      }
    } else if (dist > 20 && Math.random() < 0.4) {
      this.crouching = false;
    }

    // firing
    this.reactionT -= 1 / this.game.CFG.ai.thinkRate;
    if (this.reactionT <= 0 && this.burstPause <= 0) {
      // need LOS to shoot (no wall-bang)
      const me = this.eye();
      const te = t.eye ? t.eye() : { x: t.pos.x, y: t.pos.y + 1.4, z: t.pos.z };
      if (lineOfSight(this.game.coll, me.x, me.y, me.z, te.x, te.y, te.z)) {
        if (this.burstLeft <= 0) {
          this.burstLeft = randInt2(this.diff.burst[0], this.diff.burst[1]);
        }
        if (this.mag > 0) this.tryFire(t, dist);
        this.burstLeft--;
        if (this.burstLeft <= 0) this.burstPause = rand(0.45, 1.15) * (this.diff.search);
      } else {
        this.burstLeft = 0;
      }
    }
    if (this.burstPause > 0) this.burstPause -= 1 / this.game.CFG.ai.thinkRate;
  }

  decideSearch() {
    if (!this.lkp) return;
    const d = Math.hypot(this.lkp.x - this.pos.x, this.lkp.z - this.pos.z);
    if (d > 3) {
      this.goTo(this.lkp.x, this.lkp.z);
      this.crouching = false;
    } else {
      // arrived: scan, then check nearby cover corners
      this.scanT += 1 / this.game.CFG.ai.thinkRate;
      // face toward the LKP while scanning
      this.faceTowards(this.lkp.x, this.lkp.z, 3);
      if (this.scanT > 1.6) {
        this.scanT = 0;
        this.searchPhase++;
        if (this.searchPhase < 4) {
          const cp = this.nearestCover(null, 6 + this.searchPhase * 2);
          if (cp) { this.goTo(cp.x, cp.z); this.crouching = true; }
        } else {
          this.lkp = null; // give up, back to patrol
        }
      }
    }
  }

  decidePatrol() {
    // pick objective occasionally or when reached
    if (this.objPos && Math.hypot(this.objPos.x - this.pos.x, this.objPos.z - this.pos.z) < 2.5) {
      this.objPos = null;
    }
    if (!this.objPos) {
      const r = Math.random();
      if (r < 0.62) {
        // attack: random point on enemy side
        const side = this.team === 'a' ? -1 : 1;
        this.objPos = { x: rand(-40, 40), z: side * rand(10, 52) };
      } else if (r < 0.85) {
        // roam near current area
        this.objPos = { x: clamp(this.pos.x + rand(-18, 18), -55, 55), z: clamp(this.pos.z + rand(-18, 18), -55, 55) };
      } else {
        // shadow a living teammate (keep distance, don't tail)
        const mates = this.game.match.entities().filter((e) => e.team === this.team && e.alive && e !== this);
        if (mates.length) {
          const m = pick(mates);
          const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
          if (d > 20 || Math.random() < this.diff.follow) {
            const p = pointAtDist(m.pos.x, m.pos.z, this.pos.x, this.pos.z, 10 + rand(6, 10));
            this.objPos = p;
          } else {
            this.objPos = null;
            this.idleT = 1.2;
          }
        }
      }
      if (this.objPos) this.goTo(this.objPos.x, this.objPos.z);
    }
    this.crouching = false;
    // idle-listen moments
    if (this.idleT > 0) {
      this.idleT -= 1 / this.game.CFG.ai.thinkRate;
      this.objPos = null;
    }
  }

  nearestCover(avoidDir, maxD = 9) {
    const cps = this.game.coverPoints;
    if (!cps || !cps.length) return null;
    let best = null, bestD = maxD;
    for (const cp of cps) {
      const d = Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z);
      if (d > bestD) continue;
      if (avoidDir) {
        const dx = cp.x - this.pos.x, dz = cp.z - this.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        // cover should be away from the threat
        if ((dx / l) * avoidDir.x + (dz / l) * avoidDir.z > -0.2) continue;
      }
      best = cp; bestD = d;
    }
    return best;
  }

  // ================= firing =================
  tryFire(t, dist) {
    if (this.fireCd > 0 || this.mag <= 0) return;
    this.fireCd = 60 / this.game.CFG.weapons.ak.rpm * 1.15;
    this.mag--;
    const me = this.eye();
    const tEye = t.eye ? t.eye() : { x: t.pos.x, y: t.pos.y + 1.4, z: t.pos.z };
    // lead target + human error
    const tVel = t.vel ? { x: t.vel.x || 0, z: t.vel.z || 0 } : { x: 0, z: 0 };
    const lead = dist / 700;
    let ax = tEye.x + tVel.x * lead, ay = tEye.y, az = tEye.z + tVel.z * lead;
    const headshot = Math.random() < this.diff.head * (1 - clamp(dist / 45, 0, 0.6));
    if (headshot) ay += 0.24;
    else ay += rand(-0.12, 0.18); // bias toward chest
    // error cone
    const errDeg = this.diff.aimErr * (0.6 + dist / 40) * ((t.speed || 0) > 3 ? 1.35 : 1);
    const err = errDeg * (Math.PI / 180);
    ax += rand(-1, 1) * Math.tan(err) * dist;
    az += rand(-1, 1) * Math.tan(err) * dist;
    ay += rand(-0.6, 0.6) * Math.tan(err) * dist;

    const dx = ax - me.x, dy = ay - me.y, dz = az - me.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    const dir = { x: dx / L, y: dy / L, z: dz / L };

    // world block
    const wh = raycast(this.game.coll, me.x, me.y, me.z, dir.x, dir.y, dir.z, 300);
    let endT = wh ? wh.t : L;
    let endPt = wh ? wh.point : [ax, ay, az];
    let nrm = wh ? wh.normal : [0, 1, 0];
    // entity hit (any enemy team member, including player & other bots)
    const ents = this.game.match.entities();
    let bestT = endT, hitE = null, hitZone = null;
    for (const e of ents) {
      if (!e.alive || e.team === this.team) continue;
      const r = rayEntity(e, me, dir);
      if (r && r.t < bestT) { bestT = r.t; hitE = e; hitZone = r.zone; }
    }
    const ex = me.x + dir.x * bestT, ey = me.y + dir.y * bestT, ez = me.z + dir.z * bestT;
    if (hitE) {
      const dmgMul = this.game.CFG.ai.botDmgMul[this.game.settings.gameplay.difficulty];
      const base = hitZone === 'head' ? 34 * 2.3 : hitZone === 'limb' ? 24 : 34;
      this.game.match.damage(hitE, base * dmgMul, this, 'ak', { x: ex, y: ey, z: ez, zone: hitZone });
    }
    // face where we're shooting
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    this.yaw = angleDamp(this.yaw, targetYaw, 10, 1 / 30);
    // fx + sound + team-hear
    const muzzle = { x: me.x + dir.x * 0.4, y: me.y - 0.08 + dir.y * 0.4, z: me.z + dir.z * 0.4 };
    this.game.fx.shot(new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z), ex, ey, ez, endPt, nrm, 'ak', this.isAlly ? 'ally' : 'enemy');
    this.game.audio.play('ak', [muzzle.x, muzzle.y, muzzle.z]);
    this.game.events.emit('botShot', { pos: [this.pos.x, this.pos.y + 1, this.pos.z], shooter: this });
    // weapon bob
    this.lastShotT = this.game.time;
  }

  // ================= movement =================
  goTo(x, z) {
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    this.objPos = { x, z };
    this.pathT -= 0; // plan below
    if (d < 1.2) { this.path = []; return; }
    this.path = navFind(this.game.nav, this.pos.x, this.pos.z, x, z) || [];
  }

  move(dt) {
    if (!this.alive) return;
    const want = this.objPos;
    let dx = 0, dz = 0;
    let speedCap = 4.6;
    if (this.state === 'engage') {
      // aim toward target smoothly
      if (this.target) {
        const f = facing(this.target.pos.x, this.target.pos.z, this.pos.x, this.pos.z);
        this.yaw = angleDamp(this.yaw, Math.atan2(-f.x, -f.z), 9, dt);
      }
    } else if (want) {
      // face travel direction
      const tf = facing(want.x, want.z, this.pos.x, this.pos.z);
      this.yaw = angleDamp(this.yaw, Math.atan2(-tf.x, -tf.z), 7, dt);
    }
    // follow path
    if (this.path.length > 0) {
      const wp = this.path[0];
      const d = Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z);
      if (d < 0.9) this.path.shift();
      else { const f = facing(wp.x, wp.z, this.pos.x, this.pos.z); dx = f.x; dz = f.z; }
    } else if (want) {
      const d = Math.hypot(want.x - this.pos.x, want.z - this.pos.z);
      if (d < 0.7) { this.objPos = null; }
      else { const f = facing(want.x, want.z, this.pos.x, this.pos.z); dx = f.x; dz = f.z; }
    }
    // separation from other bots
    const ents = this.game.match.entities();
    for (const e of ents) {
      if (e === this || !e.alive) continue;
      const ddx = this.pos.x - e.pos.x, ddz = this.pos.z - e.pos.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 1.35 && d > 0.01) {
        dx += (ddx / d) * 0.9;
        dz += (ddz / d) * 0.9;
      }
    }
    const dl = Math.hypot(dx, dz);
    if (dl > 0.05) {
      dx /= Math.max(1, dl); dz /= Math.max(1, dl);
      const lam = 26 / 4;
      this.vel.x = damp(this.vel.x, dx * speedCap, lam, dt);
      this.vel.z = damp(this.vel.z, dz * speedCap, lam, dt);
    } else {
      const lam = 42 / 4;
      this.vel.x = damp(this.vel.x, 0, lam, dt);
      this.vel.z = damp(this.vel.z, 0, lam, dt);
    }
    // integrate with collision
    const bodyH = this.crouching ? 0.95 : 1.75;
    const res = this.game.moveBot(this.pos.x, this.pos.z, this.vel.x * dt, this.vel.z * dt, bodyH);
    this.pos.x = res.x; this.pos.z = res.z;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // stuck detection
    if (this.objPos && this.speed < 0.4) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > this.game.CFG.ai.stuckTime) {
      this.stuckT = 0;
      // nudge sideways and replan
      const f = this.forward();
      this.goTo(this.pos.x + -f.z * 1.8 * (Math.random() < 0.5 ? 1 : -1), this.pos.z + f.x * 1.8 * (Math.random() < 0.5 ? 1 : -1));
      if (this.objPos) this.goTo(this.objPos.x, this.objPos.z);
    }
  }

  // (this.vel is the plain {x,z} velocity object — readable directly)

  faceTowards(x, z, lambda) {
    const f = facing(x, z, this.pos.x, this.pos.z);
    this.yaw = angleDamp(this.yaw, Math.atan2(-f.x, -f.z), lambda, 1 / 30);
  }

  // ================= update =================
  update(dt) {
    if (this.frozen) return; // debug/testing flag
    if (!this.alive) {
      this.deathT = (this.deathT || 0) + dt;
      // fall over
      if (this.deathT < 0.5) {
        this.mesh.rotation.x = -clamp(this.deathT / 0.4, 0, 1) * Math.PI / 2 * 0.94;
        this.mesh.position.y = -clamp(this.deathT / 0.4, 0, 1) * 0.25;
      }
      if (this.deathT > 6) this.mesh.visible = false;
      return;
    }
    this.sense(dt);
    this.think(dt);
    this.move(dt);
    // reload progress
    if (this.reloading) {
      this.reloadT += dt / this.game.CFG.weapons.ak.reloadTime;
      if (this.reloadT >= 1) {
        this.reloading = false;
        const take = Math.min(30 - this.mag, this.reserve);
        this.mag += take;
        this.reserve -= take;
      }
    }
    this.fireCd -= dt;
    // mesh sync
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // crouch pose
    const targetScaleY = this.crouching ? 0.72 : 1;
    this.mesh.scale.y = damp(this.mesh.scale.y, targetScaleY, 10, dt);
    // walk anim
    const t = this.game.time * 1.6;
    const sw = Math.sin(t * (1 + this.speed * 0.5)) * clamp(this.speed / 5, 0, 1) * 0.5;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.6;
    // aim pose: arms forward when engaging
    const aimK = this.state === 'engage' ? 1 : 0.3;
    this.armR.rotation.x = damp(this.armR.rotation.x, -1.25 * aimK, 8, dt);
    this.weaponMesh.rotation.x = damp(this.weaponMesh.rotation.x, -0.1 * aimK, 8, dt);
    // expose velocity for lead + teammate awareness
    this.velWorld = { x: this.vel.x, z: this.vel.z };
  }

  get speed2() { return this.speed; }
}

// ---------- helpers ----------
function facing(tx, tz, fx, fz) {
  const dx = tx - fx, dz = tz - fz;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}
// direction from bot toward threat (used to pick cover on the far side)
function threatDir(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}
function pointAtDist(ax, az, bx, bz, d) {
  const dx = bx - ax, dz = bz - az;
  const l = Math.hypot(dx, dz) || 1;
  return { x: ax + (dx / l) * d, z: az + (dz / l) * d };
}
function randInt2(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function angleDamp(a, b, lambda, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
