ALTER TABLE medcontrol.patients DROP COLUMN IF EXISTS photo_thumb;
ALTER TABLE medcontrol.patients ADD COLUMN IF NOT EXISTS photo_version SMALLINT NOT NULL DEFAULT 0;
COMMENT ON COLUMN medcontrol.patients.photo_version IS 'Bumped client-side on photo_url change. Lista carrega photo_version (2B) ao invés de photo_url (50KB). Client cacheia photo_url em localStorage por (id, version). Mismatch = refetch once.';
UPDATE medcontrol.patients SET photo_version = 1 WHERE photo_url IS NOT NULL AND photo_url <> '';
