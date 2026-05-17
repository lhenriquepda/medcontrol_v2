package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;
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
 *     parseia lista de doses + chama AlarmScheduler.scheduleDoseAlarm
 *     (helper unificado branch alarm/tray), NÃO mostra notif
 *   - data.action == "cancel_alarms" → cancela alarme + tray local
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
            // #215 v0.2.3.0 fix race-condition device-validation 2026-05-13:
            // Edge payload agora inclui prefs do user (criticalAlarm, dndEnabled,
            // dndStart, dndEnd). Java passa prefsOverride pra scheduleDoseAlarm
            // ao invés de ler SharedPreferences (que pode estar stale se
            // syncUserPrefs JS ainda não rodou).
            try {
                JSONObject prefsOverride = null;
                String prefsJson = data.get("prefs");
                if (prefsJson != null) {
                    try { prefsOverride = new JSONObject(prefsJson); } catch (Exception ignored) {}
                }
                handleScheduleAlarms(data.get("doses"), prefsOverride);
                return;
            } catch (Exception e) {
                Log.e(TAG, "schedule_alarms handler error: " + e.getMessage(), e);
            }
        }

        // v0.2.3.8 #287 — fire_now_alarm: dispara AlarmService FG IMEDIATO no horário exato.
        // Edge dose-fire-time-notifier v7 envia DATA-ONLY HIGH com kind=fire_now_alarm.
        // FCM SDK obrigado a chamar onMessageReceived (sem notification block bloqueando).
        // Handler aqui invoca startForegroundService(AlarmService) → som loop + AlarmActivity
        // lockscreen — caregiver killed acorda + dispara alarme real com som.
        String kind = data != null ? data.get("kind") : null;
        if ("fire_now_alarm".equals(kind)) {
            try {
                handleFireNowAlarm(remoteMessage);
                return;
            } catch (Exception e) {
                Log.e(TAG, "fire_now_alarm handler error: " + e.getMessage(), e);
            }
        }

        // v0.2.3.7 Bug B fix (legacy compat) — fire-time tray-only rendered IN-APP.
        // Mantido pra compat com AABs antigos cacheados que ainda recebem kind=dose_fire_time.
        // Próxima release v0.2.3.9+ poderá remover.
        if ("dose_fire_time".equals(kind)) {
            try {
                handleFireTimeNotification(remoteMessage);
                return;
            } catch (Exception e) {
                Log.e(TAG, "fire_time handler error: " + e.getMessage(), e);
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
    private void handleScheduleAlarms(String dosesJson, JSONObject prefsOverride) throws JSONException {
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

            // #215 v0.2.3.0 — delega ao helper unificado scheduleDoseAlarm.
            // prefsOverride autoritativo do payload FCM (fix race condition
            // device-validation 2026-05-13 — Edge envia prefs no payload).
            AlarmScheduler.Branch branch = AlarmScheduler.scheduleDoseAlarm(ctx, alarmId, e.getKey(), e.getValue(), prefsOverride);
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
     * v0.2.3.1 Bloco 5 (Fix C + A-02) — handle cancel_alarms FCM action.
     * Recebe doseIds CSV. Cancela:
     *   1) Cada dose individualmente (cobre single-dose groups onde hash(doseId)
     *      é o mesmo do scheduling)
     *   2) Reconstroi hash do grupo (sortedDoseIds.join('|')) e cancela
     *      tambem (cobre multi-dose groups que NAO matchavam por single hash)
     * Idempotente — id inexistente OK.
     */
    private void handleCancelAlarms(String doseIdsCsv) {
        if (doseIdsCsv == null || doseIdsCsv.isEmpty()) return;
        Context ctx = getApplicationContext();
        String[] ids = doseIdsCsv.split(",");
        int cancelled = 0;

        // 1) Cancel cada doseId individualmente (single-dose groups)
        for (String doseId : ids) {
            String trimmed = doseId.trim();
            if (trimmed.isEmpty()) continue;
            int alarmId = AlarmScheduler.idFromString(trimmed);
            if (AlarmScheduler.cancelDoseAlarmAndBackup(ctx, alarmId)) {
                cancelled++;
                try {
                    JSONObject meta = new JSONObject();
                    meta.put("alarmId", alarmId);
                    meta.put("reason", "fcm_cancel_action_individual");
                    meta.put("source_scenario", "fcm_cancel_alarms");
                    AlarmAuditLogger.logCancelled(ctx, "java_fcm_received", trimmed, meta);
                } catch (JSONException ignore) {}
            }
        }

        // 2) v0.2.3.1 Fix C — reconstroi hash do grupo (sortedDoseIds.join('|'))
        //    e cancela tambem. Multi-dose groups foram agendados com esse hash.
        if (ids.length > 1) {
            String[] sorted = new String[ids.length];
            int j = 0;
            for (String id : ids) {
                String trimmed = id.trim();
                if (!trimmed.isEmpty()) sorted[j++] = trimmed;
            }
            if (j > 1) {
                String[] sortedFinal = new String[j];
                System.arraycopy(sorted, 0, sortedFinal, 0, j);
                java.util.Arrays.sort(sortedFinal);
                String groupKey = String.join("|", sortedFinal);
                int groupAlarmId = AlarmScheduler.idFromString(groupKey);
                if (AlarmScheduler.cancelDoseAlarmAndBackup(ctx, groupAlarmId)) {
                    cancelled++;
                    try {
                        JSONObject meta = new JSONObject();
                        meta.put("alarmId", groupAlarmId);
                        meta.put("groupKey", groupKey);
                        meta.put("reason", "fcm_cancel_action_group");
                        meta.put("source_scenario", "fcm_cancel_alarms_batch");
                        AlarmAuditLogger.logCancelled(ctx, "java_fcm_received", groupKey, meta);
                    } catch (JSONException ignore) {}
                }
            }
        }

        Log.d(TAG, "cancel_alarms: requested=" + ids.length + " cancelled=" + cancelled);
    }

    // v0.2.2.4 (#214) — REMOVIDO método reportAlarmScheduled().
    // Tabela dose_alarms_scheduled órfã pós-#209 (notify-doses-1min cron removido).
    // alarm_audit_log v0.2.2.0 substitui rastreio completamente.

    /**
     * v0.2.3.7 Bug B fix — render fire-time notification IN-APP com PendingIntent
     * customizado contendo openDoseId extra. Tap dispara MainActivity.handleAlarmAction
     * com extras corretos → JS event dosy:openDose → DoseModal abre.
     *
     * Payload esperado (data-only ou notification+data, ambos OK):
     *   data.kind = "dose_fire_time"
     *   data.openDoseId = "<uuid>"
     *   data.patientId / data.medName / data.scheduledAt (optional, for UI)
     *
     * Notification fields (title/body) lidos de remoteMessage.getNotification()
     * se presente, senão fallback usando data.medName + data.scheduledAt.
     */
    private void handleFireTimeNotification(RemoteMessage msg) {
        Map<String, String> data = msg.getData();
        String openDoseId = data.get("openDoseId");
        if (openDoseId == null) openDoseId = data.get("doseId");
        if (openDoseId == null) {
            Log.w(TAG, "fire_time: missing openDoseId, skip render");
            return;
        }

        String title;
        String body;
        RemoteMessage.Notification notif = msg.getNotification();
        if (notif != null && notif.getTitle() != null) {
            title = notif.getTitle();
            body = notif.getBody() != null ? notif.getBody() : "";
        } else if (data.containsKey("title")) {
            // v0.2.3.7 v6 — data-only FCM payload com title/body em data fields
            title = data.get("title");
            body = data.getOrDefault("body", "");
        } else {
            String medName = data.getOrDefault("medName", "Medicamento");
            title = "Hora da dose";
            body = medName;
        }

        ensureFireTimeChannel();

        // Build Intent → MainActivity com openDoseId extra (handleAlarmAction reads).
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openDoseId", openDoseId);
        intent.setAction("com.dosyapp.dosy.DOSE_FIRE_TIME_TAP_" + openDoseId);

        // Unique requestCode per dose pra PendingIntent não compartilhar entre doses.
        int requestCode = openDoseId.hashCode();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, requestCode, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "dosy_tray")
            .setSmallIcon(R.drawable.ic_stat_dosy)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(pi)
            .setAutoCancel(true);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            int notifId = ("fire_" + openDoseId).hashCode();
            nm.notify("fire_" + openDoseId, notifId, builder.build());
            Log.i(TAG, "fire_time tray rendered openDoseId=" + openDoseId);
        }
    }

    /**
     * v0.2.3.8 #287 — handleFireNowAlarm.
     *
     * Recebe FCM data-only com kind=fire_now_alarm enviado por dose-fire-time-notifier
     * no horário exato da dose. Dispara AlarmService FG imediato (sound loop +
     * AlarmActivity lockscreen). Substitui handleFireTimeNotification (tray silenciosa)
     * pra caregivers — alarme nativo com som agora dispara mesmo com app killed.
     *
     * Payload esperado (data fields):
     *   kind=fire_now_alarm
     *   doseId, openDoseId, medName, unit, patientName, scheduledAt
     */
    private void handleFireNowAlarm(RemoteMessage msg) {
        Map<String, String> data = msg.getData();
        String doseId = data.get("doseId");
        if (doseId == null) doseId = data.get("openDoseId");
        if (doseId == null) {
            Log.w(TAG, "fire_now_alarm: missing doseId, skip");
            return;
        }

        Context ctx = getApplicationContext();

        // Build doses JSON array com single dose entry (formato esperado AlarmService)
        try {
            JSONObject dose = new JSONObject();
            dose.put("doseId", doseId);
            dose.put("medName", data.getOrDefault("medName", "Dose"));
            dose.put("unit", data.getOrDefault("unit", ""));
            dose.put("patientName", data.getOrDefault("patientName", ""));
            dose.put("scheduledAt", data.getOrDefault("scheduledAt", ""));
            JSONArray arr = new JSONArray();
            arr.put(dose);

            Intent svc = new Intent(ctx, AlarmService.class);
            svc.putExtra("id", AlarmScheduler.idFromString(doseId));
            svc.putExtra("doses", arr.toString());

            // startForegroundService permite AlarmService startar mesmo Android 8+ Doze
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(svc);
            } else {
                ctx.startService(svc);
            }

            Log.i(TAG, "fire_now_alarm dispatched AlarmService doseId=" + doseId);

            // Audit
            try {
                JSONObject meta = new JSONObject();
                meta.put("source_scenario", "fcm_fire_now_alarm");
                meta.put("doseId", doseId);
                AlarmAuditLogger.logScheduled(
                    ctx, "java_fcm_received",
                    doseId,
                    data.getOrDefault("scheduledAt", null),
                    data.getOrDefault("patientName", null),
                    data.getOrDefault("medName", null),
                    meta
                );
            } catch (JSONException ignore) {}
        } catch (JSONException e) {
            Log.e(TAG, "fire_now_alarm JSON build error: " + e.getMessage(), e);
        }
    }

    private void ensureFireTimeChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel("dosy_tray");
        if (existing == null) {
            NotificationChannel ch = new NotificationChannel("dosy_tray", "Lembretes de Dose", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Lembretes de doses agendadas");
            nm.createNotificationChannel(ch);
        }
    }
}
