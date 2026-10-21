const jwt = require('jsonwebtoken');

const GAME_KEY = 'chessmater';

async function fetchPortalAvatars(userIds, send = fetch) {
  const ids = [...new Set(userIds.map(String))].slice(0, 3);
  const secret = process.env.CHESSMATER_JWT_SECRET;
  if (!ids.length || !secret || secret === 'CHESSMATER' || secret.startsWith('change-this-')) return new Map();
  try {
    const token = jwt.sign({ user_ids: ids, purpose: 'leaderboard-avatars' }, secret, {
      algorithm: process.env.CHESSMATER_JWT_ALG || 'HS256',
      audience: `${GAME_KEY}-leaderboard-avatars`, issuer: `${GAME_KEY}-game`, expiresIn: 60,
    });
    const base = (process.env.PORTAL_API_URL || 'https://api.deepbraintechnology.com').replace(/\/+$/, '');
    const response = await send(`${base}/api/games/${GAME_KEY}/leaderboard/avatars`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return new Map();
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.data?.avatars)) return new Map();
    return new Map(payload.data.avatars.flatMap(entry => {
      if (!ids.includes(String(entry.user_id)) || typeof entry.avatar_url !== 'string') return [];
      try {
        const url = new URL(entry.avatar_url);
        if (!['https:', 'http:'].includes(url.protocol)) return [];
        let fallback = null;
        try {
          const candidate = new URL(entry.avatar_fallback_url);
          if (['https:', 'http:'].includes(candidate.protocol)) fallback = candidate.href;
        } catch {}
        return [[String(entry.user_id), { avatar_url: url.href, avatar_fallback_url: fallback }]];
      } catch { return []; }
    }));
  } catch {
    // Portal availability must not prevent players from seeing their scores.
    return new Map();
  }
}

module.exports = { fetchPortalAvatars };
