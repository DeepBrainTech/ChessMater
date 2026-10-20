-- Hint uses inventory once per run; permanent level entitlements are obsolete.
-- Keep purchase ledgers, Hint inventory, progress and best-route data intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS public.user_level_replay_unlocks;
COMMIT;
