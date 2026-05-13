package com.dosyapp.dosy.plugins.criticalalarm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Item #083.5 (release v0.1.7.2) — FCM-driven alarm scheduling.
 *
 * Estende MessagingService do Capacitor pra interceptar mensagens FCM
 * com action `schedule_alarms` ANTES do Capacitor processá-las como
 * notificação normal.
 *
 * Comportamento:
 *   - data.action == "schedule_alarms" → processa silenciosamente:
 *     parseia lista de doses + chama AlarmScheduler.scheduleDose pra cada,
 *     reporta server-side via dose_alarms_scheduled, NÃO mostra notif
 *   - qualquer outra mensagem → delega pra super (Capacitor processa
 *     normal: notif tray ou push handler JS)
 *
 * Defense-in-depth caminho 1+2: Trigger DB e cron 6h podem ambos enviar
 * FCM data — alarme agendado é idempotente (mesmo id = replace).
 */
public class DosyMessagingService extends MessagingService {
    private static final String TAG = "DosyMessagingService";
    private static final String SYNC_PREFS = "dosy_sync_credentials";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String action = data != null ? data.get("action") : null;

        if ("schedule_alarms".equals(action)) {
            // Item #085 (release v0.1.7.3) — respeita toggle Alarme Crítico do user.
            SharedPreferences sp = getApplicationContext()
                .getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
            boolean criticalAlarmEnabled = sp.getBoolean("critical_alarm_enabled", true);
            if (!criticalAlarmEnabled) {
                Log.d(TAG, "critical alarm OFF — skip schedule_alarms (push tray covers)");
                return;
            }
            try {
                handleScheduleAlarms(data.get("doses"));
                return;
            } catch (Exception e) {
                Log.e(TAG, "schedule_alarms handler error: " + e.getMessage(), e);
            }
        }

        // Item #209 v0.2.1.9 — cancel_alarms handler. Trigger DB envia quando
        // dose deletada OR status muda pending→done/skipped/cancelled. App
        // cancela alarme local correspondente via AlarmScheduler.cancelAlarm.
        if ("cancel_alarms".equals(action)) {
            try {
                handleCancelAlarms(data.get("doseIds"));
                return;
            } catch (Exception e) {
                Log.e(TAG, "cancel_alarms handler error: " + e.getMessage(), e);
            }
        }

