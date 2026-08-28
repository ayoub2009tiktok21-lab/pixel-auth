// ============================================================
// Match: 4v4 round-based (first to 5), loot, killfeed,
// player entity, team knowledge sharing.
// ============================================================
import * as THREE from 'three';
import { clamp, rand, weightedPick } from '../core/math.js';
import { Bot } from '../ai/bot.js';
import { TEAM_NAMES } from '../config.js';

export class Match {
  constructor(game) {
    this.game = game;
    this.state = 'idle';
    this.score = { a: 0, b: 0 };
    this.round = 1;
    this.time = 0;
    this.roundTime = 0;
    this.stateT = 0;
    this.bots = [];
    this.loot = [];
    this.killfeed = [];
    this.knowledge = { a: {}, b: {} };
    this.playerHp = game.CFG.player.hp;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.botKills = {};
    this.roundWinner = null;
    this.matchWinner = null;
    this.roundDraw = false;
    this._buildPlayerEntity();
  }

  _buildPlayerEntity() {
    const g = this.game;
    this.playerEnt = {
      id: 'player', team: 'a', isPlayer: true, name: 'YOU',
      alive: true, hp: 100, crouching: false, lastShotT: -99,
      get pos() { const p = g.player.pos; return { x: p.x, y: g.player.y, z: p.z }; },
      eye() { return g.player.eye(); },
      get speed() { return g.player.speed; },
      get vel() { const v = g.player.vel; return { x: v.x, z: v.z }; },
      takeDamage(amount, from, weapon, hitInfo) {
        if (!this.alive) return;
        this.hp -= amount;
        if (this.hp <= 0) {
          this.hp = 0;
          this.alive = false;
          g.events.emit('playerDied', { from });
        }
      },
      reset() { this.hp = g.CFG.player.hp; this.alive = true; },
    };
  }

  entities() {
    return [this.playerEnt, ...this.bots];
  }

  teamOf(team) {
    const out = [this.playerEnt, ...this.bots].filter((e) => e.team === team && e.alive);
    return out;
  }

  // ---------- lifecycle ----------
  startMatch() {
    this.score = { a: 0, b: 0 };
    this.round = 1;
    this.time = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.botKills = {};
    this.killfeed = [];
    this.matchWinner = null;
    this.beginLobby();
  }

  beginLobby() {
    this.state = 'lobby';
    this.stateT = 0;
    this.roundTime = 0;
    this.roundWinner = null;
    this.roundDraw = false;
    // spawn
    const spawns = this.game.spawns;
    this.playerEnt.reset();
    this.game.player.reset(spawns.a[0]);
    // bots
    if (!this.bots.length) {
      let bi = 0;
      for (let i = 0; i < 3; i++) this.bots.push(new Bot(this.game, `A${i + 1}`, 'a', true));
      for (let i = 0; i < 4; i++) this.bots.push(new Bot(this.game, `B${i + 1}`, 'b', false));
    }
    // bots[0..2] = team a allies (spawns.a[1..3]; index 0 is the player)
    // bots[3..6] = team b enemies (spawns.b[0..3])
    this.bots.forEach((b, i) => {
      const sp = b.team === 'a' ? spawns.a[i + 1] : spawns.b[i - 3];
      b.reset(sp);
    });
    // clear loot
    for (const l of this.loot) this.game.scene.remove(l.mesh);
    this.loot = [];
    this.knowledge = { a: {}, b: {} };
    this.game.events.emit('lobby', { round: this.round, score: { ...this.score } });
  }

  beginRound() {
    this.state = 'active';
    this.stateT = 0;
    this.game.events.emit('roundStart', { round: this.round });
  }

  endRound(winnerTeam) {
    if (this.state !== 'active') return;
    this.state = 'roundEnd';
    this.stateT = 0;
    this.roundWinner = winnerTeam;
    if (winnerTeam) this.score[winnerTeam]++;
    this.game.events.emit('roundEnd', {
      winner: winnerTeam, round: this.round, score: { ...this.score },
    });
  }

  endMatch(winnerTeam) {
    this.state = 'matchEnd';
    this.matchWinner = winnerTeam;
    this.stateT = 0;
    this.game.events.emit('matchEnd', {
      winner: winnerTeam, score: { ...this.score },
      kills: this.playerKills, deaths: this.playerDeaths,
      botKills: { ...this.botKills },
    });
  }

  get active() { return this.state === 'active'; }

  // team knowledge (in-game info sharing, not radar)
  teamKnow(team, ent, pos) {
    if (!this.knowledge[team]) this.knowledge[team] = {};
    this.knowledge[team][ent.id] = { x: pos.x, z: pos.z, t: this.game.time };
  }

  // ---------- damage ----------
  damage(ent, amount, from, weapon, hitInfo) {
    if (this.state !== 'active') return;
    if (!ent || !ent.alive) return;
    if (from === ent) return;
    ent.takeDamage(amount, from, weapon, hitInfo);
    if (ent.isPlayer) {
      this.game.events.emit('playerHit', { amount, from, hitInfo });
      this.game.haptics(30);
    }
    if (!ent.alive) this.onDeath(ent, from, weapon, hitInfo);
  }

