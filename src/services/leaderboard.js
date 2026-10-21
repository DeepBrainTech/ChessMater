import { session } from './session.js';
import { game } from '../game/runtime.js';

export async function fetchLeaderboard(mode, level, signal, { startRank = 1, aroundMe = false } = {}) {
  const params = new URLSearchParams({ mode, includeMe: '1', paged: '1', startRank: String(startRank) });
  if (aroundMe) params.set('aroundMe', '1');
  if (mode === 'level') params.set('level', String(level));
  const path = `/leaderboard?${params}`;
  let response;
  if (typeof game.apiFetchWithAuthRetry === 'function') {
    response = await game.apiFetchWithAuthRetry(path, { signal });
  } else {
    const request = () => fetch(`${session.API_BASE_URL || 'https://chessmater-production.up.railway.app'}${path}`, {
      signal, credentials: 'include',
      headers: session.cmToken ? { Authorization: `Bearer ${session.cmToken}` } : {},
    });
    response = await request();
    if (response.status === 401 && await game.refreshGameTokenFromPortal?.(true)) response = await request();
  }
  if (response.status === 401) throw new Error('Your session has expired. Please sign in again from the portal.');
  if (!response.ok) throw new Error('Unable to load the leaderboard. Please try again.');
  const data = await response.json();
  if (!Array.isArray(data.entries)) throw new Error('Unable to load the leaderboard. Please try again.');
  return data;
}
