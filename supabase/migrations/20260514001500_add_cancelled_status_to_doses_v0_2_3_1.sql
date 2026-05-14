-- v0.2.3.1 Bloco 5 (A-02) — adiciona status='cancelled' para cancelFutureDoses UPDATE.
-- Antes: DELETE batch fires trigger N vezes. Agora: UPDATE status='cancelled' batch +
-- trigger statement-level agrega doseIds + envia 1 FCM com CSV.
-- 'cancelled' semanticamente correto (pausar tratamento != user pulou dose).

ALTER TABLE medcontrol.doses DROP CONSTRAINT IF EXISTS doses_status_check;
ALTER TABLE medcontrol.doses ADD CONSTRAINT doses_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'overdue'::text, 'done'::text, 'skipped'::text, 'cancelled'::text]));