        // Mensagem regular: passa pra Capacitor (notif tray + push handler JS)
        super.onMessageReceived(remoteMessage);
    }

    /**
     * Parseia payload data.doses (JSON array) e agenda alarme nativo
     * pra cada dose. Reporta server-side.
     *
     * Payload esperado:
     *   data.doses = JSON.stringify([
     *     {doseId, scheduledAt, medName, unit, patientName?},
     *     ...
     *   ])
     */
    private void handleScheduleAlarms(String dosesJson) throws JSONException {
        if (dosesJson == null) return;

        Context ctx = getApplicationContext();
        JSONArray doses = new JSONArray(dosesJson);
        Log.d(TAG, "schedule_alarms: " + doses.length() + " doses");

        // Group by minute (mesma lógica do DoseSyncWorker)
        Map<Long, JSONArray> groups = new TreeMap<>();
        Map<Long, Set<String>> doseIdsByMinute = new HashMap<>();

        for (int i = 0; i < doses.length(); i++) {
            JSONObject d = doses.getJSONObject(i);
            String scheduledAt = d.getString("scheduledAt");
            long ms = Instant.parse(scheduledAt).toEpochMilli();
            long minute = (ms / 60000L) * 60000L;

            if (!groups.containsKey(minute)) groups.put(minute, new JSONArray());
            if (!doseIdsByMinute.containsKey(minute)) doseIdsByMinute.put(minute, new HashSet<>());

            JSONObject entry = new JSONObject();
            entry.put("doseId", d.getString("doseId"));
            entry.put("medName", d.optString("medName", "Dose"));
            entry.put("unit", d.optString("unit", ""));
            entry.put("patientName", d.optString("patientName", ""));
            groups.get(minute).put(entry);
            doseIdsByMinute.get(minute).add(d.getString("doseId"));
        }

        // Audit batch_start FCM received
        try {
            JSONObject meta = new JSONObject();
            meta.put("groupsCount", groups.size());
            meta.put("dosesCount", doses.length());
            AlarmAuditLogger.logBatch(ctx, "java_fcm_received", "batch_start", meta);
        } catch (JSONException ignore) {}

        int scheduled = 0;
        for (Map.Entry<Long, JSONArray> e : groups.entrySet()) {
            Set<String> ids = doseIdsByMinute.get(e.getKey());
            String[] sorted = ids.toArray(new String[0]);
            java.util.Arrays.sort(sorted);
            String groupKey = String.join("|", sorted);
            int alarmId = AlarmScheduler.idFromString(groupKey);

            // #215 v0.2.3.0 — delega ao helper unificado scheduleDoseAlarm que
            // decide branch (push_critical_off | push_dnd | alarm_plus_push)
            // baseado em prefs SharedPreferences `dosy_user_prefs`.
            AlarmScheduler.Branch branch = AlarmScheduler.scheduleDoseAlarm(ctx, alarmId, e.getKey(), e.getValue());
            scheduled++;

            // Audit per dose scheduled (incluindo branch escolhida)
            for (int i = 0; i < e.getValue().length(); i++) {
                try {
                    JSONObject doseEntry = e.getValue().getJSONObject(i);
                    String doseId = doseEntry.getString("doseId");
                    JSONObject meta = new JSONObject();
                    meta.put("groupId", alarmId);
                    meta.put("groupSize", e.getValue().length());
                    meta.put("triggerAtMs", e.getKey());
                    meta.put("branch", branch.name().toLowerCase());
                    meta.put("source_scenario", "fcm_schedule_alarms");
                    AlarmAuditLogger.logScheduled(
                        ctx, "java_fcm_received",
                        doseId,
                        doseEntry.optString("scheduledAt", null),
                        doseEntry.optString("patientName", null),
                        doseEntry.optString("medName", null),
                        meta
                    );
                } catch (JSONException ignore) {}
            }
        }

        // Audit batch_end
        try {
            JSONObject meta = new JSONObject();
            meta.put("scheduledGroups", scheduled);
            meta.put("totalGroups", groups.size());
            AlarmAuditLogger.logBatch(ctx, "java_fcm_received", "batch_end", meta);
        } catch (JSONException ignore) {}

        Log.d(TAG, "scheduled groups=" + scheduled);
    }

    /**
     * Item #209 v0.2.1.9 — handle cancel_alarms FCM action.
     * Recebe doseIds CSV (ex: "uuid1,uuid2,uuid3"). Pra cada, calcula
     * AlarmScheduler.idFromString (mesma fórmula usada no scheduling) e
     * chama AlarmScheduler.cancelAlarm. Idempotente — id inexistente OK.
     *
     * NOTA: dose individual = group de 1 dose. ID derivado de doseId só.
     * Groups multi-dose (mesmo minute key) — cancela só se TODOS doses do
     * group estão cancelados. Conservador: cancelar individual com risk de
     * leave group order. Aceito — server-side garante consistência.
     */
    private void handleCancelAlarms(String doseIdsCsv) {
        if (doseIdsCsv == null || doseIdsCsv.isEmpty()) return;
        Context ctx = getApplicationContext();
        String[] ids = doseIdsCsv.split(",");
        int cancelled = 0;
        for (String doseId : ids) {
            String trimmed = doseId.trim();
            if (trimmed.isEmpty()) continue;
            int alarmId = AlarmScheduler.idFromString(trimmed);
            // #215 v0.2.3.0 — cancela alarme nativo + LocalNotification backup co-agendada
            if (AlarmScheduler.cancelDoseAlarmAndBackup(ctx, alarmId)) {
                cancelled++;
                try {
                    JSONObject meta = new JSONObject();
                    meta.put("alarmId", alarmId);
                    meta.put("reason", "fcm_cancel_action");
                    meta.put("source_scenario", "fcm_cancel_alarms");
                    AlarmAuditLogger.logCancelled(ctx, "java_fcm_received", trimmed, meta);
                } catch (JSONException ignore) {}
            }
        }
        Log.d(TAG, "cancel_alarms: requested=" + ids.length + " cancelled=" + cancelled);
    }

    // v0.2.2.4 (#214) — REMOVIDO método reportAlarmScheduled().
    // Tabela dose_alarms_scheduled órfã pós-#209 (notify-doses-1min cron removido).
    // alarm_audit_log v0.2.2.0 substitui rastreio completamente.
}
