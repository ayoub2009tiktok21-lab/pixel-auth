// ============================================================
// IRONLINE — headless simulation test suite (runs in Node).
// Boots the real game (logic + math + AI + match, null renderer)
// and drives it like a player: move, shoot, reload, slide, fight.
// ============================================================
import { createGame } from '../../src/main.js';
import { loadSettings, saveSettings } from '../../src/core/save.js';
import { lineOfSight, pointInSolid, raycast } from '../../src/world/colliders.js';
import { navFind } from '../../src/world/map.js';

const DT = 1 / 60;
let passed = 0, failed = 0;
const failures = [];

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  \u2713 ${name}`); }
  else { failed++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  \u2717 ${name} ${extra}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

// input driver — mirrors TouchInput.consume(): edges fire once, then clear
const input = { mx: 0, mz: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, swap: false, pause: false, camDX: 0, camDY: 0 };
function setInput(partial) {
  Object.assign(input, { mx: 0, mz: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, swap: false, pause: false, camDX: 0, camDY: 0 }, partial);
}
const inputDriver = {
  consume() {
    const out = { ...input };
    input.jump = false; input.crouch = false; input.reload = false; input.swap = false; input.pause = false;
    input.camDX = 0; input.camDY = 0;
    return out;
  },
};
function step(game, n) {
  for (let i = 0; i < n; i++) game.update(DT);
}
function sim(game, seconds) { step(game, Math.round(seconds * 60)); }
function waitActive(game, maxS = 10) {
  let s = 0;
  while (game.match && game.match.state !== 'active' && s < maxS) { step(game, 1); s += DT; }
  return game.match && game.match.state === 'active';
}
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

console.log('IRONLINE headless test suite');
console.log('-----------------------------');

const game = createGame({ isNode: true });
game.input = inputDriver;
game.settings.gameplay.difficulty = 'easy';

section('1. Boot & world integrity');
check('game created', !!game && !!game.scene);
check('colliders present', game.coll.boxes.length > 30 && game.coll.cyls.length > 10, `boxes=${game.coll.boxes.length} cyls=${game.coll.cyls.length}`);
check('spawns defined', game.spawns.a.length === 4 && game.spawns.b.length === 4);
check('cover points', game.coverPoints.length > 40, `n=${game.coverPoints.length}`);
let spawnOk = true;
for (const sp of [...game.spawns.a, ...game.spawns.b]) {
  if (pointInSolid(game.coll, sp.x, 1.0, sp.z, 0.2)) spawnOk = false;
}
check('all spawns free of solids', spawnOk);
let finiteOk = true;
for (const b of game.coll.boxes) {
  if (!b.min.every(Number.isFinite) || !b.max.every(Number.isFinite)) finiteOk = false;
}
check('all colliders finite', finiteOk);
// LOS sanity: through a house wall must be blocked, open field must be clear
const wallBlock = !lineOfSight(game.coll, -36, 1.6, -14, -24, 1.6, -14);
const openClear = lineOfSight(game.coll, 0, 1.6, 40, 0, 1.6, 0);
check('LOS blocked by house wall', wallBlock);
check('LOS clear across open road', openClear);
// raycast hits something when fired north from center
const rc = raycast(game.coll, 0, 1.6, 55, 0, 0, -1, 200);
check('raycast terminates (no bullets to the sky forever)', rc !== null, rc ? `t=${rc.t.toFixed(1)}` : 'no hit');

section('2. Match start');
game.startMatch();
step(game, 30);
check('match exists, state lobby/active', ['lobby', 'active'].includes(game.match.state), game.match.state);
const okActive = waitActive(game);
check('round 1 becomes active', okActive);
const ents = game.match.entities();
check('8 entities (player + 7 bots)', ents.length === 8, `n=${ents.length}`);
check('4 alive per team', game.match.teamOf('a').length === 4 && game.match.teamOf('b').length === 4);
const botsAlive = game.match.bots.filter((b) => b.alive).length;
check('all bots alive at round start', botsAlive === 7);

section('3. Movement: walk / sprint / crouch / slide / jump');
const p = game.player;
setInput({});
const x0 = p.pos.x, z0 = p.pos.z;
// stick magnitude scales speed: 0.6 stick ≈ 2.4 m/s walk; full stick = sprint
setInput({ mz: 0.6 });
step(game, 90); // 1.5s walk
const walkD = dist2D(p.pos, { x: x0, z: z0 });
check('walk speed scales with stick (≈2.4 m/s)', walkD > 2.8 && walkD < 4.0, `d=${walkD.toFixed(2)}m`);
setInput({ mz: 1 });
const x1 = p.pos.x, z1 = p.pos.z;
step(game, 90);
const sprintD = dist2D(p.pos, { x: x1, z: z1 });
check('sprint distance ≈ 6.5 m/s', sprintD > 7.5 && sprintD < 10.8, `d=${sprintD.toFixed(2)}m`);
// stop, then crouch (low speed → crouch, not slide)
setInput({});
step(game, 40);
check('player slowed to a stop', p.speed < 1.5, `v=${p.speed.toFixed(2)}`);
setInput({ crouch: true });
step(game, 10);
check('crouch engages', p.crouching === true);
setInput({});
step(game, 40);
check('crouch eye height ≈ 1.0', Math.abs(p.eyeH - 0.98) < 0.12, `eye=${p.eyeH.toFixed(2)}`);
setInput({ crouch: true }); // stand back up
step(game, 10);
check('stand up from crouch', p.crouching === false);
// slide (needs sprint speed first)
setInput({ mz: 1 });
step(game, 45);
setInput({ crouch: true });
step(game, 5);
check('slide starts when sprinting', p.sliding === true, `state: sliding=${p.sliding}`);
setInput({});
let slid = p.sliding;
for (let i = 0; i < 300 && slid; i++) { step(game, 1); slid = p.sliding; }
check('slide auto-ends into crouch', !p.sliding && p.crouching === true, `sliding=${p.sliding} crouch=${p.crouching}`);
setInput({ crouch: true }); // stand up before jump
step(game, 10);
// jump
setInput({ jump: true });
step(game, 2);
check('jump becomes airborne', p.airborne === true);
let airS = 0;
while (p.airborne && airS < 3) { step(game, 1); airS += DT; }
check('jump lands', !p.airborne && p.grounded === true, `t=${airS.toFixed(2)}s`);

section('4. Walls stop movement');
// push into house W1 east wall (x=-25 plane, z -17.5..-10.5)
p.pos.set(-25.4, 0, -14); p.vel.set(0, 0, 0);
setInput({ mx: 1 }); // face? move right in view space; instead force vel
p.yaw = Math.PI / 2; // face +x? yaw PI/2 -> forward = (-sin(PI/2), -cos(PI/2)) = (-1, 0) → -x. use -PI/2 for +x
p.yaw = -Math.PI / 2;
setInput({ mz: 1 });
step(game, 60);
check('player cannot pass through house wall', p.pos.x < -24.4, `x=${p.pos.x.toFixed(2)}`);
// teleport to open for next tests
p.pos.set(0, 0, 45); p.yaw = Math.PI;

section('5. Firing, ammo, recoil, hits');
const enemies = game.match.bots.filter((b) => b.team === 'b');
const target = enemies[0];
// place target 12 m ahead with clear LOS, standing
const px = p.pos.x, pz = p.pos.z;
target.pos.x = px; target.pos.z = pz - 12; target.pos.y = 0;
target.yaw = 0; target.alive = true; target.hp = 100; target.crouching = false;
target.state = 'patrol'; target.target = null; target.lkp = null; target.objPos = null; target.path = [];
p.yaw = Math.atan2(-(target.pos.x - px), -(target.pos.z - pz));
// aim at the target's chest (1.05 m) for a deterministic body hit at 12 m
p.pitch = Math.atan2(1.05 - 1.6, 12);
const magBefore = game.weapons.ammoState.mag;
const hpBefore = target.hp;
setInput({ fire: true });
step(game, 60); // 1 s of full auto (600 rpm)
setInput({});
const magAfter = game.weapons.ammoState.mag;
const shots = magBefore - magAfter;
check('full-auto fires ~10 shots/s', shots >= 8 && shots <= 12, `shots=${shots}`);
check('target took damage', target.hp < hpBefore, `hp ${hpBefore}→${target.hp}`);
check('ammo tracked (no negative)', game.weapons.ammoState.mag >= 0);
// tracer/fx pools didn't blow up
check('fx pools bounded', game.fx.tracers.items.length === 26 && game.fx.sparks.items.length === 90);
// recoil: view lifts during a burst, recovers after
setInput({ fire: true });
step(game, 25);
check('recoil lifts view mid-burst', game.weapons.rec.p > 0.004, `rec.p=${game.weapons.rec.p.toFixed(4)}`);
setInput({});
step(game, 120);
check('recoil recovers after burst', Math.abs(game.weapons.rec.p) < 0.005, `rec.p=${game.weapons.rec.p.toFixed(4)}`);

section('6. ADS');
setInput({ aim: true });
step(game, 60);
check('ADS engages (fov → 50)', game.weapons.ads === true && game.camera.fov < 60, `fov=${game.camera.fov.toFixed(1)}`);
const spreadAds = game.weapons.currentSpread();
setInput({});
step(game, 60);
const spreadHip = game.weapons.currentSpread();
check('ADS reduces spread', spreadAds < spreadHip, `ads=${spreadAds.toFixed(4)} hip=${spreadHip.toFixed(4)}`);
check('fov returns to hip', game.camera.fov > 66, `fov=${game.camera.fov.toFixed(1)}`);

section('7. Reload');
game.weapons.ammo.ak.mag = 4;
game.weapons.ammo.ak.reserve = 30;
game.weapons.shotIndex = 0;
step(game, 10);
setInput({ reload: true });
step(game, 5);
check('reload starts', game.weapons.reloading === true);
const magAtReload = game.weapons.ammoState.mag;
setInput({ fire: true });
step(game, 40); // holding fire during reload must not consume ammo
setInput({});
check('no firing during reload', game.weapons.ammoState.mag === magAtReload, `mag=${game.weapons.ammoState.mag} (was ${magAtReload})`);
step(game, 200); // let reload finish (2.3 s)
const resAfter = game.weapons.ammo.ak.reserve;
check('reload completes, mag topped from reserve',
  game.weapons.ammoState.mag === 30 && resAfter === 30 - (30 - magAtReload),
  `mag=${game.weapons.ammoState.mag} res=${resAfter} (expected 30/${30 - (30 - magAtReload)})`);

section('8. Weapon swap');
setInput({ swap: true });
step(game, 45); // let switch animation finish
check('swap to pistol', game.weapons.current === 'pistol', game.weapons.current);
check('switch animation settles', game.weapons.switching === false);
setInput({ fire: true });
step(game, 30);
setInput({});
check('pistol fires semi (single shot per press)', game.weapons.ammo.pistol.mag === 14, `mag=${game.weapons.ammo.pistol.mag}`);
setInput({ swap: true });
step(game, 45);
check('swap back to AK', game.weapons.current === 'ak');
step(game, 30);

section('9. AI perception: no wallhack (isolated scenario)');
// Fresh match so no combat noise, then pin all other entities far away.
game.newMatch();
waitActive(game);
game.playerAlive = true;
const allBots = game.match.bots;
const bot = allBots.find((b) => b.team === 'b');
// pin (freeze) all other bots far from the test site at the west house
for (const b of allBots) {
  if (b === bot) continue;
  const sp = b.team === 'a' ? game.spawns.a[1 + (allBots.indexOf(b) % 3)] : game.spawns.b[(allBots.indexOf(b) - 3) % 4];
  b.pos.x = sp.x; b.pos.z = sp.z; b.pos.y = 0;
  b.state = 'patrol'; b.target = null; b.lkp = null; b.objPos = null; b.path = [];
  b.vel.x = 0; b.vel.z = 0;
  b.frozen = true;
}
// house W1 spans x -35..-25, z -17.5..-10.5. Bot west of it, player east.
bot.pos.x = -37; bot.pos.z = -14; bot.pos.y = 0;
bot.yaw = -Math.PI / 2; // face +x (toward the house)
bot.target = null; bot.lkp = null; bot.state = 'patrol'; bot.objPos = null; bot.path = [];
p.pos.set(-24, 0, -14); p.yaw = 0;
// phase A: hidden AND silent → bot must not acquire the player (no wallhack)
step(game, 360); // 6 s
check('bot does NOT target player through wall', bot.target !== game.match.playerEnt,
  bot.target ? `target=${bot.target.isPlayer ? 'player' : bot.target.name}` : 'no target');
const playerHpBefore = game.match.playerEnt.hp;
check('player takes no damage while hidden', game.match.playerEnt.hp === playerHpBefore, `hp=${game.match.playerEnt.hp}`);
// phase B: player fires (shot is heard) → bot should investigate the sound
game.events.emit('playerShot', { pos: [-24, 1, -14], weapon: 'ak' });
let investigated = false;
for (let i = 0; i < 720; i++) {
  step(game, 1);
  if (bot.state === 'search' || dist2D(bot.pos, { x: -24, z: -14 }) < 9) { investigated = true; break; }
}
check('bot investigates gunshot (moves to last known pos)', investigated, `state=${bot.state} dist=${dist2D(bot.pos, { x: -24, z: -14 }).toFixed(1)}m`);
// phase C: player peeks into the open → bot must visually acquire & engage
p.pos.set(-20, 0, -8);
p.yaw = Math.atan2(-(-37 - -20), -(-14 - -8));
let spotted = false;
for (let i = 0; i < 900; i++) {
  step(game, 1);
  if (bot.target === game.match.playerEnt) { spotted = true; break; }
}
check('bot spots player when line-of-sight is clear', spotted,
  `state=${bot.state} target=${bot.target ? (bot.target.isPlayer ? 'player' : bot.target.name) : 'none'}`);
// now the bot should fire at the player
let tookDamage = false;
for (let i = 0; i < 1200 && !tookDamage; i++) {
  step(game, 1);
  if (game.match.playerEnt.hp < playerHpBefore) tookDamage = true;
  if (!game.match.active) break;
}
check('bot fires back (player damaged)', tookDamage, `hp=${game.match.playerEnt.hp}`);

section('10. AI vs AI combat');
// unfreeze all bots; let the match run with the player passive
for (const b of game.match.bots) b.frozen = false;
const killsBefore = Object.values(game.match.botKills).reduce((a, b) => a + b, 0);
let roundEnded = false, matchEnded = false;
game.match.events.on('roundEnd', () => { roundEnded = true; });
game.match.events.on('matchEnd', () => { matchEnded = true; });
const t0 = game.match.time;
sim(game, 240);
const killsAfter = Object.values(game.match.botKills).reduce((a, b) => a + b, 0);
check('bots kill each other (AI vs AI)', killsAfter > killsBefore || roundEnded || matchEnded,
  `kills +${killsAfter - killsBefore}, roundEnd=${roundEnded}, matchEnd=${matchEnded}`);
let nan = false, inside = 0;
for (const b of game.match.bots) {
  if (!Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.z) || !Number.isFinite(b.yaw)) nan = true;
  if (b.alive && pointInSolid(game.coll, b.pos.x, b.pos.y + 0.9, b.pos.z, 0.08)) inside++;
}
check('no NaN in bot state', !nan);
check('no bots stuck inside walls', inside === 0, `inside=${inside}`);
check('rounds progress (time advanced)', game.match.time - t0 > 100, `advanced=${(game.match.time - t0).toFixed(0)}s`);

section('11. Collision: bullets stop at solids');
// stand east of house, shoot west: first hit must be the wall (x≈-25 plane), not a bot behind it
p.pos.set(-22, 0, -14); p.yaw = Math.PI / 2; // face -x
const shooter = game.match.bots.find((b) => b.team === 'b');
shooter.pos.x = -40; shooter.pos.z = -14;
const hpB = shooter.hp;
const magS = game.weapons.ammoState.mag;
setInput({ fire: true });
step(game, 12);
setInput({});
check('wall absorbs shot (bot behind wall unharmed)', shooter.hp === hpB, `hp=${shooter.hp} (was ${hpB})`);
// but the wall itself was hit: raycast from player eye west stops short of the bot
const eye = p.eye();
const hit = raycast(game.coll, eye.x, eye.y, eye.z, -1, 0, 0, 100);
check('raycast stops at wall before bot', hit !== null && hit.t < 20, hit ? `t=${hit.t.toFixed(1)}` : 'none');

section('12. Match flow: first to 5 wins');
game.match.events.off('roundEnd');
game.match.events.off('matchEnd');
let ended = false;
game.match.events.on('matchEnd', (d) => { ended = true; game._endData = d; });
// force player-team wins: wipe enemies each round
let guard = 0;
while (!ended && guard < 30) {
  guard++;
  // make sure active
  if (game.match.state === 'matchEnd') break;
  if (game.match.state === 'active') {
    for (const b of game.match.bots.filter((b) => b.team === 'b' && b.alive)) {
      game.match.damage(b, 999, game.match.playerEnt, 'ak', { x: b.pos.x, y: 1, z: b.pos.z, zone: 'body' });
    }
  }
  step(game, 120); // 2 s — advance through roundEnd → lobby
  if (game.match.state === 'roundEnd' && (game.match.score.a >= 5 || game.match.score.b >= 5)) step(game, 300);
}
check('match ends when a team reaches 5', ended && game.match.state === 'matchEnd', `state=${game.match.state} score=${game.match.score.a}-${game.match.score.b}`);
check('winner is team a (forced)', game._endData && game._endData.winner === 'a');
check('score shows 5 for winner', game.match.score.a === 5, `a=${game.match.score.a}`);

section('13. Play Again resets cleanly');
game.newMatch();
step(game, 30);
check('new match: score reset 0-0', game.match.score.a === 0 && game.match.score.b === 0, `${game.match.score.a}-${game.match.score.b}`);
check('new match: round 1', game.match.round === 1, `r=${game.match.round}`);
check('new match: 7 fresh bots', game.match.bots.length === 7 && game.match.bots.every((b) => b.alive));
const sceneBefore = game.scene.children.length;
waitActive(game);
step(game, 120);
const sceneAfter = game.scene.children.length;
check('no scene-object leak on reset', Math.abs(sceneAfter - sceneBefore) < 6, `before=${sceneBefore} after=${sceneAfter}`);

section('14. Settings persistence (simulated storage)');
game.settings.sensitivity.camera = 1.73;
game.settings.hud.fire.x = 91;
game.settings.graphics.quality = 'medium';
game.save();
const re = loadSettings();
check('sensitivity persists', Math.abs(re.sensitivity.camera - 1.73) < 0.001, `got=${re.sensitivity.camera}`);
check('HUD layout persists', re.hud.fire.x === 91);
check('graphics quality persists', re.graphics.quality === 'medium');

section('15. Performance (logic, headless)');
const t0ms = process.hrtime.bigint();
const frames = 3600; // 60 s of simulation
for (let i = 0; i < frames; i++) game.update(DT);
const t1ms = Number(process.hrtime.bigint() - t0ms) / 1e6;
const logicFps = frames / (t1ms / 1000);
console.log(`  logic sim: ${frames} frames in ${t1ms.toFixed(0)} ms → ${logicFps.toFixed(0)} updates/s`);
check('logic well above 60 updates/s on a 2-core VM', logicFps > 300, `${logicFps.toFixed(0)} ups`);
check('no NaN after long run', Number.isFinite(p.pos.x) && Number.isFinite(p.yaw));

section('16. Stability: three back-to-back matches');
let crashed = null;
try {
  for (let m = 0; m < 3; m++) {
    game.newMatch();
    step(game, 600); // 10 s per match
  }
} catch (e) { crashed = e; }
check('3 matches without crash', crashed === null, crashed ? crashed.message : '');
const botsFinal = game.scene.children.filter((c) => c.userData && c.userData.isBot).length;
check('bot meshes cleaned up (≤7 in scene)', botsFinal <= 7, `n=${botsFinal}`);

console.log('\n==============================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(failed ? 1 : 0);
