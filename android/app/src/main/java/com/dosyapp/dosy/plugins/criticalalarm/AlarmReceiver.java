package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.media.RingtoneManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AlarmReceiver — fired by AlarmManager at scheduled time.
 *
 * Posts a notification with setFullScreenIntent() (BAL workaround for Android 14+).
 * Receives a "doses" extra (JSON array). Renders count + concatenated meds.
 */
public class AlarmReceiver extends BroadcastReceiver {

    // v0.2.3.1 — canal renomeado pra `dosy_alarm_fallback` (era `doses_critical_v2`
    // deletado por MainActivity.cleanupLegacyChannels = loop deleta-cria).
    // Canal usado apenas pelo fallback path quando startForegroundService falha (raro).
    // Mantém priority MAX + custom sound dosy_alarm.mp3 + bypassDND (alarme-like).
    private static final String CHANNEL_ID = "dosy_alarm_fallback";
    private static final int FS_NOTIF_OFFSET = 200_000_000;

    // #215 v0.2.3.0 — alinhado com src/services/notifications/unifiedScheduler.js BACKUP_OFFSET.
    // Alarme nativo disparou OK → cancela LocalNotification backup co-agendada
    // (anti-duplicate: user não vê alarme fullscreen + notif tray vibrando junto).
    // Se startForegroundService falhar (catch block abaixo), backup CONTINUA agendada
    // como fallback visual.
    // Fix overflow device-validation 2026-05-13: 700M → 2^30 (1073741824).
    private static final int BACKUP_OFFSET = 1073741824; // 2^30

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "Dosy:AlarmReceiver"
        );
        wl.acquire(10_000);

        int alarmId = intent.getIntExtra("id", 0);
        String dosesJson = intent.getStringExtra("doses");
        if (dosesJson == null) dosesJson = "[]";

        // v0.2.3.1 Fix B — re-rota fire time. AlarmReceiver consulta prefs ATUAIS
        // antes de fire alarme fullscreen. Se prefs mudaram entre agendamento e fire
        // (ex: user toggle Critical OFF, DnD ON), re-rota pra TrayNotificationReceiver
        // sem disparar AlarmService (sem som, sem fullscreen).
        SharedPreferences spPrefs = context.getSharedPreferences("dosy_user_prefs", Context.MODE_PRIVATE);
        boolean criticalOn = spPrefs.getBoolean("critical_alarm_enabled", true);
        boolean dndOn = spPrefs.getBoolean("dnd_enabled", false);
        String dndStart = spPrefs.getString("dnd_start", "23:00");
        String dndEnd = spPrefs.getString("dnd_end", "07:00");
        long nowMs = System.currentTimeMillis();
        boolean inDnd = dndOn && AlarmScheduler.isInDndWindowPublic(nowMs, dndStart, dndEnd);
        if (!criticalOn || inDnd) {
            String channelId = inDnd ? AlarmScheduler.TRAY_DND_CHANNEL_ID : AlarmScheduler.TRAY_CHANNEL_ID;
            android.util.Log.d("AlarmReceiver", "Fix B re-rota fire time: criticalOn=" + criticalOn
                + " inDnd=" + inDnd + " channel=" + channelId);
            // Re-rota direto pra TrayNotificationReceiver sem AlarmService.
            Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
            trayIntent.putExtra("notifId", alarmId);
            trayIntent.putExtra("doses", dosesJson);
            trayIntent.putExtra("channelId", channelId);
            context.sendBroadcast(trayIntent);
            if (wl.isHeld()) wl.release();
            return;
        }

        // Audit: log fired event per dose (debug observability)
        try {
            JSONArray arrAudit = new JSONArray(dosesJson);
            for (int i = 0; i < arrAudit.length(); i++) {
                JSONObject d = arrAudit.getJSONObject(i);
                JSONObject meta = new JSONObject();
                meta.put("alarmId", alarmId);
                meta.put("groupSize", arrAudit.length());
                AlarmAuditLogger.logFired(
                    context, "java_alarm_scheduler",
                    d.optString("doseId", null),
                    d.optString("scheduledAt", null),
                    d.optString("patientName", null),
                    d.optString("medName", null),
                    meta
                );
            }
        } catch (Exception ignored) {}

        // #215 v0.2.3.0 + v0.2.3.1 Fix B-01: anti-duplicate cancel cobrindo race
        // mesmo timestamp. NotificationManagerCompat.cancel só cobre notif VISIVEL —
        // não cancela PendingIntent pendente no AlarmManager. Sem este fix, se
        // TrayNotificationReceiver dispara MS depois de AlarmReceiver (race no
        // mesmo trigger), tray ainda aparece duplicado com alarme.
        try {
            // 1) Cancel notif visível (caso TrayNotificationReceiver já tenha postado)
            NotificationManagerCompat.from(context).cancel(alarmId + BACKUP_OFFSET);
            // 2) Cancel PendingIntent pendente do TrayNotificationReceiver (race fix)
            Intent trayIntent = new Intent(context, TrayNotificationReceiver.class);
            PendingIntent trayPi = PendingIntent.getBroadcast(
                context, alarmId + BACKUP_OFFSET, trayIntent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );
            if (trayPi != null) {
                android.app.AlarmManager am = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (am != null) am.cancel(trayPi);
                trayPi.cancel();
            }
        } catch (Exception ignored) {}

        // Primary path (Android 8+): start foreground service → service launches AlarmActivity.
        // FGS-style exemption bypasses BAL (Background Activity Launch) on Android 14+.
        try {
            Intent svc = new Intent(context, AlarmService.class);
            svc.putExtra("id", alarmId);
            svc.putExtra("doses", dosesJson);
            ContextCompat.startForegroundService(context, svc);
            if (wl.isHeld()) wl.release();
            return;
        } catch (Exception e) {
            e.printStackTrace();
            // Fall through to notification-only fallback below
        }

        // Fallback: full-screen intent notification (only fires fullscreen if user
        // granted USE_FULL_SCREEN_INTENT; otherwise reduces to heads-up).
        // Parse doses for notification body + collect IDs for tap intent
        int count = 0;
        StringBuilder bodyBuilder = new StringBuilder();
        StringBuilder idsCsv = new StringBuilder();
        String firstMed = "Dose";
        try {
            JSONArray arr = new JSONArray(dosesJson);
            count = arr.length();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject d = arr.getJSONObject(i);
                String med = d.optString("medName", "Dose");
                String unit = d.optString("unit", "");
                String did = d.optString("doseId", "");
                if (i == 0) firstMed = med;
                if (bodyBuilder.length() > 0) bodyBuilder.append(" · ");
                bodyBuilder.append(med);
                if (!unit.isEmpty()) bodyBuilder.append(" (").append(unit).append(")");
                if (!did.isEmpty()) {
                    if (idsCsv.length() > 0) idsCsv.append(",");
                    idsCsv.append(did);
                }
            }
        } catch (Exception ignored) {}

        ensureChannel(context);

        // Full-screen intent → AlarmActivity (system launches when device locked)
        Intent activityIntent = new Intent(context, AlarmActivity.class);
        activityIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_NO_USER_ACTION
        );
        activityIntent.putExtra("id", alarmId);
        activityIntent.putExtra("doses", dosesJson);

        PendingIntent fullScreenPi = PendingIntent.getActivity(
            context,
            alarmId,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tap (heads-up / unlocked) → MainActivity with openDoseIds → opens DoseModal queue
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (idsCsv.length() > 0) tapIntent.putExtra("openDoseIds", idsCsv.toString());

        PendingIntent tapPi = PendingIntent.getActivity(
            context,
            alarmId + FS_NOTIF_OFFSET,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = count <= 1
            ? "💊 Hora da medicação — " + firstMed
            : "💊 " + count + " doses agora";

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_dosy)
            .setColor(0xFFFF6B5B)
            .setContentTitle(title)
            .setContentText(bodyBuilder.toString())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyBuilder.toString()))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(true)
            .setContentIntent(tapPi)
            .setFullScreenIntent(fullScreenPi, true);

        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        try {
            nm.notify(alarmId + FS_NOTIF_OFFSET, b.build());
        } catch (SecurityException ignored) {}

        if (wl.isHeld()) wl.release();
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "Alarmes de Dose",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Lembretes críticos de medicação (alarme estilo despertador)");
        ch.enableLights(true);
        ch.enableVibration(true);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);

        // Item #203 (release v0.2.1.5+) — som customizado dosy_alarm.mp3 em res/raw/.
        // Se ausente fallback ringtone padrão. Channel + AlarmService usam o mesmo
        // arquivo pra som consistente entre notification tray e fullscreen alarm.
        Uri sound = null;
        int rawId = context.getResources().getIdentifier("dosy_alarm", "raw", context.getPackageName());
        if (rawId != 0) {
            sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + rawId);
        }
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        ch.setSound(sound, attrs);

        nm.createNotificationChannel(ch);
    }
}
