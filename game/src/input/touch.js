// ============================================================
// Touch input: virtual joystick (left), camera drag (right),
// action buttons, multi-touch, plus keyboard fallback for
// desktop testing. Gyroscope support (optional).
// ============================================================
import { clamp, damp } from '../core/math.js';

export class TouchInput {
  constructor(game) {
    this.game = game;
    this.mx = 0; this.mz = 0;        // joystick vec (mz: +1 forward)
    this.fire = false;
    this.aim = false;
    this.edge = { jump: false, crouch: false, reload: false, swap: false, pause: false };
    this.camDX = 0; this.camDY = 0;
    this.pointers = new Map();
    this.joyPointer = null;
    this.joyBase = { x: 0, y: 0 };
    this.gyroLast = null;
    this.keys = new Set();
    this._onOrient = null;
  }

  attach() {
    const g = this.game;
    const root = g.dom;
    const opts = { passive: false };

    // zones
    this.joyzone = g.dom.querySelector('#joyzone');
    this.camzone = g.dom.querySelector('#camzone');
    this.joybaseEl = g.dom.querySelector('#joybase');
    this.joyknobEl = g.dom.querySelector('#joyknob');

    const pos = (e) => {
      const r = root.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };

    this._pd = (e) => {
      root.setPointerCapture?.(e.pointerId);
      const p = pos(e);
      if (e.target.classList && e.target.classList.contains('tbtn')) return; // buttons handle themselves
      const inLeft = p.x < p.w * 0.46;
      if (inLeft && this.joyPointer === null) {
        this.joyPointer = e.pointerId;
        // fixed base from settings layout
        const lay = this.layout('joy');
        this.joyBase.x = (lay.x / 100) * p.w;
        this.joyBase.y = (lay.y / 100) * p.h;
        this.joyRadius = 62 * lay.s;
        this.placeJoyUI();
        this.pointers.set(e.pointerId, { type: 'joy', x: p.x, y: p.y });
        this.updateJoy(p);
      } else if (!inLeft) {
        this.pointers.set(e.pointerId, { type: 'cam', x: p.x, y: p.y });
      } else {
        this.pointers.set(e.pointerId, { type: 'joy2' }); // extra left thumbs ignored
      }
    };
    this._pm = (e) => {
      const p = pos(e);
      const rec = this.pointers.get(e.pointerId);
      if (!rec) return;
      if (rec.type === 'joy' && this.joyPointer === e.pointerId) {
        this.updateJoy(p);
      } else if (rec.type === 'cam') {
        const sens = this.game.settings.sensitivity;
        const firing = this.fire ? sens.firing : 1;
        const ads = this.aim ? sens.ads : 1;
        const k = 0.0034 * sens.camera * ads * firing;
        let dx = (p.x - rec.x) * k;
        let dy = (p.y - rec.y) * k * sens.vertical;
        // soft deadzone
        const m = Math.hypot(dx, dy);
        const dz = 0.0009;
        if (m < dz) { dx = 0; dy = 0; }
        else {
          const s = (m - dz) / m;
          dx *= s; dy *= s;
        }
        // stability cap per event
        const cap = 0.05;
        dx = clamp(dx, -cap, cap);
        dy = clamp(dy, -cap, cap);
        this.camDX += dx;
        this.camDY += dy;
      }
      rec.x = p.x; rec.y = p.y;
    };
    this._pu = (e) => {
      const rec = this.pointers.get(e.pointerId);
      if (rec && rec.type === 'joy' && this.joyPointer === e.pointerId) {
        this.joyPointer = null;
        this.mx = 0; this.mz = 0;
        this.updateJoy({ x: this.joyBase.x, y: this.joyBase.y });
      }
      this.pointers.delete(e.pointerId);
    };

    this.joyzone.addEventListener('pointerdown', this._pd, opts);
    this.camzone.addEventListener('pointerdown', this._pd, opts);
    root.addEventListener('pointermove', this._pm, opts);
    root.addEventListener('pointerup', this._pu, opts);
    root.addEventListener('pointercancel', this._pu, opts);
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // desktop keyboard fallback
    this._kd = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k) || e.code === 'Space') e.preventDefault();
      this.keys.add(k === ' ' ? 'space' : k);
      if (!this._repeat(e)) {
        if (k === ' ' || e.code === 'Space') this.edge.jump = true;
        if (k === 'c') this.edge.crouch = true;
        if (k === 'r') this.edge.reload = true;
        if (k === 'q' || k === 'tab') this.edge.swap = true;
        if (k === 'escape' || k === 'p') this.edge.pause = true;
      }
      if (k === 'f' && !this.fire) this.fire = true;
      if (k === 'e') this.aim = true;
    };
    this._ku = (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k === ' ' ? 'space' : k);
      if (k === 'f') this.fire = false;
      if (k === 'e') this.aim = false;
    };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);

    // mouse drag camera (desktop)
    // (already handled via pointer events on camzone)

    // gyro
    this._onOrient = (e) => {
      const gy = this.game.settings.gyro;
      if (!gy.enabled) return;
      if (e.beta == null || e.gamma == null) return;
      if (this.gyroLast) {
        const db = e.beta - this.gyroLast.beta;
        const dg = e.gamma - this.gyroLast.gamma;
        const k = 0.0045 * gy.sens * this.game.settings.sensitivity.camera;
        this.camDX += -dg * k;
        this.camDY += -db * k * this.game.settings.sensitivity.vertical;
      }
      this.gyroLast = { beta: e.beta, gamma: e.gamma };
    };
    window.addEventListener('deviceorientation', this._onOrient);
  }

  _repeat(e) { return e.repeat; }

  layout(name) {
    return this.game.settings.hud[name] || { x: 50, y: 50, s: 1, o: 0.9, v: true };
  }

  placeJoyUI() {
    const lay = this.layout('joy');
    const r = this.joybaseEl.getBoundingClientRect();
    const root = this.game.dom;
    const rw = root.clientWidth, rh = root.clientHeight;
    const size = 128 * lay.s;
    this.joybaseEl.style.width = this.joybaseEl.style.height = `${size}px`;
    this.joybaseEl.style.left = `${(lay.x / 100) * rw - size / 2}px`;
    this.joybaseEl.style.top = `${(lay.y / 100) * rh - size / 2}px`;
    this.joybaseEl.style.opacity = lay.o;
    this.joybaseEl.style.display = this.joyPointer !== null ? 'block' : 'none';
    const knob = 58 * lay.s;
    this.joyknobEl.style.width = this.joyknobEl.style.height = `${knob}px`;
  }

  updateJoy(p) {
    const dx = p.x - this.joyBase.x, dy = p.y - this.joyBase.y;
    const r = this.joyRadius || 62;
    const d = Math.hypot(dx, dy);
    const k = d > r ? r / d : 1;
    const ox = dx * k, oy = dy * k;
    // response curve: precision at small deflections, full at edge
    const m = Math.min(1, d / r);
    const curved = m < 1 ? m * (0.55 + 0.45 * m) : 1;
    const ang = Math.atan2(dy, dx);
    this.mx = Math.cos(ang) * curved;
    this.mz = -Math.sin(ang) * curved;
    const knob = 58 * (this.layout('joy').s);
    this.joyknobEl.style.left = `${(this.layout('joy').x / 100) * this.game.dom.clientWidth + ox - knob / 2}px`;
    this.joyknobEl.style.top = `${(this.layout('joy').y / 100) * this.game.dom.clientHeight + oy - knob / 2}px`;
  }

  keyboardMove() {
    const k = this.keys;
    if (!k.size) return null;
    let x = 0, z = 0;
    if (k.has('w') || k.has('arrowup')) z += 1;
    if (k.has('s') || k.has('arrowdown')) z -= 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (!x && !z) return null;
    const l = Math.hypot(x, z);
    return { mx: x / l, mz: z / l };
  }

  consume() {
    const kb = this.keyboardMove();
    const out = {
      mx: kb ? kb.mx : this.mx,
      mz: kb ? kb.mz : this.mz,
      fire: this.fire || this.keys.has('f'),
      aim: this.aim || this.keys.has('e'),
      jump: this.edge.jump,
      crouch: this.edge.crouch,
      reload: this.edge.reload,
      swap: this.edge.swap,
      pause: this.edge.pause,
      camDX: this.camDX,
      camDY: this.camDY,
    };
    this.camDX = 0; this.camDY = 0;
    this.edge = { jump: false, crouch: false, reload: false, swap: false, pause: false };
    return out;
  }

  detach() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('deviceorientation', this._onOrient);
  }
}
