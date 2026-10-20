BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.user_level_coin_rewards (
  portal_user_id TEXT NOT NULL,
  level_index INT NOT NULL CHECK (level_index > 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  rewarded_at TIMESTAMP,
  PRIMARY KEY (portal_user_id, level_index)
);
COMMIT;
