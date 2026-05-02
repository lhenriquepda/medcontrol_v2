-- Item #083.1 (release v0.1.7.2) — defense-in-depth caminho coordenação
--
-- Tabela rastreia quais (doseId, deviceId) já têm alarme nativo agendado
-- localmente. Permite:
--
--   1. notify-doses cron skip push tray quando dose já tem alarme agendado
--      (evita user ver alarme fullscreen + notif tray redundantes)
--   2. rescheduleAll() do app filtrar doses já agendadas em outras vias
--      (FCM data, WorkManager) pra não reagendar à toa
--   3. Observability: medir delivery rate por device/user
--
-- Identidade do device:
--   - Plugin Android grava em SharedPreferences `dosy_sync_credentials`
--     uma string único device_id ao primeiro setSyncCredentials() — pode
--     ser hash do FCM deviceToken truncado, ou UUID v4 randômico persistido
--   - Web (PWA): registration.endpoint pode servir; ou UUID localStorage
--
-- Cleanup:
--   - ON DELETE CASCADE quando dose deletada
--   - Future job pg_cron pra limpar rows >7 dias após dose passada (opcional)

CREATE TABLE IF NOT EXISTS medcontrol.dose_alarms_scheduled (
    "doseId" uuid NOT NULL REFERENCES medcontrol.doses(id) ON DELETE CASCADE,
    "userId" uuid NOT NULL,
    "deviceId" text NOT NULL,
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    -- canal que agendou: 'fcm-data' (caminho 1+2), 'app-foreground' (3), 'workmanager' (4)
    via text NOT NULL CHECK (via IN ('fcm-data', 'app-foreground', 'workmanager')),
    PRIMARY KEY ("doseId", "deviceId")
);

CREATE INDEX IF NOT EXISTS idx_dose_alarms_scheduled_user
    ON medcontrol.dose_alarms_scheduled ("userId", scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_dose_alarms_scheduled_at
    ON medcontrol.dose_alarms_scheduled (scheduled_at DESC);

-- RLS: service_role only (Edge Functions + plugin Android via REST autenticado)
ALTER TABLE medcontrol.dose_alarms_scheduled ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcontrol.dose_alarms_scheduled FORCE ROW LEVEL SECURITY;

REVOKE ALL ON medcontrol.dose_alarms_scheduled FROM anon;
GRANT ALL ON medcontrol.dose_alarms_scheduled TO service_role;

-- User pode ler suas próprias rows (debug/observability futura)
CREATE POLICY "user reads own alarms" ON medcontrol.dose_alarms_scheduled
    FOR SELECT TO authenticated
    USING ("userId" = auth.uid());

-- User pode INSERT/UPDATE/DELETE suas próprias (plugin Android usa auth user JWT)
CREATE POLICY "user manages own alarms" ON medcontrol.dose_alarms_scheduled
    FOR ALL TO authenticated
    USING ("userId" = auth.uid())
    WITH CHECK ("userId" = auth.uid());

COMMENT ON TABLE medcontrol.dose_alarms_scheduled IS
    'Defense-in-depth coordination: tracks which (dose, device) pairs have native alarm scheduled locally. Prevents redundant push tray when alarm already agendado.';
