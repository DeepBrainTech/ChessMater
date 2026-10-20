BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS hint_credits INT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS public.inventory_deliveries (
  portal_user_id TEXT NOT NULL,
  purchase_id UUID NOT NULL,
  grants JSONB NOT NULL,
  delivered_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (portal_user_id, purchase_id)
);
COMMIT;
