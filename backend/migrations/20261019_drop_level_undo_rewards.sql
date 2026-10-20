-- Per-level Undo credits are no longer granted on completion.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS public.user_level_undo_rewards;
COMMIT;
