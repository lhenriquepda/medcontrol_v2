const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:xoeDZAnfn8TvBD5m@db.guefraaqbkcehofchnrc.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  // RPC: upsert push subscription, transferring device ownership to current user
  await c.query(`
    CREATE OR REPLACE FUNCTION medcontrol.upsert_push_subscription(
      p_device_token text,
      p_platform     text,
      p_advance_mins int DEFAULT 15,
      p_user_agent   text DEFAULT 'capacitor'
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = medcontrol, public
    AS $func$
    DECLARE
      v_caller uuid := auth.uid();
      v_id uuid;
    BEGIN
      IF v_caller IS NULL THEN
        RAISE EXCEPTION 'NOT_AUTHENTICATED';
      END IF;

      -- Limpar subs deste device pertencendo a outros users (logout de user A, login de user B)
      DELETE FROM medcontrol.push_subscriptions
      WHERE "deviceToken" = p_device_token AND "userId" != v_caller;

      -- Upsert pro caller
      INSERT INTO medcontrol.push_subscriptions
        ("userId", "deviceToken", platform, "advanceMins", "userAgent")
      VALUES (v_caller, p_device_token, p_platform, p_advance_mins, p_user_agent)
      ON CONFLICT ("deviceToken") DO UPDATE
        SET "userId"      = EXCLUDED."userId",
            "advanceMins" = EXCLUDED."advanceMins",
            platform      = EXCLUDED.platform,
            "userAgent"   = EXCLUDED."userAgent"
      RETURNING id INTO v_id;

      RETURN v_id;
    END;
    $func$;
  `);
  console.log('✓ medcontrol.upsert_push_subscription created');

  await c.query(`GRANT EXECUTE ON FUNCTION medcontrol.upsert_push_subscription(text, text, int, text) TO authenticated`);
  console.log('✓ granted to authenticated');

  await c.end();
})();
