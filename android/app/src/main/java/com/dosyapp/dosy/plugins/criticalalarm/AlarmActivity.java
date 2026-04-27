package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.Color;
import android.util.TypedValue;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * AlarmActivity — full-screen alarm UI for medication reminders (single or multi-dose).
 *
 * Receives "doses" extra (JSON array). Renders list with all meds.
 * Buttons:
 *   - "Ciente": stops alarm, posts persistent notif (tap → opens DoseModal queue with all doseIds).
 *   - "Adiar 10 min": stops + cancels notif + re-schedules alarm 10 min ahead.
 */
public class AlarmActivity extends Activity {

    private static final String CHANNEL_ID = "doses_v2";
    private static final int NOTIF_ID_OFFSET = 100_000_000;
    private static final int FS_NOTIF_OFFSET = 200_000_000;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    private int alarmId;
    private List<DoseItem> doses = new ArrayList<>();

    private static class DoseItem {
        String doseId, medName, unit, patientName;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "Dosy:AlarmActivity"
        );
        wakeLock.acquire(10 * 60 * 1000L);

        Intent intent = getIntent();
        alarmId = intent.getIntExtra("id", 0);
        String dosesJson = intent.getStringExtra("doses");
        parseDoses(dosesJson);

        setContentView(buildLayout());

        try {
            NotificationManagerCompat.from(this).cancel(alarmId + FS_NOTIF_OFFSET);
        } catch (Exception ignored) {}

        // Activity owns the experience now — stop service-level sound/vibration
        AlarmService.stopActiveAlarm(this);

