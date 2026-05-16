-- Item #281 (release v0.2.3.7) — track fire-time FCM dispatch idempotency.
ALTER TABLE medcontrol.doses ADD COLUMN IF NOT EXISTS fire_notified_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_doses_fire_notified_pending
ON medcontrol.doses ("scheduledAt")
WHERE status = 'pending' AND fire_notified_at IS NULL;
