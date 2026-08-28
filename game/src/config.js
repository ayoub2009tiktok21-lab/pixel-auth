// ============================================================
// IRONLINE — central tuning configuration
// ============================================================

export const CFG = {
  version: 3,
  world: {
    size: 128,          // map square size (m)
    fogNear: 60, fogFar: 150,
  },

  player: {
    radius: 0.36,
    eyeStanding: 1.60, eyeCrouch: 0.98, eyeSlide: 0.62,
    walk: 4.0, sprint: 6.6, crouch: 2.2, ads: 3.0,
    accel: 34, decel: 42,
    jump: 5.35, gravity: 14.2, airControl: 0.42,
    slideSpeed: 8.8, slideTime: 0.78,
    hp: 100,
    fovHip: 72,
    landShake: 0.05,
  },

  weapons: {
    ak: {
      id: 'ak', name: 'AK-47', auto: true,
      adsFov: 50,
      rpm: 600, magSize: 30, reserveMax: 90, reserve: 90,
      dmg: { body: 34, head: 78, limb: 24 },
      reloadTime: 2.3, switchTime: 0.6,
      hipSpread: 0.0125, adsSpread: 0.0026,
      moveSpread: { walk: 0.004, sprint: 0.011, air: 0.02, crouch: -0.0035, slide: 0.016, ads: 0.0004 },
      recoil: {
        // [pitchDeg, yawDeg] per successive shot (cycled), jittered
        pattern: [
          [1.62, 0.18], [1.74, 0.52], [1.58, -0.4], [1.86, 0.44], [1.64, -0.58],
          [1.78, 0.24], [1.66, -0.3], [1.82, 0.5], [1.52, -0.22], [1.7, 0.38],
          [1.6, -0.48], [1.76, 0.28],
        ],
        jitter: 0.3,       // degrees of random spread on top of pattern
        camFrac: 0.46,     // fraction of viewmodel kick applied to camera
        spring: 7.2,       // camera recovery stiffness
        damp: 5.2,
        adsMul: 0.62,
        crouchMul: 0.85,
        firstBoost: 1.0,
      },
      vm: {
        // viewmodel transforms (position x,y,z + rotation pitch,yaw,roll in rad)
        hip:  { pos: [0.265, -0.235, -0.52], rot: [0.02, -0.06, -0.02] },
        ads:  { pos: [0.0,   -0.117, -0.40], rot: [0, 0, 0] },
        muzzle: [0.012, 0.004, -1.29],   // in weapon-model space
      },
      kick: { back: 0.055, up: -0.02, rot: 0.05 },
    },
    pistol: {
      id: 'pistol', name: 'M9-12', auto: false,
      adsFov: 48,
      rpm: 430, magSize: 15, reserveMax: 45, reserve: 45,
      dmg: { body: 26, head: 55, limb: 16 },
      reloadTime: 1.55, switchTime: 0.45,
      hipSpread: 0.010, adsSpread: 0.0022,
      moveSpread: { walk: 0.0035, sprint: 0.009, air: 0.016, crouch: -0.003, slide: 0.013, ads: 0.0003 },
      recoil: {
        pattern: [
          [0.78, 0.1], [0.86, 0.26], [0.72, -0.2], [0.84, 0.18], [0.76, -0.14],
        ],
        jitter: 0.16,
        camFrac: 0.34,
        spring: 8.5,
        damp: 5.6,
        adsMul: 0.55,
        crouchMul: 0.85,
        firstBoost: 1.0,
      },
      vm: {
        hip:  { pos: [0.21, -0.245, -0.44], rot: [0.0, -0.03, -0.01] },
        ads:  { pos: [0.0,  -0.128, -0.34], rot: [0, 0, 0] },
        muzzle: [0.0, 0.012, -0.34],
      },
      kick: { back: 0.04, up: -0.012, rot: 0.035 },
    },
  },

  loot: {
    table: [ // weighted outcomes when an enemy dies
      { ammo: 30, hp: 0, w: 40 },
      { ammo: 0, hp: 25, w: 30 },
      { ammo: 20, hp: 15, w: 22 },
      { ammo: 45, hp: 25, w: 8 },
    ],
    pickupRadius: 1.35,
  },

  ai: {
    senseRate: 12,          // Hz vision checks (staggered)
    thinkRate: 6,           // Hz decisions
    vision: { fov: Math.PI * 0.62, range: 55 },   // ~112 deg
    hearShot: 65, hearFoot: 14,
    // difficulty presets: reaction [min,max] s, aimErrDeg, headChance, coverUse, groupFollow, search, burst [min,max]
    difficulty: {
      easy:   { react: [0.55, 0.95], aimErr: 4.6, head: 0.03, cover: 0.35, follow: 0.55, search: 0.5, burst: [2, 4] },
      normal: { react: [0.38, 0.68], aimErr: 2.9, head: 0.06, cover: 0.6, follow: 0.4, search: 0.7, burst: [3, 6] },
      hard:   { react: [0.26, 0.48], aimErr: 1.9, head: 0.09, cover: 0.75, follow: 0.3, search: 0.85, burst: [3, 8] },
      expert: { react: [0.17, 0.34], aimErr: 1.25, head: 0.13, cover: 0.9, follow: 0.25, search: 1.0, burst: [4, 9] },
    },
    botHp: 100,
    botDmgMul: { easy: 0.7, normal: 0.85, hard: 1.0, expert: 1.15 },
    stuckTime: 0.55,
    separation: 1.6,        // m — bots avoid stacking
  },

  match: {
    teamSize: 4,
    roundsToWin: 5,
    roundTimeout: 200,      // s
    roundEndPause: 3.6,
    lobbyTime: 2.6,
  },

  quality: {
    low:    { dpr: 1.0, shadow: 0,    shadowSize: 512,  particles: 0.35, grass: 0.3, aa: 0, fogMul: 0.75, lod: 1 },
    medium: { dpr: 1.4, shadow: 1,    shadowSize: 1024, particles: 0.65, grass: 0.6, aa: 0, fogMul: 1.0, lod: 0 },
    high:   { dpr: 1.8, shadow: 1,    shadowSize: 2048, particles: 1.0, grass: 1.0, aa: 2, fogMul: 1.1, lod: 0 },
    ultra:  { dpr: 2.4, shadow: 1,    shadowSize: 2048, particles: 1.0, grass: 1.0, aa: 4, fogMul: 1.25, lod: 0, softShadow: true },
  },
  fpsCaps: [30, 60, 90, 120],
};

