// ============================================================
// Procedural spatial audio engine (no external assets).
// All SFX are synthesized into AudioBuffers at init time.
// 3D sounds go through PannerNode (HRTF when available).
// ============================================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.sfxBus = null;
    this.buffers = {};
    this.panPool = [];
    this.panIdx = 0;
    this.volumes = { master: 0.9, sfx: 1.0 };
    this.windGain = null;
  }

  ensure() {
    if (this.ready) return true;
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) { return false; }
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    this.renderBuffers();
    this.ready = true;
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
  }
  setVolumes(master, sfx) {
    this.volumes.master = master;
    this.volumes.sfx = sfx;
    this.applyVolumes();
  }

  // ---------- buffer synthesis ----------
  mkBuf(dur, fn) {
    const sr = this.ctx.sampleRate;
    const n = Math.max(1, Math.floor(dur * sr));
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      fn(d, sr, ch);
    }
    return buf;
  }

  renderBuffers() {
    // AK-47: deep boom + body crack
    this.buffers.ak = this.mkBuf(0.42, (d, sr) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        // low-passed noise body
        last += 0.12 * (n - last);
        const body = last * Math.exp(-t * 16) * 2.2;
        // sub thump with pitch drop
        const f = 95 * Math.exp(-t * 9) + 52;
        const sub = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 20) * 0.9;
        // crack transient
        const crack = (Math.random() * 2 - 1) * Math.exp(-t * 110) * 1.1;
        d[i] = clampA((body + sub + crack) * (0.9 + Math.random() * 0.2));
      }
    });
    // pistol: shorter, brighter
    this.buffers.pistol = this.mkBuf(0.28, (d, sr) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        last += 0.28 * (n - last);
        const body = last * Math.exp(-t * 30) * 2.4;
        const sub = Math.sin(2 * Math.PI * (140 * Math.exp(-t * 14) + 80) * t) * Math.exp(-t * 34) * 0.55;
        const crack = (Math.random() * 2 - 1) * Math.exp(-t * 150) * 1.0;
        d[i] = clampA((body + sub + crack) * (0.9 + Math.random() * 0.2));
      }
    });
    // reload click
    this.buffers.click = this.mkBuf(0.05, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const ring = Math.sin(2 * Math.PI * 2300 * t) * Math.exp(-t * 160);
        d[i] = clampA((Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.7 + ring * 0.5);
      }
    });
    // mag release (deeper)
    this.buffers.mag = this.mkBuf(0.09, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const ring = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 60);
        d[i] = clampA((Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.8 + ring * 0.8);
      }
    });
    // footstep
    this.buffers.step = this.mkBuf(0.07, (d, sr) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        last += 0.35 * (n - last);
        d[i] = clampA(last * Math.exp(-t * 60) * 2.4 * (0.7 + 0.5 * Math.random()));
      }
    });
    // bullet impact (metal + dust)
    this.buffers.impact = this.mkBuf(0.14, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const ping = Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 90);
        const ping2 = Math.sin(2 * Math.PI * 3100 * t) * Math.exp(-t * 130);
        const dust = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.5;
        d[i] = clampA((ping * 0.6 + ping2 * 0.4 + dust) * (0.5 + Math.random() * 0.8));
      }
    });
    // slide whoosh
    this.buffers.slide = this.mkBuf(0.4, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const f = 900 * Math.exp(-t * 4);
        const env = Math.sin(Math.min(1, t / 0.4) * Math.PI);
        d[i] = clampA((Math.random() * 2 - 1) * (0.25 + 0.75 * f / 900) * env * 1.1);
      }
    });
    // jump/land thump
    this.buffers.thump = this.mkBuf(0.12, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const f = 70 * Math.exp(-t * 20) + 42;
        d[i] = clampA(Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 34) * 1.2);
      }
    });
    // wind ambience loop
    this.buffers.wind = this.mkBuf(3.0, (d, sr) => {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const n = Math.random() * 2 - 1;
        last += 0.05 * (n - last);
        const lfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.33 * t);
        d[i] = clampA(last * lfo * 0.5);
      }
    });
    // hitmarker tick
    this.buffers.hit = this.mkBuf(0.06, (d, sr) => {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        d[i] = clampA(Math.sin(2 * Math.PI * 1250 * t) * Math.exp(-t * 120) * 0.8);
      }
    });
    this.startWind();
  }

  startWind() {
    if (!this.ctx || this.windGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.wind;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.16;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.windGain = g;
  }

  // ---------- playback ----------
  play(name, pos, distHint = -1) {
    if (!this.ready) return;
    this.resume();
    const buf = this.buffers[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = this.ctx.createGain();
    g.gain.value = 1;
    if (pos && distHint === -1) {
      const p = this.getPan();
      const listener = this.listener;
      const dx = pos[0] - listener[0], dy = pos[1] - listener[1], dz = pos[2] - listener[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      p.positionX ? p.positionX.value = pos[0] : p.setPosition(pos[0], pos[1], pos[2]);
      p.positionY ? p.positionY.value = pos[1] : 0;
      p.positionZ ? p.positionZ.value = pos[2] : 0;
      const falloff = Math.max(0.03, Math.min(1, 14 / (dist + 6)));
      g.gain.value = falloff * (dist < 2 ? 1 : 1);
      src.connect(p).connect(g).connect(this.sfxBus);
      src.onended = () => { this.releasePan(p); };
    } else {
      src.connect(g).connect(this.sfxBus);
    }
    src.start();
  }

  reloadSeq(weapon) {
    if (!this.ready) return;
    const times = weapon === 'ak' ? [0.15, 0.5, 1.55, 2.05] : [0.1, 0.4, 1.0, 1.35];
    for (const t of times) setTimeout(() => this.play(t > 1 ? 'mag' : 'click'), t * 1000);
  }

  setListener(x, y, z) {
    this.listener = [x, y, z];
    if (!this.ready || !this.listenerPannerBase) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    } else if (l.setPosition) l.setPosition(x, y, z);
  }

  getPan() {
    if (!this.listenerPannerBase) {
      this.listenerPannerBase = [];
      for (let i = 0; i < 14; i++) {
        const p = this.ctx.createPanner();
        p.panningModel = 'HRTF';
        p.distanceModel = 'inverse';
        p.refDistance = 3;
        p.maxDistance = 90;
        p.rolloffFactor = 1.15;
        this.listenerPannerBase.push(p);
      }
    }
    const p = this.listenerPannerBase[this.panIdx];
    this.panIdx = (this.panIdx + 1) % this.listenerPannerBase.length;
    return p;
  }
  releasePan(p) { /* pooled: reuse as-is */ }

  dispose() {
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; this.ready = false; }
  }
}

function clampA(v) { return v > 1 ? 1 : v < -1 ? -1 : v; }
