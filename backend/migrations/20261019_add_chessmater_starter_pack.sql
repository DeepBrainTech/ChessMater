-- Store the ChessMater one-time starter Hint credits and idempotent Hint uses.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS hint_credits INT NOT NULL DEFAULT 0;
ALTER TABLE public.user_progress
  ALTER COLUMN antigravity_credits SET DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.user_hint_credit_uses (
  portal_user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (portal_user_id, request_id)
);
COMMIT;
