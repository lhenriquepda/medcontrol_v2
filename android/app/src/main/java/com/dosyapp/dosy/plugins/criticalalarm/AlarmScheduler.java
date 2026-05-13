package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

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
     */
    public static int idFromString(String s) {
        // Mesma fórmula do JS doseIdToNumber pra coincidir alarmes JS-scheduled
        // com Worker-scheduled (idempotente). Ver src/services/notifications.js
        // doseIdToNumber: int positivo via simple hash.
        int h = 0;
        for (int i = 0; i < s.length(); i++) {
            h = ((h << 5) - h) + s.charAt(i);
            h |= 0; // i32 cast
        }
        return Math.abs(h);
    }
}