// default user settings (persisted to localStorage)
export const DEFAULTS = {
  version: CFG.version,
  sensitivity: {
    camera: 1.0,      // master 0.4 .. 2.4
    ads: 0.55,        // 0.3 .. 1.0
    vertical: 0.9,    // 0.5 .. 1.4
    firing: 0.85,     // 0.5 .. 1.2
  },
  gyro: { enabled: false, sens: 1.0 },
  graphics: {
    quality: 'high',
    shadows: 'auto',     // auto|on|off
    aa: 'auto',          // auto|off|msaa
    viewDist: 1.0,       // 0.6 .. 1.3
    fov: 0,              // 0 = weapon default
    fpsCap: 60,          // 30|60|90|120|0(auto)
    dynRes: true,
  },
  audio: { master: 0.9, sfx: 1.0 },
  gameplay: {
    haptics: true,
    killfeed: true,
    difficulty: 'normal',
    crosshairDot: true,
  },
  // HUD layout: per-control {x%, y%, scale, opacity, visible}
  hud: {
    fire:   { x: 88, y: 82, s: 1.0, o: 0.92, v: true },
    aim:    { x: 74.5, y: 87, s: 0.86, o: 0.85, v: true },
    jump:   { x: 66, y: 76, s: 0.7, o: 0.8, v: true },
    crouch: { x: 80, y: 68, s: 0.72, o: 0.85, v: true },
    reload: { x: 70, y: 62, s: 0.6, o: 0.75, v: true },
    swap:   { x: 58.5, y: 70, s: 0.6, o: 0.75, v: true },
    pause:  { x: 4.5, y: 5, s: 0.62, o: 0.7, v: true },
    joy:    { x: 15, y: 82, s: 1.0, o: 0.9, v: true },
  },
};

export const TEAM_NAMES = { a: 'IRON', b: 'ASH' };
export const MAP_NAME = 'Kharan Crossing';
