// platform bridge: web + native (Capacitor/Android shell) capabilities
export const platform = {
  isNative: typeof window !== 'undefined' && !!window.AndroidBridge,
  isMobile: typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''),

  vibrate(pattern) {
    try {
      if (this.isNative && window.AndroidBridge.vibrate) {
        const arr = Array.isArray(pattern) ? pattern : [pattern];
        for (const ms of arr) window.AndroidBridge.vibrate(Math.round(ms));
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* no haptics */ }
  },

  onBack(cb) {
    if (typeof window === 'undefined') return;
    // native shell calls window.__onNativeBack() from Activity.onBackPressed
    window.__onNativeBack = () => cb();
    window.addEventListener('popstate', cb);
  },
  navigateBack() {
    if (typeof history !== 'undefined') history.back();
  },

  // estimated display refresh rate (measured over time by caller)
  displayRate() { return this._rate || 60; },
  setDisplayRate(r) { this._rate = r; },

  requestGyroPermission() {
    return new Promise((resolve) => {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then((r) => resolve(r === 'granted'))
          .catch(() => resolve(false));
      } else {
        resolve(true); // Android WebView: no explicit permission needed
      }
    });
  },
};
