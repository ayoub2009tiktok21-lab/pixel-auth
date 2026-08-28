// ============================================================
// UI: main menu, settings (6 tabs), in-match HUD, HUD layout
// editor, round/match overlays. All DOM, saved to settings.
// ============================================================
import { CFG, DEFAULTS, TEAM_NAMES, MAP_NAME } from '../config.js';
import { clamp } from '../core/math.js';

export class UI {
  constructor(game) {
    this.g = game;
    this.s = game.settings;
    this.el = {
      hud: game.dom.querySelector('#hud'),
      pause: game.dom.querySelector('#scr-pause'),
      sa: game.dom.querySelector('#sa'),
      sb: game.dom.querySelector('#sb'),
      roundno: game.dom.querySelector('#roundno'),
      killfeed: game.dom.querySelector('#killfeed'),
      hpfill: game.dom.querySelector('#hpfill'),
      hpn: game.dom.querySelector('#hpn'),
      ammo: game.dom.querySelector('#ammo'),
      wname: game.dom.querySelector('#wname'),
      crosshair: game.dom.querySelector('#crosshair'),
      fpsb: game.dom.querySelector('#fpsb'),
      banner: game.dom.querySelector('#banner'),
      deathveil: game.dom.querySelector('#deathveil'),
      menu: game.dom.querySelector('#scr-menu'),
      settings: game.dom.querySelector('#scr-settings'),
      setTabs: game.dom.querySelector('#set-tabs'),
      setBody: game.dom.querySelector('#set-body'),
      hudedit: game.dom.querySelector('#hudedit'),
      heBar: game.dom.querySelector('#hudedit-bar'),
    };
    this.matchEndEl = null;
    this._hudTimer = 0;
    this._bindMenu();
    this._buildButtons();
    this.applyHudLayout();
  }

  // ---------------- main menu ----------------
  _bindMenu() {
    const g = this.g;
    g.dom.querySelector('#m-play').onclick = () => {
      g.audio.ensure(); g.audio.resume();
      g.startMatch();
      this.hideMenu();
    };
    g.dom.querySelector('#p-resume').onclick = () => g.togglePause(false);
    g.dom.querySelector('#p-quit').onclick = () => { g.togglePause(false); g.toMenu(); };
    g.dom.querySelector('#m-settings').onclick = () => this.showSettings('controls');
    g.dom.querySelector('#m-hudedit').onclick = () => this.showHudEdit();
    g.dom.querySelector('#set-back').onclick = () => { this.settings.classList.remove('on'); this.menu.classList.add('on'); };
  }

  hideMenu() {
    this.menu.classList.remove('on');
    this.el.hud.style.display = 'block';
    g_showZones(this.g);
  }
  showMenu() {
    this.menu.classList.add('on');
    this.el.hud.style.display = 'none';
    this.el.pause.classList.remove('on');
    g_hideZones(this.g);
    this.el.banner.style.display = 'none';
    this.el.deathveil.style.display = 'none';
    if (this.matchEndEl) { this.matchEndEl.remove(); this.matchEndEl = null; }
  }
  showPause(v) { this.el.pause.classList.toggle('on', !!v); }

  // ---------------- settings ----------------
  showSettings(tab = 'controls') {
    this.settings.classList.add('on');
    this.menu.classList.remove('on');
    this._renderTabs(tab);
  }

