#!/usr/bin/env node
// ============================================================
// IRONLINE — APK build (no Gradle, no Android Studio).
// Toolchain:
//   aapt (v1) + d8 + apksigner + zipalign  (AOSP build-tools 30.0.3)
//   android.jar 30                          (AOSP fullsdk platform)
//   JDK 17                                  (local .tools or CI)
// aapt v1 resolves android:* attributes against the real android.jar,
// so the compiled manifest carries the exact framework resource IDs.
// ============================================================
import { execSync } from 'node:child_process';
import { mkdirSync, cpSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GAME = join(here, '..', '..');
// toolchain paths: CI env overrides (GitHub runners), otherwise local .tools
const BT = process.env.IRONLINE_BT || '/home/user/pixel-auth/.tools/android-sdk/build-tools/30.0.3';
const PLAT = process.env.IRONLINE_PLAT || '/home/user/pixel-auth/.tools/android-sdk/platforms/android-30';
const LOCAL_JRE = '/home/user/pixel-auth/.tools/node_modules/javajre-linux-64/jre';
const JAVABIN = process.env.IRONLINE_JAVA || (existsSync(LOCAL_JRE + '/bin/java') ? LOCAL_JRE + '/bin' : 'java');
const javac = JAVABIN === 'java' ? 'javac' : `${JAVABIN}/javac`;
const keytool = JAVABIN === 'java' ? 'keytool' : `${JAVABIN}/keytool`;
const JAVA_HOME_FOR_ENV = JAVABIN === 'java' ? process.env.JAVA_HOME : join(JAVABIN, '..');
const OUT = join(here, 'build');
const FINAL_DIR = join(here, '..', '..', '..', 'APK');

const sh = (cmd, opts = {}) => execSync(cmd, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(JAVA_HOME_FOR_ENV ? { JAVA_HOME: JAVA_HOME_FOR_ENV } : {}),
    ...(JAVABIN !== 'java' ? { PATH: `${JAVABIN}:${process.env.PATH}` } : {}),
  },
  ...opts,
});
const log = (m) => console.log(`\n\==> ${m}`);

// ---------- 0. sanity ----------
for (const p of [join(BT, 'aapt2'), join(BT, 'd8'), join(BT, 'apksigner'), join(BT, 'zipalign'), join(PLAT, 'android.jar')]) {
  if (!existsSync(p)) { console.error('missing toolchain file:', p); process.exit(1); }
}
const AAPT2 = join(BT, 'aapt2');
const AAPT = join(BT, 'aapt');
const ANDROID_JAR = join(PLAT, 'android.jar');

// ---------- 1. (framework stub not needed — aapt v1 resolves android IDs from android.jar) ----------

// ---------- 2. stage res + assets ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'res/mipmap-xxxhdpi'), { recursive: true });
mkdirSync(join(OUT, 'res/values'), { recursive: true });
mkdirSync(join(OUT, 'assets/game'), { recursive: true });

log('generating launcher icon');
sh(`python3 "${join(here, 'make-icon.py')}" "${join(OUT, 'res/mipmap-xxxhdpi/ic_launcher.png')}"`);
cpSync(join(here, 'res/values/strings.xml'), join(OUT, 'res/values/strings.xml'));

log('bundling game (classic script for file:// WebView)');
sh(`node "${join(GAME, 'build-web.mjs')}"`);
log('staging game assets');
for (const f of ['index.html', 'manifest.webmanifest', 'ironline.js']) {
  cpSync(join(GAME, f), join(OUT, 'assets/game', f));
}
sh(`python3 "${join(here, 'make-icon.py')}" "${join(OUT, 'assets/game/icon.png')}"`);

// ---------- 3. aapt (v1) package: manifest + res + assets ----------
// aapt v1 resolves android:* attributes against the real android.jar,
// producing exact framework resource IDs.
log('aapt package (manifest + res + assets)');
sh(`"${AAPT}" package -f -M "${join(here, 'AndroidManifest.xml')}" -S "${join(OUT, 'res')}" -A "${join(OUT, 'assets')}" --min-sdk-version 24 --target-sdk-version 30 -I "${ANDROID_JAR}" -F "${join(OUT, 'base.apk')}"`);

// ---------- 4. javac + d8 ----------
log('javac (MainActivity)');
mkdirSync(join(OUT, 'classes'), { recursive: true });
sh(`"${javac}" -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath "${ANDROID_JAR}" -d "${join(OUT, 'classes')}" "${join(here, 'src/com/pixelauth/ironline/MainActivity.java')}" 2>&1 | grep -v "warning" || true`);
log('d8 → classes.dex');
sh(`"${join(BT, 'd8')}" --lib "${ANDROID_JAR}" --min-api 24 --output "${OUT}" $(find "${join(OUT, 'classes')}" -name '*.class' | tr '\n' ' ')`);

// ---------- 5. add dex, align ----------
log('adding classes.dex + aligning');
sh(`cd "${OUT}" && zip -q base.apk classes.dex && "${join(BT, 'zipalign')}" -f 4 base.apk aligned.apk`);

// ---------- 6. sign ----------
log('signing (v1+v2)');
const KS = join(here, 'ironline.keystore');
if (!existsSync(KS)) {
  sh(`"${keytool}" -genkeypair -keystore "${KS}" -alias ironline -keyalg RSA -keysize 2048 -validity 10000 -storepass ironline -keypass ironline -dname "CN=IRONLINE, OU=Game, O=PixelAuth, L=Mobile, C=US"`);
}
sh(`"${join(BT, 'apksigner')}" sign --ks "${KS}" --ks-pass pass:ironline --key-pass pass:ironline --v1-signing-enabled true --v2-signing-enabled true --out "${join(OUT, 'IRONLINE.apk')}" "${join(OUT, 'aligned.apk')}"`);

// ---------- 7. verify ----------
log('verifying');
sh(`"${join(BT, 'apksigner')}" verify --verbose "${join(OUT, 'IRONLINE.apk')}" | head -8`);
sh(`"${AAPT2}" dump badging "${join(OUT, 'IRONLINE.apk')}" | head -6`);

// ---------- 8. final artifact ----------
mkdirSync(FINAL_DIR, { recursive: true });
const FINAL = join(FINAL_DIR, 'IRONLINE-v1.0.apk');
cpSync(join(OUT, 'IRONLINE.apk'), FINAL);
const size = readFileSync(FINAL).length;
console.log(`\n====================================================`);
console.log(`APK READY: ${FINAL}`);
console.log(`size: ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log(`====================================================`);
