package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;
import com.dosyapp.dosy.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * #215 v0.2.3.0 — TrayNotificationReceiver.
 *
 * Dispara LocalNotification tray no horário agendado por AlarmManager.setExactAndAllowWhileIdle.
 * Usado por:
 *   - Branch PUSH_CRITICAL_OFF: tray normal (canal dosy_tray, sound default)
 *   - Branch PUSH_DND: tray silencioso vibração leve (canal dosy_tray_dnd)
 *   - Branch ALARM_PLUS_PUSH: backup co-agendado (canal dosy_tray) — AlarmReceiver
 *     cancela via NotificationManagerCompat.cancel ao disparar alarme nativo OK
 *
 * Sobrevive reboot via BootReceiver (que re-agenda os PendingIntents persistidos).
 * (TODO: BootReceiver atual só re-agenda alarme nativo; expandir pra tray também em
 * release seguinte. Hoje, tray notif perde-se em reboot — mas próximo Cenário 03a
 * WorkManager 6h reagenda em <6h. Trade-off aceitável.)
 */
public class TrayNotificationReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int notifId = intent.getIntExtra("notifId", 0);
        String dosesJson = intent.getStringExtra("doses");
        String channelId = intent.getStringExtra("channelId");
        if (channelId == null) channelId = AlarmScheduler.TRAY_CHANNEL_ID;
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

        // Tap → MainActivity com openDoseIds → abre DoseModal queue
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        if (idsCsv.length() > 0) tapIntent.putExtra("openDoseIds", idsCsv.toString());

        PendingIntent tapPi = PendingIntent.getActivity(
            context,
            notifId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = count <= 1
            ? "Dosy 💊 — " + firstMed
            : "💊 " + count + " doses agora";

        // Importance set per channel; aqui usa PRIORITY_HIGH default. Canal dosy_tray_dnd
        // tem importance IMPORTANCE_DEFAULT (sem heads-up) — Android respeita channel-level
        // override em Android 8+.
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_dosy)
            .setColor(0xFFFF6B5B)
            .setContentTitle(title)
            .setContentText(bodyBuilder.toString())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bodyBuilder.toString()))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(true)
            .setContentIntent(tapPi);

        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        try {
            nm.notify(notifId, b.build());
        } catch (SecurityException ignored) {}
    }
}