  _renderTabs(active) {
    const tabs = [
      ['controls', 'Controls'],
      ['sensitivity', 'Sensitivity'],
      ['graphics', 'Graphics'],
      ['audio', 'Audio'],
      ['gameplay', 'Gameplay'],
      ['gyro', 'Gyroscope'],
    ];
    this.el.setTabs.innerHTML = '';
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.className = 'tab pe' + (id === active ? ' on' : '');
      b.textContent = label;
      b.onclick = () => this._renderTabs(id);
      this.el.setTabs.appendChild(b);
    }
    this.el.setBody.innerHTML = '';
    const body = this.el.setBody;
    if (active === 'controls') this._tabControls(body);
    if (active === 'sensitivity') this._tabSens(body);
    if (active === 'graphics') this._tabGraphics(body);
    if (active === 'audio') this._tabAudio(body);
    if (active === 'gameplay') this._tabGameplay(body);
    if (active === 'gyro') this._tabGyro(body);
  }

  _row(body, label, hint) {
    const row = document.createElement('div');
    row.className = 'row';
    const l = document.createElement('div');
    l.innerHTML = `<label>${label}</label>${hint ? `<div class="hint">${hint}</div>` : ''}`;
    row.appendChild(l);
    return row;
  }
  _slider(body, label, key, min, max, step, fmt, onChange) {
    const row = this._row(body, label);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = this.s[key];
    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = fmt ? fmt(this.s[key]) : this.s[key];
    inp.oninput = () => {
      this.s[key] = parseFloat(inp.value);
      val.textContent = fmt ? fmt(this.s[key]) : this.s[key];
      this.g.save();
      if (onChange) onChange(this.s[key]);
    };
    row.appendChild(inp); row.appendChild(val);
    body.appendChild(row);
  }
  _select(body, label, key, options, onChange) {
    const row = this._row(body, label);
    const sel = document.createElement('select');
    sel.className = 'pe';
    for (const [v, l2] of options) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l2;
      if (String(this.s[key]) === String(v)) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { this.s[key] = isNaN(parseFloat(sel.value)) ? sel.value : parseFloat(sel.value); this.g.save(); if (onChange) onChange(this.s[key]); };
    row.appendChild(sel);
    body.appendChild(row);
  }
  _toggle(body, label, key, onChange) {
    const row = this._row(body, label);
    const t = document.createElement('button');
    t.className = 'toggle pe' + (this.s[key] ? ' on' : '');
    t.innerHTML = '<i></i>';
    t.onclick = () => { this.s[key] = !this.s[key]; t.classList.toggle('on', this.s[key]); this.g.save(); if (onChange) onChange(this.s[key]); };
    row.appendChild(t);
    body.appendChild(row);
  }

  _tabControls(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Touch Layout</h3>';
    const row = this._row(sec, 'Open layout editor', 'drag buttons · resize · opacity · hide');
    const b = document.createElement('button');
    b.className = 'sbtn ok pe'; b.textContent = 'Open Editor';
    b.style.maxWidth = '160px';
    b.onclick = () => this.showHudEdit();
    row.appendChild(b); sec.appendChild(row);
    body.appendChild(sec);

    const sec2 = document.createElement('div'); sec2.className = 'set-sec';
    sec2.innerHTML = '<h3>Buttons</h3>';
    const list = [
      ['fire', 'Fire', 'hold for full-auto (AK)'],
      ['aim', 'Aim (ADS)'], ['jump', 'Jump'], ['crouch', 'Crouch / Slide', 'run + press = slide'],
      ['reload', 'Reload'], ['swap', 'Swap weapon'], ['joy', 'Joystick'],
    ];
    for (const [id, label, hint] of list) {
      const r = this._row(sec2, label, hint);
      const t = document.createElement('button');
      t.className = 'toggle pe' + (this.s.hud[id].v ? ' on' : '');
      t.innerHTML = '<i></i>';
      t.onclick = () => { this.s.hud[id].v = !this.s.hud[id].v; t.classList.toggle('on'); this.g.save(); this.applyHudLayout(); };
      r.appendChild(t); sec2.appendChild(r);
    }
    body.appendChild(sec2);

    const sec3 = document.createElement('div'); sec3.className = 'set-sec';
    sec3.innerHTML = '<h3>Desktop keys (testing)</h3>';
    const r = this._row(sec3, 'WASD move · F fire · E aim · Space jump · C crouch/slide · R reload · Q swap');
    sec3.appendChild(r);
    body.appendChild(sec3);
  }

  _tabSens(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Camera</h3>';
    this._slider(sec, 'Master sensitivity', 'sensitivity.camera', 0.4, 2.4, 0.05, (v) => v.toFixed(2));
    this._slider(sec, 'ADS sensitivity', 'sensitivity.ads', 0.3, 1.0, 0.05, (v) => v.toFixed(2));
    this._slider(sec, 'Vertical multiplier', 'sensitivity.vertical', 0.5, 1.4, 0.05, (v) => v.toFixed(2));
    this._slider(sec, 'Firing sensitivity', 'sensitivity.firing', 0.5, 1.2, 0.05, (v) => v.toFixed(2));
    body.appendChild(sec);
    const note = document.createElement('div');
    note.className = 'set-sec';
    note.innerHTML = '<h3>Response curve</h3><div class="hint" style="font-size:12.5px;line-height:1.6">Small drags are precision-scaled (deadzone ~1px, gentle ramp), fast flicks stay capped and stable — no sudden acceleration, no touch drop-out. Tested across 0.4×–2.4×.</div>';
    body.appendChild(note);
  }

  _tabGraphics(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Quality</h3>';
    this._select(sec, 'Graphics quality', 'graphics.quality', [
      ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'],
    ], () => this.g.applyQuality());
    this._select(sec, 'Shadows', 'graphics.shadows', [
      ['auto', 'Auto (by quality)'], ['on', 'On'], ['off', 'Off'],
    ], () => this.g.applyQuality());
    this._select(sec, 'Anti-aliasing', 'graphics.aa', [
      ['auto', 'Auto'], ['off', 'Off'], ['msaa', 'MSAA'],
    ], () => this.g.applyQuality());
    this._slider(sec, 'View distance', 'graphics.viewDist', 0.6, 1.3, 0.05, (v) => v.toFixed(2) + '×', () => this.g.applyQuality());
    this._select(sec, 'Field of view', 'graphics.fov', [
      [0, 'Default (72°)'], [68, '68°'], [72, '72°'], [78, '78°'], [85, '85° (wide)'],
    ], () => this.g.applyQuality());
    body.appendChild(sec);

    const sec2 = document.createElement('div'); sec2.className = 'set-sec';
    sec2.innerHTML = '<h3>Performance</h3>';
    const dev = this.g.platform.displayRate();
    this._select(sec2, 'Frame rate cap', 'graphics.fpsCap', [
      [60, '60 FPS'], [90, '90 FPS'], [120, '120 FPS'], [30, '30 FPS (battery)'],
    ]);
    this._toggle(sec2, 'Dynamic resolution', 'graphics.dynRes', () => this.g.applyQuality());
    const note = document.createElement('div');
    note.className = 'row';
    note.innerHTML = `<div><label>Display</label><div class="hint">This device measures ≈ ${Math.round(dev)} Hz. Caps above that run at the device rate — the HUD counter shows the real measured FPS, never a fake one.</div></div>`;
    sec2.appendChild(note);
    body.appendChild(sec2);
  }

  _tabAudio(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Sound</h3>';
    this._slider(sec, 'Master volume', 'audio.master', 0, 1, 0.05, (v) => Math.round(v * 100) + '%', () => this.g.audio.setVolumes(this.s.audio.master, this.s.audio.sfx));
    this._slider(sec, 'Effects volume', 'audio.sfx', 0, 1, 0.05, (v) => Math.round(v * 100) + '%', () => this.g.audio.setVolumes(this.s.audio.master, this.s.audio.sfx));
    const row = this._row(sec, 'Test fire');
    const b = document.createElement('button');
    b.className = 'sbtn pe'; b.textContent = 'Play AK shot';
    b.onclick = () => { this.g.audio.ensure(); this.g.audio.play('ak'); };
    row.appendChild(b); sec.appendChild(row);
    body.appendChild(sec);
  }

  _tabGameplay(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Gameplay</h3>';
    this._select(sec, 'AI difficulty', 'gameplay.difficulty', [
      ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['expert', 'Expert'],
    ]);
    this._toggle(sec, 'Haptic feedback', 'gameplay.haptics');
    this._toggle(sec, 'Kill feed', 'gameplay.killfeed');
    this._toggle(sec, 'Crosshair dot', 'gameplay.crosshairDot');
    body.appendChild(sec);
  }

  _tabGyro(body) {
    const sec = document.createElement('div'); sec.className = 'set-sec';
    sec.innerHTML = '<h3>Gyroscope Aim</h3>';
    this._toggle(sec, 'Enable gyroscope', 'gyro.enabled', async (v) => {
      if (v) await this.g.platform.requestGyroPermission();
    });
    this._slider(sec, 'Gyro sensitivity', 'gyro.sens', 0.2, 2.5, 0.05, (v) => v.toFixed(2));
    const note = document.createElement('div');
    note.className = 'row';
    note.innerHTML = '<div class="hint" style="font-size:12.5px">Tilt the device to aim. Optional — off by default. Works on Android devices with sensors.</div>';
    sec.appendChild(note);
    body.appendChild(sec);
  }

  // ---------------- touch buttons ----------------
  _buildButtons() {
    const g = this.g;
    const defs = {
      fire: { label: 'FIRE', base: 96 },
      aim: { label: 'ADS', base: 84 },
      jump: { label: 'JMP', base: 66 },
      crouch: { label: 'CRCH', base: 68 },
      reload: { label: 'RLD', base: 58 },
      swap: { label: 'SWP', base: 58 },
      pause: { label: 'II', base: 54 },
    };
    this.btnEls = {};
    for (const [id, d] of Object.entries(defs)) {
      const b = document.createElement('div');
      b.className = 'tbtn pe';
      b.dataset.btn = id;
      b.textContent = d.label;
      b.style.fontSize = `${Math.round(d.base * 0.19)}px`;
      g.dom.appendChild(b);
      this.btnEls[id] = b;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        b.classList.add('down');
        if (id === 'fire') g.input.fire = true;
        if (id === 'aim') g.input.aim = true;
        if (id === 'jump') g.input.edge.jump = true;
        if (id === 'crouch') g.input.edge.crouch = true;
        if (id === 'reload') g.input.edge.reload = true;
        if (id === 'swap') g.input.edge.swap = true;
        if (id === 'pause') g.input.edge.pause = true;
      });
      const up = (e) => {
        b.classList.remove('down');
        if (id === 'fire') g.input.fire = false;
        if (id === 'aim') g.input.aim = false;
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }
  }

  applyHudLayout() {
    const g = this.g;
    const rw = g.dom.clientWidth || window.innerWidth;
    const rh = g.dom.clientHeight || window.innerHeight;
    for (const [id, b] of Object.entries(this.btnEls)) {
      const lay = g.settings.hud[id];
      const size = 96 * lay.s * (id === 'fire' ? 1 : (id === 'aim' ? 0.9 : id === 'jump' || id === 'crouch' ? 0.72 : 0.62));
      b.style.width = b.style.height = `${size}px`;
      b.style.left = `${(lay.x / 100) * rw - size / 2}px`;
      b.style.top = `${(lay.y / 100) * rh - size / 2}px`;
      b.style.opacity = lay.o;
      b.style.display = lay.v ? 'flex' : 'none';
    }
  }

  // ---------------- HUD (in match) ----------------
  updateHUD(dt) {
    this._hudTimer -= dt;
    if (this._hudTimer > 0) return;
    this._hudTimer = 0.08;
    const g = this.g;
    const m = g.match;
    if (!m) return;
    this.el.sa.textContent = m.score.a;
    this.el.sb.textContent = m.score.b;
    this.el.roundno.textContent = m.state === 'matchEnd' ? 'FINAL' : `ROUND ${m.round}`;
    const hp = m.playerEnt.hp;
    this.el.hpfill.style.width = `${hp}%`;
    this.el.hpfill.style.background = hp > 50 ? 'linear-gradient(90deg,#8fd06f,#5ea84f)' : hp > 25 ? 'linear-gradient(90deg,#e0c05a,#c8a13c)' : 'linear-gradient(90deg,#e06c5c,#b04a3e)';
    this.el.hpn.textContent = Math.max(0, Math.ceil(hp));
    this.el.hpn.className = hp <= 25 ? 'low' : '';
    const w = g.weapons;
    this.el.ammo.innerHTML = `${w.ammoState.mag} <small>/ ${w.ammoState.reserve}</small>`;
    this.el.wname.textContent = w.def.name + (w.reloading ? ' · RELOADING' : '');
    // crosshair spread
    const ch = this.el.crosshair;
    if (m.active && m.playerEnt.alive) {
      ch.style.display = 'block';
      const spread = w.currentSpread();
      const px = clamp(spread * 900, 4, 34);
      const gap = px + 5;
      const k = ch.children;
      k[0].style.left = `${-gap}px`; k[1].style.left = `${gap - 9}px`;
      k[2].style.top = `${-gap}px`; k[3].style.top = `${gap - 9}px`;
      if (g.settings.gameplay.crosshairDot) k[4].style.display = 'block'; else k[4].style.display = 'none';
      ch.style.opacity = w.ads ? 0.4 : 1;
    } else ch.style.display = 'none';
    // killfeed
    if (g.settings.gameplay.killfeed) {
      const now = m.time;
      const items = m.killfeed.filter((k) => now - k.t < 4.5);
      if (this._kfLen !== items.length || this._kfT !== (items.length ? items[items.length - 1].t : 0)) {
        this._kfLen = items.length; this._kfT = items.length ? items[items.length - 1].t : 0;
        this.el.killfeed.innerHTML = items.map((k) =>
          `<div class="kf ${k.enemy ? '' : 'enemy'}"><span class="k">${k.killer}</span> <span class="w">[${k.weapon}]</span> <span class="v">${k.victim}</span></div>`
        ).join('');
      }
      for (const d of this.el.killfeed.children) {
        d.style.opacity = '1';
      }
    }
    // fps
    const f = g.perf;
    if (f) this.el.fpsb.textContent = `${Math.round(f.avg)} fps · ${Math.round(g.platform.displayRate())}Hz dev`;
  }

  banner(kind, a, b, c) {
    const el = this.el.banner;
    const [b1, b2, b3] = el.children;
    b1.textContent = a || ''; b1.className = 'b1 ' + (kind === 'a' ? 'a' : kind === 'b' ? 'b' : '');
    b2.textContent = b || '';
    b3.textContent = c || '';
    b3.className = 'b3 ' + (kind === 'a' ? 'a' : kind === 'b' ? 'b' : '');
    el.style.display = 'flex';
  }
  hideBanner() { this.el.banner.style.display = 'none'; }

  showDeath(v) { this.el.deathveil.style.display = v ? 'flex' : 'none'; }

  // ---------------- match end ----------------
  showMatchEnd(data) {
    const g = this.g;
    this.hideBanner();
    const win = data.winner === 'a';
    const el = document.createElement('div');
    el.className = 'screen on';
    el.style.background = win
      ? 'radial-gradient(900px 400px at 50% 20%, rgba(232,179,75,.16), transparent 60%), #0b0f13'
      : 'radial-gradient(900px 400px at 50% 20%, rgba(208,91,74,.14), transparent 60%), #0b0f13';
    const kills = Object.entries(data.botKills || {}).map(([n, k]) => `<div class="row" style="border-top:none"><label>${n}</label><span class="val">${k}</span></div>`).join('');
    el.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px">
        <div style="font-size:46px;font-weight:900;letter-spacing:10px" class="${win ? '' : ''}" ${win ? 'style="color:var(--amber)"' : 'style="color:var(--ash)"'}>${win ? 'VICTORY' : 'DEFEAT'}</div>
        <div style="font-size:15px;color:var(--txt-dim);letter-spacing:2px">${TEAM_NAMES.a} ${data.score.a} : ${data.score.b} ${TEAM_NAMES.b} — ${MAP_NAME}</div>
        <div class="set-sec" style="width:min(360px,80vw)">
          <h3>Match summary</h3>
          <div class="row"><label>Your kills</label><span class="val">${data.kills}</span></div>
          <div class="row"><label>Your deaths</label><span class="val">${data.deaths}</span></div>
          ${kills}
        </div>
        <button class="mbtn primary pe" id="me-again" style="width:min(320px,74vw)">Play Again</button>
        <button class="mbtn pe" id="me-menu" style="width:min(320px,74vw)">Main Menu</button>
      </div>`;
    g.dom.appendChild(el);
    this.matchEndEl = el;
    el.querySelector('#me-again').onclick = () => {
      el.remove(); this.matchEndEl = null;
      g.newMatch();
    };
    el.querySelector('#me-menu').onclick = () => {
      el.remove(); this.matchEndEl = null;
      g.match.dispose();
      g.match = null;
      g.toMenu();
    };
  }

  // ---------------- HUD layout editor ----------------
  showHudEdit() {
    const g = this.g;
    const he = this.el.hudedit;
    he.style.display = 'block';
    this.applyHudLayout();
    this._heSel = null;
    const selBtns = Object.keys(this.btnEls);
    const joy = g.dom.querySelector('#joybase');

    const setSel = (id) => {
      for (const b of Object.values(this.btnEls)) b.classList.remove('sel');
      if (id) {
        this._heSel = id;
        this.btnEls[id].classList.add('sel');
        const lay = g.settings.hud[id];
        he.querySelector('#he-size').value = Math.round(lay.s * 100);
        he.querySelector('#he-sizev').textContent = Math.round(lay.s * 100) + '%';
        he.querySelector('#he-opac').value = Math.round(lay.o * 100);
        he.querySelector('#he-opacv').textContent = Math.round(lay.o * 100) + '%';
        he.querySelector('#he-hide').textContent = lay.v ? 'Hide' : 'Show';
        this.el.heBar.classList.add('on');
      } else {
        this.el.heBar.classList.remove('on');
      }
    };
    this._heSetSel = setSel;

    for (const id of selBtns) {
      const b = this.btnEls[id];
      b.onpointerdown = (e) => {
        e.stopPropagation();
        setSel(id);
        let dragging = true;
        const move = (ev) => {
          if (!dragging) return;
          const r = g.dom.getBoundingClientRect();
          const lay = g.settings.hud[id];
          lay.x = clamp((ev.clientX - r.left) / r.width * 100, 4, 96);
          lay.y = clamp((ev.clientY - r.top) / r.height * 100, 6, 96);
          this.applyHudLayout();
        };
        const up = () => {
          dragging = false;
          g.save();
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };
    }
    // joystick also draggable
    joy.style.pointerEvents = 'auto';
    joy.onpointerdown = (e) => {
      e.stopPropagation();
      setSel('joy');
      const move = (ev) => {
        const r = g.dom.getBoundingClientRect();
        const lay = g.settings.hud.joy;
        lay.x = clamp((ev.clientX - r.left) / r.width * 100, 6, 42);
        lay.y = clamp((ev.clientY - r.top) / r.height * 100, 8, 96);
        this.applyHudLayout();
      };
      const up = () => { g.save(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };

    he.querySelector('#he-size').oninput = (e) => {
      if (!this._heSel) return;
      g.settings.hud[this._heSel].s = parseFloat(e.target.value) / 100;
      he.querySelector('#he-sizev').textContent = e.target.value + '%';
      this.applyHudLayout(); g.save();
    };
    he.querySelector('#he-opac').oninput = (e) => {
      if (!this._heSel) return;
      g.settings.hud[this._heSel].o = parseFloat(e.target.value) / 100;
      he.querySelector('#he-opacv').textContent = e.target.value + '%';
      this.applyHudLayout(); g.save();
    };
    he.querySelector('#he-hide').onclick = () => {
      if (!this._heSel) return;
      const lay = g.settings.hud[this._heSel];
      lay.v = !lay.v;
      this.applyHudLayout(); g.save();
      setSel(this._heSel);
    };
    he.querySelector('#he-reset').onclick = () => {
      g.settings.hud = JSON.parse(JSON.stringify(DEFAULTS.hud));
      g.save();
      this.applyHudLayout();
      setSel(null);
    };
    he.querySelector('#he-done').onclick = () => {
      he.style.display = 'none';
      joy.style.pointerEvents = 'none';
      joy.onpointerdown = null;
      for (const id of selBtns) this.btnEls[id].onpointerdown = null;
      g.save();
    };
  }
}

function g_showZones(g) {
  g.dom.querySelector('#joyzone').style.display = 'block';
  g.dom.querySelector('#camzone').style.display = 'block';
}
function g_hideZones(g) {
  g.dom.querySelector('#joyzone').style.display = 'none';
  g.dom.querySelector('#camzone').style.display = 'none';
  const jb = g.dom.querySelector('#joybase');
  const jk = g.dom.querySelector('#joyknob');
  jb.style.display = 'none'; jk.style.display = 'none';
}
