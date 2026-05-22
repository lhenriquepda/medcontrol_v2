package com.dosyapp.dosy.plugins.criticalalarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

import androidx.core.app.NotificationManagerCompat;

import com.dosyapp.dosy.MainActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * AlarmActionReceiver — handles 3 action buttons posted on the live-alarm
 * foreground notification (AlarmService): "Ciente", "Adiar 10min", "Ignorar".
 *
 * Mirrors AlarmActivity.handleAction() so user can resolve alarm directly
 * from the notification shade (without re-opening AlarmActivity).
 *
 * Refactor Fase 2 (Refactor_Full.md §4.4) — v0.2.3.16:
 *   - ACTION_ACK agora chama RPC confirm_dose via HTTP REST por dose. Antes
 *     apenas abria MainActivity esperando user marcar dentro do app —
 *     próximo rescheduleAll reagendava o alarme. Agora server-side commit
 *     persiste status=done; cron/trigger não reagendam.
 *   - ACTION_SNOOZE agora chama RPC snooze_dose (nova, migration
 *     20260520120000) que seta doses.snoozed_until = NOW() + minutos.
 *     Antes só re-agendava local via setAlarmClock; rescheduleAll
 *     subsequente cancelava o snooze. Agora server filtra doses snoozed
 *     do reschedule. Reagendamento local mantido como redundância.
 *   - Ambas chamadas usam padrão goAsync() + Thread + HTTP timeout curto
 *     (1.5s), reusando creds do SharedPreferences dosy_sync_credentials
 *     (mesmo storage do AlarmReceiver pre-check em v0.2.3.13).
 *   - Fallback offline: se HTTP falha, grava intent em SharedPreferences
 *     dosy_pending_actions pro app drenar quando voltar foreground.
 */
public class AlarmActionReceiver extends BroadcastReceiver {

    public static final String ACTION_ACK = "com.dosyapp.dosy.ALARM_ACK";
    public static final String ACTION_SNOOZE = "com.dosyapp.dosy.ALARM_SNOOZE";
    public static final String ACTION_IGNORE = "com.dosyapp.dosy.ALARM_IGNORE";

    private static final int FS_NOTIF_OFFSET = 200_000_000;

