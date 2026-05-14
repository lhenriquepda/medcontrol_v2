package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * AlarmScheduler — helper static usado pelo plugin (chamadas JS) E pelo
 * DoseSyncWorker (background WorkManager). Item #081 (release v0.1.7.1) —
 * defense-in-depth caminho 3 de 3. Permite agendar alarmes nativos sem
 * depender de app foreground.
 *
 * Comportamento idêntico ao scheduleInternal() do CriticalAlarmPlugin:
 * setAlarmClock() (bypassa Doze) + persiste em SharedPreferences (sobrevive
 * reboot via BootReceiver).
 */
public class AlarmScheduler {
    private static final String TAG = "AlarmScheduler";
    private static final String PREFS = "dosy_critical_alarms";
    private static final String KEY_SCHEDULED = "scheduled_alarms";

    // #215 v0.2.3.0 — paridade com src/services/notifications/unifiedScheduler.js
    public static final int BACKUP_OFFSET = 700_000_000;
    public static final String TRAY_CHANNEL_ID = "dosy_tray";
    public static final String TRAY_DND_CHANNEL_ID = "dosy_tray_dnd";

    // Prefs SharedPreferences (gravadas pelo JS via setSyncCredentials + plugin updateUserPrefs futuro)
    private static final String USER_PREFS = "dosy_user_prefs";
    private static final String KEY_CRITICAL_ALARM = "critical_alarm_enabled";
    private static final String KEY_DND_ENABLED = "dnd_enabled";
    private static final String KEY_DND_START = "dnd_start"; // formato "HH:mm"
    private static final String KEY_DND_END = "dnd_end";     // formato "HH:mm"

    public enum Branch {
        PUSH_CRITICAL_OFF,
        PUSH_DND,
        ALARM_PLUS_PUSH
    }

    /**
     * #215 — Helper unificado: decide branch + agenda alarme + tray notification.
     * Paridade com JS `unifiedScheduler.buildSchedulePayload`.
     *
     * Lê prefs de SharedPreferences `dosy_user_prefs` (criticalAlarm, dndEnabled, dndStart, dndEnd).
     *
     * Branches:
     *   PUSH_CRITICAL_OFF  → só tray notif canal `dosy_tray` (sound default)
     *   PUSH_DND           → só tray notif canal `dosy_tray_dnd` (vibração leve, sem sound)
     *   ALARM_PLUS_PUSH    → setAlarmClock + tray notif backup canal `dosy_tray`
     *
     * @param ctx Android Context
     * @param groupId int hash determinístico do groupKey (deve coincidir com JS doseIdToNumber)
     * @param triggerAtEpochMs UTC epoch ms do horário da dose
     * @param doses JSONArray de {doseId, medName, unit, patientName, scheduledAt}
     * @return Branch escolhida
     */
    public static Branch scheduleDoseAlarm(Context ctx, int groupId, long triggerAtEpochMs, JSONArray doses) {
        SharedPreferences sp = ctx.getSharedPreferences(USER_PREFS, Context.MODE_PRIVATE);
        // #215 fix bug device-validation 2026-05-13: legacy fallback ler de
        // dosy_sync_credentials.critical_alarm_enabled (setSyncCredentials grava
        // antes do syncUserPrefs novo rodar). Garante critical_alarm respeitado
        // mesmo se syncUserPrefs JS ainda não disparou (login fresh, dose insert
        // antes de Ajustes touch).
        boolean criticalOn = sp.getBoolean(KEY_CRITICAL_ALARM, true);
        if (!sp.contains(KEY_CRITICAL_ALARM)) {
            SharedPreferences spLegacy = ctx.getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
            criticalOn = spLegacy.getBoolean("critical_alarm_enabled", true);
        }
        boolean dndOn = sp.getBoolean(KEY_DND_ENABLED, false);

        boolean inDnd = false;
        if (dndOn) {
            String dndStart = sp.getString(KEY_DND_START, "23:00");
            String dndEnd = sp.getString(KEY_DND_END, "07:00");
            inDnd = isInDndWindow(triggerAtEpochMs, dndStart, dndEnd);
        }
        Log.d(TAG, "scheduleDoseAlarm prefs: criticalOn=" + criticalOn + " dndOn=" + dndOn + " inDnd=" + inDnd);

        Branch branch;
        if (!criticalOn) {
            branch = Branch.PUSH_CRITICAL_OFF;
        } else if (inDnd) {
            branch = Branch.PUSH_DND;
        } else {
            branch = Branch.ALARM_PLUS_PUSH;
        }

        switch (branch) {
            case ALARM_PLUS_PUSH:
                scheduleDose(ctx, groupId, triggerAtEpochMs, doses);
                scheduleTrayNotification(ctx, groupId + BACKUP_OFFSET, triggerAtEpochMs, doses, TRAY_CHANNEL_ID);
                break;
            case PUSH_DND:
                scheduleTrayNotification(ctx, groupId, triggerAtEpochMs, doses, TRAY_DND_CHANNEL_ID);
                break;
            case PUSH_CRITICAL_OFF:
                scheduleTrayNotification(ctx, groupId, triggerAtEpochMs, doses, TRAY_CHANNEL_ID);
                break;
        }

        Log.d(TAG, "scheduleDoseAlarm groupId=" + groupId + " branch=" + branch + " count=" + doses.length());
        return branch;
    }

