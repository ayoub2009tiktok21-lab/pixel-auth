// ============================================================
// AK-47 viewmodel — procedurally built, ~870 mm overall length.
// Model space: origin at receiver center, barrel toward -Z, up +Y, left +X.
// ============================================================
import * as THREE from 'three';

export function buildAK47(mats) {
  const g = new THREE.Group();
  const W = mats.wMetal, WD = mats.wMetalDark, WDwood = mats.wWood, DP = mats.wPolymer;

  const box = (sx, sy, sz, x, y, z, mat, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = false;
    g.add(m);
    return m;
  };
  const cyl = (r0, r1, len, x, y, z, mat, axis = 'z', seg = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg), mat);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  // ---- receiver (steel, ribbed) ----
  box(0.034, 0.056, 0.31, 0, 0, -0.03, W);
  box(0.036, 0.04, 0.16, 0, 0.006, -0.06, WD); // lower band
  // charging handle recess
  box(0.012, 0.012, 0.1, 0.019, 0.02, -0.02, WD);

  // ---- bolt handle (right side) ----
  cyl(0.004, 0.004, 0.05, 0.03, 0.004, -0.02, W, 'x', 6);
  box(0.008, 0.008, 0.03, 0.055, 0.004, -0.02, W);

  // ---- gas block + gas tube ----
  box(0.024, 0.026, 0.05, 0, 0.028, -0.44, W);
  cyl(0.0085, 0.0085, 0.24, 0, 0.032, -0.33, W, 'z', 8);

  // ---- barrel ----
  cyl(0.0115, 0.0115, 0.44, 0, 0.008, -0.42, W, 'z', 12);

  // ---- muzzle brake (slotted drum) ----
  cyl(0.0165, 0.0145, 0.05, 0, 0.008, -0.635, WD, 'z', 12);
  // slot notches
  for (let i = 0; i < 3; i++) {
    box(0.004, 0.012, 0.02, 0.0165, 0.008, -0.62 - i * 0.014, WDwood);
  }

  // ---- front sight (post + protective ear) ----
  box(0.011, 0.052, 0.014, 0, 0.045, -0.505, W);
  box(0.004, 0.03, 0.02, 0.012, 0.03, -0.505, W); // left ear
  box(0.011, 0.016, 0.011, 0, 0.072, -0.505, W); // top

  // ---- rear sight (notch) ----
  box(0.016, 0.018, 0.03, 0, 0.042, 0.095, W);
  box(0.004, 0.018, 0.016, 0, 0.042, 0.095, WD); // notch gap

  // ---- wooden handguard ----
  box(0.052, 0.042, 0.24, 0, -0.012, -0.315, WDwood);
  box(0.054, 0.014, 0.24, 0, 0.012, -0.315, WDwood); // top rail section
  // handguard screws
  for (const z of [-0.24, -0.39]) {
    cyl(0.005, 0.005, 0.054, 0, -0.002, z, WD, 'x', 6);
  }

  // ---- pistol grip (wood, angled) ----
  {
    const grip = new THREE.Group();
    grip.position.set(0, -0.045, 0.105);
    grip.rotation.x = 0.32;
    const gm = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.095, 0.032), WDwood);
    gm.position.y = -0.04;
    grip.add(gm);
    box(0.029, 0.02, 0.034, 0, 0.012, 0, WDwood); // grip base plate
    g.add(grip);
  }

  // ---- trigger + guard ----
  box(0.006, 0.026, 0.008, 0, -0.038, -0.015, W); // trigger
  box(0.008, 0.008, 0.1, 0, -0.052, -0.045, W);   // guard bottom
  box(0.008, 0.024, 0.008, 0, -0.04, 0.0, W);      // guard front
  box(0.008, 0.024, 0.008, 0, -0.04, -0.09, W);    // guard back

  // ---- curved 7.62 magazine (banana) ----
  {
    const mag = new THREE.Group();
    mag.position.set(0, -0.028, -0.045);
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const a = 0.35 + i * 0.16; // increasing curve
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.062, 0.044), i % 2 ? W : WD);
      const cum = (0.35 + i * 0.16) * 0.5 * i * 0.5 + 0.02;
      seg.position.set(0, -(0.02 + i * 0.048 + Math.sin(i * 0.18) * 0.012), -0.02 - i * 0.042);
      seg.rotation.x = 0.3 + i * 0.17;
      mag.add(seg);
    }
    // mag lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.05), W);
    lip.position.set(0, 0.008, -0.02);
    lip.rotation.x = 0.3;
    mag.add(lip);
    g.add(mag);
    g.userData.magGroup = mag;
  }

  // ---- wooden stock ----
  {
    const stock = new THREE.Group();
    stock.position.set(0, -0.004, 0.145);
    stock.rotation.x = -0.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.24), WDwood);
    body.position.set(0, -0.012, 0.12);
    body.rotation.x = 0.08;
    stock.add(body);
    // comb step
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.034, 0.12), WDwood);
    comb.position.set(0, 0.024, 0.1);
    stock.add(comb);
    // steel butt plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.062, 0.014), W);
    plate.position.set(0, -0.014, 0.245);
    plate.rotation.x = 0.08;
    stock.add(plate);
    g.add(stock);
  }

  // ---- selector lever (left) ----
  box(0.012, 0.008, 0.05, -0.022, -0.004, 0.02, W);

  // muzzle marker (exact muzzle world point reference)
  g.userData.muzzle = new THREE.Vector3(0, 0.008, -0.665);
  g.userData.sight = new THREE.Vector3(0, 0.05, -0.505); // front sight post
  return g;
}
