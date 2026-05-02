-- Item #080 (release v0.1.7.1) — defense-in-depth caminho 2 de 3
--
-- Tabela de idempotência pra notify-doses Edge Function.
-- Razão: cron roda a cada 1 min com janela ±60s; sem registro,
-- mesma dose pode receber notif múltiplas vezes (spam) OU se Edge
-- crash mid-run, próxima execução não sabe o que já foi enviado.
--
-- Estratégia:
--   - Antes de enviar push, INSERT ON CONFLICT DO NOTHING
--   - Se conflito (PK duplicada) = já foi notificado → skip
--   - Se sucesso = registro novo, prossegue
--
-- Cleanup: doses antigas (>7 dias) podem ser limpas via pg_cron job
-- separado se tabela crescer demais.

CREATE TABLE IF NOT EXISTS medcontrol.dose_notifications (
    "doseId" uuid NOT NULL REFERENCES medcontrol.doses(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('fcm', 'webpush')),
    "userId" uuid NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("doseId", channel)
);

-- Index pra queries observability (count por dia, por canal)
CREATE INDEX IF NOT EXISTS idx_dose_notifications_sent_at
    ON medcontrol.dose_notifications (sent_at DESC);

-- RLS: só service_role escreve. User pode ler suas próprias (debug futuro).
ALTER TABLE medcontrol.dose_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medcontrol.dose_notifications FORCE ROW LEVEL SECURITY;

-- Service role bypass RLS by design — sem policies pra authenticated.
-- Se quiser permitir user ler suas próprias notifs futuramente:
-- CREATE POLICY "user reads own notifs" ON medcontrol.dose_notifications
--   FOR SELECT TO authenticated
--   USING ("userId" = auth.uid());

-- Revoke padrão pra anon (defesa)
REVOKE ALL ON medcontrol.dose_notifications FROM anon;
GRANT ALL ON medcontrol.dose_notifications TO service_role;

COMMENT ON TABLE medcontrol.dose_notifications IS
    'Idempotency log for notify-doses Edge Function. PK (doseId, channel) prevents duplicate sends.';