    private static final int HTTP_CONNECT_TIMEOUT_MS = 1500;
    private static final int HTTP_READ_TIMEOUT_MS = 1500;

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
            // v0.2.3.16 — server commit confirm_dose por dose ANTES de abrir o app.
            // Mata bug P1 "Ciente não confirma dose" (Refactor_Full.md §1.8).
            final List<String> doseIds = parseDoseIds(dosesJson, doseIdsCsv);
            final String dosesJsonFinal = dosesJson;
            final String doseIdsCsvFinal = doseIdsCsv;
            final int alarmIdFinal = alarmId;
            final PendingResult pendingResult = goAsync();
            new Thread(() -> {
                try {
                    confirmDosesViaRpc(context, doseIds);
                } catch (Exception e) {
                    android.util.Log.w("AlarmActionReceiver", "ACK rpc err: " + e.getMessage());
                    queuePendingAction(context, "confirm", doseIds);
                } finally {
                    // Opens MainActivity even after RPC (UX continuity — user expects app
                    // to open quando toca "Ciente" no card). Modal queue ainda re-marca
                    // mesmo dose se aberto, mas mutation otimista é idempotente (Fase 1
                    // RealtimeGate descarta refetch durante o curto window).
                    try {
                        Intent main = new Intent(context, MainActivity.class);
                        main.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                        if (doseIdsCsvFinal != null && !doseIdsCsvFinal.isEmpty()) {
                            main.putExtra("openDoseIds", doseIdsCsvFinal);
                        }
                        context.startActivity(main);
                    } catch (Exception startErr) {
                        android.util.Log.w("AlarmActionReceiver", "openMain err: " + startErr.getMessage());
                    }
                    pendingResult.finish();
                }
            }, "Dosy-AlarmAck").start();
        } else if (ACTION_SNOOZE.equals(action)) {
            // v0.2.3.16 — server persist snoozed_until ANTES de reagendar local.
            // Mata bug P1 "Snooze não persiste DB".
            final List<String> doseIds = parseDoseIds(dosesJson, doseIdsCsv);
            final String dosesJsonFinal = dosesJson;
            final int alarmIdFinal = alarmId;
            final PendingResult pendingResult = goAsync();
            new Thread(() -> {
                try {
                    snoozeDosesViaRpc(context, doseIds, 10);
                } catch (Exception e) {
                    android.util.Log.w("AlarmActionReceiver", "SNOOZE rpc err: " + e.getMessage());
                    queuePendingAction(context, "snooze", doseIds);
                } finally {
                    // Reagendamento local mantido como redundância — se HTTP RPC falhou
                    // (offline), local-only ainda dispara em 10min. Quando online voltar,
                    // o snoozed_until vai sincronizar via cron/trigger.
                    try {
                        scheduleSnooze(context, alarmIdFinal, dosesJsonFinal, 10);
                    } catch (Exception schErr) {
                        android.util.Log.w("AlarmActionReceiver", "scheduleSnooze err: " + schErr.getMessage());
                    }
                    pendingResult.finish();
                }
            }, "Dosy-AlarmSnooze").start();
        } else if (ACTION_IGNORE.equals(action)) {
            // No-op: alarm dismissed, doses remain pending in DB. User will resolve later from app.
        }
    }

    /**
     * Parse doseIds vindos de dosesJson (array de objetos com doseId) OU
     * doseIdsCsv (string CSV). dosesJson tem precedência.
     */
    private List<String> parseDoseIds(String dosesJson, String doseIdsCsv) {
        List<String> ids = new ArrayList<>();
        if (dosesJson != null && !dosesJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(dosesJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject d = arr.getJSONObject(i);
                    String did = d.optString("doseId", "");
                    if (!did.isEmpty()) ids.add(did);
                }
            } catch (Exception ignored) {}
        }
        if (ids.isEmpty() && doseIdsCsv != null && !doseIdsCsv.isEmpty()) {
            for (String p : doseIdsCsv.split(",")) {
                String t = p.trim();
                if (!t.isEmpty()) ids.add(t);
            }
        }
        return ids;
    }

    /**
     * Confirma cada dose via RPC confirm_dose. Não retorna nada — best-effort.
     * Failures gravam em queuePendingAction pra retry.
     */
    private void confirmDosesViaRpc(Context ctx, List<String> doseIds) {
        if (doseIds.isEmpty()) return;
        String[] creds = loadSupabaseCreds(ctx);
        if (creds == null) {
            queuePendingAction(ctx, "confirm", doseIds);
            return;
        }
        String supabaseUrl = creds[0];
        String anonKey = creds[1];
        String accessToken = creds[2];
        String schema = creds[3];
        String nowIso = nowIso8601();

        for (String doseId : doseIds) {
            JSONObject body = new JSONObject();
            try {
                body.put("p_dose_id", doseId);
                body.put("p_actual_time", nowIso);
                body.put("p_observation", "");
            } catch (Exception ignored) {}
            int code = postRpc(supabaseUrl + "/rest/v1/rpc/confirm_dose",
                anonKey, accessToken, schema, body.toString());
            if (code != 200 && code != 204) {
                android.util.Log.w("AlarmActionReceiver",
                    "confirm_dose HTTP " + code + " dose=" + doseId);
                queuePendingAction(ctx, "confirm", List.of(doseId));
            }
        }
    }

    /**
     * Snooze cada dose via RPC snooze_dose. Best-effort.
     */
    private void snoozeDosesViaRpc(Context ctx, List<String> doseIds, int minutes) {
        if (doseIds.isEmpty()) return;
        String[] creds = loadSupabaseCreds(ctx);
        if (creds == null) {
            queuePendingAction(ctx, "snooze", doseIds);
            return;
        }
        String supabaseUrl = creds[0];
        String anonKey = creds[1];
        String accessToken = creds[2];
        String schema = creds[3];

        for (String doseId : doseIds) {
            JSONObject body = new JSONObject();
            try {
                body.put("p_dose_id", doseId);
                body.put("p_minutes", minutes);
            } catch (Exception ignored) {}
            int code = postRpc(supabaseUrl + "/rest/v1/rpc/snooze_dose",
                anonKey, accessToken, schema, body.toString());
            if (code != 200 && code != 204) {
                android.util.Log.w("AlarmActionReceiver",
                    "snooze_dose HTTP " + code + " dose=" + doseId);
                queuePendingAction(ctx, "snooze", List.of(doseId));
            }
        }
    }

    /**
     * POST genérico pra Supabase RPC. Retorna código HTTP (200/204 = sucesso).
     * Retorna -1 em erro de network/exception.
     */
    private int postRpc(String url, String anonKey, String accessToken,
                        String schema, String bodyJson) {
        HttpURLConnection conn = null;
        try {
            URL u = new URL(url);
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", anonKey);
            String bearer = (accessToken != null && !accessToken.isEmpty()) ? accessToken : anonKey;
            conn.setRequestProperty("Authorization", "Bearer " + bearer);
            conn.setRequestProperty("Content-Profile", schema);
            conn.setRequestProperty("Accept-Profile", schema);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Prefer", "return=minimal");
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bodyJson.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            if (code >= 400) {
                // Drain error stream for log visibility
                try {
                    BufferedReader rd = new BufferedReader(new InputStreamReader(
                        conn.getErrorStream() != null ? conn.getErrorStream() : conn.getInputStream(),
                        StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = rd.readLine()) != null) sb.append(line);
                    android.util.Log.w("AlarmActionReceiver",
                        "RPC " + url + " HTTP " + code + " body=" + sb);
                    rd.close();
                } catch (Exception ignored) {}
            }
            return code;
        } catch (Exception e) {
            android.util.Log.w("AlarmActionReceiver", "postRpc err: " + e.getMessage());
            return -1;
        } finally {
            try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}
        }
    }

    /**
     * Carrega [supabaseUrl, anonKey, accessToken, schema] do SharedPreferences
     * dosy_sync_credentials. Mesmo storage que AlarmReceiver pre-check usa.
     * Retorna null se creds incompletas (sem URL ou anonKey).
     */
    private String[] loadSupabaseCreds(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences("dosy_sync_credentials", Context.MODE_PRIVATE);
        String supabaseUrl = sp.getString("supabase_url", null);
        String anonKey = sp.getString("anon_key", null);
        if (supabaseUrl == null || anonKey == null) return null;
        String accessToken = sp.getString("access_token", null);
        String schema = sp.getString("schema", "medcontrol");
        return new String[]{supabaseUrl, anonKey, accessToken, schema};
    }

    /**
     * Grava ação pendente em SharedPreferences pro app drenar no próximo foreground.
     * Formato: dosy_pending_actions → JSONArray de {kind, doseId, ts}.
     */
    private void queuePendingAction(Context ctx, String kind, List<String> doseIds) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences("dosy_pending_actions", Context.MODE_PRIVATE);
            String existing = sp.getString("queue", "[]");
            JSONArray arr = new JSONArray(existing);
            long now = System.currentTimeMillis();
            for (String did : doseIds) {
                JSONObject o = new JSONObject();
                o.put("kind", kind);
                o.put("doseId", did);
                o.put("ts", now);
                arr.put(o);
            }
            sp.edit().putString("queue", arr.toString()).apply();
        } catch (Exception ignored) {}
    }

    private String nowIso8601() {
        // ISO 8601 UTC: 2026-05-20T12:34:56.789Z
        java.text.SimpleDateFormat sdf =
            new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return sdf.format(new java.util.Date());
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
            // v0.2.3.1 A-03 — persist em SharedPreferences pra sobreviver reboot.
            // v0.2.3.16 — RPC snooze_dose já persistiu snoozed_until no DB; local
            // continua como redundância (BootReceiver lê SharedPrefs sem precisar
            // de rede pra reagendar pós-boot).
            try {
                JSONArray doses = new JSONArray(dosesJson != null ? dosesJson : "[]");
                AlarmScheduler.persistSnoozedAlarm(context, alarmId, snoozeAt, doses);
            } catch (Exception persistErr) {
                android.util.Log.w("AlarmActionReceiver", "persistSnoozedAlarm error: " + persistErr.getMessage());
            }
        } catch (SecurityException ignored) {}
    }
}
