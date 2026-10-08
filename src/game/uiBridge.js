/**
 * Event channel between the Canvas engine and React interface.
 */

const listeners = new Set();

export function subscribeGameUi(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function emitGameUi(event) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error("cmGameUi listener error", err);
    }
  });
}
