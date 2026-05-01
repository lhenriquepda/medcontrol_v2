package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AlarmService — long-lived foreground service for active alarm.
 *
 * Plays looped MediaPlayer (USAGE_ALARM, bypasses silent/DND) + vibration until
 * AlarmActivity launches (via fullScreenIntent on locked, or user tap on unlocked)
 * OR user dismisses via tap on notification.
 *
 * Android 14+ BAL: fullScreenIntent only launches activity on locked screen.
 * On unlocked: heads-up notif only. Sound + vibration handled here keeps alarm
 * "active" until user interaction. Tap notif → MainActivity → app stops service.
 */
public class AlarmService extends Service {

    public static final String ACTION_STOP = "com.dosyapp.dosy.STOP_ALARM";
    public static final String ACTION_MUTE = "com.dosyapp.dosy.MUTE_ALARM";
    public static final String ACTION_UNMUTE = "com.dosyapp.dosy.UNMUTE_ALARM";

    private static final String CHANNEL_ID = "doses_critical";
    private static final int FG_NOTIF_ID = 300_000_000;
    private static final int TAP_NOTIF_OFFSET = 200_000_000;

    private static MediaPlayer activePlayer;
    private static Vibrator activeVibrator;

    public static void stopActiveAlarm(Context ctx) {
        try {
            if (activePlayer != null) {
                if (activePlayer.isPlaying()) activePlayer.stop();
                activePlayer.release();
                activePlayer = null;
            }
        } catch (Exception ignored) {}
        try {
            if (activeVibrator != null) {
                activeVibrator.cancel();
                activeVibrator = null;
            }
        } catch (Exception ignored) {}
        ctx.stopService(new Intent(ctx, AlarmService.class));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopAlarmInternal();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_MUTE.equals(intent.getAction())) {
            try {
                if (activePlayer != null && activePlayer.isPlaying()) activePlayer.pause();
            } catch (Exception ignored) {}
            try { if (activeVibrator != null) activeVibrator.cancel(); } catch (Exception ignored) {}
            return START_STICKY;
        }
        if (intent != null && ACTION_UNMUTE.equals(intent.getAction())) {
            try {
                if (activePlayer != null && !activePlayer.isPlaying()) activePlayer.start();
            } catch (Exception ignored) {}
            startVibrationLoop();
            return START_STICKY;
        }
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        int alarmId = intent.getIntExtra("id", 0);
        String dosesJson = intent.getStringExtra("doses");
        if (dosesJson == null) dosesJson = "[]";

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

        ensureChannel();

        // Full-screen intent → AlarmActivity (system launches on locked screen)
        Intent fsActivityIntent = new Intent(this, AlarmActivity.class);
        fsActivityIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_NO_USER_ACTION
        );
        fsActivityIntent.putExtra("id", alarmId);
        fsActivityIntent.putExtra("doses", dosesJson);

        PendingIntent fullScreenPi = PendingIntent.getActivity(
            this,
            alarmId,
            fsActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tap (heads-up / unlocked) → re-open AlarmActivity (so user can return when accidentally dismissed)
        Intent tapIntent = new Intent(this, AlarmActivity.class);
        tapIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        tapIntent.putExtra("id", alarmId);
        tapIntent.putExtra("doses", dosesJson);

        PendingIntent tapPi = PendingIntent.getActivity(
            this,
            alarmId + TAP_NOTIF_OFFSET,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // ── 3 action buttons (Ciente / Adiar / Ignorar) ─────────────────
        PendingIntent ackPi = buildActionPi(alarmId, dosesJson, idsCsv.toString(), AlarmActionReceiver.ACTION_ACK, 1);
        PendingIntent snoozePi = buildActionPi(alarmId, dosesJson, idsCsv.toString(), AlarmActionReceiver.ACTION_SNOOZE, 2);
        PendingIntent ignorePi = buildActionPi(alarmId, dosesJson, idsCsv.toString(), AlarmActionReceiver.ACTION_IGNORE, 3);

        String title = count <= 1
            ? "🔔 ALARME Dosy — " + firstMed
            : "🔔 ALARME Dosy — " + count + " doses";
        String subtext = "Toque pra abrir · Ciente / Adiar / Ignorar";

        Notification fgNotif = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(bodyBuilder.toString())
            .setSubText(subtext)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyBuilder.toString()))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(tapPi)
            .setFullScreenIntent(fullScreenPi, true)
            .addAction(R.mipmap.ic_launcher, "Ciente", ackPi)
            .addAction(R.mipmap.ic_launcher, "Adiar 10min", snoozePi)
            .addAction(R.mipmap.ic_launcher, "Ignorar", ignorePi)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(FG_NOTIF_ID, fgNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(FG_NOTIF_ID, fgNotif, ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE);
            } else {
                startForeground(FG_NOTIF_ID, fgNotif);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Direct startActivity — relies on SYSTEM_ALERT_WINDOW permission for BAL exemption.
        // Without that permission, falls back to fullScreenIntent on locked screen only.
        try {
            Intent directLaunch = new Intent(this, AlarmActivity.class);
            directLaunch.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NO_USER_ACTION
            );
            directLaunch.putExtra("id", alarmId);
            directLaunch.putExtra("doses", dosesJson);
            startActivity(directLaunch);
        } catch (Exception e) {
            e.printStackTrace();
        }

        startMediaPlayerLoop();
        startVibrationLoop();

        // Service stays alive — sound + vibration loop until stopActiveAlarm() called
        return START_STICKY;
    }

    private PendingIntent buildActionPi(int alarmId, String dosesJson, String doseIdsCsv, String action, int seq) {
        Intent i = new Intent(this, AlarmActionReceiver.class);
        i.setAction(action);
        i.putExtra("id", alarmId);
        i.putExtra("doses", dosesJson);
        i.putExtra("doseIdsCsv", doseIdsCsv);
        // Unique requestCode per (alarmId, action) — avoids PI extras getting clobbered
        int rc = alarmId * 10 + seq;
        return PendingIntent.getBroadcast(
            this, rc, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void startMediaPlayerLoop() {
        try {
            if (activePlayer != null) {
                try { activePlayer.release(); } catch (Exception ignored) {}
                activePlayer = null;
            }
            activePlayer = new MediaPlayer();
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            activePlayer.setAudioAttributes(attrs);

            int rawId = getResources().getIdentifier("dosy_alarm", "raw", getPackageName());
            if (rawId != 0) {
                Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + rawId);
                activePlayer.setDataSource(this, uri);
            } else {
                Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (ringtone == null) ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                activePlayer.setDataSource(this, ringtone);
            }

            activePlayer.setLooping(true);
            activePlayer.prepare();
            activePlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startVibrationLoop() {
        try {
            activeVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (activeVibrator == null || !activeVibrator.hasVibrator()) return;
            long[] pattern = { 0, 800, 600, 800, 600 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activeVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                activeVibrator.vibrate(pattern, 0);
            }
        } catch (Exception ignored) {}
    }

    private void stopAlarmInternal() {
        try {
            if (activePlayer != null) {
                if (activePlayer.isPlaying()) activePlayer.stop();
                activePlayer.release();
                activePlayer = null;
            }
        } catch (Exception ignored) {}
        try {
            if (activeVibrator != null) {
                activeVibrator.cancel();
                activeVibrator = null;
            }
        } catch (Exception ignored) {}
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopAlarmInternal();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
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

        // Channel sound disabled — service drives MediaPlayer loop instead
        // (channel sound plays once per notif post; we need continuous loop)
        ch.setSound(null, null);

        nm.createNotificationChannel(ch);
    }
}
