ALTER TABLE medcontrol.patients ADD COLUMN IF NOT EXISTS photo_thumb TEXT;
COMMENT ON COLUMN medcontrol.patients.photo_thumb IS 'Tiny avatar thumbnail (~3KB jpeg 96x96 base64). Loaded in patient lists for low egress. Full-size lives in photo_url.';
