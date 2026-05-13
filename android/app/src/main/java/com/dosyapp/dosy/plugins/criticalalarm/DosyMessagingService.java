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

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
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

            if (AlarmScheduler.scheduleDose(ctx, alarmId, e.getKey(), e.getValue())) {
                scheduled++;
                // Reporta server-side pra cada dose individualmente — permite
                // notify-doses cron skip push se alarme já agendado
                for (int i = 0; i < e.getValue().length(); i++) {
                    try {
                        JSONObject doseEntry = e.getValue().getJSONObject(i);
                        String doseId = doseEntry.getString("doseId");
                        reportAlarmScheduled(ctx, doseId);
                        // Audit per dose scheduled
                        try {
                            JSONObject meta = new JSONObject();
                            meta.put("groupId", alarmId);
                            meta.put("groupSize", e.getValue().length());
                            meta.put("triggerAtMs", e.getKey());
                            meta.put("kind", "critical_alarm");
                            AlarmAuditLogger.logScheduled(
                                ctx, "java_fcm_received",
                                doseId,
                                doseEntry.optString("scheduledAt", null),
                                doseEntry.optString("patientName", null),
                                doseEntry.optString("medName", null),
                                meta
                            );
                        } catch (JSONException ignore) {}
                    } catch (Exception ex) {
                        Log.w(TAG, "reportAlarmScheduled fail: " + ex.getMessage());
                    }
                }
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
            if (AlarmScheduler.cancelAlarm(ctx, alarmId)) {
                cancelled++;
                // Audit cancelled
                try {
                    JSONObject meta = new JSONObject();
                    meta.put("alarmId", alarmId);
                    meta.put("reason", "fcm_cancel_action");
                    AlarmAuditLogger.logCancelled(ctx, "java_fcm_received", trimmed, meta);
                } catch (JSONException ignore) {}
            }
        }
        Log.d(TAG, "cancel_alarms: requested=" + ids.length + " cancelled=" + cancelled);
    }

    /**
     * Item #083.6 — POST pra Supabase REST registrando que esta dose+device
     * tem alarme agendado localmente. Permite notify-doses cron skip push tray.
     *
     * Item #205 (release v0.2.1.8) — REMOVE refresh_token endpoint call.
     * Antes: refreshAccessToken() em paralelo com DoseSyncWorker + JS supabase-js
     * causava storm xx:00. Agora usa access_token cached (gravado pelo plugin
     * updateAccessToken em TOKEN_REFRESHED event). Se expirado/falha, skip
     * report — alarme local já agendado, este endpoint é defense extra (cron
     * notify-doses skip push se já agendado). Não-crítico se falhar.
     */
    static void reportAlarmScheduled(Context ctx, String doseId) {
        SharedPreferences sp = ctx.getSharedPreferences(SYNC_PREFS, Context.MODE_PRIVATE);
        String url = sp.getString("supabase_url", null);
        String anon = sp.getString("anon_key", null);
        String userId = sp.getString("user_id", null);
        String deviceId = sp.getString("device_id", null);
        String schema = sp.getString("schema", "medcontrol");
        String accessToken = sp.getString("access_token", null);
        long accessTokenExp = sp.getLong("access_token_exp_ms", 0L);

        if (url == null || anon == null || userId == null || deviceId == null) {
            Log.d(TAG, "reportAlarmScheduled skip: missing credentials");
            return;
        }

        // Item #205 — usa access_token cached, NÃO faz refresh paralelo.
        if (accessToken == null) {
            Log.d(TAG, "reportAlarmScheduled skip: no access_token cached");
            return;
        }
        long now = System.currentTimeMillis();
        if (accessTokenExp > 0 && (now + 60_000L) >= accessTokenExp) {
            Log.d(TAG, "reportAlarmScheduled skip: access_token expired/near-expiry");
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("doseId", doseId);
            body.put("userId", userId);
            body.put("deviceId", deviceId);
            body.put("via", "fcm-data");

            HttpURLConnection conn = (HttpURLConnection) new URL(url + "/rest/v1/dose_alarms_scheduled").openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", anon);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Content-Profile", schema);
            conn.setRequestProperty("Prefer", "resolution=ignore-duplicates"); // PK conflict = skip
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int status = conn.getResponseCode();
            if (status != 201 && status != 200 && status != 409) {
                Log.w(TAG, "reportAlarmScheduled status=" + status);
            }
        } catch (Exception e) {
            Log.w(TAG, "reportAlarmScheduled error: " + e.getMessage());
        }
    }
}
