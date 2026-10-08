import { session } from '../services/session.js';
import { initializeGame } from '../game/initialize.js';
import { initializeEditor } from './tools.js';
import { game } from '../game/runtime.js';

const host = location.hostname;
const local = ['localhost', '127.0.0.1', '', '0.0.0.0', '[::1]'].includes(host);
session.API_BASE_URL = local ? `http://${host || 'localhost'}:3000` : 'https://chessmater-production.up.railway.app';
session.authReady = Promise.resolve();
const dispose = initializeGame({ editor: true });
initializeEditor(game);
window.addEventListener('pagehide', dispose, { once: true });
