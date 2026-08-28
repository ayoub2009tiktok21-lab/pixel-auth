// ============================================================
// IRONLINE — game bootstrap & main loop
// Works in browser (WebGL) and Node (null renderer, for tests).
// ============================================================
import * as THREE from 'three';
import { CFG, TEAM_NAMES } from './config.js';
import { loadSettings, saveSettings } from './core/save.js';
import { Emitter } from './core/events.js';
import { clamp, damp } from './core/math.js';
import { makeMaterials, makeSkyTexture } from './world/materials.js';
import { buildMap } from './world/map.js';
import { moveCircle } from './world/colliders.js';
import { PlayerController } from './player/controller.js';
import { WeaponSystem } from './player/weapons.js';
import { ViewModel } from './player/viewmodel.js';
import { FX } from './fx/fx.js';
import { AudioEngine } from './audio/audio.js';
import { TouchInput } from './input/touch.js';
import { UI } from './ui/ui.js';
import { Match } from './match/match.js';
import { Perf, measureDisplayRate } from './perf/perf.js';
import { platform } from './platform/native.js';

export class NullRenderer {
  constructor() {
    this.domElement = null;
    this.shadowMap = { enabled: false };
    this.info = { render: { calls: 0, triangles: 0 } };
  }
  setPixelRatio() {}
  setSize() {}
  render() {}
  dispose() {}
}

