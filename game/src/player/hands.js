// ============================================================
// First-person hands: articulated tactical gloves (palm, 4
// two-segment fingers, thumb). Different grip poses per weapon.
// Hand local space: palm center at origin, fingers toward -Z,
// thumb toward +X (right hand).
// ============================================================
import * as THREE from 'three';

function makeGlove(mats, side /* 'R' | 'L' */) {
  const g = new THREE.Group();
  const s = side === 'R' ? 1 : -1;
  const G = mats.glove, T = mats.gloveTrim;

  // forearm cuff (so the hand reads as part of an arm, not a floating mitten)
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.05, 0.09), mats.sleeve);
  cuff.position.set(0, 0.005, 0.075);
  g.add(cuff);
  const cuff2 = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.03), G);
  cuff2.position.set(0, 0.004, 0.038);
  g.add(cuff2);

  // palm
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.075), G);
  palm.position.set(0, 0, -0.02);
  g.add(palm);
  // knuckle ridge
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.012, 0.014), T);
  ridge.position.set(0, 0.008, -0.052);
  g.add(ridge);

  // fingers: 4 two-segment chains
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * 0.0118 * s;
    const len1 = 0.026, len2 = 0.022;
    const pivot = new THREE.Group();
    pivot.position.set(fx, -0.002, -0.045);
    pivot.rotation.x = -0.5;
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.0105, 0.013, len1), G);
    f1.position.z = -len1 / 2;
    pivot.add(f1);
    const pivot2 = new THREE.Group();
    pivot2.position.z = -len1;
    pivot2.rotation.x = -0.55;
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.012, len2), T);
    f2.position.z = -len2 / 2;
    pivot2.add(f2);
    pivot.add(pivot2);
    g.add(pivot);
    fingers.push({ pivot, pivot2 });
  }

  // thumb
  const thumbP = new THREE.Group();
  thumbP.position.set(0.024 * s, -0.004, -0.02);
  thumbP.rotation.set(-0.35, 0, -0.5 * s);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.013, 0.028), G);
  t1.position.z = -0.014;
  thumbP.add(t1);
  const t2 = new THREE.Group();
  t2.position.z = -0.028;
  t2.rotation.x = -0.5;
  const t3 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.012, 0.022), T);
  t3.position.z = -0.011;
  t2.add(t3);
  thumbP.add(t2);
  g.add(thumbP);

  g.userData.fingers = fingers;
  g.userData.thumb = thumbP;
  g.userData.fingerBase = -0.5;
  return g;
}

// poses: where each hand sits on each weapon (in weapon model space)
const POSES = {
  ak: {
    R: { pos: [0.004, -0.052, 0.1], rot: [0.35, 0, -0.06], curl: 0.55 },   // on pistol grip
    L: { pos: [-0.012, -0.018, -0.3], rot: [0.1, 0, 0.12], curl: 0.5 },    // cradling handguard
  },
  pistol: {
    R: { pos: [0.006, -0.062, 0.01], rot: [0.28, 0, -0.05], curl: 0.6 },   // index on grip
    L: { pos: [-0.012, -0.052, -0.01], rot: [0.24, 0, 0.1], curl: 0.55 },  // support wrap
  },
};

export function buildHands(mats) {
  return { R: makeGlove(mats, 'R'), L: makeGlove(mats, 'L') };
}

export function applyHandPose(hand, pose, t = 0, clench = 0) {
  hand.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  hand.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
  const curl = pose.curl + clench * 0.5;
  for (const f of hand.userData.fingers) {
    f.pivot.rotation.x = -0.45 - curl * 0.35;
    f.pivot2.rotation.x = -0.4 - curl * 0.5;
  }
  hand.userData.thumb.rotation.x = -0.3 - curl * 0.3;
  void t;
}

export function handPose(weaponId, side) {
  return POSES[weaponId]?.[side] || POSES.ak[side];
}
