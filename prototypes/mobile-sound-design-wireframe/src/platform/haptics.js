/**
 * Platform seam for iOS haptics. The production shell can install a bridge
 * without coupling product components to WebKit or native message names.
 */
export function triggerHaptic(kind = "light") {
  const bridge = globalThis.__COSIMO_MOBILE_HAPTICS__;
  if (typeof bridge === "function") {
    bridge(kind);
    return;
  }
  navigator.vibrate?.(kind === "success" ? 14 : 7);
}
