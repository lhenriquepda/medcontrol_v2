package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.animation.ValueAnimator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;

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

    // #222 v0.2.3.0 — channel IDs consolidados. Antigos `doses_v2` + NOTIF_ID_OFFSET
    // usados apenas em postPersistentNotification/cancelPersistentNotification —
    // funções removidas (código morto). FS_NOTIF_OFFSET mantido pra cancel notif
    // do AlarmReceiver fallback.
    private static final int FS_NOTIF_OFFSET = 200_000_000;

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
        // Dosy v0.2.0.0 — sunset gradient full screen alarm, glass cards grouped by patient.
        // Source: contexto/claude-design/dosy/project/src/screens/Onboarding.jsx (AlarmFullScreen)
        // Bg gradient TL→BR sunset (#FF3D7F → #FF6B5B → #FFA56B) + 2 absolute ripple circles
        // (radial white glow, scale pulse loop) + content vertical column.
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{ Color.parseColor("#FF3D7F"), Color.parseColor("#FF6B5B"), Color.parseColor("#FFA56B") }
        );

        FrameLayout root = new FrameLayout(this);
        root.setBackground(bg);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // ── Ripple bg circles (decorative pulse) ─────────────────────
        View ripple1 = new View(this);
        GradientDrawable r1Bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{ Color.parseColor("#38FFFFFF"), Color.TRANSPARENT }
        );
        r1Bg.setShape(GradientDrawable.OVAL);
        ripple1.setBackground(r1Bg);
        FrameLayout.LayoutParams r1Lp = new FrameLayout.LayoutParams(dp(360), dp(360));
        r1Lp.gravity = Gravity.TOP | Gravity.END;
        r1Lp.topMargin = dp(40);
        r1Lp.rightMargin = -dp(120);
        root.addView(ripple1, r1Lp);

        View ripple2 = new View(this);
        GradientDrawable r2Bg = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[]{ Color.parseColor("#26FFFFFF"), Color.TRANSPARENT }
        );
        r2Bg.setShape(GradientDrawable.OVAL);
        ripple2.setBackground(r2Bg);
        FrameLayout.LayoutParams r2Lp = new FrameLayout.LayoutParams(dp(320), dp(320));
        r2Lp.gravity = Gravity.BOTTOM | Gravity.START;
        r2Lp.bottomMargin = -dp(120);
        r2Lp.leftMargin = -dp(100);
        root.addView(ripple2, r2Lp);

        // Pulse animations — scale 1.0 → 1.15 ping-pong
        animateRipple(ripple1, 2400, 0);
        animateRipple(ripple2, 2800, 400);

        // ── Content column over ripples ──────────────────────────────
        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));
        root.addView(outer);

        // ── HEADER (fixed top) ───────────────────────────────────────
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(24), dp(46), dp(24), dp(18));

        // Top row: status pill (left) + close button (right)
        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        // Status pill: 🔔 HORA DO REMÉDIO
        LinearLayout statusRow = new LinearLayout(this);
        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable statusBg = new GradientDrawable();
        statusBg.setColor(Color.parseColor("#2EFFFFFF"));
        statusBg.setCornerRadius(dp(20));
        statusBg.setStroke(dp(1), Color.parseColor("#3DFFFFFF"));
        statusRow.setBackground(statusBg);
        statusRow.setPadding(dp(12), dp(6), dp(14), dp(6));

        TextView bell = new TextView(this);
        bell.setText("🔔");
        bell.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        bell.setPadding(0, 0, dp(8), 0);
        statusRow.addView(bell);

        TextView statusText = new TextView(this);
        statusText.setText("HORA DO REMÉDIO");
        statusText.setTextColor(Color.WHITE);
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        statusText.setLetterSpacing(0.08f);
        statusText.setTypeface(null, android.graphics.Typeface.BOLD);
        statusRow.addView(statusText);

        LinearLayout.LayoutParams statusPillLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        topRow.addView(statusRow, statusPillLp);

        // Spacer pushes close to right
        View spacer = new View(this);
        topRow.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        // Close button — circle 34px white-translucent with × glyph
        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.WHITE);
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        closeBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        closeBtn.setGravity(Gravity.CENTER);
        GradientDrawable closeBg = new GradientDrawable();
        closeBg.setShape(GradientDrawable.OVAL);
        closeBg.setColor(Color.parseColor("#2EFFFFFF"));
        closeBtn.setBackground(closeBg);
        closeBtn.setClickable(true);
        closeBtn.setFocusable(true);
        closeBtn.setOnClickListener(v -> handleAction("ignore"));
        LinearLayout.LayoutParams closeLp = new LinearLayout.LayoutParams(dp(34), dp(34));
        topRow.addView(closeBtn, closeLp);

        LinearLayout.LayoutParams topRowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        topRowLp.setMargins(0, 0, 0, dp(10));
        header.addView(topRow, topRowLp);

        // Big clock row (now HH:mm) + right-side "PREVISTO"
        SimpleDateFormat hhmm = new SimpleDateFormat("HH:mm", new Locale("pt", "BR"));
        String nowStr = hhmm.format(new Date());

        LinearLayout clockRow = new LinearLayout(this);
        clockRow.setOrientation(LinearLayout.HORIZONTAL);
        clockRow.setGravity(Gravity.BOTTOM);

        TextView clock = new TextView(this);
        clock.setText(nowStr);
        clock.setTextColor(Color.WHITE);
        clock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 64);
        clock.setTypeface(null, android.graphics.Typeface.BOLD);
        clock.setLetterSpacing(-0.04f);
        clock.setShadowLayer(20f, 0f, 6f, Color.parseColor("#26000000"));
        LinearLayout.LayoutParams clockLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        clockRow.addView(clock, clockLp);

        // Find first scheduled time across doses → "Previsto"
        String alarmTimeStr = "—";
        for (DoseItem d : doses) {
            if (d.scheduledAt != null && !d.scheduledAt.isEmpty()) {
                try {
                    long t = java.time.Instant.parse(d.scheduledAt).toEpochMilli();
                    alarmTimeStr = hhmm.format(new Date(t));
                    break;
                } catch (Exception ignored) {}
            }
        }

        LinearLayout previstoCol = new LinearLayout(this);
        previstoCol.setOrientation(LinearLayout.VERTICAL);
        previstoCol.setGravity(Gravity.END);

        TextView previstoLbl = new TextView(this);
        previstoLbl.setText("PREVISTO");
        previstoLbl.setTextColor(Color.parseColor("#D9FFFFFF"));
        previstoLbl.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        previstoLbl.setLetterSpacing(0.08f);
        previstoLbl.setTypeface(null, android.graphics.Typeface.BOLD);
        previstoCol.addView(previstoLbl);

        TextView previstoVal = new TextView(this);
        previstoVal.setText(alarmTimeStr);
        previstoVal.setTextColor(Color.WHITE);
        previstoVal.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        previstoVal.setTypeface(null, android.graphics.Typeface.BOLD);
        previstoVal.setLetterSpacing(-0.02f);
        previstoVal.setPadding(0, dp(2), 0, 0);
        previstoCol.addView(previstoVal);

        clockRow.addView(previstoCol);
        header.addView(clockRow);

        // Subtitle: "{N} dose(s) pra agora · {M} pessoa(s)"
        Map<String, List<DoseItem>> grouped = groupByPatient();
        TextView subtitle = new TextView(this);
        int totalDoses = doses.size();
        int totalPeople = grouped.size();
        subtitle.setText(
            totalDoses + " dose" + (totalDoses == 1 ? "" : "s")
            + " pra agora · " + totalPeople + " pessoa" + (totalPeople == 1 ? "" : "s")
        );
        subtitle.setTextColor(Color.parseColor("#F2FFFFFF"));
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        subtitle.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subLp.setMargins(0, dp(10), 0, 0);
        header.addView(subtitle, subLp);

        outer.addView(header, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        // ── SCROLLABLE DOSE LIST grouped by patient ──────────────────
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        );
        outer.addView(scroll, scrollLp);

        LinearLayout cardList = new LinearLayout(this);
        cardList.setOrientation(LinearLayout.VERTICAL);
        cardList.setPadding(dp(24), dp(4), dp(24), dp(16));
        scroll.addView(cardList);

        boolean firstGroup = true;
        for (Map.Entry<String, List<DoseItem>> entry : grouped.entrySet()) {
            String patientName = entry.getKey();
            List<DoseItem> patientDoses = entry.getValue();

            // Section spacing
            LinearLayout section = new LinearLayout(this);
            section.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams sectionLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            );
            sectionLp.setMargins(0, firstGroup ? dp(4) : dp(18), 0, 0);
            section.setLayoutParams(sectionLp);
            firstGroup = false;

            // Patient header (avatar circle + name + count)
            LinearLayout patHeader = new LinearLayout(this);
            patHeader.setOrientation(LinearLayout.HORIZONTAL);
            patHeader.setGravity(Gravity.CENTER_VERTICAL);
            patHeader.setPadding(dp(4), 0, dp(4), dp(10));

            TextView avatar = new TextView(this);
            avatar.setText(patientInitial(patientName));
            avatar.setTextColor(Color.WHITE);
            avatar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            avatar.setTypeface(null, android.graphics.Typeface.BOLD);
            avatar.setGravity(Gravity.CENTER);
            GradientDrawable avBg = new GradientDrawable();
            avBg.setShape(GradientDrawable.OVAL);
            avBg.setColor(Color.parseColor("#2EFFFFFF"));
            avBg.setStroke(dp(1), Color.parseColor("#59FFFFFF"));
            avatar.setBackground(avBg);
            LinearLayout.LayoutParams avLp = new LinearLayout.LayoutParams(dp(32), dp(32));
            avLp.setMarginEnd(dp(10));
            patHeader.addView(avatar, avLp);

            LinearLayout patTextCol = new LinearLayout(this);
            patTextCol.setOrientation(LinearLayout.VERTICAL);
            LinearLayout.LayoutParams patTextLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
            );
            patTextCol.setLayoutParams(patTextLp);

            TextView patName = new TextView(this);
            patName.setText(patientName);
            patName.setTextColor(Color.WHITE);
            patName.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
            patName.setTypeface(null, android.graphics.Typeface.BOLD);
            patName.setLetterSpacing(-0.02f);
            patTextCol.addView(patName);

            TextView patCount = new TextView(this);
            int n = patientDoses.size();
            patCount.setText(n + " dose" + (n == 1 ? "" : "s"));
            patCount.setTextColor(Color.parseColor("#D9FFFFFF"));
            patCount.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            patCount.setTypeface(null, android.graphics.Typeface.NORMAL);
            patTextCol.addView(patCount);

            patHeader.addView(patTextCol);
            section.addView(patHeader);

            // Dose rows for this patient (glass cards)
            for (DoseItem d : patientDoses) {
                LinearLayout card = new LinearLayout(this);
                card.setOrientation(LinearLayout.HORIZONTAL);
                card.setGravity(Gravity.CENTER_VERTICAL);

                GradientDrawable cardBg = new GradientDrawable();
                cardBg.setColor(Color.parseColor("#2EFFFFFF"));
                cardBg.setCornerRadius(dp(18));
                cardBg.setStroke(dp(1), Color.parseColor("#47FFFFFF"));
                card.setBackground(cardBg);
                card.setPadding(dp(14), dp(13), dp(14), dp(13));

                // White squircle pill icon
                TextView pillIcon = new TextView(this);
                pillIcon.setText("💊");
                pillIcon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
                pillIcon.setGravity(Gravity.CENTER);
                GradientDrawable iconBg = new GradientDrawable();
                iconBg.setColor(Color.WHITE);
                iconBg.setCornerRadius(dp(14));
                pillIcon.setBackground(iconBg);
                LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(dp(42), dp(42));
                iconLp.setMarginEnd(dp(12));
                card.addView(pillIcon, iconLp);

                LinearLayout textCol = new LinearLayout(this);
                textCol.setOrientation(LinearLayout.VERTICAL);
                LinearLayout.LayoutParams textColLp = new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
                );
                textCol.setLayoutParams(textColLp);

                TextView med = new TextView(this);
                med.setText(d.medName);
                med.setTextColor(Color.WHITE);
                med.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                med.setTypeface(null, android.graphics.Typeface.BOLD);
                med.setLetterSpacing(-0.02f);
                textCol.addView(med);

                // Subtitle line: "{unit} · {time}"
                String timeOnly = "";
                if (d.scheduledAt != null && !d.scheduledAt.isEmpty()) {
                    try {
                        long t = java.time.Instant.parse(d.scheduledAt).toEpochMilli();
                        timeOnly = hhmm.format(new Date(t));
                    } catch (Exception ignored) {}
                }
                StringBuilder sub = new StringBuilder();
                if (!d.unit.isEmpty()) sub.append(d.unit);
                if (!timeOnly.isEmpty()) {
                    if (sub.length() > 0) sub.append(" · ");
                    sub.append(timeOnly);
                }
                if (sub.length() > 0) {
                    TextView subV = new TextView(this);
                    subV.setText(sub.toString());
                    subV.setTextColor(Color.parseColor("#EAFFFFFF"));
                    subV.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                    subV.setPadding(0, dp(2), 0, 0);
                    textCol.addView(subV);
                }

                card.addView(textCol);

                LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
                );
                cardLp.setMargins(0, dp(4), 0, dp(4));
                section.addView(card, cardLp);
            }

            cardList.addView(section);
        }

        // ── BOTTOM BUTTON BAR ────────────────────────────────────────
        LinearLayout buttonBar = new LinearLayout(this);
        buttonBar.setOrientation(LinearLayout.VERTICAL);
        buttonBar.setPadding(dp(24), dp(14), dp(24), dp(28));

        // Primary: "✓ Tomei todas (N)" — white solid, sunset text
        GradientDrawable ackBg = new GradientDrawable();
        ackBg.setColor(Color.WHITE);
        ackBg.setCornerRadius(dp(22));

        Button btnAck = new Button(this);
        btnAck.setText(doses.size() <= 1 ? "✓  Ciente" : "✓  Ciente (" + doses.size() + ")");
        btnAck.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        btnAck.setTextColor(Color.parseColor("#FF3D7F"));
        btnAck.setTypeface(null, android.graphics.Typeface.BOLD);
        btnAck.setBackground(ackBg);
        btnAck.setStateListAnimator(null);
        btnAck.setPadding(0, dp(17), 0, dp(17));
        btnAck.setAllCaps(false);
        btnAck.setLetterSpacing(-0.02f);
        btnAck.setOnClickListener(v -> handleAction("acknowledge"));
        LinearLayout.LayoutParams ackLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        buttonBar.addView(btnAck, ackLp);

        // Row: Adiar 10min + Pular (translucent glass)
        LinearLayout secondaryRow = new LinearLayout(this);
        secondaryRow.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams secRowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        secRowLp.setMargins(0, dp(8), 0, 0);
        secondaryRow.setLayoutParams(secRowLp);

        GradientDrawable snoozeBg = new GradientDrawable();
        snoozeBg.setColor(Color.parseColor("#38FFFFFF"));
        snoozeBg.setCornerRadius(dp(18));

        Button btnSnooze = new Button(this);
        btnSnooze.setText("⏰  Adiar 10min");
        btnSnooze.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btnSnooze.setTextColor(Color.WHITE);
        btnSnooze.setTypeface(null, android.graphics.Typeface.BOLD);
        btnSnooze.setBackground(snoozeBg);
        btnSnooze.setStateListAnimator(null);
        btnSnooze.setAllCaps(false);
        btnSnooze.setPadding(0, dp(13), 0, dp(13));
        btnSnooze.setOnClickListener(v -> handleAction("snooze"));
        LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        snoozeLp.setMarginEnd(dp(4));
        secondaryRow.addView(btnSnooze, snoozeLp);

        GradientDrawable ignoreBg = new GradientDrawable();
        ignoreBg.setColor(Color.TRANSPARENT);
        ignoreBg.setCornerRadius(dp(18));
        ignoreBg.setStroke(dp(1), Color.parseColor("#66FFFFFF"));

        Button btnIgnore = new Button(this);
        btnIgnore.setText("Pular");
        btnIgnore.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btnIgnore.setTextColor(Color.WHITE);
        btnIgnore.setTypeface(null, android.graphics.Typeface.BOLD);
        btnIgnore.setBackground(ignoreBg);
        btnIgnore.setStateListAnimator(null);
        btnIgnore.setAllCaps(false);
        btnIgnore.setPadding(0, dp(13), 0, dp(13));
        btnIgnore.setOnClickListener(v -> handleAction("ignore"));
        LinearLayout.LayoutParams ignoreLp = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        ignoreLp.setMarginStart(dp(4));
        secondaryRow.addView(btnIgnore, ignoreLp);

        buttonBar.addView(secondaryRow);

        // Mute toggle (bottom, ghost)
        GradientDrawable muteBg = new GradientDrawable();
        muteBg.setColor(Color.TRANSPARENT);
        muteBg.setCornerRadius(dp(18));

        muteButtonRef = new Button(this);
        muteButtonRef.setText("🔊 Silenciar alarme");
        muteButtonRef.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        muteButtonRef.setTextColor(Color.parseColor("#D9FFFFFF"));
        muteButtonRef.setBackground(muteBg);
        muteButtonRef.setStateListAnimator(null);
        muteButtonRef.setAllCaps(false);
        muteButtonRef.setPadding(0, dp(10), 0, dp(2));
        muteButtonRef.setOnClickListener(v -> toggleMute());
        LinearLayout.LayoutParams muteLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        muteLp.setMargins(0, dp(6), 0, 0);
        buttonBar.addView(muteButtonRef, muteLp);

        outer.addView(buttonBar, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        return root;
    }

    /** Pulse animation: scale 1.0 ↔ 1.15 looped, ping-pong. */
    private void animateRipple(View v, int durationMs, int startDelayMs) {
        ValueAnimator anim = ValueAnimator.ofFloat(1f, 1.15f);
        anim.setDuration(durationMs);
        anim.setStartDelay(startDelayMs);
        anim.setRepeatCount(ValueAnimator.INFINITE);
        anim.setRepeatMode(ValueAnimator.REVERSE);
        anim.setInterpolator(new AccelerateDecelerateInterpolator());
        anim.addUpdateListener(a -> {
            float s = (float) a.getAnimatedValue();
            v.setScaleX(s);
            v.setScaleY(s);
        });
        anim.start();
    }


    /** Group doses by patient name. Preserves insertion order via LinkedHashMap. */
    private Map<String, List<DoseItem>> groupByPatient() {
        Map<String, List<DoseItem>> map = new LinkedHashMap<>();
        for (DoseItem d : doses) {
            String key = (d.patientName == null || d.patientName.isEmpty()) ? "Sem paciente" : d.patientName;
            List<DoseItem> list = map.get(key);
            if (list == null) {
                list = new ArrayList<>();
                map.put(key, list);
            }
            list.add(d);
        }
        return map;
    }

    /** First letter of patient name → avatar fallback (no emoji avatar in native intent payload). */
    private String patientInitial(String name) {
        if (name == null || name.isEmpty()) return "?";
        String trimmed = name.trim();
        if (trimmed.isEmpty()) return "?";
        return trimmed.substring(0, 1).toUpperCase(new Locale("pt", "BR"));
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

    // #222 v0.2.3.0 — startAlarmSound + startVibration REMOVIDAS (código morto):
    // AlarmService.startMediaPlayerLoop + startVibrationLoop são as fontes reais
    // de som + vibração. AlarmActivity é apenas UI.

    private void stopSoundAndVibration() {
        // Stop apenas wakelock; sound + vibration drived por AlarmService.
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
        } else if ("snooze".equals(action)) {
            scheduleSnooze(10);
        }
        // #222 v0.2.3.0 — cancelPersistentNotification removida (código morto):
        // postPersistentNotification nunca era chamada (Service tem própria notif FG).
        // 'ignore' simplesmente dismiss alarme — doses permanecem pending no DB.

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

    // #222 v0.2.3.0 — postPersistentNotification + cancelPersistentNotification +
    // ensureChannel REMOVIDAS (código morto):
    //   - postPersistentNotification NUNCA era chamada
    //   - cancelPersistentNotification chamada em handleAction mas cancelava notif
    //     que nunca foi postada (no-op)
    //   - ensureChannel criava canal `doses_v2` legacy — agora substituído por
    //     `dosy_tray` criado em AlarmScheduler.ensureTrayChannel + channels.js

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
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        // Item #102 — atalho hardware silenciar alarme. Comportamento padrão
        // Android (clock app stock + Samsung): volume up/down silencia alarme
        // tocando, sem dismiss. User ainda precisa Ciente/Adiar/Pular pra
        // resolver. Mantém volume real do device intacto (consume event).
        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP
            || keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (!muted) {
                toggleMute();
            }
            return true; // consume — não passa pra AudioManager
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopSoundAndVibration();
        try { unregisterReceiver(finishReceiver); } catch (Exception ignored) {}
    }
}