export function createGame(opts = {}) {
  const isNode = !!opts.isNode || typeof window === 'undefined';
  const canvas = opts.canvas || null;
  const dom = opts.dom || (typeof document !== 'undefined' ? document.body : null);

  // renderer
  let renderer;
  if (!isNode && canvas) {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
    renderer = new NullRenderer();
  }

  const settings = opts.settings || loadSettings();
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xc9bfa4, CFG.world.fogNear, CFG.world.fogFar);

  const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 400);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // lights
  const hemi = new THREE.HemisphereLight(0xbcd3e8, 0x8a7a63, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c4, 1.75);
  sun.position.set(42, 58, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // map
  const mats = makeMaterials();
  const map = buildMap(scene, mats);
  const { coll, spawns, coverPoints, nav, grassSpots } = map;

  // grass
  let grassMesh = null;
  const buildGrass = (mul) => {
    if (grassMesh) { scene.remove(grassMesh); grassMesh.geometry.dispose(); grassMesh.material.dispose(); }
    const count = Math.floor(grassSpots.length * mul);
    if (count <= 0) return;
    const geo = new THREE.PlaneGeometry(0.34, 0.5);
    geo.translate(0, 0.25, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6d8a4a, roughness: 1, side: THREE.DoubleSide,
    });
    grassMesh = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const v = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const sp = grassSpots[i];
      eul.set(randTilt(sp.r), sp.r, randTilt(sp.r * 1.3));
      q.setFromEuler(eul);
      v.set(sp.s, sp.s, sp.s);
      m4.compose(new THREE.Vector3(sp.x, 0, sp.z), q, v);
      grassMesh.setMatrixAt(i, m4);
      col.setHSL(0.24 + sp.tint * 0.05, 0.35 + sp.tint * 0.2, 0.3 + sp.tint * 0.14);
      grassMesh.setColorAt(i, col);
    }
    grassMesh.receiveShadow = true;
    scene.add(grassMesh);
  };
  function randTilt(a) { return Math.sin(a * 3.1) * 0.28; }

  // ---------- game object ----------
  const game = {
    CFG, settings, renderer, scene, camera, canvas, dom,
    coll, nav, coverPoints, spawns, mats,
    events: new Emitter(),
    time: 0,
    match: null,
    player: null,
    weapons: null,
    viewmodel: null,
    fx: null,
    audio: new AudioEngine(),
    input: null,
    ui: null,
    perf: new Perf(),
    platform,
    isNode,
    grassMeshBuild: buildGrass,
  };

  game.difficulty = () => CFG.ai.difficulty[game.settings.gameplay.difficulty] || CFG.ai.difficulty.normal;
  game.moveBot = (x, z, dx, dz, bodyH) => moveCircle(coll, x, z, dx, dz, 0.34, 0.2, bodyH);
  game.save = () => saveSettings(game.settings);
  game.haptics = (ms) => { if (game.settings.gameplay.haptics) platform.vibrate(ms); };
  game.playerTeam = 'a';

  // player
  game.player = new PlayerController(game, spawns.a[0]);
  game.weapons = new WeaponSystem(game);
  game.viewmodel = new ViewModel(camera, mats, CFG.weapons);
  game.fx = new FX(scene, mats, 1);

  // input + UI (browser only)
  if (!isNode) {
    game.input = new TouchInput(game);
    game.input.attach();
    game.ui = new UI(game);
    resize();
    window.addEventListener('resize', resize);
    measureDisplayRate(80, (r) => platform.setDisplayRate(r));
    game.ui.showMenu();
  }

  // ---------- quality ----------
  game.applyQuality = () => {
    const q = CFG.quality[game.settings.graphics.quality] || CFG.quality.high;
    const shSetting = game.settings.graphics.shadows;
    const shadowOn = shSetting === 'on' ? 1 : shSetting === 'off' ? 0 : q.shadow;
    if (renderer.shadowMap) renderer.shadowMap.enabled = !!shadowOn;
    if (shadowOn && sun.shadow.map) {
      sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * q.dpr * game.perf.dynScale;
    renderer.setPixelRatio(clamp(dpr, 0.5, 2.6));
    const vd = game.settings.graphics.viewDist;
    scene.fog.far = CFG.world.fogFar * vd * q.fogMul;
    scene.fog.near = CFG.world.fogNear * vd;
    const pMul = q.particles * (game.perf.dynScale < 0.8 ? 0.6 : 1);
    game.fx.setQuality(pMul);
    buildGrass(q.grass * (game.perf.dynScale < 0.75 ? 0.5 : 1));
    game.applyQualitySize();
  };
  game.applyQualitySize = () => {
    if (!game.dom) return;
    resize();
  };
  function resize() {
    if (!game.dom) return;
    const w = game.dom.clientWidth || 640;
    const h = game.dom.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (game.ui) game.ui.applyHudLayout();
  }

  // ---------- match lifecycle ----------
  game._unsubs = [];
  game.startMatch = () => {
    if (!game.match) game.match = new Match(game);
    wireMatchEvents(game.match);
    game.match.startMatch();
  };
  game.newMatch = () => {
    game._unsubs.forEach((f) => f());
    game._unsubs = [];
    game.match.dispose();
    game.match = new Match(game);
    wireMatchEvents(game.match);
    game.match.startMatch();
  };
  game.toMenu = () => {
    game.paused = false;
    if (game._unsubs) game._unsubs.forEach((f) => f());
    game._unsubs = [];
    if (game.ui) game.ui.showMenu();
    if (game.match) { game.match.dispose(); game.match = null; }
    game.matchActive = false;
  };
  game.togglePause = (on) => {
    if (game.isNode || !game.ui) return;
    const m = game.match;
    const inMatch = !!(m && ['lobby', 'active', 'roundEnd'].includes(m.state));
    if (on === undefined) on = !game.paused;
    if (on && !inMatch) return;
    game.paused = on;
    game.ui.showPause(on);
  };

  // ---------- events wiring ----------
  function wireMatchEvents(m) {
    m.events = game.events;
    const on = (ev, fn) => game._unsubs.push(m.events.on(ev, fn));
    on('lobby', (d) => {
      if (game.ui) {
        game.ui.banner('', `${TEAM_NAMES.a}  VS  ${TEAM_NAMES.b}`, `Round ${d.round}`);
        game.ui._setButtonsVisible(true);
      }
    });
    on('roundStart', () => {
      game.playerAlive = true;
      if (game.ui) { game.ui.hideBanner(); game.ui.showDeath(false); }
    });
    on('roundEnd', (d) => {
      if (game.ui) {
        if (d.winner) game.ui.banner(d.winner, `${TEAM_NAMES[d.winner]} TAKE THE ROUND`, `Round ${d.round} — ${d.score.a} : ${d.score.b}`);
        else game.ui.banner('', 'ROUND DRAW — REPLAY', `Round ${d.round}`);
      }
    });
    on('matchEnd', (d) => {
      if (game.ui) game.ui.showMatchEnd(d);
    });
    on('playerDied', () => {
      game.playerAlive = false;
      if (game.ui) game.ui.showDeath(true);
      game.haptics(120);
    });
    on('playerHit', () => {
      game.audio.play('hit');
    });
    on('kill', (d) => {
      if (d.killer && d.killer.isPlayer) {
        game.audio.play('hit');
        game.haptics(60);
      }
    });
    on('slide', () => game.audio.play('slide'));
    on('jump', () => game.audio.play('thump', null, 0));
    on('land', () => game.audio.play('thump', null, 0));
    on('footstep', (d) => { if (Math.random() < 0.8) game.audio.play('step', null, 0); });
    on('reloadstart', (d) => game.audio.reloadSeq(d.weapon));
    on('botShot', (d) => {
      if (d.shooter.team === 'a') {
        // allies hearing each other too
      }
      for (const b of game.match.bots) {
        if (b.alive && b !== d.shooter) b.hearShot(d.pos, d.shooter);
      }
    });
    on('playerShot', (d) => {
      for (const b of game.match.bots) {
        if (b.alive) b.hearShot(d.pos, game.match.playerEnt);
      }
      game.match.teamKnow('a', game.match.playerEnt, game.player.pos);
    });
  }

  // ---------- update ----------
  game.paused = false;
  game.update = (dt, preInput = null) => {
    game.time += dt;
    const m = game.match;
    game.matchActive = !!(m && m.state === 'active');

    if (m && m.state !== 'idle') {
      const input = preInput ?? (game.input ? game.input.consume() : { mx: 0, mz: 0, fire: false, aim: false, jump: false, crouch: false, reload: false, swap: false, pause: false, camDX: 0, camDY: 0 });

      if (game.matchActive) {
        // camera look
        if (game.playerAlive) {
          if (input.camDX || input.camDY) game.player.look(input.camDX, input.camDY);
          if (input.jump) game.player.onJump();
          if (input.crouch) game.player.onLowButton();
        }
        // movement (frozen when dead)
        if (game.playerAlive) {
          game.player.update(dt, {
            mx: input.mx, mz: input.mz, ads: game.weapons.ads,
          }, coll);
        }
        // weapons
        if (game.playerAlive) {
          if (input.reload) game.weapons.startReload();
          if (input.swap) game.weapons.swap();
          game.weapons.update(dt, { fire: input.fire, ads: input.aim });
        }
      }
      // match (bots, loot, round logic) — runs in every match state
      m.update(dt);

      // player entity sync
      m.playerEnt.crouching = game.player.crouching || game.player.sliding;

      // viewmodel
      game.viewmodel.update(dt, {
        speed: game.player.speed,
        ads: game.weapons.ads,
        moving: game.player.moving || game.player.speed > 0.5,
        crouching: game.player.crouching || game.player.sliding,
        airborne: game.player.airborne,
        fireHeld: input.fire,
        reloadActive: game.weapons.reloading,
      });

      // camera sync
      const eye = game.player.eye(new THREE.Vector3());
      camera.position.copy(eye);
      camera.rotation.y = game.player.yaw;
      camera.rotation.x = game.player.pitch + game.weapons.rec.p;
      camera.rotation.z = 0;
      const targetFov = game.settings.fov || CFG.player.fovHip;
      const adsFov = game.weapons.def.adsFov;
      const wantFov = targetFov + (adsFov - targetFov) * game.weapons.adsBlend;
      camera.fov = damp(camera.fov, wantFov, 12, dt);
      camera.updateProjectionMatrix();

      // audio listener
      game.audio.setListener(eye.x, eye.y, eye.z);

      // fx
      game.fx.update(dt);
    }

    // perf
    if (!isNode) {
      const cap = game.settings.graphics.fpsCap || 60;
      game.perf.cap = cap;
      if (game.settings.graphics.dynRes) {
        game.perf._tick = (game.perf._tick || 0) + dt;
        if (game.perf._tick > 1) {
          game.perf._tick = 0;
          game.perf.evaluate(cap);
          if (Math.abs(game.perf.dynScale - (game._lastScale || 1)) > 0.001) {
            game._lastScale = game.perf.dynScale;
            game.applyQuality();
          }
        }
      }
      if (game.ui && (m && m.state !== 'idle')) game.ui.updateHUD(dt);
    }
  };

  game.render = () => renderer.render(scene, camera);

  // initial quality
  game.applyQuality();

  return game;
}

// ---------- browser boot ----------
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('game')) {
  const canvas = document.getElementById('game');
  const game = createGame({ canvas });
  window.game = game; // debug/test access
  window.__ironlineBooted = true;

  let last = performance.now();
  let lastFrame = 0;
  const loop = (t) => {
    requestAnimationFrame(loop);
    const cap = game.settings.graphics.fpsCap || 60;
    const target = 1000 / cap;
    if (t - lastFrame < target - 1.2) return; // fps cap
    lastFrame = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) dt = 0.001;
    // consume pause edge outside the sim so it works while paused
    let preInput = null;
    if (game.input) {
      preInput = game.input.consume();
      if (preInput.pause) game.togglePause();
    }
    game.perf.frame(dt * 1000);
    if (!game.paused) {
      game.update(dt, preInput);
    }
    game.render();
  };
  requestAnimationFrame(loop);

  // native back button → pause (in match) or menu
  platform.onBack(() => {
    if (game.match && ['lobby', 'active', 'roundEnd'].includes(game.match.state)) game.togglePause(true);
    else game.toMenu();
  });
}
