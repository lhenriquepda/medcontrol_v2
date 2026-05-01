package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

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
        String doseId, medName, unit, patientName, scheduledAt;
    }

    private boolean muted = false;

    /** Listens for AlarmActionReceiver finishing this activity when user resolves via notif action. */
    private final BroadcastReceiver finishReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            int incomingId = intent.getIntExtra("id", -1);
            if (incomingId == alarmId || incomingId == -1) {
                stopSoundAndVibration();
                finish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lockscreen (NOT dismiss keyguard) — user vê alarme, decide ação
        // sem desbloquear. Só dismiss keyguard quando user clica "Ciente" → openApp.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
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

        // Service owns sound + vibration + FG notif (with action buttons).
        // Activity is JUST the UI. When user dismisses Activity (swipe / home),
        // service keeps notif alive so user can re-enter via tap or resolve via actions.

        // Register dynamic receiver for "finish from notif action" broadcasts
        try {
            IntentFilter f = new IntentFilter("com.dosyapp.dosy.FINISH_ALARM_ACTIVITY");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(finishReceiver, f, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(finishReceiver, f);
            }
        } catch (Exception ignored) {}
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
                item.scheduledAt = o.optString("scheduledAt", "");
                doses.add(item);
            }
        } catch (Exception ignored) {}
    }

    private Button muteButtonRef;

    private View buildLayout() {
        // Outer container fills screen — gradient bg, vertical column
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{ Color.parseColor("#0d1535"), Color.parseColor("#1a2660") }
        );

        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setBackground(bg);
        outer.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT
        ));

        // ── HEADER (fixed top) ───────────────────────────────────────
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setGravity(Gravity.CENTER_HORIZONTAL);
        header.setPadding(dp(20), dp(28), dp(20), dp(12));

        // ── Branded header ───────────────────────────────────────────
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.dosy_logo_light);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(48)
        );
        logoLp.setMargins(0, 0, 0, dp(4));
        logo.setLayoutParams(logoLp);
        logo.setAdjustViewBounds(true);
        header.addView(logo);

        TextView tagline = new TextView(this);
        tagline.setText("controle de medicação");
        tagline.setTextColor(Color.parseColor("#94A3B8"));
        tagline.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        tagline.setLetterSpacing(0.08f);
        tagline.setAllCaps(true);
        tagline.setGravity(Gravity.CENTER);
        tagline.setPadding(0, 0, 0, dp(28));
        tagline.setPadding(0, 0, 0, dp(16));
        header.addView(tagline);

        // ── Status badge with pulse-style emoji + time ───────────────
        LinearLayout statusRow = new LinearLayout(this);
        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable statusBg = new GradientDrawable();
        statusBg.setColor(Color.parseColor("#33EF4444")); // red w/ alpha
        statusBg.setCornerRadius(dp(20));
        statusRow.setBackground(statusBg);
        statusRow.setPadding(dp(12), dp(6), dp(14), dp(6));

        TextView dot = new TextView(this);
        dot.setText("●");
        dot.setTextColor(Color.parseColor("#EF4444"));
        dot.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        dot.setPadding(0, 0, dp(8), 0);
        statusRow.addView(dot);

        TextView statusText = new TextView(this);
        String now = new SimpleDateFormat("HH:mm", new Locale("pt", "BR")).format(new Date());
        statusText.setText("ALARME · " + now);
        statusText.setTextColor(Color.parseColor("#FCA5A5"));
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        statusText.setLetterSpacing(0.05f);
        statusText.setTypeface(null, android.graphics.Typeface.BOLD);
        statusRow.addView(statusText);

        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        statusLp.setMargins(0, 0, 0, dp(14));
        header.addView(statusRow, statusLp);

        // ── Title ─────────────────────────────────────────────────────
        TextView title = new TextView(this);
        title.setText(doses.size() <= 1 ? "Hora da medicação" : doses.size() + " doses agora");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        header.addView(title);

        outer.addView(header, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // ── SCROLLABLE DOSE LIST (fills available space) ─────────────
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        );
        outer.addView(scroll, scrollLp);

        LinearLayout cardList = new LinearLayout(this);
        cardList.setOrientation(LinearLayout.VERTICAL);
        cardList.setPadding(dp(20), dp(8), dp(20), dp(8));
        scroll.addView(cardList);

        SimpleDateFormat hhmm = new SimpleDateFormat("HH:mm", new Locale("pt", "BR"));

        for (DoseItem d : doses) {
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.HORIZONTAL);
            card.setGravity(Gravity.CENTER_VERTICAL);

            GradientDrawable cardBg = new GradientDrawable();
            cardBg.setColor(Color.parseColor("#1e2750"));
            cardBg.setCornerRadius(dp(16));
            cardBg.setStroke(dp(1), Color.parseColor("#2B3EDF"));
            card.setBackground(cardBg);
            card.setPadding(dp(14), dp(12), dp(14), dp(12));

            // Pill icon
            TextView pillIcon = new TextView(this);
            pillIcon.setText("💊");
            pillIcon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
            pillIcon.setPadding(0, 0, dp(12), 0);
            card.addView(pillIcon);

            LinearLayout textCol = new LinearLayout(this);
            textCol.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
            );
            textCol.setLayoutParams(textColLp);

            // Patient name (top, small caps style)
            TextView patient = new TextView(this);
            patient.setText(d.patientName.isEmpty() ? "Sem paciente" : d.patientName);
            patient.setTextColor(Color.parseColor("#94A3B8"));
            patient.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            patient.setLetterSpacing(0.04f);
            patient.setAllCaps(true);
            textCol.addView(patient);

            // Med name (bold white)
            TextView med = new TextView(this);
            med.setText(d.medName);
            med.setTextColor(Color.WHITE);
            med.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            med.setTypeface(null, android.graphics.Typeface.BOLD);
            med.setPadding(0, dp(2), 0, 0);
            textCol.addView(med);

            // Unit (teal)
            if (!d.unit.isEmpty()) {
                TextView unitV = new TextView(this);
                unitV.setText(d.unit);
                unitV.setTextColor(Color.parseColor("#7DD3FC"));
                unitV.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                unitV.setPadding(0, dp(1), 0, 0);
                textCol.addView(unitV);
            }

            card.addView(textCol);

            // Right-side scheduled time HH:mm
            if (d.scheduledAt != null && !d.scheduledAt.isEmpty()) {
                TextView timeV = new TextView(this);
                try {
                    long t = java.time.Instant.parse(d.scheduledAt).toEpochMilli();
                    timeV.setText(hhmm.format(new Date(t)));
                } catch (Exception e) {
                    timeV.setText("");
                }
                timeV.setTextColor(Color.parseColor("#FBBF24"));
                timeV.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
                timeV.setTypeface(null, android.graphics.Typeface.BOLD);
                timeV.setPadding(dp(8), 0, 0, 0);
                card.addView(timeV);
            }

            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            );
            cardLp.setMargins(0, dp(4), 0, dp(4));
            cardList.addView(card, cardLp);
        }

        // ── BOTTOM BUTTON BAR (fixed) ────────────────────────────────
        LinearLayout buttonBar = new LinearLayout(this);
        buttonBar.setOrientation(LinearLayout.VERTICAL);
        buttonBar.setPadding(dp(20), dp(10), dp(20), dp(20));

        // Top row: Mute + Snooze (side by side)
        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // Mute button (left)
        GradientDrawable muteBg = new GradientDrawable();
        muteBg.setColor(Color.parseColor("#22FFFFFF"));
        muteBg.setCornerRadius(dp(14));
        muteBg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));

        muteButtonRef = new Button(this);
        muteButtonRef.setText("🔊 Silenciar");
        muteButtonRef.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        muteButtonRef.setTextColor(Color.parseColor("#E2E8F0"));
        muteButtonRef.setBackground(muteBg);
        muteButtonRef.setStateListAnimator(null);
        muteButtonRef.setAllCaps(false);
        muteButtonRef.setPadding(0, dp(13), 0, dp(13));
        muteButtonRef.setOnClickListener(v -> toggleMute());
        LinearLayout.LayoutParams muteLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        muteLp.setMarginEnd(dp(6));
        topRow.addView(muteButtonRef, muteLp);

        // Snooze (right)
        GradientDrawable snoozeBg = new GradientDrawable();
        snoozeBg.setColor(Color.parseColor("#22FFFFFF"));
        snoozeBg.setCornerRadius(dp(14));
        snoozeBg.setStroke(dp(1), Color.parseColor("#33FFFFFF"));

        Button btnSnooze = new Button(this);
        btnSnooze.setText("⏰ Adiar 10min");
        btnSnooze.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btnSnooze.setTextColor(Color.parseColor("#E2E8F0"));
        btnSnooze.setBackground(snoozeBg);
        btnSnooze.setStateListAnimator(null);
        btnSnooze.setAllCaps(false);
        btnSnooze.setPadding(0, dp(13), 0, dp(13));
        btnSnooze.setOnClickListener(v -> handleAction("snooze"));
        LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        snoozeLp.setMarginStart(dp(6));
        topRow.addView(btnSnooze, snoozeLp);

        buttonBar.addView(topRow);

        // Secondary "Ignorar" — dismiss sem abrir app, sem snooze
        GradientDrawable ignoreBg = new GradientDrawable();
        ignoreBg.setColor(Color.parseColor("#11FFFFFF"));
        ignoreBg.setCornerRadius(dp(14));
        ignoreBg.setStroke(dp(1), Color.parseColor("#22FFFFFF"));

        Button btnIgnore = new Button(this);
        btnIgnore.setText("Ignorar (já vi)");
        btnIgnore.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btnIgnore.setTextColor(Color.parseColor("#94A3B8"));
        btnIgnore.setBackground(ignoreBg);
        btnIgnore.setStateListAnimator(null);
        btnIgnore.setAllCaps(false);
        btnIgnore.setPadding(0, dp(12), 0, dp(12));
        btnIgnore.setOnClickListener(v -> handleAction("ignore"));
        LinearLayout.LayoutParams ignoreLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        ignoreLp.setMargins(0, dp(10), 0, 0);
        buttonBar.addView(btnIgnore, ignoreLp);

        // Primary button: Ciente
        GradientDrawable ackBg = new GradientDrawable();
        ackBg.setColor(Color.parseColor("#10B981"));
        ackBg.setCornerRadius(dp(16));

        Button btnAck = new Button(this);
        btnAck.setText(doses.size() <= 1 ? "✓  Ciente" : "✓  Marcar doses");
        btnAck.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        btnAck.setTextColor(Color.WHITE);
        btnAck.setTypeface(null, android.graphics.Typeface.BOLD);
        btnAck.setBackground(ackBg);
        btnAck.setStateListAnimator(null);
        btnAck.setPadding(0, dp(18), 0, dp(18));
        btnAck.setAllCaps(false);
        btnAck.setOnClickListener(v -> handleAction("acknowledge"));
        LinearLayout.LayoutParams ackLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        ackLp.setMargins(0, dp(10), 0, 0);
        buttonBar.addView(btnAck, ackLp);

        outer.addView(buttonBar, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        return outer;
    }

    /** Toggle alarme sound + vibration via service control intent. */
    private void toggleMute() {
        muted = !muted;
        Intent svc = new Intent(this, AlarmService.class);
        svc.setAction(muted ? AlarmService.ACTION_MUTE : AlarmService.ACTION_UNMUTE);
        try { startService(svc); } catch (Exception ignored) {}
        if (muteButtonRef != null) {
            muteButtonRef.setText(muted ? "🔇 Som off — tocar" : "🔊 Silenciar");
        }
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
        // Stop service-driven sound + FG notif
        AlarmService.stopActiveAlarm(this);
        stopSoundAndVibration();

        if ("acknowledge".equals(action)) {
            // Open MainActivity directly with doseIds → opens modal queue
            openAppWithDoseIds();
            cancelPersistentNotification();
        } else if ("snooze".equals(action)) {
            cancelPersistentNotification();
            scheduleSnooze(10);
        } else if ("ignore".equals(action)) {
            // Dismiss alarm without opening app, without snooze. User saw it, will deal later.
            cancelPersistentNotification();
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
        // User clicked Ciente → wants to interact with app. Now dismiss keyguard
        // (prompts unlock if secure) before launching MainActivity.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                try { km.requestDismissKeyguard(this, null); } catch (Exception ignored) {}
            }
        }
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
        try { unregisterReceiver(finishReceiver); } catch (Exception ignored) {}
    }
}