    /**
     * Agenda LocalNotification tray via PendingIntent (mesmo pattern Capacitor LocalNotifications usa).
     * Channel `dosy_tray` tem sound default + vibração; `dosy_tray_dnd` tem só vibração leve.
     */
    private static void scheduleTrayNotification(Context ctx, int notifId, long triggerAtMs, JSONArray doses, String channelId) {
        ensureTrayChannel(ctx, channelId);

        Intent intent = new Intent(ctx, TrayNotificationReceiver.class);
        intent.putExtra("notifId", notifId);
        intent.putExtra("doses", doses.toString());
        intent.putExtra("channelId", channelId);

        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, notifId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        } catch (SecurityException e) {
            Log.w(TAG, "tray schedule failed (permission): " + e.getMessage());
            am.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        }
    }

    /**
     * Cria channel dosy_tray ou dosy_tray_dnd se ainda não existe (idempotente).
     */
    private static void ensureTrayChannel(Context ctx, String channelId) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(channelId) != null) return;

        boolean isDnd = TRAY_DND_CHANNEL_ID.equals(channelId);
        int importance = isDnd
            ? NotificationManager.IMPORTANCE_DEFAULT  // sem heads-up + sem som
            : NotificationManager.IMPORTANCE_HIGH;     // heads-up + som default

        NotificationChannel ch = new NotificationChannel(
            channelId,
            isDnd ? "Lembretes — Não Perturbe" : "Lembretes de Dose",
            importance
        );
        ch.setDescription(isDnd
            ? "Lembretes silenciosos dentro da janela Não Perturbe"
            : "Lembretes de doses agendadas");
        ch.enableLights(!isDnd);
        ch.enableVibration(true);
        if (isDnd) {
            ch.setVibrationPattern(new long[]{0, 200}); // pulse curto 200ms
            ch.setSound(null, null);
        }
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    /**
     * Verifica se epoch ms cai dentro janela DnD (interpretada em America/Sao_Paulo).
     * Suporta janelas que cruzam meia-noite (ex: 23:00 → 07:00).
     */
    private static boolean isInDndWindow(long epochMs, String dndStart, String dndEnd) {
        try {
            ZonedDateTime zdt = Instant.ofEpochMilli(epochMs).atZone(ZoneId.of("America/Sao_Paulo"));
            LocalTime t = zdt.toLocalTime();
            LocalTime start = LocalTime.parse(dndStart);
            LocalTime end = LocalTime.parse(dndEnd);
            int tMin = t.getHour() * 60 + t.getMinute();
            int sMin = start.getHour() * 60 + start.getMinute();
            int eMin = end.getHour() * 60 + end.getMinute();
            if (sMin <= eMin) {
                return tMin >= sMin && tMin < eMin;
            } else {
                return tMin >= sMin || tMin < eMin;
            }
        } catch (Exception e) {
            Log.w(TAG, "isInDndWindow parse error: " + e.getMessage());
            return false;
        }
    }

    /**
     * #215 — Cancela alarme nativo + tray backup co-agendado (cobre branch ALARM_PLUS_PUSH).
     * Idempotente — cancelar id inexistente = no-op.
     */
    public static boolean cancelDoseAlarmAndBackup(Context ctx, int groupId) {
        boolean ok = cancelAlarm(ctx, groupId);
        // Plus cancela tray backup
        try {
            NotificationManagerCompat.from(ctx).cancel(groupId + BACKUP_OFFSET);
            // Cancela também PendingIntent da AlarmManager pra prevent dispare
            Intent intent = new Intent(ctx, TrayNotificationReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(
                ctx, groupId + BACKUP_OFFSET, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(pi);
            pi.cancel();
        } catch (Exception ignored) {}
        Log.d(TAG, "cancelDoseAlarmAndBackup groupId=" + groupId);
        return ok;
    }

    /**
     * Schedule a critical alarm for the given trigger time + doses payload.
     *
     * @param ctx Android Context
     * @param id Stable alarm id (deterministic from doseIds hash)
     * @param triggerAtEpochMs UTC epoch milliseconds when alarm fires
     * @param doses JSON array of {doseId, medName, unit, patientName}
     * @return true if scheduled, false if invalid/past
     */
    public static boolean scheduleDose(Context ctx, int id, long triggerAtEpochMs, JSONArray doses) {
        // Floor to minute boundary (ignore residual seconds)
        long triggerAt = (triggerAtEpochMs / 60000L) * 60000L;

        if (triggerAt <= System.currentTimeMillis()) {
            Log.d(TAG, "skip past trigger id=" + id + " at=" + triggerAt);
            return false;
        }

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.w(TAG, "AlarmManager null");
            return false;
        }

        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("doses", doses.toString());

        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(ctx, AlarmActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(
            ctx, id, showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(triggerAt, showPi);
            am.setAlarmClock(info, pi);
            persistAlarm(ctx, id, triggerAt, doses);
            Log.d(TAG, "scheduled id=" + id + " at=" + triggerAt + " count=" + doses.length());
            return true;
        } catch (SecurityException e) {
            // Pode lançar se permissão SCHEDULE_EXACT_ALARM revogada (Android 14+)
            Log.e(TAG, "schedule failed (permission): " + e.getMessage());
            return false;
        }
    }

    /**
     * Persiste alarme no SharedPreferences pra sobreviver reboot (BootReceiver
     * lê dali) + idempotência: scheduling mesmo id 2x apenas atualiza.
     */
    private static void persistAlarm(Context ctx, int id, long triggerAt, JSONArray doses) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray current;
            String existing = sp.getString(KEY_SCHEDULED, null);
            current = existing != null ? new JSONArray(existing) : new JSONArray();

            // Remove entry com mesmo id (replace semantics)
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < current.length(); i++) {
                JSONObject e = current.getJSONObject(i);
                if (e.getInt("id") != id) filtered.put(e);
            }

            JSONObject entry = new JSONObject();
            entry.put("id", id);
            entry.put("triggerAt", triggerAt);
            entry.put("doses", doses);
            filtered.put(entry);

            sp.edit().putString(KEY_SCHEDULED, filtered.toString()).apply();
        } catch (JSONException e) {
            Log.w(TAG, "persistAlarm error: " + e.getMessage());
        }
    }

    /**
     * Item #209 v0.2.1.9 — cancel a specific alarm by groupId.
     * Chamado por DosyMessagingService handleCancelAlarms quando trigger DB
     * envia action=cancel_alarms (dose deletada, status changed pending→done,
     * etc). Plus chamado quando rescheduleAll detecta dose removida do cache.
     */
    public static boolean cancelAlarm(Context ctx, int id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.cancel(pi);
        pi.cancel();
        removePersisted(ctx, id);
        Log.d(TAG, "cancelled id=" + id);
        return true;
    }

    /**
     * Remove entry persistida do SharedPreferences.
     */
    private static void removePersisted(Context ctx, int id) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            String existing = sp.getString(KEY_SCHEDULED, null);
            if (existing == null) return;
            JSONArray current = new JSONArray(existing);
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < current.length(); i++) {
                JSONObject e = current.getJSONObject(i);
                if (e.getInt("id") != id) filtered.put(e);
            }
            sp.edit().putString(KEY_SCHEDULED, filtered.toString()).apply();
        } catch (JSONException e) {
            Log.w(TAG, "removePersisted error: " + e.getMessage());
        }
    }

    /**
     * Determinístic id derivation from a stable string (e.g. concat of doseIds).
     * Used by DoseSyncWorker pra coincidir com ids do JS-side (groupKey hash).
     *
     * #220 v0.2.3.0 — alinhado com JS `doseIdToNumber` (src/services/notifications/prefs.js):
     * ambos aplicam `Math.abs(h) % 2147483647` pra garantir paridade cross-source.
     * Antes Java só fazia `Math.abs(h)` — strings longas podiam divergir do JS.
     */
    public static int idFromString(String s) {
        int h = 0;
        for (int i = 0; i < s.length(); i++) {
            h = ((h << 5) - h) + s.charAt(i);
            h |= 0; // i32 cast
        }
        return Math.abs(h) % 2147483647;
    }
}
