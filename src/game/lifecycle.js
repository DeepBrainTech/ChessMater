/** Own browser resources so remounting the board never leaves a second loop. */
export function createLifecycle(host = window) {
  let active = true;
  const cleanups = [];
  const frames = new Set();
  const timeouts = new Set();
  const intervals = new Set();
  const observers = new Set();
  return {
    get active() { return active; },
    trackNode(node) {
      cleanups.push(() => node.remove());
      return node;
    },
    listen(target, type, listener, options) {
      if (!target || !active) return;
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    },
    setHandler(target, property, handler) {
      if (!target || !active) return handler;
      const previous = target[property];
      target[property] = handler;
      cleanups.push(() => { if (target[property] === handler) target[property] = previous; });
      return handler;
    },
    requestAnimationFrame(callback) {
      if (!active) return 0;
      const id = host.requestAnimationFrame(time => {
        frames.delete(id);
        if (active) callback(time);
      });
      frames.add(id);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); host.cancelAnimationFrame(id); },
    setTimeout(callback, delay, ...args) {
      if (!active) return 0;
      const id = host.setTimeout(() => {
        timeouts.delete(id);
        if (active) callback(...args);
      }, delay);
      timeouts.add(id);
      return id;
    },
    clearTimeout(id) { timeouts.delete(id); host.clearTimeout(id); },
    setInterval(callback, delay, ...args) {
      if (!active) return 0;
      const id = host.setInterval(() => { if (active) callback(...args); }, delay);
      intervals.add(id);
      return id;
    },
    clearInterval(id) { intervals.delete(id); host.clearInterval(id); },
    MutationObserver: class {
      constructor(callback) {
        const observer = new host.MutationObserver((...args) => { if (active) callback(...args); });
        observers.add(observer);
        return observer;
      }
    },
    dispose() {
      if (!active) return;
      active = false;
      cleanups.reverse().forEach(cleanup => cleanup());
      frames.forEach(id => host.cancelAnimationFrame(id));
      timeouts.forEach(id => host.clearTimeout(id));
      intervals.forEach(id => host.clearInterval(id));
      observers.forEach(observer => observer.disconnect());
      frames.clear(); timeouts.clear(); intervals.clear(); observers.clear();
    },
  };
}
