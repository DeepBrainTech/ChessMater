/**
 * Thin bridge so classic game scripts can notify React without owning React state.
 * Game logic stays imperative; UI components subscribe and re-render.
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

/** Install globals classic scripts can call. */
export function installGameUiBridge() {
  window.cmEmitGameUi = emitGameUi;
  window.cmSubscribeGameUi = subscribeGameUi;
}
