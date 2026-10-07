const jwt = require('jsonwebtoken');

function verifyReplayGrant(token, userId, level) {
  const secret = process.env.CHESSMATER_JWT_SECRET;
  if (!secret || secret === 'CHESSMATER' || secret.startsWith('change-this-')) {
    throw new Error('game_signing_not_configured');
  }
  const claims = jwt.verify(token, secret, {
    algorithms: [process.env.CHESSMATER_JWT_ALG || 'HS256'],
    audience: process.env.CHESSMATER_JWT_AUD || 'chessmater',
    issuer: process.env.CHESSMATER_JWT_ISS || 'main-portal',
  });
  if (typeof claims === 'string' || claims.game_key !== 'chessmater'
    || claims.product_id !== 'replay' || claims.purpose !== 'level-replay'
    || claims.user_id !== Number(userId) || claims.target !== 'level:' + level
    || !Number.isSafeInteger(claims.exp)
    || typeof claims.purchase_id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(claims.purchase_id)
    || claims.purchase_id === '00000000-0000-0000-0000-000000000000') {
    throw new Error('invalid_paid_grant');
  }
  return claims;
}

module.exports = { verifyReplayGrant };
