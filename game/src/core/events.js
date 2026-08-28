// tiny event emitter
export class Emitter {
  constructor() { this._m = new Map(); }
  on(ev, fn) {
    if (!this._m.has(ev)) this._m.set(ev, []);
    this._m.get(ev).push(fn);
    return () => this.off(ev, fn);
  }
  off(ev, fn) {
    const a = this._m.get(ev);
    if (!a) return;
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  emit(ev, data) {
    const a = this._m.get(ev);
    if (!a) return;
    for (const fn of a.slice()) fn(data);
  }
  clear() { this._m.clear(); }
}
