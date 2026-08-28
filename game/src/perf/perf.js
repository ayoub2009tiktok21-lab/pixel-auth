// ============================================================
// Performance: FPS measurement, frame pacing stats, dynamic
// resolution scaler, honest device-rate detection.
// ============================================================

export class Perf {
  constructor() {
    this.samples = [];
    this.avg = 60;
    this.min = 60;
    this.stutterFrames = 0;
    this.totalFrames = 0;
    this.dynScale = 1;
    this._med = 16.6;
    this._acc = 0;
    this._evalT = 0;
    this.cap = 60;
  }

  frame(dtMs) {
    this.samples.push(dtMs);
    if (this.samples.length > 180) this.samples.shift();
    this.totalFrames++;
    this.avg = this.avg * 0.95 + (1000 / Math.max(1, dtMs)) * 0.05;
    if (this.samples.length > 60) {
      // median
      const s = this.samples.slice().sort((a, b) => a - b);
      this._med = s[s.length >> 1];
      this.stutterFrames += dtMs > this._med * 2.3 ? 1 : 0;
    }
    const f = 1000 / Math.max(1, dtMs);
    if (f < this.min) this.min = f;
  }

  reset() {
    this.samples.length = 0;
    this.stutterFrames = 0;
    this.totalFrames = 0;
    this.min = 60;
    this.avg = 60;
  }

  // called ~1/sec: adjust dynamic resolution
  evaluate(targetFps) {
    if (this.samples.length < 30) return;
    const avg = this.avg;
    this._evalT++;
    if (avg < targetFps * 0.82) {
      if (this.dynScale > 0.6) this.dynScale = Math.max(0.6, this.dynScale - 0.12);
    } else if (avg > targetFps * 0.96 && this.dynScale < 1 && this._evalT % 3 === 0) {
      this.dynScale = Math.min(1, this.dynScale + 0.06);
    }
  }
}

// estimate display refresh rate from rAF cadence
export function measureDisplayRate(frames = 90, onDone) {
  const stamps = [];
  let i = 0;
  const tick = (t) => {
    stamps.push(t);
    if (stamps.length > 2) {
      const d = stamps[stamps.length - 1] - stamps[stamps.length - 2];
      if (d < 100) {
        i++;
        if (i >= frames) {
          const ds = stamps.slice(1).map((s, k) => s - stamps[k]).sort((a, b) => a - b);
          const med = ds[ds.length >> 1];
          onDone(Math.round(1000 / med));
          return;
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