        postPersistentNotification();
        startAlarmSound();
        startVibration();
    }

    private void parseDoses(String json) {
        doses.clear();
        if (json == null) return;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                DoseItem item = new DoseItem();
                item.doseId = o.optString("doseId", "");
                item.medName = o.optString("medName", "Dose");
                item.unit = o.optString("unit", "");
                item.patientName = o.optString("patientName", "");
                doses.add(item);
            }
        } catch (Exception ignored) {}
    }

    private View buildLayout() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.parseColor("#0d1535"));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(24), dp(48), dp(24), dp(48));

        TextView icon = new TextView(this);
        icon.setText("💊");
        icon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 64);
        icon.setGravity(Gravity.CENTER);
        root.addView(icon);

        TextView title = new TextView(this);
        title.setText(doses.size() <= 1 ? "Hora da medicação" : doses.size() + " doses agora");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(8), 0, dp(16));
        root.addView(title);

        // Lista de doses como cards
        for (DoseItem d : doses) {
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackgroundColor(Color.parseColor("#1e2750"));
            card.setPadding(dp(16), dp(12), dp(16), dp(12));

            TextView med = new TextView(this);
            med.setText(d.medName);
            med.setTextColor(Color.parseColor("#7DD3FC"));
            med.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
            med.setTypeface(null, android.graphics.Typeface.BOLD);
            card.addView(med);

            StringBuilder sb = new StringBuilder();
            if (!d.unit.isEmpty()) sb.append(d.unit);
            if (!d.patientName.isEmpty()) {
                if (sb.length() > 0) sb.append(" · ");
                sb.append(d.patientName);
            }
            if (sb.length() > 0) {
                TextView details = new TextView(this);
                details.setText(sb.toString());
                details.setTextColor(Color.parseColor("#94A3B8"));
                details.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                card.addView(details);
            }

            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, dp(6), 0, dp(6));
            root.addView(card, cardLp);
        }

        // Spacer
        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(0, dp(24)));
        root.addView(spacer);

        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnLp.setMargins(0, dp(8), 0, dp(8));

        Button btnAck = new Button(this);
        btnAck.setText(doses.size() <= 1 ? "✓ Ciente" : "✓ Ciente — abrir todas");
        btnAck.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        btnAck.setTextColor(Color.WHITE);
        btnAck.setBackgroundColor(Color.parseColor("#10B981"));
        btnAck.setPadding(0, dp(20), 0, dp(20));
        btnAck.setOnClickListener(v -> handleAction("acknowledge"));
        root.addView(btnAck, btnLp);

        Button btnSnooze = new Button(this);
        btnSnooze.setText("⏰ Adiar 10 min");
        btnSnooze.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        btnSnooze.setTextColor(Color.WHITE);
        btnSnooze.setBackgroundColor(Color.parseColor("#3B82F6"));
        btnSnooze.setPadding(0, dp(16), 0, dp(16));
        btnSnooze.setOnClickListener(v -> handleAction("snooze"));
        root.addView(btnSnooze, btnLp);

        scroll.addView(root);
        return scroll;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()
        );
    }

    private void startAlarmSound() {
        try {
            mediaPlayer = new MediaPlayer();
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attrs);

            int rawId = getResources().getIdentifier("dosy_alarm", "raw", getPackageName());
            if (rawId != 0) {
                Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + rawId);
                mediaPlayer.setDataSource(this, uri);
            } else {
                Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (ringtone == null) ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                mediaPlayer.setDataSource(this, ringtone);
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = { 0, 800, 600, 800, 600 };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        } else {
            vibrator.vibrate(pattern, 0);
        }
    }

    private void stopSoundAndVibration() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
                mediaPlayer = null;
            }
        } catch (Exception ignored) {}
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) {}
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
    }

    private void handleAction(String action) {
        stopSoundAndVibration();

        if ("acknowledge".equals(action)) {
            // Open MainActivity directly with doseIds → opens modal queue
            openAppWithDoseIds();
            cancelPersistentNotification();
        } else if ("snooze".equals(action)) {
            cancelPersistentNotification();
            scheduleSnooze(10);
        }

        finish();
    }

    private String getDoseIdsCsv() {
        StringBuilder sb = new StringBuilder();
        for (DoseItem d : doses) {
            if (d.doseId == null || d.doseId.isEmpty()) continue;
            if (sb.length() > 0) sb.append(",");
            sb.append(d.doseId);
        }
        return sb.toString();
    }

    private void openAppWithDoseIds() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        String csv = getDoseIdsCsv();
        if (!csv.isEmpty()) i.putExtra("openDoseIds", csv);
        startActivity(i);
    }

    private void postPersistentNotification() {
        ensureChannel();

        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String csv = getDoseIdsCsv();
        if (!csv.isEmpty()) tapIntent.putExtra("openDoseIds", csv);

        PendingIntent tapPi = PendingIntent.getActivity(
            this,
            alarmId + NOTIF_ID_OFFSET,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        StringBuilder body = new StringBuilder();
        for (DoseItem d : doses) {
            if (body.length() > 0) body.append(" · ");
            body.append(d.medName);
            if (!d.unit.isEmpty()) body.append(" (").append(d.unit).append(")");
        }
        if (body.length() == 0) body.append("Dose");

        String title = doses.size() <= 1
            ? "💊 " + (doses.isEmpty() ? "Dose" : doses.get(0).medName)
            : "💊 " + doses.size() + " doses pendentes";

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body.toString())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body.toString()))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(false)
            .setContentIntent(tapPi);

        NotificationManagerCompat nm = NotificationManagerCompat.from(this);
        try {
            nm.notify(alarmId + NOTIF_ID_OFFSET, b.build());
        } catch (SecurityException ignored) {}
    }

    private void cancelPersistentNotification() {
        NotificationManagerCompat.from(this).cancel(alarmId + NOTIF_ID_OFFSET);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "Doses de Medicação",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Lembretes de doses agendadas");
        ch.enableLights(true);
        ch.enableVibration(true);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private void scheduleSnooze(int minutes) {
        long snoozeAt = System.currentTimeMillis() + minutes * 60 * 1000L;
        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);

        // Re-fire same alarm with same doses payload
        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.putExtra("id", alarmId);
        intent.putExtra("doses", getIntent().getStringExtra("doses"));

        PendingIntent pi = PendingIntent.getBroadcast(
            this, alarmId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(this, AlarmActivity.class);
        PendingIntent showPi = PendingIntent.getActivity(
            this, alarmId, showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        am.setAlarmClock(new AlarmManager.AlarmClockInfo(snoozeAt, showPi), pi);
    }

    @Override
    public void onBackPressed() {
        // Block back — force user to choose Ciente or Adiar
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopSoundAndVibration();
    }
}
