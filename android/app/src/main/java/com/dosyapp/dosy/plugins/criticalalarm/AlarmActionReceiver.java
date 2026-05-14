package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;

/**
 * AlarmActionReceiver — handles 3 action buttons posted on the live-alarm
 * foreground notification (AlarmService): "Ciente", "Adiar 10min", "Ignorar".
 *
 * Mirrors AlarmActivity.handleAction() so user can resolve alarm directly
 * from the notification shade (without re-opening AlarmActivity).
 */
public class AlarmActionReceiver extends BroadcastReceiver {

    public static final String ACTION_ACK = "com.dosyapp.dosy.ALARM_ACK";
    public static final String ACTION_SNOOZE = "com.dosyapp.dosy.ALARM_SNOOZE";
    public static final String ACTION_IGNORE = "com.dosyapp.dosy.ALARM_IGNORE";

    private static final int FS_NOTIF_OFFSET = 200_000_000;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        int alarmId = intent.getIntExtra("id", 0);
        String dosesJson = intent.getStringExtra("doses");
        String doseIdsCsv = intent.getStringExtra("doseIdsCsv");

        // Stop sound + vibration + FG service first
        AlarmService.stopActiveAlarm(context);

        // Cancel any leftover notifs (AlarmReceiver fallback fullscreen-intent notif)
        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        nm.cancel(alarmId + FS_NOTIF_OFFSET);

        // Also try to finish AlarmActivity if open (best-effort via close-system-dialogs broadcast)
        try {
            Intent closeAlarmActivity = new Intent("com.dosyapp.dosy.FINISH_ALARM_ACTIVITY");
            closeAlarmActivity.putExtra("id", alarmId);
            closeAlarmActivity.setPackage(context.getPackageName());
            context.sendBroadcast(closeAlarmActivity);
        } catch (Exception ignored) {}

        if (ACTION_ACK.equals(action)) {
            // Open MainActivity → DoseModal queue (resolves doses)
            Intent main = new Intent(context, MainActivity.class);
            main.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            if (doseIdsCsv != null && !doseIdsCsv.isEmpty()) {
                main.putExtra("openDoseIds", doseIdsCsv);
            }
            context.startActivity(main);
        } else if (ACTION_SNOOZE.equals(action)) {
            scheduleSnooze(context, alarmId, dosesJson, 10);
        } else if (ACTION_IGNORE.equals(action)) {
            // No-op: alarm dismissed, doses remain pending in DB. User will resolve later from app.
        }
    }

    private void scheduleSnooze(Context context, int alarmId, String dosesJson, int minutes) {
        long snoozeAt = System.currentTimeMillis() + minutes * 60 * 1000L;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent fire = new Intent(context, AlarmReceiver.class);
        fire.putExtra("id", alarmId);
        fire.putExtra("doses", dosesJson != null ? dosesJson : "[]");

        PendingIntent firePi = PendingIntent.getBroadcast(
            context, alarmId, fire,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent show = new Intent(context, AlarmActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(
            context, alarmId, show,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(snoozeAt, showPi), firePi);
            // v0.2.3.1 A-03 Fix — persiste snoozeAt em SharedPreferences pra sobreviver reboot.
            // Sem isso, BootReceiver lê triggerAt antigo + re-agenda no horário original.
            try {
                org.json.JSONArray doses = new org.json.JSONArray(dosesJson != null ? dosesJson : "[]");
                AlarmScheduler.persistSnoozedAlarm(context, alarmId, snoozeAt, doses);
            } catch (Exception persistErr) {
                android.util.Log.w("AlarmActionReceiver", "persistSnoozedAlarm error: " + persistErr.getMessage());
            }
        } catch (SecurityException ignored) {}
    }
}