  onDeath(ent, from, weapon, hitInfo) {
    const killerName = from ? (from.isPlayer ? 'YOU' : from.name) : '—';
    const victimName = ent.isPlayer ? 'YOU' : ent.name;
    this.killfeed.push({ killer: killerName, victim: victimName, weapon, t: this.time, enemy: !ent.isPlayer });
    if (this.killfeed.length > 5) this.killfeed.shift();
    if (from) {
      if (from.isPlayer) this.playerKills++;
      else this.botKills[from.name] = (this.botKills[from.name] || 0) + 1;
    }
    if (ent.isPlayer) this.playerDeaths++;
    this.game.events.emit('kill', { killer: from, victim: ent, weapon, hitInfo });
    // team knows who killed (and where the killer was)
    if (from && !from.isPlayer) {
      this.teamKnow(ent.team, from, from.pos);
    }
    // loot drops (enemy or teammate deaths both drop)
    if (!ent.isPlayer) this.dropLoot(ent);
    // round end check
    this.checkRound();
  }

  dropLoot(bot) {
    const table = this.game.CFG.loot.table;
    const roll = weightedPick(table);
    const mesh = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.26, 0.42),
      new THREE.MeshStandardMaterial({
        color: roll.hp > 0 && roll.ammo > 0 ? 0x5f8a4a : roll.hp > 0 ? 0x4f8a52 : 0xb08a3e,
        roughness: 0.8,
      })
    );
    box.castShadow = true;
    const tag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: roll.hp > 0 ? 0x7ec97e : 0xe8b34b, roughness: 0.6 })
    );
    tag.position.y = 0.2;
    mesh.add(box, tag);
    mesh.position.set(bot.pos.x, 0.16, bot.pos.z);
    mesh.rotation.y = rand(0, Math.PI);
    this.game.scene.add(mesh);
    this.loot.push({ mesh, ammo: roll.ammo, hp: roll.hp, t: 0 });
  }

  updateLoot(dt) {
    const P = this.game.player;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t += dt;
      l.mesh.rotation.y += dt * 0.8;
      l.mesh.position.y = 0.16 + Math.sin(l.t * 2.2) * 0.03;
      if (!this.playerEnt.alive) continue;
      const d = Math.hypot(P.pos.x - l.mesh.position.x, P.pos.z - l.mesh.position.z);
      if (d < this.game.CFG.loot.pickupRadius) {
        let got = [];
        if (l.ammo > 0) {
          const before = this.game.weapons.ammoState.reserve;
          this.game.weapons.addAmmo(l.ammo);
          const after = this.game.weapons.ammoState.reserve;
          if (after > before) got.push(`+${after - before} ammo`);
        }
        if (l.hp > 0) {
          const before = this.playerHp;
          this.playerHp = clamp(this.playerHp + l.hp, 0, this.game.CFG.player.hp);
          if (this.playerHp > before) got.push(`+${this.playerHp - before} HP`);
        }
        this.game.scene.remove(l.mesh);
        this.loot.splice(i, 1);
        this.game.events.emit('pickup', { got });
        this.game.audio.play('click');
      }
    }
  }

  checkRound() {
    if (this.state !== 'active') return;
    const a = this.teamOf('a').length;
    const b = this.teamOf('b').length;
    if (a === 0) this.endRound('b');
    else if (b === 0) this.endRound('a');
  }

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    this.stateT += dt;

    if (this.state === 'lobby') {
      if (this.stateT >= this.game.CFG.match.lobbyTime) this.beginRound();
      return;
    }
    if (this.state === 'roundEnd') {
      if (this.stateT >= this.game.CFG.match.roundEndPause) {
        if (this.score.a >= this.game.CFG.match.roundsToWin || this.score.b >= this.game.CFG.match.roundsToWin) {
          this.endMatch(this.score.a >= this.game.CFG.match.roundsToWin ? 'a' : 'b');
        } else {
          this.round++;
          this.beginLobby();
        }
      }
      return;
    }
    if (this.state === 'matchEnd') return;

    // active
    this.roundTime += dt;
    for (const b of this.bots) b.update(dt);
    this.updateLoot(dt);

    // timeout: most survivors wins
    if (this.roundTime >= this.game.CFG.match.roundTimeout) {
      const a = this.teamOf('a').length;
      const b2 = this.teamOf('b').length;
      if (a > b2) this.endRound('a');
      else if (b2 > a) this.endRound('b');
      else {
        // draw: no points, replay round
        this.roundDraw = true;
        this.endRound(null);
      }
    }
  }

  dispose() {
    for (const b of this.bots) {
      this.game.scene.remove(b.mesh);
      b.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.bots = [];
    for (const l of this.loot) this.game.scene.remove(l.mesh);
    this.loot = [];
  }
}
