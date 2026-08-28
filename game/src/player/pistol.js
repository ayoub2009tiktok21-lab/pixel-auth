// ============================================================
// "M9-12" — original 9mm service pistol viewmodel.
// Model space: origin at grip top center, barrel toward -Z, up +Y.
// ============================================================
import * as THREE from 'three';

export function buildPistol(mats) {
  const g = new THREE.Group();
  const SL = mats.wSlide, FR = mats.wPolymer, DP = mats.wMetalDark;

  const box = (sx, sy, sz, x, y, z, mat, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  // ---- slide ----
  box(0.03, 0.034, 0.185, 0, 0.022, -0.055, SL);
  // slide top chamfer
  box(0.028, 0.008, 0.16, 0, 0.041, -0.06, SL, 0, 0, 0.04);
  // rear serrations (3 notches)
  for (let i = 0; i < 3; i++) {
    box(0.032, 0.02, 0.006, 0, 0.018, 0.012 + i * 0.011, DP);
  }
  // ejection port hint
  box(0.004, 0.012, 0.05, 0.016, 0.03, -0.02, DP);
  // front sight (slide)
  box(0.008, 0.009, 0.012, 0, 0.047, -0.135, DP);
  // rear sight
  box(0.026, 0.012, 0.02, 0, 0.047, 0.02, DP);
  box(0.004, 0.012, 0.02, 0, 0.047, 0.02, SL); // notch

  // ---- frame ----
  box(0.027, 0.026, 0.15, 0, -0.002, -0.075, FR);
  // barrel tip visible under slide
  {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 8), DP);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.012, -0.15);
    g.add(b);
  }
  // dust cover
  box(0.026, 0.012, 0.1, 0, -0.018, -0.07, FR);

  // ---- grip (polymer, angled) ----
  {
    const grip = new THREE.Group();
    grip.position.set(0, -0.02, 0.03);
    grip.rotation.x = 0.3;
    const gm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.115, 0.034), FR);
    gm.position.y = -0.055;
    grip.add(gm);
    // grip panels (slightly proud, darker)
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.08, 0.02), DP);
    p1.position.set(0, -0.055, 0);
    grip.add(p1);
    // mag base plate
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.014, 0.038), DP);
    base.position.set(0, -0.118, 0.004);
    grip.add(base);
    g.add(grip);
  }

  // ---- trigger + guard ----
  box(0.005, 0.02, 0.006, 0, -0.03, -0.012, DP);
  box(0.006, 0.006, 0.05, 0, -0.042, -0.038, FR);   // guard bottom
  box(0.006, 0.016, 0.006, 0, -0.033, -0.058, FR);   // guard front

  // ---- hammer + safety (rear) ----
  box(0.014, 0.014, 0.018, 0, 0.008, 0.052, DP);
  box(0.012, 0.008, 0.02, 0.018, 0.0, 0.04, DP);

  g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.155);
  g.userData.sight = new THREE.Vector3(0, 0.04, -0.135);
  return g;
}
