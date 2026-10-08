import { resetGameRuntime } from './runtime.js';
import { assets } from './assets.js';
import { levels } from './levels.js';
import { modules } from './engine/modules.js';
import { createLifecycle } from './lifecycle.js';
import { emitGameUi } from './uiBridge.js';
import { PortalInventoryClient, PortalApiError, gameAccountId } from '../services/portalCommerce.js';

let initialized = false;

export function initializeGame({ editor = false } = {}) {
  if (initialized) throw new Error('A game is already mounted. Dispose it before initializing another.');
  initialized = true;
  const lifecycle = createLifecycle();
  const game = resetGameRuntime();
  Object.assign(game, {
    lifecycle, CM_EDITOR_PAGE: editor, CM_ASSETS: assets, LEVELS: levels,
    PortalInventoryClient, PortalApiError, gameAccountId,
    cmEmitGameUi: event => { if (lifecycle.active) emitGameUi(event); },
  });
  try {
    // Register functions before initialization to retain cross-feature calls.
    modules.forEach(module => module.register(game));
    modules.forEach(module => module.initialize?.(game));
  } catch (error) {
    lifecycle.dispose();
    document.querySelectorAll('audio').forEach(audio => audio.pause());
    initialized = false;
    throw error;
  }
  return () => {
    if (!lifecycle.active) return;
    lifecycle.dispose();
    document.querySelectorAll('audio').forEach(audio => audio.pause());
    game.confettiStyle?.remove();
    document.documentElement.classList.remove('modal-scroll-lock');
    document.body.classList.remove('modal-scroll-lock', 'in-game');
    document.body.style.top = '';
    document.documentElement.style.removeProperty('--modal-scrollbar-width');
    initialized = false;
  };
}
