// settings persistence (localStorage with graceful fallback)
import { DEFAULTS } from '../config.js';

const KEY = 'ironline.settings.v1';

function deepMerge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

let memStore = null; // fallback when localStorage is unavailable

export function loadSettings() {
  let raw = null;
  try {
    raw = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || memStore;
  } catch (e) { raw = memStore; }
  if (!raw) return structuredCloneSafe(DEFAULTS);
  try {
    const parsed = JSON.parse(raw);
    return deepMerge(structuredCloneSafe(DEFAULTS), parsed);
  } catch (e) {
    return structuredCloneSafe(DEFAULTS);
  }
}

export function saveSettings(settings) {
  const s = JSON.stringify(settings);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, s);
  } catch (e) { /* ignore */ }
  memStore = s;
}

export function clearSettings() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch (e) {}
  memStore = null;
}

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
